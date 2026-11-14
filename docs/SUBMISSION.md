# Nox

**Turn rough sketches into editable 3D physics experiments.**

## Inspiration

A sketch captures a physics question quickly, but testing it usually means rebuilding it in another tool. We wanted someone to keep the original drawing, inspect the assumptions behind a physical model, then change one thing and measure the difference.

## What it does

Draw a mechanism or upload a paper sketch. Nox can ask about missing scale, depth and connections, then propose a correctable 3D scene in the same workspace. Confirm it to run real rigid-body mechanics.

Keep a measured baseline, then change the setup by voice or typed language. Nox shows the exact proposed edits and waits for Apply. Plots compare the new motion with the baseline, while Save and portable export retain the source, versions and paused simulation state. Library provides three labelled recorded experiments that run without a model key.

## How we built it

TypeScript and Vite power the app, Three.js renders its geometry, and Rapier3D advances the simulation at 120 fixed steps per second. The recorded live cases used GPT 6 Luna through Momen. Server-side model requests return validated scene data and operations; they do not execute arbitrary generated code. Preview/Confirm and Review/Apply keep the user in control.

Advaita Gupta built physics, measurements, recovery, integration and correctness review. Juwon built sketch/photo interpretation, voice/editor, runtime integration and the assistant interface. Both handled UX, integration and tests. Codex and Claude Code assisted implementation and review; all engines, models and significant AI contributions are credited in the repository.

## Challenges and learning

A plausible scene can have a missing support or a joint that starts apart. We made those assumptions inspectable and added validation using actual bad replies. Keeping measured samples and checkpoints also made comparisons repeatable across Save/reload, rather than relying on how a motion looked.

Recorded experiments show why this matters: moving a cup changes whether a ball lands inside it, and doubling a spring's stiffness changes the cart's measured period from about 0.993 to 0.705 seconds. Corrected recorded scenes are labelled rather than passed off as fresh generation.

## Limits and next steps

Nox models rigid mechanics and a declared fan approximation, not fluids, deformation or electricity. Fresh interpretation and ordinary-language edits depend on a configured model service, and a model can refuse or be wrong. Results describe the declared simulated setup. Our next step is broader testing of unfamiliar mechanisms and clearer guidance when a drawing leaves physical intent uncertain.

Built with TypeScript, Vite, Three.js, Rapier3D, Momen, GPT 6 Luna, browser speech, Codex and Claude Code. Prepared tracks: Best AI Hack and Best Design & UX.
