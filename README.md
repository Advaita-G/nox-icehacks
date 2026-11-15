# Nox

**A voice-first room for building and exploring 3D ideas.** Built for IceHacks 2026 by Advaita Gupta and Juwon.

**Live AI status, November 15 (Pacific):** Momen repaired its upstream model-call service. The existing participant-funded runtime and reviewed metric drawing conversion are now deployed at the main Nox URL. Actual hosted drawing, reviewed model edit, physics and exact Save/reload checks pass. No purchase or paid overage was enabled. [Release evidence and limits](docs/evidence/momen-recovery-2026-11-15/README.md).

Open Nox, tap its name and speak. Ask it to build a scene, add a drawing when you need one, then talk to move objects, change properties, run real physics and retain a comparison. The scene appears in the same room, with Nox docked below it.

## Try it

[Open Nox](https://nox-icehacks.vercel.app) · [Current UI: actual Momen source footage and evidence](https://github.com/Advaita-G/nox-icehacks/releases/tag/momen-recovery-2026-11-15)

The living-assistant UI and metric Momen route are merged in [PR #2](https://github.com/Advaita-G/nox-icehacks/pull/2) and [PR #3](https://github.com/Advaita-G/nox-icehacks/pull/3). Stable application `8cfcc5a`, deployed repository `b36e51f`, has a [pinned deployment](https://nox-icehacks-dt5d0nvdg-idk-41a8.vercel.app); later main commits only update release evidence/docs. Its UI is byte-identical to checked `d1ed836`. The fresh 63-second source take shows that UI with genuine canonical Momen replies, synthetic speech and silent capture; it precedes the metric compiler and is source for the final HyperFrames edit. The [UI evidence](docs/evidence/living-room-review-2026-11-15/README.md) distinguishes real local physics/storage from recorded or synthetic replies. [Devpost field preparation and remaining account checks](docs/SUBMISSION.md#devpost-field-audit--not-part-of-the-story) are tracked separately from a saved or submitted entry.

The [earlier 113-second film](https://github.com/Advaita-G/nox-icehacks/releases/tag/live-review-2026-11-15) shows actual Cloudflare interpretation/edit on source `0784006`, with a continuous 1× main take and recreated speech. The [older 94-second YouTube film](https://youtu.be/9IRrXUZZexE) records an earlier local workflow/provider failure. Both are historical; the new final HyperFrames film/channel upload is pending. Physical microphone/camera acceptance and final human watch/listen review remain pending.

The live path uses Momen with existing IceHacks participant credits. The metric route passed actual hosted image interpretation in 19.078 s and a reviewed model-backed edit in 7.142 s, with real physics and exact source/checkpoint Save/reload. The final smaller command prompt passed separately in 6.921 s. The local assistant and solver also work without inference.

Recognition remains bounded. The earlier Cloudflare case has an inaccurate ball source box and its house case failed; restored Momen's direct canonical output produced disconnected chair legs. The metric compiler removes nested frame arithmetic and places declared supports against actual collision shapes. Its final-adapter chair, house, character and freely hinged lever checks and house/character repeats pass validation and solver execution. Targeted geometry checks verify connected chair members, roof contacts, supplied measurements and aligned hinge anchors; earlier failures remain retained. This generated digital corpus does not establish population accuracy or real camera/microphone acceptance. [Verification](docs/VERIFICATION.md) · [Exact responses, inputs, timings and geometry findings](docs/evidence/momen-recovery-2026-11-15/README.md).

1. Tap **Nox** to begin the conversation. Use **Keyboard** if browser speech is unavailable.
2. Choose **Add drawing** or **Camera**, or drop/paste an image. Nox retains the source and asks the live model to build a rigid 3D representation. Estimated dimensions and materials stay visible as assumptions. Critical questions require an answer; invalid results preserve the previous valid work.
3. Once the scene appears, pause and select a part. Ask for a change, review the proposed edit, then say **“yes, apply”** or **“cancel.”** The live film uses a model-backed initial velocity edit from 0 to 2 m/s.
4. Run the real simulation, keep a baseline, compare versions and **Save**. Saved source, versions and checkpoints can be reopened in this browser. Say **“stop listening”** or use **Stop** to end voice input.

For an optional offline start, say **“Create a ramp and ball.”** This creates fresh local geometry with declared defaults and runs the real solver without a model call. Local numerical edits such as **“double its mass”** still wait for review. Manual edits start a new version from the paused visible state; a version comparison is not automatically a controlled experiment.

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
| Interpretation and edits | Local numerical edits remain reviewed. Model output is validated before automatic photo model/run or reviewed edits; the bounded live case passed validation and reviewed application. Manual canvas previews retain Confirm/Cancel. |
| Physics and rendering | Rapier3D 0.21.0 advances rigid bodies at 120 fixed steps/s. Three.js 0.186.0 renders the same geometry used for collision. |
| Measurement and recovery | Selected-body samples drive plots; baseline, versions, source and checkpoints survive Save/reload and portable export. |

[Architecture](docs/ARCHITECTURE.md) · [Verification and evidence boundaries](docs/VERIFICATION.md)

## What is live, and what is recorded

The ramp-and-ball request creates fresh local scene data and runs the real solver. The spring demonstration also produces new local measurements. Library examples are labelled recorded experiments, with the solver running their saved scenes. None of these is fresh vision inference.

New drawing/photo interpretation and language outside the local command set require a working server-side provider. Stable production uses the restored participant-funded Momen route. Its configured model was not freshly queried, so these new results do not assert a model name. Momen drawings use a metric intermediate plan compiled into the same strictly validated scene, while language edits retain their reviewed canonical contract. Earlier Cloudflare and Momen results remain preserved. Each request has a 120-second deadline, and clarification can require further requests. There is no universal conversion-time or recognition guarantee. Current checks and earlier live evidence are distinguished in [verification](docs/VERIFICATION.md).

Nox models rigid mechanics and a declared fan-airflow approximation. Drawn water, cloth or electrical objects can have explicitly labelled rigid visual proxies; fluid flow, deformation and electricity are not simulated. If such behavior is central to the request, Nox asks about the intended approximation. Invalid geometry, unavailable service and cancelled work remain visible. Results describe the declared setup, not a guarantee about a real object.

## Authors and credits

**Advaita Gupta** — physics workbench, measurements, recovery, integration and correctness review.
**Juwon** — sketch/photo interpretation, voice/editor, runtime integration and assistant interface.
Both contributed UX, testing and release work. Codex and Claude Code assisted implementation/review; Rapier, Three.js and the model services are credited rather than claimed as original engines/models.

[Attribution and provenance](ATTRIBUTION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Copyright status](COPYRIGHT.md)
