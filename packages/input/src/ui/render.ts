/** Canvas drawing for the source sketch and the PLACEHOLDER 2D scene preview. Not a physics renderer. */
import type { EditableState, SceneObject } from '../contract/types';
import type { Stroke } from '../source/strokes';

const WORLD_W = 16;
const WORLD_H = 9;

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

export function drawStrokes(canvas: HTMLCanvasElement, strokes: readonly Stroke[], highlight: ReadonlySet<string>, background = true): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (background) {
    ctx.fillStyle = css('--canvas');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    const hot = highlight.has(s.id);
    ctx.strokeStyle = hot ? css('--highlight') : css('--ink');
    ctx.lineWidth = hot ? 9 : 5;
    ctx.beginPath();
    s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (s.points.length === 1) {
      const p = s.points[0]!;
      ctx.lineTo(p[0] + 0.1, p[1]);
    }
    ctx.stroke();
  }
}

/** Export the sketch as a PNG on white, independent of the theme. */
export function exportSketchPng(strokes: readonly Stroke[]): string {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 900;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const s of strokes) {
    ctx.beginPath();
    s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (s.points.length === 1) { const p = s.points[0]!; ctx.lineTo(p[0] + 0.1, p[1]); }
    ctx.stroke();
  }
  return c.toDataURL('image/png');
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = css('--grid');
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.fillStyle = css('--muted');
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('grid: 1 m (100 px)', 12, h - 12);
}

const n = (o: SceneObject, k: string) => (typeof o.dims[k] === 'number' ? (o.dims[k] as number) : 0);

/** Shape outline in object-local metres (centroid at origin). */
function outline(o: SceneObject): [number, number][] {
  switch (o.kind) {
    case 'ramp': {
      const w = n(o, 'width');
      const h = n(o, 'height');
      // Right triangle; facing "right" means the vertical side is on the left.
      return o.dims.facing === 'left'
        ? [[-2 * w / 3, -h / 3], [w / 3, -h / 3], [w / 3, (2 * h) / 3]]
        : [[-w / 3, -h / 3], [(2 * w) / 3, -h / 3], [-w / 3, (2 * h) / 3]];
    }
    case 'container': {
      const iw = n(o, 'innerWidth');
      const ih = n(o, 'innerHeight');
      const t = n(o, 'wallThickness');
      const W = iw + 2 * t;
      const H = ih + t;
      // U shape traced as one polygon.
      return [[-W / 2, H / 2], [-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [W / 2 - t, H / 2], [W / 2 - t, -H / 2 + t], [-W / 2 + t, -H / 2 + t], [-W / 2 + t, H / 2]];
    }
    default: {
      const w = n(o, 'width');
      const h = n(o, 'height');
      return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    }
  }
}

export function drawScene(canvas: HTMLCanvasElement, state: EditableState | null, selected: string | null, highlightIds: ReadonlySet<string>): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = css('--canvas');
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, W, H);
  if (!state) {
    ctx.fillStyle = css('--muted');
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillText('No scene yet — interpret a sketch, load a fixture or add objects.', 60, H / 2);
    return;
  }
  const k = W / WORLD_W; // px per metre
  const toPx = (x: number, y: number): [number, number] => [x * k, H - y * k];
  for (const o of state.scene.objects) {
    const hot = o.id === selected || highlightIds.has(o.id);
    ctx.lineWidth = hot ? 6 : 3;
    ctx.strokeStyle = hot ? css('--highlight') : css('--ink');
    ctx.fillStyle = o.bodyType === 'fixed' ? css('--grid') : 'rgba(31, 95, 209, 0.18)';
    ctx.beginPath();
    if (o.kind === 'ball') {
      const [cx, cy] = toPx(o.x, o.y);
      const r = n(o, 'radius') * k;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(o.angle) * r, cy - Math.sin(o.angle) * r);
      ctx.stroke();
    } else {
      const c = Math.cos(o.angle);
      const s = Math.sin(o.angle);
      outline(o).forEach(([lx, ly], i) => {
        const [px, py] = toPx(o.x + lx * c - ly * s, o.y + lx * s + ly * c);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    const v = o.linearVelocity;
    if (v && (v.vx || v.vy)) {
      const [sx, sy] = toPx(o.x, o.y);
      const [ex, ey] = toPx(o.x + v.vx * 0.4, o.y + v.vy * 0.4);
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.fillStyle = css('--muted');
    ctx.font = '24px system-ui, sans-serif';
    const [lx, ly] = toPx(o.x, o.y);
    ctx.fillText(o.id, lx + 8, ly - 8);
  }
}

/** Nearest object whose rough extent contains the point (preview canvas px). */
export function hitTest(canvas: HTMLCanvasElement, state: EditableState | null, px: number, py: number): string | null {
  if (!state) return null;
  const k = canvas.width / WORLD_W;
  const x = px / k;
  const y = WORLD_H - py / k;
  let best: { id: string; d: number } | null = null;
  for (const o of state.scene.objects) {
    const r = o.kind === 'ball' ? n(o, 'radius') : Math.max(0.15, Math.hypot(n(o, 'width') || n(o, 'innerWidth'), n(o, 'height') || n(o, 'innerHeight')) / 2);
    const d = Math.hypot(o.x - x, o.y - y);
    if (d <= r + 0.1 && (!best || d < best.d)) best = { id: o.id, d };
  }
  return best?.id ?? null;
}
