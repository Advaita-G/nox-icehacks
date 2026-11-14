import { Workbench } from '../physics/experiments.ts';
import type { SourceAsset } from '../physics/experiments.ts';
import { check } from '../physics/scene.ts';
import type { Scene } from '../physics/scene.ts';

export class Preview {
  readonly scratch: Workbench;
  private readonly context: string;
  private readonly ticks: number;
  readonly original: Workbench;
  constructor(original: Workbench, scene: Scene, source: SourceAsset) {
    this.original = original;
    this.scratch = new Workbench(scene);
    this.scratch.experiment.source = structuredClone(source);
    try { original.capture(); original.pause(); }
    catch (error) { this.scratch.physics.free(); throw error; }
    this.context = original.contextToken; this.ticks = original.physics.ticks;
  }
  confirm(): void {
    check(this.original.contextToken === this.context && this.original.physics.ticks === this.ticks, 'The original experiment changed. Cancel this preview and interpret again.');
    this.original.importLibrary(this.scratch.library);
    this.scratch.physics.free();
  }
  cancel(): void { this.scratch.physics.free(); }
}
