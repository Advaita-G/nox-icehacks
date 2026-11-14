import { describe, expect, it } from 'vitest';
import { checkDecodedSize, checkFileBytes, sniffImageType, uploadSize } from '../src/source/image';
import { example } from './helpers';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));

const HEADERS: Record<string, Uint8Array> = {
  'image/jpeg': bytes([0xff, 0xd8, 0xff, 0xe1], [0, 0, 0, 0, 0, 0, 0, 0]),
  'image/png': bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 0]),
  'image/webp': bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '),
  'image/heic': bytes([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0]),
  'application/pdf': bytes('%PDF-1.7', [0, 0, 0, 0]),
  'text/plain': bytes('hello world, not an image'),
};

describe('sniffImageType', () => {
  it('identifies files by content', () => {
    expect(sniffImageType(HEADERS['image/jpeg']!)).toBe('image/jpeg');
    expect(sniffImageType(HEADERS['image/png']!)).toBe('image/png');
    expect(sniffImageType(HEADERS['image/webp']!)).toBe('image/webp');
    expect(sniffImageType(HEADERS['image/heic']!)).toBe('image/heic');
    expect(sniffImageType(bytes([0, 0, 0, 0x18], 'ftypmif1'))).toBe('image/heic');
    expect(sniffImageType(bytes([0, 0, 0, 0x18], 'ftypavif'))).toBe('image/avif');
    expect(sniffImageType(HEADERS['application/pdf']!)).toBe('application/pdf');
    expect(sniffImageType(HEADERS['text/plain']!)).toBe('unknown');
    expect(sniffImageType(new Uint8Array())).toBe('unknown');
  });
});

describe('E-08 photo intake cases', () => {
  const cases = example('image-input-cases.json').cases as any[];
  for (const c of cases) {
    it(`${c.id} ${c.file}`, () => {
      const header = HEADERS[c.sniffedType] ?? HEADERS['image/jpeg']!;
      let result = checkFileBytes(header, c.bytes ?? 1_000_000);
      if (!result && c.decodedPx) result = checkDecodedSize(c.decodedPx[0], c.decodedPx[1]);
      if (!result && c.id === 'E-08h') result = checkDecodedSize(0, 0); // decode failure
      if (c.expected.accepted) {
        expect(result).toBeNull();
        // EXIF orientation 6 rotates 4032x3024 to 3024x4032 before scaling.
        const [w, h] = c.exifOrientation === 6 ? [c.decodedPx[1], c.decodedPx[0]] : c.decodedPx;
        expect(uploadSize(w, h)).toEqual(c.expected.uploadedPx);
      } else {
        expect(result?.code).toBe(c.expected.code);
        if (c.expected.message) expect(result?.message).toBe(c.expected.message);
      }
    });
  }
  it('never upscales small accepted photos', () => {
    expect(uploadSize(800, 700)).toEqual([800, 700]);
  });
});
