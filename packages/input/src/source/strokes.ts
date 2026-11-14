/** Canvas sketch source with a revision that changes on every edit (R-02, R-06). */

export type Point = [number, number];

export interface Stroke {
  id: string;
  points: Point[];
}

export const CANVAS_SIZE = { widthPx: 1600, heightPx: 900 } as const;
const MAX_POINTS_PER_STROKE = 2000;
const MAX_STROKES = 500;

export class StrokeStore {
  private strokes: Stroke[] = [];
  private nextId = 1;
  revision = 0;

  constructor(readonly sourceId: string) {}

  list(): readonly Stroke[] {
    return this.strokes;
  }

  ids(): Set<string> {
    return new Set(this.strokes.map((s) => s.id));
  }

  /** Add a finished stroke. Points are clamped to the canvas; tiny strokes (taps) are kept as dots. */
  add(points: Point[]): Stroke | null {
    if (points.length === 0 || this.strokes.length >= MAX_STROKES) return null;
    const clamped = points
      .slice(0, MAX_POINTS_PER_STROKE)
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map(([x, y]): Point => [clamp(x, 0, CANVAS_SIZE.widthPx), clamp(y, 0, CANVAS_SIZE.heightPx)]);
    if (clamped.length === 0) return null;
    const stroke = { id: `s${this.nextId++}`, points: clamped };
    this.strokes.push(stroke);
    this.revision++;
    return stroke;
  }

  undo(): Stroke | null {
    const s = this.strokes.pop() ?? null;
    if (s) this.revision++;
    return s;
  }

  clear(): void {
    if (this.strokes.length === 0) return;
    this.strokes = [];
    this.revision++;
  }

  isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  toJSON(): { widthPx: number; heightPx: number; strokes: Stroke[] } {
    return { ...CANVAS_SIZE, strokes: this.strokes.map((s) => ({ id: s.id, points: s.points.map((p) => [round1(p[0]), round1(p[1])] as Point) })) };
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
