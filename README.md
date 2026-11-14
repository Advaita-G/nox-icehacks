# Nox

**A talking Jarvis for real 3D physics experiments.** Built for IceHacks 2026 by Advaita Gupta and Juwon.

Start with a photo of your paper drawing or upload an image. With the live model service configured, Nox checks it automatically, builds a validated 3D experiment and starts the real solver. Then talk to move parts, change properties, compare measurements and save the result.

## Try it

[Open Nox](https://nox-icehacks.vercel.app)

The hosted local assistant and physics are available. Fresh photo interpretation is awaiting the Momen runtime connection.

1. Choose **Take a photo** to use a phone camera, or **Upload drawing** for an existing image. Nox normalizes the image and automatically starts checking it; the source and real checking state stay visible.
2. A validated scene appears and starts running in the same workspace. There is no required Library, Build or Confirm click for a ready photo result. Missing values can become visible assumptions; genuine ambiguity produces a clarification.
3. Choose **Talk to Nox** and allow microphone access when prompted. You can start talking during checking or after the model appears; typing also works.
4. Tell it what to change: **“Move the cup farther right”** or **“make this part twice as heavy.”** Nox explains the proposed operations. Say **“yes, apply”** to commit them, or **“cancel”** to retain the current experiment.
5. Continue with **“run it,” “pause,” “keep a baseline,” “compare,”** and **“save.”** Nox listens again between replies. Say **“stop listening”** to turn voice off.

The intended photo-to-running-model response is **120–180 seconds**, an aim rather than a measured guarantee. Each model request has a 120-second deadline; image preparation, clarification rounds and service latency affect total time. Fresh drawing recognition and free-form model edits need the configured live Momen service and private judge access. A static build alone cannot interpret a new image. The application reports unavailable service, invalid images and unsupported requests; it does not replace failed recognition with a stored scene.

**Without a model account**, say **“Show me what you can do.”** Nox builds a declared spring example, computes two new solver runs, doubles its mass from the same initial setup, compares measured periods and saves the result. You do not navigate Library or click experiment controls. This is a built-in demonstration, not fresh model inference. Local creation of known examples, numerical edits and simulation controls also work without a model key.

Typing uses the same assistant when speech is unavailable. Spoken input uses the browser’s recognition service and microphone permission; narration uses browser speech synthesis. Denied permission and service failures are reported. Stop remains available during checking. The recent transcript is held only in this page’s memory; **Save** stores the experiment in this browser and **Export** creates a portable backup. Draw, Parts, Measure and the three labelled Library replays remain optional advanced tools.

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
| Sketch/photo and speech | Shared input modules normalize images, retain source identity, transcribe speech and cancel obsolete requests. |
| Interpretation and edits | Server-side calls return validated 3D scene data and operations. Ready photo results are confirmed/run automatically; ordinary edits wait for reviewed spoken yes or Apply. Manual canvas previews retain Confirm/Cancel. |
| Physics and rendering | Rapier3D 0.21.0 advances rigid bodies at 120 fixed steps/s. Three.js 0.186.0 renders the same geometry used for collision. |
| Measurement and recovery | Selected-body samples drive plots; baseline, versions, source and checkpoints survive Save/reload and portable export. |

[Architecture](docs/ARCHITECTURE.md) · [Verification and evidence boundaries](docs/VERIFICATION.md)

## What is live, and what is recorded

Library examples are labelled recorded experiments, with the real solver running their saved scenes. They do not demonstrate a fresh interpretation. New drawing/photo interpretation and ordinary-language model edits use a configured server-side provider; a static build alone does not supply that backend. Recorded live cases used GPT 6 Luna through Momen. Current candidate checks and earlier live evidence are distinguished in [verification](docs/VERIFICATION.md).

Nox models rigid mechanics and a declared fan-airflow approximation. It does not model fluids, deformation or electricity. A model can refuse or propose invalid geometry; the app reports the failure and preserves valid work. Results describe the declared simulated setup, not a guarantee about a real object.

## Authors and credits

**Advaita Gupta** — physics workbench, measurements, recovery, integration and correctness review.
**Juwon** — sketch/photo interpretation, voice/editor, runtime integration and assistant interface.
Both contributed UX, testing and release work. Codex and Claude Code assisted implementation/review; Rapier, Three.js and the model services are credited rather than claimed as original engines/models.

[Attribution and provenance](ATTRIBUTION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Copyright status](COPYRIGHT.md)
