# Living room integration review — November 15, 2026 UTC

Review branch: `review/living-nox-integration`, based on main `0ed8c5e`. Juwon's two issue #25 patches are preserved as commits `f7f9808` and `ae0cf7a`. This branch does **not** contain the experimental drawing compiler in [draft PR #1](https://github.com/Advaita-G/nox-icehacks/pull/1).

Nox's period becomes a ball on a line driven by actual voice/request state. Reviewed edits get display-only ghosts, velocity arrows and anchored notes. The actual drawing is briefly printed beneath its model. A throwaway solver warm-up preserves the existing delayed-frame guard. Review fixes reuse ghost materials, separate timeout/animation-frame cleanup, keep long offscreen notes inside the viewport and clear the previous source print on cancellation/new input.

## Observed checks

- **251/251 root tests, 110/110 input tests**, root typecheck and both production builds pass. No dependencies added. The existing large bundle warning remains.
- [Five layout/interaction cases](room-layout.json): 1280×800, 768×900, 375×812, 375×667 normal motion and 320×640 reduced motion. Typed local ramp creation, real solver advancement, anchored review, unchanged state before yes, applied values, cancel cleanup, offscreen note containment and exact IndexedDB Save/reload passed without page errors or horizontal overflow.
- [Sustained local runs](room-sustained.json) remained Running beyond 1.2 solver seconds on desktop and reduced-motion 320 px, then passed the same editing/persistence checks.
- [Desktop and mobile photo workflows](photo-workflows.json) passed actual raster normalization, strict canonical validation, automatic real simulation, reviewed velocity change, explicit yes, edited motion and exact Save/reload. The drawing reply is a captured Gemma reply with only request/source identity mapped. The command and browser speech events are synthetic fixtures. **Zero vendor calls; no fresh recognition, physical microphone/camera or capture.** The summary corrects inherited recorder metadata that called the fixture command model-backed; original private receipt hashes are retained.
- [Checked source hashes](checked-source-sha256.json) identify the reviewed application/test files; logs preserve the local numerical/build results.

The earlier experimental full-flow rendering-startup failure remains in the [audit](../../AUDIT-2026-11-14.md). These later passes concern this separate UI integration source and controlled inputs. They do not establish that warm-up fixes every hardware/browser stall. No guard was relaxed.

## Release boundary

This is a review candidate, not a stable release. Human visual/auditory preference and physical-device behavior remain unverified. All checks were background/headless, using source, DOM, layout measurements and interactions; no audit screenshots were taken. The earlier 113-second published film shows the previous UI.

[Pinned review preview](https://nox-icehacks-21iqfx6kz-idk-41a8.vercel.app), deployed source `10e13041d264d699d442c6308206bca712f66aaf`, deployment `dpl_2XyknuEGo4BcFUPN6bD6bWJCMFyL`. [HTTP/asset check](deployed-http.json) returned 200 and byte-identical main JavaScript/CSS; anonymous API status remains access-gated. [Deployed desktop/reduced-motion mobile checks](deployed-room.json) passed actual local creation, sustained simulation, review/yes/cancel, offscreen annotation and exact Save/reload. Inference routes were blocked and no inference requests occurred. [Stable alias evidence](stable-alias.json) confirms `nox-icehacks.vercel.app` still points to the previous `dpl_Hg5bT9m2FLNmGgMUDxSV4u7a1dWU` deployment. [Draft UI PR #2](https://github.com/Advaita-G/nox-icehacks/pull/2) is unmerged.

The user chose **$0 and wait for the Cloudflare reset at November 15, 4 PM Pacific**. No fresh inference is permitted before that reset; no paid capacity is enabled. Broader recognition fidelity/repeats still fail the separate experimental acceptance gate. Devpost remains unsubmitted and account-browser work remains deferred under the background-only instruction.
