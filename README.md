# Nox

**Turn rough sketches into editable 3D physics experiments.** Built for IceHacks 2026 by Advaita Gupta and Juwon.

Draw a mechanism or upload a paper sketch. Nox asks about missing physical details, turns the source into a correctable 3D preview, then runs a real rigid-body simulation. Change it by voice or text, review the exact proposed edit, and compare the new motion with a retained baseline.

## Try it

1. Open **Library**, choose **Ramp and cup**, **Fan and floor friction** or **Spring cart stiffness**, then **Open replay**. These recorded experiments need no model API key.
2. Close Library, select a moving part and use **Run experiment**, **Reset** and **Measure**. The solid plot is the current run; the dashed plot is the retained baseline.
3. Open **Parts** for values and versions, or **Source** for the original drawing. **Save** retains experiments in this browser; **Export** creates a portable backup.
4. For new input, use **Draw** or **Upload photo → Build 3D preview**. Review assumptions and parts, then **Confirm experiment**. Fresh interpretation and free-form language edits require the configured live service and a judge access code. **Unlock live AI** opens access in a separate tab so your drawing is retained. Public recorded experiments and offline editing remain available to everyone.

**Voice** opens speech and typed commands. Check the transcript, choose **Review change**, inspect the before/after values, then **Apply change**. Offline numerical commands such as `set this mass x2` and `gravity -4.9` work without a model. Browser speech requires a supported browser, its speech service and microphone permission.

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
| Interpretation and edits | Server-side provider calls return data; strict validation checks the 3D scene and atomic operations. Preview/Review waits for Confirm/Apply. |
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
