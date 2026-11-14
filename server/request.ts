import { check, keys, number, record, text, validateScene } from '../src/physics/scene.ts';

export function validateRequest(path: string, value: unknown): void {
  record(value); text(value.requestId, 80, 'Request ID'); record(value.target);
  const t = value.target;
  for (const key of ['experimentId', 'versionId', 'sourceId']) text(t[key], 128, key);
  for (const key of ['sceneRevision', 'sourceRevision', 'epoch']) { number(t[key], 0, Number.MAX_SAFE_INTEGER, key); check(Number.isInteger(t[key]), `${key} must be integral.`); }
  if (path === '/api/command') {
    keys(value, ['requestId', 'target', 'transcript', 'selection', 'scene', 'answers']); text(value.transcript, 4000, 'Command');
    const scene = validateScene(value.scene);
    check(Array.isArray(value.selection) && value.selection.length <= 128 && value.selection.every(id => scene.objects.some(o => o.id === id)), 'Invalid selected parts.');
  } else {
    keys(value, ['requestId', 'target', 'source', 'notes', 'answers']); record(value.source); const s = value.source;
    keys(s, ['id', 'revision', 'kind', 'image', 'widthPx', 'heightPx', 'strokes']);
    check(s.id === t.sourceId && s.revision === t.sourceRevision, 'Source differs from request target.');
    check(s.kind === 'canvas' || s.kind === 'photo', 'Unsupported source kind.');
    number(s.widthPx, 1, 1600, 'Image width'); number(s.heightPx, 1, 1600, 'Image height');
    check(typeof s.image === 'string' && s.image.length <= 2_500_000, 'Image exceeds request limit.');
    check(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(s.image), 'Send a normalized PNG or JPEG image.');
    const encoded = s.image.slice(s.image.indexOf(',') + 1), bytes = Buffer.from(encoded, 'base64');
    check(bytes.toString('base64') === encoded && (s.image.startsWith('data:image/png;') ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255), 'Invalid image bytes.');
    if (s.kind === 'canvas') {
      check(Array.isArray(s.strokes) && s.strokes.length > 0 && s.strokes.length <= 500, 'Invalid canvas strokes.'); const ids = new Set();
      for (const stroke of s.strokes) {
        record(stroke); text(stroke.id, 64, 'Stroke ID'); check(!ids.has(stroke.id), 'Duplicate stroke ID.'); ids.add(stroke.id);
        check(Array.isArray(stroke.points) && stroke.points.length > 0 && stroke.points.length <= 2000, 'Invalid stroke points.');
        for (const point of stroke.points) { check(Array.isArray(point) && point.length === 2, 'Invalid stroke point.'); number(point[0], 0, s.widthPx, 'Stroke x'); number(point[1], 0, s.heightPx, 'Stroke y'); }
      }
    }
    check(typeof value.notes === 'string' && value.notes.length <= 4000, 'Notes exceed 4000 characters.');
  }
  check(Array.isArray(value.answers) && value.answers.length <= 40, 'Invalid clarification answers.');
  for (const a of value.answers) { record(a); text(a.question, 500, 'Question'); text(a.answer, 2000, 'Answer'); }
}
