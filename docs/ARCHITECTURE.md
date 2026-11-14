# Architecture

Nox keeps model output, user confirmation and physical execution separate.

1. `packages/input/src/source` captures strokes and normalizes uploaded images; `src/input/ui.ts` retains source revisions, notes and clarification answers. Browser speech supplies reviewed text.
2. `server/middleware.ts` bounds request size/time and chooses server-side providers. `server/momen.ts` and `server/anthropic.ts` implement provider transports. Credentials never enter the scene or client bundle.
3. `src/input/contract.ts` validates proposed canonical 3D scenes and edits, including geometry, units, identity and connection alignment. `src/input/preview.ts` quarantines an unconfirmed scene from the existing experiment.
4. `src/physics` owns scene validation, Rapier execution, version/baseline data, measurements and checkpoint recovery. `src/viewport.ts` renders the physical geometry through Three.js.
5. `src/ui/shell.ts` arranges Draw, Source, Library, Parts, Measure and Voice around one stage. Its decorative transitions follow actual request/listening/preview/run state; they do not drive physics.

Interpretation produces a preview, not an automatically committed experiment. Confirm accepts it; Cancel restores prior work. Language edits produce a readable physical diff and wait for Apply. Source/version changes or cancellation invalidate stale results. Save/reload and export/import retain confirmed work and its source; absent or incompatible checkpoints remain visible recovery states.

The solver uses SI units, a 1/120 s step and sampled output for plots. It supports rigid bodies, compound/convex geometry, fixed/hinge/slider/spherical/rope/spring connections, finite-effort motors, declared forces/drag and a parameterized fan model. This is an approximate rigid-mechanics model with published bounds, not a general physical-world simulator.

See [runtime setup](RUNTIME.md) and [verification](VERIFICATION.md).
