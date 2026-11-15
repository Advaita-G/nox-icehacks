# Nox

**A voice-first room for building and exploring 3D ideas.** Built for IceHacks 2026 by Advaita Gupta and Juwon.

Open Nox, tap its name and speak. Ask it to build a scene, add a drawing when you need one, then talk to move objects, change properties, run real physics and retain a comparison. The scene appears in the same room, with Nox docked below it.

## Try it

[Open Nox](https://nox-icehacks.vercel.app) · [Watch/download the 113-second live demo, captions and editable source](https://github.com/Advaita-G/nox-icehacks/releases/tag/live-review-2026-11-15)

The live review film shows a real image interpretation and a second real model response, followed by confirmation, simulation and Save/reload. Its main take runs continuously at 1×, including processing waits. Speech input is scripted and audio recreated from the same take's words. Physical microphone/camera acceptance and human watch/listen review remain pending. The [older 94-second YouTube film](https://youtu.be/9IRrXUZZexE) records the earlier local workflow and provider failure; it is historical.

The live path uses Gemma 4 26B A4B directly through Cloudflare Workers AI. One deployed generated-image case passed strict 3D validation, a second model-backed velocity edit, confirmation, real physics and exact source/checkpoint Save/reload. The local assistant and solver also work without inference.

Recognition remains limited: the successful case has an inaccurate ball source box, and a separate unlabelled house drawing failed validation. Two local prompt candidates were discarded after geometry/grounding checks. [Verification](docs/VERIFICATION.md) retains the [actual successful responses](docs/evidence/cloudflare-2026-11-14/live-workflow.json), [generated input](docs/evidence/cloudflare-2026-11-14/generated-input.jpg), failed cases, timings and device-test limits.

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

New drawing/photo interpretation and language outside the local command set require a working server-side provider. The current path uses Gemma 4 26B A4B directly through Cloudflare Workers AI. Earlier participant-funded Momen projects became unstable; their failures are retained and vendor support was contacted. Earlier actual live cases used GPT 6 Luna through Momen. A bounded fresh response does not establish recognition for every image, and captured replies do not establish new recognition. Each request has a 120-second deadline, and clarification can require further requests. There is no universal conversion-time or recognition guarantee. Current checks and earlier live evidence are distinguished in [verification](docs/VERIFICATION.md).

Nox models rigid mechanics and a declared fan-airflow approximation. Drawn water, cloth or electrical objects can have explicitly labelled rigid visual proxies; fluid flow, deformation and electricity are not simulated. If such behavior is central to the request, Nox asks about the intended approximation. Invalid geometry, unavailable service and cancelled work remain visible. Results describe the declared setup, not a guarantee about a real object.

## Authors and credits

**Advaita Gupta** — physics workbench, measurements, recovery, integration and correctness review.
**Juwon** — sketch/photo interpretation, voice/editor, runtime integration and assistant interface.
Both contributed UX, testing and release work. Codex and Claude Code assisted implementation/review; Rapier, Three.js and the model services are credited rather than claimed as original engines/models.

[Attribution and provenance](ATTRIBUTION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Copyright status](COPYRIGHT.md)
