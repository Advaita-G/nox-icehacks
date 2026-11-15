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

## Independent review and Stop fix — November 15 morning Pacific

Juwon's Claude confirmed that its existing **10-minute** check watches [team issue #25](https://github.com/Advaita-G/nox/issues/25#issuecomment-6890825235), then delivered an [independent verdict](https://github.com/Advaita-G/nox/issues/25#issuecomment-6890916878). [Copied raw DOM/permission results](independent-review.json) cover desktop, phone/reduced motion, Save/reload, microphone denial and unavailable speech. Physical microphone/TTS and new paper-camera acceptance still require Juwon personally; neither agent has an authorised background Devpost session.

The reviewer reproduced a real defect: Stop during a pending local demonstration cancelled work but left the assistant in `thinking`, with Stop visible and the roll active. Its one-line fix explicitly resets the panel to idle after cancellation. The portable commit is applied with Juwon's authorship preserved at **`d1ed836975c370c29a47c180882e53ebc49ff231`**. Physics, timing guards, schemas and provider behavior are unchanged. Root **251/251** and typecheck/build pass. [Test log](stop-root-tests.txt) · [Build log](stop-build.txt) · [Touched source hashes](stop-source-sha256.json).

Codex independently reproduced the old state on desktop and reduced-motion phone; the old 320 px setup did not reach the tested pending state ([before receipt](stop-before.json)). With the fix, Stop itself passed at all three sizes, but the initial expanded recovery run timed out at 320 px after Stop ([initial after receipt](stop-after.json)). A targeted 320 px diagnostic passed ([diagnostic](stop-narrow-diagnostic.json)); no causal repair for that transient recovery timeout is claimed. The final unchanged-source matrix passed **3/3** at 1280×800, 375×667 reduced motion and 320×640: pending request → actual Stop → idle/readable label/hidden Stop/no roll → fixed clock → next local request running beyond 0.25 s, with zero inference, page errors or capture ([final receipt](stop-final.json)). Earlier failure remains retained; this is bounded regression acceptance, not universal device reliability.

Reproduce on the development Mac with its existing Python/Playwright/Chromium installation (ANGLE Metal) and a built app served locally:

```sh
python3 scripts/check-room-stop.py http://127.0.0.1:4173 /tmp/nox-stop.json
```

The helper uses isolated headless browsers, blocks interpretation/command endpoints and exits nonzero on any failed case. It neither accesses a personal profile nor captures media.

**Updated pinned candidate:** https://nox-icehacks-9azrftvy7-idk-41a8.vercel.app — deployed repository `68dac2c`, application `d1ed836`, deployment `dpl_GdmHeFsWikgHyN8yTbLPm2GB1Tkg`. [Deployed Stop/recovery matrix](stop-deployed.json) passed **3/3** using the same assertions and zero inference. [Downloaded main JavaScript/CSS](stop-deployed-http.json) match the checked build byte-for-byte; anonymous status remains access-gated. [Stable alias proof](stop-stable-alias.json) confirms production remains on `dpl_Hg5bT9m2FLNmGgMUDxSV4u7a1dWU`. The earlier `21iqfx6kz` preview above is historical and predates the Stop fix. The current input suite also passed **110/110** ([log](stop-input-tests.txt)). No new model/device/account acceptance is claimed.

**Later ownership update:** Advaita explicitly [delegated Cloudflare capacity/fresh vision and HyperFrames/YouTube to Juwon's Claude](https://github.com/Advaita-G/nox/issues/25#issuecomment-6896868979). Separately verified available free/already funded capacity may be used before the exhausted deployed account's 4 PM reset, with $0 personal spend and no overage. Capacity and new-task pickup remain unconfirmed; Codex holds inference until explicit handback. The earlier no-call receipts and their results are unchanged. This assignment establishes neither a successful new runtime nor a new YouTube upload.
