# Nox

**A voice-first room for building and exploring 3D ideas.** Built for IceHacks 2026 by Advaita Gupta and Juwon.

Open Nox, tap its name and speak. Ask it to build a scene, add a drawing when you need one, then talk to move objects, change properties, run real physics and retain a comparison. The scene appears in the same room, with Nox docked below it.

## Try it

[Open Nox](https://nox-icehacks.vercel.app) · [Watch the 94-second core demo](https://youtu.be/9IRrXUZZexE) · [Download the review MP4, captions and editable HyperFrames source](https://github.com/Advaita-G/nox-icehacks/releases/tag/core-review-2026-11-14)

The unlisted video demonstrates the earlier built-in workflow with scripted speech and explicitly labels the blocked image provider. Its anonymous embed metadata was verified; physical-microphone acceptance and human watch/listen review are not claimed.

The local assistant and real physics are available. **Momen is configured and participant-funded, but actual image requests currently fail with an internal “Connection pool shut down” error. Fresh drawing conversion and free-form model edits are not working.** The promoted core release passed eight deployed create/run/review/confirm/Save/reload cases across four sizes and two motion settings. See [verification](docs/VERIFICATION.md) for exact scope and evidence boundaries.

1. The room opens with **Nox**. Tap its name once and allow the browser's microphone prompt, then speak naturally between Nox's replies.
2. Say **“Create a ramp and ball.”** Nox creates a fresh local scene with a floor, ramp and ball, declares its physical defaults and starts the real solver. This request uses local code, not an image interpretation or captured model reply.
3. Say **“pause,” “keep a baseline,” “select the ball,”** then **“double its mass.”** Nox explains the proposed edit. Say **“yes, apply”** to commit it or **“cancel”** to discard it.
4. Continue with **“reset,” “run it,” “compare,”** and **“save.”** A manual edit starts its new version from the paused visible state, so that comparison is not automatically a controlled mass-only experiment. The model stays in the room while Nox remains available below it. Say **“stop listening”** or use **Stop** to end voice input.

When a drawing is useful, the conversation offers **Camera** and **Add drawing**; you can also drop or paste an image into the room. Nox normalizes and retains the source before requesting interpretation. The implemented pipeline validates a ready response before automatic model/run and asks about critical ambiguity. Its prompt requests declared rigid approximations of objects, characters, scenery, abstract forms and mechanisms, with estimated scale, depth and mass preserved as assumptions. Current live requests fail at the provider; the source and last valid experiment are retained instead of substituting a saved scene.

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
| Interpretation and edits | Local numerical edits remain reviewed. Model output is validated before automatic photo model/run or reviewed edits; the current live provider fails before returning scene data. Manual canvas previews retain Confirm/Cancel. |
| Physics and rendering | Rapier3D 0.21.0 advances rigid bodies at 120 fixed steps/s. Three.js 0.186.0 renders the same geometry used for collision. |
| Measurement and recovery | Selected-body samples drive plots; baseline, versions, source and checkpoints survive Save/reload and portable export. |

[Architecture](docs/ARCHITECTURE.md) · [Verification and evidence boundaries](docs/VERIFICATION.md)

## What is live, and what is recorded

The ramp-and-ball request creates fresh local scene data and runs the real solver. The spring demonstration also produces new local measurements. Library examples are labelled recorded experiments, with the solver running their saved scenes. None of these is fresh vision inference.

New drawing/photo interpretation and language outside the local command set require a working server-side provider. The current Momen connection is configured, but actual vision calls fail before returning a usable result. Earlier actual live cases used GPT 6 Luna through Momen; captured replies do not prove current recognition. Each request has a 120-second deadline, and clarification can require further requests. There is no universal conversion-time or recognition guarantee. Current checks and earlier live evidence are distinguished in [verification](docs/VERIFICATION.md).

Nox models rigid mechanics and a declared fan-airflow approximation. Drawn water, cloth or electrical objects can have explicitly labelled rigid visual proxies; fluid flow, deformation and electricity are not simulated. If such behavior is central to the request, Nox asks about the intended approximation. Invalid geometry, unavailable service and cancelled work remain visible. Results describe the declared setup, not a guarantee about a real object.

## Authors and credits

**Advaita Gupta** — physics workbench, measurements, recovery, integration and correctness review.
**Juwon** — sketch/photo interpretation, voice/editor, runtime integration and assistant interface.
Both contributed UX, testing and release work. Codex and Claude Code assisted implementation/review; Rapier, Three.js and the model services are credited rather than claimed as original engines/models.

[Attribution and provenance](ATTRIBUTION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Copyright status](COPYRIGHT.md)
