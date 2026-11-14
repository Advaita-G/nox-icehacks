# Nox

**A voice-first room for building and exploring 3D ideas.** Built for IceHacks 2026 by Advaita Gupta and Juwon.

Open Nox, tap its name and speak. Ask it to build a scene, add a drawing when you need one, then talk to move objects, change properties, run real physics and retain a comparison. The scene appears in the same room, with Nox docked below it.

## Try it

[Open Nox](https://nox-icehacks.vercel.app)

The hosted local assistant and physics are available. **Hosted vision interpretation is still pending the new Momen runtime connection and live verification.**

1. The room opens with **Nox**. Tap its name once and allow the browser's microphone prompt, then speak naturally between Nox's replies.
2. Say **“Create a ramp and ball.”** Nox creates a fresh local scene with a floor, ramp and ball, declares its physical defaults and starts the real solver. This request uses local code, not an image interpretation or captured model reply.
3. Say **“pause,” “keep a baseline,” “select the ball,”** then **“double its mass.”** Nox explains the proposed edit. Say **“yes, apply”** to commit it or **“cancel”** to discard it.
4. Continue with **“reset,” “run it,” “compare,”** and **“save.”** The model stays in the room while Nox remains available below it. Say **“stop listening”** or use **Stop** to end voice input.

When a drawing is useful, the conversation offers **Camera** and **Add drawing**; you can also drop or paste an image into the room. With a configured live service and private judge access, Nox normalizes the source and starts checking automatically. A validated ready result becomes the running scene; a critical ambiguity produces a question. The vision prompt attempts objects, characters, scenery, abstract forms and mechanisms using declared rigid-body approximations. Estimated scale, depth and mass remain visible assumptions. Failed recognition is reported without substituting a saved scene.

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
| Interpretation and edits | Server-side calls return validated 3D scene data and operations. Ready photo results are confirmed/run automatically; ordinary edits wait for reviewed spoken yes or Apply. Manual canvas previews retain Confirm/Cancel. |
| Physics and rendering | Rapier3D 0.21.0 advances rigid bodies at 120 fixed steps/s. Three.js 0.186.0 renders the same geometry used for collision. |
| Measurement and recovery | Selected-body samples drive plots; baseline, versions, source and checkpoints survive Save/reload and portable export. |

[Architecture](docs/ARCHITECTURE.md) · [Verification and evidence boundaries](docs/VERIFICATION.md)

## What is live, and what is recorded

The ramp-and-ball request creates fresh local scene data and runs the real solver. The spring demonstration also produces new local measurements. Library examples are labelled recorded experiments, with the solver running their saved scenes. None of these is fresh vision inference.

New drawing/photo interpretation and language outside the local command set use a configured server-side provider. A static build alone cannot supply it. Earlier actual live cases used GPT 6 Luna through Momen; the new hosted connection remains pending verification. Each model request has a 120-second deadline, and clarification can require further requests. There is no universal conversion-time or recognition guarantee. Current checks and earlier live evidence are distinguished in [verification](docs/VERIFICATION.md).

Nox models rigid mechanics and a declared fan-airflow approximation. Drawn water, cloth or electrical objects can have explicitly labelled rigid visual proxies; fluid flow, deformation and electricity are not simulated. If such behavior is central to the request, Nox asks about the intended approximation. Invalid geometry, unavailable service and cancelled work remain visible. Results describe the declared setup, not a guarantee about a real object.

## Authors and credits

**Advaita Gupta** — physics workbench, measurements, recovery, integration and correctness review.
**Juwon** — sketch/photo interpretation, voice/editor, runtime integration and assistant interface.
Both contributed UX, testing and release work. Codex and Claude Code assisted implementation/review; Rapier, Three.js and the model services are credited rather than claimed as original engines/models.

[Attribution and provenance](ATTRIBUTION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Copyright status](COPYRIGHT.md)
