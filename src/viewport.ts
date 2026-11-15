import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { geometryParts } from './physics/geometry.ts';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { BodySample, Sample } from './physics/engine.ts';
import type { Operation, Scene, SceneObject, Vec3 } from './physics/scene.ts';
import type { ProposalMark } from './assistant/proposal.ts';

export const theme = (role: string): string => getComputedStyle(document.documentElement).getPropertyValue(`--color-${role}`).trim();
/** Connection resources survive pose updates so their GPU programs and buffers stay warm. */
export class ConnectionLines extends THREE.Group {
  private signature = '';
  private material?: THREE.LineDashedMaterial;
  update(setup: Scene, sample: Sample, color: string): void {
    const bodies = new Map(sample.bodies.map(body => [body.objectId, body]));
    const connections = setup.constraints.filter(c => bodies.has(c.bodyA) && bodies.has(c.bodyB));
    const signature = JSON.stringify([color, connections.map(c => [c.id, c.type, c.bodyA, c.bodyB])]);
    if (signature !== this.signature) {
      this.dispose();
      if (connections.length) this.material = new THREE.LineDashedMaterial({ color, dashSize: .08, gapSize: .05 });
      for (const _connection of connections) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('lineDistance', new THREE.Float32BufferAttribute(new Float32Array(2), 1).setUsage(THREE.DynamicDrawUsage));
        this.add(new THREE.LineSegments(geometry, this.material!));
      }
      this.signature = signature;
    }
    const anchor = (body: BodySample, local: Vec3) => new THREE.Vector3(local.x, local.y, local.z).applyQuaternion(new THREE.Quaternion(body.rotation.x, body.rotation.y, body.rotation.z, body.rotation.w)).add(new THREE.Vector3(body.position.x, body.position.y, body.position.z));
    connections.forEach((c, index) => {
      const a = anchor(bodies.get(c.bodyA)!, c.anchorA), b = anchor(bodies.get(c.bodyB)!, c.anchorB);
      const geometry = (this.children[index] as THREE.LineSegments).geometry;
      const positions = geometry.getAttribute('position'), distances = geometry.getAttribute('lineDistance');
      positions.setXYZ(0, a.x, a.y, a.z); positions.setXYZ(1, b.x, b.y, b.z); positions.needsUpdate = true;
      distances.setX(0, 0); distances.setX(1, a.distanceTo(b)); distances.needsUpdate = true;
      geometry.computeBoundingSphere();
    });
  }
  dispose(): void {
    for (const line of this.children as THREE.LineSegments[]) line.geometry.dispose();
    this.material?.dispose(); this.material = undefined; this.clear(); this.signature = '';
  }
}

export class Viewport {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, .05, 5000);
  controls: OrbitControls;
  transform: TransformControls;
  objects = new THREE.Group();
  ghosts = new THREE.Group();
  meshes = new Map<string, THREE.Group>();
  raycaster = new THREE.Raycaster();
  signature = '';
  selected = '';
  assemblyId = '';
  links = new ConnectionLines();
  canvas: HTMLCanvasElement;
  /** Display-only conversation layer: proposal ghosts/arrows, the source print and one anchored note. Never physics. */
  proposal = new THREE.Group();
  private note?: { element: HTMLElement; id: string };
  private print?: { mesh: THREE.Mesh; texture: THREE.Texture; started: number; frame?: number };
  private lastSample?: Sample;
  constructor(canvas: HTMLCanvasElement, onSelect: (id: string) => void, onBegin: () => void, onCommit: (operations: Operation[]) => void) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.scene.background = new THREE.Color(theme('viewport')); this.scene.fog = new THREE.Fog(theme('viewport'), 60, 180);
    this.scene.add(new THREE.HemisphereLight(theme('light'), theme('shadow'), 2.5));
    const light = new THREE.DirectionalLight(theme('light'), 3); light.position.set(-8, 16, 9); light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: .5, far: 80 }); light.shadow.normalBias = .02;
    this.scene.add(light, this.objects, this.ghosts, this.links, this.proposal);
    const grid = new THREE.GridHelper(40, 40, theme('grid-axis'), theme('grid')); grid.position.y = -.015; this.scene.add(grid);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = false; this.controls.minDistance = .5; this.controls.maxDistance = 3000; this.controls.maxPolarAngle = Math.PI * .92;
    this.transform = new TransformControls(this.camera, canvas); this.transform.setSize(.8); this.scene.add(this.transform.getHelper());
    this.transform.addEventListener('change', () => this.render());
    this.transform.addEventListener('dragging-changed', event => { this.controls.enabled = !event.value; });
    let startPosition = new THREE.Vector3(), startRotation = new THREE.Quaternion();
    this.transform.addEventListener('mouseDown', () => { const group = this.transform.object; if (group) { startPosition = group.position.clone(); startRotation = group.quaternion.clone(); } onBegin(); });
    this.transform.addEventListener('mouseUp', () => {
      const group = this.transform.object; if (!group) return;
      const id = String(group.userData.id), o = group.userData.setup as SceneObject, q = group.quaternion;
      if (this.assemblyId) {
        const assemblyId = this.assemblyId, rotation = group.quaternion.clone().multiply(startRotation.clone().invert()).normalize(), translation = group.position.clone().sub(startPosition); group.scale.set(1, 1, 1);
        queueMicrotask(() => onCommit([{ type: 'transform-assembly', id: assemblyId, translation: { x: translation.x, y: translation.y, z: translation.z }, rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }, pivot: { x: startPosition.x, y: startPosition.y, z: startPosition.z } }])); return;
      }
      const operations: Operation[] = [{ type: 'move', id, position: { x: group.position.x, y: group.position.y, z: group.position.z } },
        { type: 'rotate', id, rotation: { x: q.x, y: q.y, z: q.z, w: q.w } },
        { type: 'resize', id, width: o.width * group.scale.x, height: o.height * group.scale.y, depth: o.depth * group.scale.z }];
      group.scale.set(1, 1, 1); queueMicrotask(() => onCommit(operations));
    });
    this.camera.position.set(12, 9, 16); this.controls.target.set(0, 2, 0); this.controls.update();
    let down = { x: 0, y: 0 };
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', e => {
      if (this.transform.dragging || this.transform.axis || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = canvas.getBoundingClientRect(); this.raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
      const hit = this.raycaster.intersectObjects(this.objects.children, true).find(hit => hit.object instanceof THREE.Mesh && this.meshes.has(hit.object.userData.id));
      if (hit) onSelect(hit.object.userData.id as string);
    });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); canvas.dispatchEvent(new CustomEvent('viewport-error', { detail: '3D graphics context lost. Save/export your work, then reload.' })); });
    this.controls.addEventListener('change', () => this.render());
  }
  private clear(group: THREE.Group): void {
    group.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(m => m.dispose()); } }); group.clear();
  }
  private mesh(o: SceneObject, ghost = false): THREE.Group {
    const group = new THREE.Group(), material = ghost ? new THREE.MeshBasicMaterial({ color: theme('baseline'), wireframe: true, transparent: true, opacity: .35 })
      : new THREE.MeshStandardMaterial({ color: theme(o.fixed ? 'support' : o.kind === 'ball' ? 'sphere' : o.kind === 'domino' ? 'domino' : 'body'), roughness: .42, metalness: .08 });
    for (const p of geometryParts(o)) {
      const { x: w, y: h, z: d } = p.size;
      const geometry = p.shape === 'sphere' ? new THREE.SphereGeometry(w / 2, ghost ? 12 : 40, ghost ? 8 : 28)
        : p.shape === 'cylinder' ? new THREE.CylinderGeometry(w / 2, w / 2, h, 40)
        : p.shape === 'capsule' ? new THREE.CapsuleGeometry(w / 2, h - w, 8, 32)
        : p.shape === 'convex' ? new ConvexGeometry(p.vertices!.map(v => new THREE.Vector3(v.x, v.y, v.z)))
        : new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geometry, material.clone()); mesh.userData.id = o.id; mesh.position.copy(p.position); mesh.quaternion.copy(p.rotation); mesh.castShadow = !ghost; mesh.receiveShadow = !ghost; group.add(mesh);
      if (!ghost && p.shape !== 'sphere') { const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color: theme('edge'), transparent: true, opacity: .22 })); edges.position.copy(mesh.position); edges.quaternion.copy(mesh.quaternion); group.add(edges); }
      if (!ghost && p.shape === 'sphere') { const ring = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + .001, w * .012, 6, 48), new THREE.MeshStandardMaterial({ color: theme('sphere-mark'), roughness: .5 })); ring.rotation.y = Math.PI / 2; ring.userData.id = o.id; mesh.add(ring); }
    }
    material.dispose(); group.userData.id = o.id; group.userData.setup = o; return group;
  }
  update(setup: Scene, sample: Sample, selected: string, baseline?: { scene: Scene; sample: Sample }): void {
    if (this.transform.dragging) return;
    const signature = JSON.stringify([setup.objects.map(o => [o.id, o.kind, o.fixed, o.width, o.height, o.depth, o.wallThickness, o.geometry]), baseline?.scene]);
    if (signature !== this.signature) {
      this.transform.detach(); this.clear(this.objects); this.clear(this.ghosts); this.links.dispose(); this.meshes.clear(); this.selected = '';
      setup.objects.forEach(o => { const group = this.mesh(o); this.meshes.set(o.id, group); this.objects.add(group); });
      baseline?.scene.objects.forEach(o => this.ghosts.add(this.mesh(o, true))); this.signature = signature;
    }
    this.lastSample = sample;
    if (this.note && !this.meshes.has(this.note.id)) this.clearNote();
    const pose = (group: THREE.Object3D, body: BodySample) => { group.position.copy(body.position); group.quaternion.copy(body.rotation); };
    sample.bodies.forEach(b => { const group = this.meshes.get(b.objectId); if (group) pose(group, b); });
    if (baseline) this.ghosts.children.forEach(group => { const b = baseline.sample.bodies.find(b => b.objectId === group.userData.id); if (b) pose(group, b); });
    if (this.selected !== selected) {
      this.meshes.forEach((group, id) => group.traverse(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) { child.material.emissive.set(id === selected ? theme('selection') : theme('unselected')); child.material.emissiveIntensity = id === selected ? .18 : 0; } })); this.selected = selected;
    }
    const selectedMesh = this.meshes.get(selected);
    if (selectedMesh && this.transform.enabled) {
      if (this.transform.object !== selectedMesh) this.transform.attach(selectedMesh);
    } else if (this.transform.object) this.transform.detach();
    this.links.update(setup, sample, theme('body-edge'));
    this.transform.getHelper().visible = this.transform.enabled;
    this.render();
  }
  /** Name the part Nox is talking about, anchored to it in the room. */
  annotate(id: string, text: string): void {
    if (!this.meshes.has(id) || !text.trim()) { this.clearNote(); return; }
    const host = this.canvas.parentElement!;
    const element = this.note?.element ?? Object.assign(document.createElement('div'), { className: 'scene-note' });
    element.setAttribute('role', 'note'); element.textContent = text; element.dataset.fresh = 'true';
    if (!element.isConnected) host.append(element);
    requestAnimationFrame(() => { delete element.dataset.fresh; });
    this.note = { element, id }; this.render();
  }
  clearNote(): void { this.note?.element.remove(); this.note = undefined; }
  /** Show a reviewed, unapplied change: ghosts at proposed poses/sizes, velocity arrows, and a note on the first part. */
  showProposal(marks: readonly ProposalMark[], text: string): void {
    this.clearProposal();
    const ink = theme('ink') || '#f4f3ee';
    for (const mark of marks) {
      if (mark.kind === 'ghost') {
        const group = this.mesh(mark.object, true);
        group.traverse(child => { if (child instanceof THREE.Mesh) child.material = new THREE.MeshBasicMaterial({ color: ink, wireframe: true, transparent: true, opacity: .45, depthWrite: false }); });
        group.position.set(mark.object.position.x, mark.object.position.y, mark.object.position.z);
        group.quaternion.set(mark.object.rotation.x, mark.object.rotation.y, mark.object.rotation.z, mark.object.rotation.w);
        this.proposal.add(group);
      } else if (mark.kind === 'arrow') {
        const body = this.lastSample?.bodies.find(b => b.objectId === mark.id); if (!body) continue;
        const v = new THREE.Vector3(mark.vector.x, mark.vector.y, mark.vector.z), speed = v.length();
        const length = Math.min(4, Math.max(.6, speed * .5));
        this.proposal.add(new THREE.ArrowHelper(v.normalize(), new THREE.Vector3(body.position.x, body.position.y, body.position.z), length, ink, Math.min(.35, length * .3), Math.min(.2, length * .18)));
      }
    }
    const first = marks[0]; if (first) this.annotate(first.id, text);
    this.render();
  }
  clearProposal(): void {
    this.proposal.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Line) { child.geometry.dispose(); (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose()); } });
    this.proposal.clear(); this.render();
  }
  /** Lay the user's actual drawing on the floor under the model it became, then let it fade (skipped when still). */
  showSourcePrint(image: HTMLCanvasElement | HTMLImageElement, setup: Scene, still: boolean): void {
    this.clearSourcePrint();
    const box = new THREE.Box3();
    for (const o of setup.objects) { const group = this.meshes.get(o.id); if (group && !(o.fixed && o.height <= .2 && o.width > 4)) box.expandByObject(group, true); }
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const aspect = (image.width || 16) / (image.height || 9), width = Math.max(size.x, size.z * aspect, 1) * 1.25;
    const texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .5, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(center.x, Math.max(0, box.min.y) + .004, center.z); mesh.renderOrder = -1;
    this.scene.add(mesh); this.print = { mesh, texture, started: performance.now() };
    const hold = 1800, fade = 1600;
    if (still) { this.print.frame = window.setTimeout(() => this.clearSourcePrint(), hold + fade) as unknown as number; this.render(); return; }
    const step = (now: number) => {
      const print = this.print; if (!print || print.mesh !== mesh) return;
      const t = Math.min(1, Math.max(0, (now - print.started - hold) / fade));
      (mesh.material as THREE.MeshBasicMaterial).opacity = .5 * (1 - t * t);
      this.render();
      if (t < 1) print.frame = requestAnimationFrame(step); else this.clearSourcePrint();
    };
    this.print.frame = requestAnimationFrame(step);
  }
  clearSourcePrint(): void {
    const print = this.print; if (!print) return; this.print = undefined;
    if (print.frame !== undefined) { cancelAnimationFrame(print.frame); clearTimeout(print.frame); }
    this.scene.remove(print.mesh); print.mesh.geometry.dispose(); (print.mesh.material as THREE.Material).dispose(); print.texture.dispose(); this.render();
  }
  fit(setup: Scene): void {
    const box = new THREE.Box3();
    for (const o of setup.objects) {
      const group = this.meshes.get(o.id);
      if (o.id !== 'floor' && !(o.fixed && /\b(?:ground|floor)\b/i.test(o.label)) && group) box.expandByObject(group, true);
    }
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(0, 1, 0), new THREE.Vector3(8, 4, 8));
    const center = box.getCenter(new THREE.Vector3()), radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const vertical = this.camera.fov * Math.PI / 360, horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = Math.max(.5, radius / Math.sin(Math.min(vertical, horizontal)) * 1.1);
    this.controls.target.copy(center); this.camera.position.copy(center).add(new THREE.Vector3(.75, .6, 1).normalize().multiplyScalar(distance)); this.camera.lookAt(center); this.controls.update(); this.render();
  }

  front(): void { const target = this.controls.target; const distance = this.camera.position.distanceTo(target); this.camera.position.copy(target).add(new THREE.Vector3(0, .001, distance)); this.controls.update(); this.render(); }
  focus(position: Vec3): void { const offset = this.camera.position.clone().sub(this.controls.target); this.controls.target.copy(position); this.camera.position.copy(position).add(offset); this.controls.update(); this.render(); }
  render(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    const ratio = this.renderer.getPixelRatio();
    if (this.canvas.width !== Math.floor(w * ratio) || this.canvas.height !== Math.floor(h * ratio)) {
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    this.placeNote(w, h);
  }
  private placeNote(w: number, h: number): void {
    const note = this.note; if (!note) return;
    const group = this.meshes.get(note.id); if (!group) { note.element.hidden = true; return; }
    const top = new THREE.Box3().setFromObject(group), anchor = new THREE.Vector3((top.min.x + top.max.x) / 2, top.max.y, (top.min.z + top.max.z) / 2).project(this.camera);
    // A part outside the view keeps its note at the nearest edge, marked as off-screen, rather than losing it.
    const inFront = anchor.z < 1, inside = inFront && Math.abs(anchor.x) <= 1 && Math.abs(anchor.y) <= 1;
    note.element.hidden = false; note.element.toggleAttribute('data-offscreen', !inside);
    const sx = inFront ? anchor.x : -anchor.x, sy = inFront ? anchor.y : -anchor.y;
    const x = Math.min(w - 24, Math.max(24, (sx + 1) / 2 * w)), y = Math.min(h - 16, Math.max(64, (1 - sy) / 2 * h));
    note.element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
