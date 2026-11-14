# Nox

**Speak an idea, see it take shape in 3D, and keep changing it with Nox.**

## Inspiration

We wanted a space where trying an idea feels like talking to someone who can build beside you. A rough drawing, an object you describe or a question about motion should lead into the same conversation, without a dashboard of controls becoming the first task.

## What it does

The room opens with Nox. Tap its name once for the browser's microphone consent, then speak naturally. Say “Create a ramp and ball” and Nox creates a fresh local floor, ramp and ball using declared physical defaults, then starts the real simulation. The scene occupies the same room while Nox docks below it, ready for the next request. This local creation uses neither a model call nor a captured reply.

Ask Nox to select a part, move it or change a property. It explains proposed physical changes and waits for “yes” before applying a normal edit. You can pause, reset, keep a baseline, compare measured motion and save the experiment with its source, versions and paused checkpoint. Keyboard input is available on demand; optional workbench controls live behind Tools.

Camera and Add drawing appear when the conversation needs them; images can also be dropped or pasted into the room. With a configured vision service, Nox normalizes the source and checks it automatically. The prompt attempts objects, characters, scenery, abstract forms and mechanisms as declared rigid-body approximations. It estimates noncritical scale, depth and mass, retains source grounding and asks when an unresolved detail changes the intended result. A validated ready interpretation becomes the running scene.

Fresh hosted vision interpretation and free-form model edits are pending the new Momen runtime connection and live verification. The local ramp flow and the “show me what you can do” spring demonstration work independently of that service. The spring demonstration produces two real measured runs before and after doubling mass, compares sampled periods and saves the result. Recorded Library experiments remain labelled optional examples. Model requests are bounded, and no universal recognition or conversion-time guarantee is claimed.

## How we built it

TypeScript and Vite power Nox, Three.js renders the geometry, and Rapier3D advances rigid bodies at 120 fixed steps per second. Browser speech and optional keyboard input share an action pipeline. Bounded local requests create fresh scene data; server-side model replies become validated scene data and reviewed operations. Earlier actual live interpretation cases used GPT 6 Luna through Momen with participant credits.

Advaita Gupta built physics, measurements, recovery, integration and correctness review. Juwon built sketch/photo intake, interpretation, voice/editor, runtime integration and the assistant interface. Both contributed UX and testing. Codex and Claude Code assisted implementation and review; third-party engines, models and significant AI contributions are credited in the repository.

## Challenges and learning

A plausible model can have a missing support or a joint that starts apart. We made assumptions inspectable and added validation from actual bad replies. Broad drawings also require a distinction between representing a subject and simulating its behavior: a rigid figurine is useful, but it must not be presented as a walking character or a deformable body. Delayed responses need source/version identity so cancellation or a new drawing cannot silently edit another experiment.

Retaining comparable starting conditions, sample data and checkpoints made a before/after comparison repeatable through Save/reload. The assistant explains measured results instead of treating an attractive motion as proof.

## Limits and next steps

Nox models rigid mechanics and a declared fan approximation. Water, cloth and electrical objects may be represented by explicit rigid visual proxies; fluid flow, deformation and electricity are not simulated. Browser speech support varies, and model interpretation can be unavailable, refused or wrong. Results describe the declared simulated setup. Captured-reply tests, fresh local demonstrations and actual live-model/device evidence are identified separately.

We want to test more unfamiliar drawings and make the limits of each approximation easier to resolve through conversation.

Built with TypeScript, Vite, Three.js, Rapier3D, Momen, GPT 6 Luna, browser speech, Codex and Claude Code. Prepared tracks: Best AI Hack, Best Design & UX and Best Deployed / Shipped App.
