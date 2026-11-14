/**
 * Photo intake (R-09 image part): content sniffing, limits, orientation, downscale, EXIF removal.
 */

export type SniffedType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/avif'
  | 'image/gif'
  | 'application/pdf'
  | 'unknown';

export type ImageRejectCode =
  | 'UNSUPPORTED_FORMAT'
  | 'HEIC_UNSUPPORTED'
  | 'FILE_TOO_LARGE'
  | 'IMAGE_TOO_SMALL'
  | 'IMAGE_TOO_LARGE'
  | 'DECODE_FAILED';

export interface ImageReject {
  code: ImageRejectCode;
  message: string;
}

export const IMAGE_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  minShortEdgePx: 640,
  maxMegapixels: 40,
  uploadLongEdgePx: 1600,
  jpegQuality: 0.85,
};

export const ACCEPTED_TYPES: readonly SniffedType[] = ['image/jpeg', 'image/png', 'image/webp'];

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));

/** Identify a file from its leading bytes (never from its name or declared MIME type). */
export function sniffImageType(bytes: Uint8Array): SniffedType {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && ascii(bytes, 0, 4) === 'GIF8') return 'image/gif';
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (['avif', 'avis'].includes(brand)) return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return 'unknown';
}

const MESSAGES: Record<ImageRejectCode, string> = {
  UNSUPPORTED_FORMAT: 'Upload a JPEG, PNG or WebP photo.',
  HEIC_UNSUPPORTED: 'This photo is HEIC. Export or share it as JPEG and upload again.',
  FILE_TOO_LARGE: 'Photos must be 10 MB or smaller.',
  IMAGE_TOO_SMALL: 'This photo is too small to read (short edge under 640 px).',
  IMAGE_TOO_LARGE: 'This photo is over 40 megapixels.',
  DECODE_FAILED: 'This photo could not be opened. It may be damaged.',
};

export function reject(code: ImageRejectCode): ImageReject {
  return { code, message: MESSAGES[code] };
}

/** Checks that need only the bytes (before decoding). */
export function checkFileBytes(bytes: Uint8Array, byteLength = bytes.length): ImageReject | null {
  const type = sniffImageType(bytes);
  if (type === 'image/heic') return reject('HEIC_UNSUPPORTED');
  if (!ACCEPTED_TYPES.includes(type)) return reject('UNSUPPORTED_FORMAT');
  if (byteLength > IMAGE_LIMITS.maxBytes) return reject('FILE_TOO_LARGE');
  return null;
}

/** Checks on decoded pixel size (after orientation). */
export function checkDecodedSize(widthPx: number, heightPx: number): ImageReject | null {
  if (!(widthPx > 0 && heightPx > 0)) return reject('DECODE_FAILED');
  if (widthPx * heightPx > IMAGE_LIMITS.maxMegapixels * 1_000_000) return reject('IMAGE_TOO_LARGE');
  if (Math.min(widthPx, heightPx) < IMAGE_LIMITS.minShortEdgePx) return reject('IMAGE_TOO_SMALL');
  return null;
}

/** Target size for upload: long edge at most uploadLongEdgePx, aspect kept, never upscaled. */
export function uploadSize(widthPx: number, heightPx: number): [number, number] {
  const long = Math.max(widthPx, heightPx);
  const k = Math.min(1, IMAGE_LIMITS.uploadLongEdgePx / long);
  return [Math.round(widthPx * k), Math.round(heightPx * k)];
}

export interface PreparedImage {
  blob: Blob;
  widthPx: number;
  heightPx: number;
  bytes: number;
  sha256: string;
  originalType: SniffedType;
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Browser-only: validate, decode with EXIF orientation applied, downscale and re-encode as JPEG.
 * Re-encoding drops EXIF metadata (including location).
 */
export async function prepareImage(file: Blob): Promise<{ ok: true; image: PreparedImage } | { ok: false; reject: ImageReject }> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const early = checkFileBytes(head, file.size);
  if (early) return { ok: false, reject: early };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { ok: false, reject: reject('DECODE_FAILED') };
  }
  try {
    const sizeIssue = checkDecodedSize(bitmap.width, bitmap.height);
    if (sizeIssue) return { ok: false, reject: sizeIssue };
    const [w, h] = uploadSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reject: reject('DECODE_FAILED') };
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_LIMITS.jpegQuality));
    if (!blob) return { ok: false, reject: reject('DECODE_FAILED') };
    const sha256 = await sha256Hex(await blob.arrayBuffer());
    return { ok: true, image: { blob, widthPx: w, heightPx: h, bytes: blob.size, sha256, originalType: sniffImageType(head) } };
  } finally {
    bitmap.close();
  }
}
