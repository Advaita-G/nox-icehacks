# Nox

**Speak an idea, see it take shape in 3D, and keep changing it with Nox.**

## Inspiration

We wanted a space where trying an idea feels like talking to someone who can build beside you. A rough drawing, an object you describe or a question about motion should lead into the same conversation, without a dashboard of controls becoming the first task.

## What it does

The room opens with Nox. Start a conversation, show a rough drawing with Camera or Add drawing, and let it become a rigid 3D model in the same space. Nox preserves the source, makes estimated dimensions and materials inspectable, and asks about critical ambiguity. A usable model must pass strict validation before the real simulation starts.

Then talk to change it. Nox explains proposed physical edits and waits for “yes” before applying them. Pause, select a part, change its motion or properties, keep a baseline, compare measured versions and save the source, versions and paused checkpoint. Keyboard input is available on demand; optional controls live behind Tools.

The current vision path uses Gemma 4 26B A4B directly through Cloudflare Workers AI. The live review film records a generated annotated JPEG becoming a strict-valid three-body scene in 42.46 seconds, then a second genuine model response proposing initial velocity 0 → 2 m/s in 21.90 seconds. The edit waits for yes; Rapier moves the ball and Save/reload preserves the exact source and checkpoint. The main take is continuous at 1×, including processing waits. Speech is scripted/recreated; this does not establish physical microphone or camera acceptance. The ball's source box is inaccurate.

Broader drawing reliability remains a limitation: a separate unlabelled house response failed strict validation on inconsistent part IDs. Nox retained valid work instead of silently substituting a preset. We do not claim universal recognition or conversion time.

For an optional local start, “Create a ramp and ball” creates fresh declared geometry without inference. “Show me what you can do” computes two real spring runs before and after doubling mass and compares sampled periods. Recorded Library examples remain labelled optional experiments.

## How we built it

TypeScript and Vite power Nox, Three.js renders the geometry, and Rapier3D advances rigid bodies at 120 fixed steps per second. Browser speech and optional keyboard input share an action pipeline. Bounded local requests create fresh scene data; server-side model replies become validated scene data and reviewed operations. The current model uses direct Cloudflare Workers AI hosting of Gemma 4 26B A4B. Earlier actual live interpretation cases used GPT 6 Luna through Momen with participant credits; those later projects became unstable and vendor support was contacted.

Advaita Gupta built physics, measurements, recovery, integration and correctness review. Juwon built sketch/photo intake, interpretation, voice/editor, runtime integration and the assistant interface. Both contributed UX and testing. Codex and Claude Code assisted implementation and review; third-party engines, models and significant AI contributions are credited in the repository.

## Challenges and learning

A plausible model can have a missing support or a joint that starts apart. We made assumptions inspectable and added validation from actual bad replies. Broad drawings also require a distinction between representing a subject and simulating its behavior: a rigid figurine is useful, but it must not be presented as a walking character or a deformable body. Delayed responses need source/version identity so cancellation or a new drawing cannot silently edit another experiment.

The automatic spring demonstration uses comparable starting conditions. Ordinary manual edits begin a new version from the paused visible state, so the recorded ramp speed comparison describes different versions rather than isolating the effect of mass. Samples and checkpoints make the saved result repeatable through reload.

## Limits and next steps

Nox models rigid mechanics and a declared fan approximation. Water, cloth and electrical objects may be represented by explicit rigid visual proxies; fluid flow, deformation and electricity are not simulated. Browser speech support varies, and model interpretation can be unavailable, refused or wrong. Results describe the declared simulated setup. Captured-reply tests, fresh local demonstrations and actual live-model/device evidence are identified separately.

The earlier local core passed eight deployed create/run/review/confirm/Save/reload cases across four viewport sizes and both motion settings, with synthetic speech and real physics/storage. The [113-second live review](https://github.com/Advaita-G/nox-icehacks/releases/tag/live-review-2026-11-15) adds actual image and model-edit evidence with its limits disclosed. An expressive living-assistant redesign is assigned to Juwon and remains in progress. Broader drawings, physical device testing and human review of the final interface and film remain pending. Devpost remains a draft; submission requires the user's explicit approval.

Built with TypeScript, Vite, Three.js, Rapier3D, Cloudflare Workers AI, Gemma 4 26B A4B, Momen, historical GPT 6 Luna, browser speech, Codex and Claude Code. Prepared tracks: Best AI Hack, Best Design & UX and Best Deployed / Shipped App.
