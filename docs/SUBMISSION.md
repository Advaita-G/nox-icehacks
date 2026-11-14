# Nox

**Turn a paper drawing into a real 3D physics experiment, then change it by talking.**

## Inspiration

We wanted to test a rough physical idea without rebuilding it through a long series of controls. A drawing should be enough to start a conversation about what moves, what connects and what happens when a variable changes.

## What it does

Take a photo of a paper mechanism or upload a drawing. Nox prepares the image and starts checking it automatically. The normalized source stays visible while the assistant reports its actual progress. A valid interpretation becomes a 3D model and starts running in the same dark assistant workspace. If the drawing leaves a physical detail unclear, Nox asks about it.

Allow the microphone once to continue by voice, or use the typed fallback. Ask Nox to select a part, move an object or change a property. It explains the proposed physical changes and waits for “yes” before applying an edit. You can pause, reset, retain a baseline, compare measured motion and save the experiment with its source, versions and paused checkpoint.

Photo interpretation and free-form edits use the configured Momen service. Local actions and a clearly identified built-in spring demonstration also run without a model call. That demonstration measures two real five-second runs before and after doubling mass and explains the sampled change in period. Recorded Library experiments are optional examples.

## How we built it

TypeScript and Vite power Nox, Three.js renders the geometry, and Rapier3D advances rigid bodies at 120 fixed steps per second. Server-side model replies become validated scene data and operations. Browser speech supplies reviewed text through the same action pipeline. Earlier actual live interpretation cases used GPT 6 Luna through Momen with participant credits.

Advaita Gupta built physics, measurements, recovery, integration and correctness review. Juwon built sketch/photo intake, interpretation, voice/editor, runtime integration and the assistant interface. Both contributed UX and testing. Codex and Claude Code assisted implementation and review; third-party engines, models and significant AI contributions are credited in the repository.

## Challenges and learning

A plausible model can have a missing support or a joint that starts apart. We made those assumptions inspectable and added validation from actual bad replies. Delayed responses also need source/version identity so cancellation or a new drawing cannot silently edit another experiment.

Retaining comparable starting conditions, sample data and checkpoints made a before/after comparison repeatable through Save/reload. The assistant explains measured results instead of treating an attractive motion as proof.

## Limits and next steps

Nox models rigid mechanics and a declared fan approximation. It does not model fluids, deformation or electricity. Browser speech support varies, and model interpretation can be unavailable, refused or wrong. Results describe the declared simulated setup. Captured-reply tests, built-in demonstrations and actual live-model/device evidence are identified separately.

We want to test more unfamiliar mechanisms and make physical ambiguity easier to resolve through conversation.

Built with TypeScript, Vite, Three.js, Rapier3D, Momen, GPT 6 Luna, browser speech, Codex and Claude Code. Prepared tracks: Best AI Hack and Best Design & UX.
