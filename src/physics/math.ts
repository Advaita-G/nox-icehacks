import type { Vec3, Quaternion } from './scene.ts';
export const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
export const IDENTITY: Quaternion = { ...ZERO, w: 1 };
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
export const inverse = (q: Quaternion): Quaternion => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export function product(a: Quaternion, b: Quaternion): Quaternion {
  const v = add(add(mul(b, a.w), mul(a, b.w)), cross(a, b)); return { ...v, w: a.w * b.w - dot(a, b) };
}
export function rotate(q: Quaternion, v: Vec3): Vec3 { const t = mul(cross(q, v), 2); return add(v, add(mul(t, q.w), cross(q, t))); }
export function axisFrame(axis: Vec3): Quaternion {
  if (axis.x < -1 + 1e-12) return { x: 0, y: 1, z: 0, w: 0 };
  const norm = Math.hypot(axis.y, axis.z, 1 + axis.x);
  return { x: 0, y: -axis.z / norm, z: axis.y / norm, w: (1 + axis.x) / norm };
}
