# Architecture

Nox validates model output before physical execution and ties each operation to the current source and experiment.

1. `packages/input/src/source` captures strokes and normalizes uploaded images; `src/input/ui.ts` retains source revisions, notes and clarification answers. Browser speech supplies reviewed text.
2. `server/middleware.ts` bounds request size/time and chooses server-side providers. `server/momen.ts` and `server/anthropic.ts` implement provider transports. Credentials never enter the scene or client bundle.
3. `src/input/contract.ts` validates proposed canonical 3D scenes and edits, including geometry, units, identity and connection alignment. `src/input/preview.ts` quarantines an unconfirmed scene from the existing experiment.
4. `src/physics` owns scene validation, Rapier execution, version/baseline data, measurements and checkpoint recovery. `src/viewport.ts` renders the physical geometry through Three.js.
5. `src/assistant/panel.ts` provides native camera/upload actions, conversation, typed fallback and Stop. `src/assistant/voice.ts` manages recognition/speech; `src/assistant/actions.ts` routes local and model-backed actions. `src/ui/shell.ts` retains optional Draw, Source, Library, Parts and Measure around the same stage. Decorative transitions follow real state and do not drive physics.

A photo selection starts image preparation and interpretation automatically. A ready result passes the existing staged validation, then the assistant confirms it and starts the real solver after the reveal/rendering settles. Manual canvas previews retain Confirm/Cancel. Ordinary language edits produce a readable physical diff and wait for spoken yes or Apply. Source/version changes or cancellation invalidate stale results. Save/reload and export/import retain confirmed work and its source; absent or incompatible checkpoints remain visible recovery states.

The solver uses SI units, a 1/120 s step and sampled output for plots. It supports rigid bodies, compound/convex geometry, fixed/hinge/slider/spherical/rope/spring connections, finite-effort motors, declared forces/drag and a parameterized fan model. This is an approximate rigid-mechanics model with published bounds, not a general physical-world simulator.

See [runtime setup](RUNTIME.md) and [verification](VERIFICATION.md).
