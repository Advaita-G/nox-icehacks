# Nox

**A voice-first room for building and exploring 3D ideas.** Built for IceHacks 2026 by Advaita Gupta and Juwon.

**Live AI status, November 15 (Pacific):** the public link uses the free NVIDIA Nemotron 3.5 Super VL vision model through OpenRouter. No account, code or private launcher is needed. Upload a drawing and Nox builds it automatically, then request ordinary changes without entering dimensions or masses. The server pins the `:free` model with zero price ceilings and no paid fallback. The current account has a finite 50-request daily allowance; free availability is not unlimited. [Automatic upload and direct-edit checks](docs/evidence/automatic-conversation-2026-11-15/README.md) · [Earlier provider evidence and limits](docs/evidence/public-free-ai-2026-11-15/README.md).

Open Nox, tap its name and speak. Upload a drawing; Nox estimates missing physical values, builds it automatically and runs the scene in the same room. Then ask **“Make the ball a bit heavier”**, **“Incline the ramp by 12 degrees”**, or a change to another object. Clear reversible edits apply immediately, with a spoken acknowledgement and a retained version. Say **“undo”** to go back; ambiguous requests get a short question.

## Try it

[Open Nox](https://nox-icehacks.vercel.app) · [Watch the public YouTube demo](https://youtu.be/wTUoFWWepdk) · [Film/captions/source downloads](https://github.com/Advaita-G/nox-icehacks/releases/tag/final-film-2026-11-15)

The living-assistant UI and metric drawing compiler are merged in [PR #2](https://github.com/Advaita-G/nox-icehacks/pull/2) and [PR #3](https://github.com/Advaita-G/nox-icehacks/pull/3). The conversational-flow repair has a [pinned deployment](https://nox-icehacks-dmb6hlt0s-idk-41a8.vercel.app) and [exact source/client receipts](docs/evidence/automatic-conversation-2026-11-15/README.md). The film records earlier UI `d1ed836` with genuine Momen replies and synthetic speech; it precedes the current provider, metric compiler and conversational repair. [Devpost preparation and remaining account checks](docs/SUBMISSION.md#devpost-field-audit--not-part-of-the-story) stay separate from an account save or submission.

The final HyperFrames film is **75.7 seconds**, with genuine Momen and separately labelled local-command footage, cut waits, captions and effects-only sound. Its corrected provenance/end hold and published hashes pass review; full decode passes and the source/caption checksums were reverified after download. It is now [published Public on Pathfind’s YouTube channel](https://youtu.be/wTUoFWWepdk). Physical microphone/camera acceptance and human full watch/listen remain pending. The [earlier 113-second film](https://github.com/Advaita-G/nox-icehacks/releases/tag/live-review-2026-11-15) shows Cloudflare/source `0784006`; the [older 94-second YouTube film](https://youtu.be/9IRrXUZZexE) records a local workflow/provider failure. Both are historical.

The live path uses NVIDIA’s published Nemotron 3.5 Super VL weights under OpenMDW-1.1 through a zero-price hosted endpoint. A clean anonymous session passed actual drawing interpretation, a second AI response proposing a velocity edit, explicit confirmation, real motion and exact source/versions/checkpoint Save/reload. Speech input was synthetic; the model responses, physics and storage were real. Earlier Momen and Cloudflare results remain historical evidence.

Recognition remains bounded. Current generated sphere/plank, chair, house and rigid-character cases passed canonical validation and solver execution; targeted checks verify connected chair members. One lever response claimed a free hinge without providing it. The final English free-pivot guard asks for clarification in that case and rejects a still-missing hinge after an answer, rather than repeating forever or simulating the wrong mechanism. Earlier geometry, capacity and rendering failures remain recorded. Missing depth/detail and unsupported behavior can still require estimates or questions; no population accuracy or physical-device acceptance is claimed. [Actual outcomes and limits](docs/evidence/public-free-ai-2026-11-15/README.md).

1. Tap **Nox** to begin the conversation. Use **Keyboard** if browser speech is unavailable.
2. Choose **Add drawing** or **Camera**, or drop/paste an image. Nox immediately starts building and acknowledges the running model when ready. No second build command, dimension, mass or material form is required. Estimated values stay visible as assumptions. A genuine critical-intent question can still need an answer; invalid results preserve valid work. Free image analysis can take 30–82 seconds in the checked cases; cancel remains available.
3. Ask for a change: **“Make the ball a bit heavier”**, **“Incline the ramp by 12 degrees”**, or an edit to any other named part. Nox applies clear reversible changes and reports the actual result. **“Incline it”** can use a modest stated default or ask **“By how many degrees?”** when needed. Manual selection is optional. **“Undo”** restores the prior version. Removal, scene replacement and mechanism changes still get explicit review.
4. Run the real simulation, keep a baseline, compare versions and **Save**. Saved source, versions and checkpoints can be reopened in this browser. Say **“stop listening”** or use **Stop** to end voice input.

For an optional offline start, say **“Create a ramp and ball”** or **“Can you make a domino effect?”** These create fresh local geometry with declared defaults and run the real solver without a model call. Custom counts, dimensions or arrangements require a reviewed proposal. New drawings and model requests work from the normal public link without entering a code. Clear local numerical edits such as **“double its mass”** also apply directly and retain the prior version. Manual edits start a new version from the paused visible state; a version comparison is not automatically a controlled experiment.

**Keyboard** reveals an optional input box using the same assistant pipeline. Browser speech support and permission vary, and the browser may request permission again in another session. Nox reports speech failures and keeps typing available. **Tools** contains optional drawing, Library, Parts, measurements and workbench controls. The recent conversation stays only in page memory; **Save** stores the experiment in this browser and **Export** creates a portable backup.

For an automatic local comparison, say **“Show me what you can do.”** Nox builds a spring example, computes two new solver runs from comparable starting conditions, doubles the mass, compares sampled periods and saves the experiment. This demonstration makes no model call. The three labelled Library replays remain optional recorded examples.

## Run locally

Use Node.js **22.18 or newer**.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open the localhost URL printed by Vite. The real solver and three recorded experiments run without credentials. For a local production build, run `npm run preview` after building.

The shared input package has its own regression suite:

```sh
npm ci --prefix packages/input
npm test --prefix packages/input
npm run build --prefix packages/input
```

Use the root app for Nox's 3D interface. The standalone input-package UI is a preserved earlier prototype, not another product entry point. [Runtime setup](docs/RUNTIME.md)

## How it works

| Layer | Implementation |
| --- | --- |
| Voice room and drawings | Nox starts the conversation; contextual camera/upload, drop/paste and optional keyboard feed shared input modules that retain source identity. |
| Interpretation and edits | Picture uploads start source-aware interpretation automatically. Metric geometry and model-proposed degree rotations/supports compile to validated physics. Clear reversible edits apply and acknowledge; ambiguous/destructive/mechanism changes retain question/review paths. Versions support local spoken undo. |
| Physics and rendering | Rapier3D 0.21.0 advances rigid bodies at 120 fixed steps/s. Three.js 0.186.0 renders the same geometry used for collision. |
| Measurement and recovery | Selected-body samples drive plots; baseline, versions, source and checkpoints survive Save/reload and portable export. |

[Architecture](docs/ARCHITECTURE.md) · [Verification and evidence boundaries](docs/VERIFICATION.md)

## What is live, and what is recorded

The ramp-and-ball and ordinary domino requests create fresh local scene data and run the real solver. The spring demonstration also produces new local measurements. Library examples are labelled recorded experiments, with the solver running their saved scenes. None of these is fresh vision inference.

New drawing/photo interpretation and language outside the local command set use the free server-side NVIDIA/OpenRouter provider. Images go to the external free service: use drawings without personal or confidential information. Its daily allowance is finite; exhausted capacity must stop or report an error rather than charge money or select a paid fallback. The metric drawing plan compiles into the same strictly validated scene; language edits remain reviewed. Requests have a 120-second deadline and clarification can require further requests. There is no universal conversion-time or recognition guarantee. [Verification](docs/VERIFICATION.md).

Nox models rigid mechanics and a declared fan-airflow approximation. Drawn water, cloth or electrical objects can have explicitly labelled rigid visual proxies; fluid flow, deformation and electricity are not simulated. If such behavior is central to the request, Nox asks about the intended approximation. Invalid geometry, unavailable service and cancelled work remain visible. Results describe the declared setup, not a guarantee about a real object.

## Authors and credits

**Advaita Gupta** — physics workbench, measurements, recovery, integration and correctness review.
**Juwon** — sketch/photo interpretation, voice/editor, runtime integration and assistant interface.
Both contributed UX, testing and release work. Codex and Claude Code assisted implementation/review; Rapier, Three.js and the model services are credited rather than claimed as original engines/models.

[Attribution and provenance](ATTRIBUTION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Copyright status](COPYRIGHT.md)
