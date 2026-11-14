import RAPIER from '@dimforge/rapier3d-compat';
import { check } from './scene.ts';
import type { GeometryPart, SceneObject } from './scene.ts';
import { ZERO, IDENTITY } from './math.ts';

export function geometryParts(o: SceneObject): GeometryPart[] {
  const w = o.width, h = o.height, d = o.depth, t = o.wallThickness;
  const part = (shape: GeometryPart['shape'], x = w, y = h, z = d, px = 0, py = 0, pz = 0): GeometryPart =>
    ({ shape, size: { x, y, z }, position: { x: px, y: py, z: pz }, rotation: { ...IDENTITY } });
  if (o.geometry) return o.geometry.map(p => ({ ...p,
    size: { x: p.size.x * w, y: p.size.y * h, z: p.size.z * d },
    position: { x: p.position.x * w, y: p.position.y * h, z: p.position.z * d },
    vertices: p.vertices?.map(v => ({ x: v.x * p.size.x * w, y: v.y * p.size.y * h, z: v.z * p.size.z * d })),
  }));
  if (o.kind === 'ball') return [part('sphere')];
  if (o.kind === 'cylinder' || o.kind === 'capsule') return [part(o.kind)];
  if (o.kind === 'ramp') return [{ ...part('convex'), vertices: [-d / 2, d / 2].flatMap(z => [{ x: -w / 2, y: -h / 2, z }, { x: w / 2, y: -h / 2, z }, { x: -w / 2, y: h / 2, z }]) }];
  if (o.kind === 'container') return [part('box', w, t, d, 0, -(h - t) / 2),
    ...[-1, 1].flatMap(sign => [part('box', w, h - t, t, 0, t / 2, sign * (d - t) / 2), part('box', t, h - t, d - 2 * t, sign * (w - t) / 2, t / 2)]),
  ];
  return [part('box')];
}

export function colliderParts(o: SceneObject): RAPIER.ColliderDesc[] {
  return geometryParts(o).map(p => {
    const { x: w, y: h, z: d } = p.size;
    const shape = p.shape === 'sphere' ? RAPIER.ColliderDesc.ball(w / 2)
      : p.shape === 'cylinder' ? RAPIER.ColliderDesc.cylinder(h / 2, w / 2)
      : p.shape === 'capsule' ? RAPIER.ColliderDesc.capsule((h - w) / 2, w / 2)
      : p.shape === 'convex' ? RAPIER.ColliderDesc.convexHull(new Float32Array(p.vertices!.flatMap(v => [v.x, v.y, v.z])))
      : RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
    check(shape, `Cannot construct solid geometry for ${o.id}.`);
    return shape.setTranslation(p.position.x, p.position.y, p.position.z).setRotation(p.rotation ?? IDENTITY);
  });
}

export function primitive(shape: GeometryPart['shape'], size = { x: 1, y: 1, z: 1 }): GeometryPart {
  return { shape, size, position: { ...ZERO }, rotation: { ...IDENTITY } };
}
