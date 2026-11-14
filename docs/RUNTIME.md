# Nox: paper drawing to a talking 3D experiment

## Start with your drawing

1. Choose **Take a photo** on a device with a camera, or **Upload drawing** to select an existing image. Camera capture is a browser/device feature; on a desktop it may open the normal file picker. Use a JPEG, PNG, WebP or AVIF that the browser can decode. Unsupported or damaged files produce a visible error; if a camera supplies HEIC, export a JPEG or PNG.
2. Nox prepares the image and begins checking automatically. The normalized source stays visible with the real checking animation and phase text. You do not need to open Library or click Build/Confirm for a ready photo interpretation.
3. When the model supplies a valid scene, Nox validates it, creates the 3D experiment, lets rendering settle and starts the real simulation. If physical intent is unclear, answer the clarification instead of assuming the model guessed correctly. A failed or cancelled request preserves valid work.
4. Choose **Talk to Nox** and allow microphone permission to move or change objects through conversation. You can also enable Talk while the photo is being checked. The browser may ask for permission again in a later session; typing follows the same action pipeline.

Photo understanding and free-form edits need the configured model service. Checking is actual pending work, not an estimated percentage. Each model request is bounded to 120 seconds; clarification rounds and service latency affect total time. A captured-response check does not establish fresh recognition or a live latency guarantee.

## Continue by voice or text

Ask Nox to select a named part, move it or change a physical property. The assistant explains the proposed physical changes and waits for **“yes”** before applying a normal edit. **“Cancel”** discards a pending request or change. You can run, pause, reset, keep a baseline, compare measured motion and save.

**Stop listening** remains available during checking, listening, thinking, speaking and errors. It turns voice off and cancels pending work rather than allowing a delayed auto-start. Browser speech support varies and may use an online speech service. The recent transcript is held in memory for this session; Save stores experiments, not a persistent conversation transcript.

Use Parts or Draw when exact manual control is useful. Recorded Library examples and the built-in **“show me what you can do”** demonstration are optional. The spring demonstration creates and measures two real five-second runs before/after doubling mass, compares the sampled periods and saves the experiment. It identifies itself as local and makes no model call.

## Live model configuration

Photo interpretation, custom systems and language outside the local command set use a configured server-side provider. Earlier actual live cases used GPT 6 Luna through Momen. Local commands, the spring demonstration and recorded examples remain separate from fresh interpretation.

For local setup, run `npm ci` and `npm run dev`, then open the printed URL. Use the repository root for the current 3D product; `packages/input` includes shared modules and a preserved earlier prototype. The [README](../README.md) lists root/input-package verification commands.

Only when authorized to configure the runtime, copy `.env.example` to an ignored server-local `.env`. The Momen adapter requires `NOX_LIVE_CALLS=enabled`, `NOX_MODEL_PROVIDER=momen`, project external ID, admin token, agent ID and instruction/request/image argument keys. Its agent must accept an actual image for interpretation and return the structured data specified by Nox's prompts. Real values belong in server/deployment secrets, never browser code or the public repository. There is no automatic paid fallback.

Production endpoints include `/api/status`, `/api/interpret`, `/api/command` and `/api/access`. Live calls use a server-side judge access code (`NOX_DEMO_ACCESS_CODE`, at least 32 characters). Use the access flow or private judge link supplied by the project owner; no credential is published here. Unlocking cannot configure a missing provider. Check the displayed runtime status before expecting fresh interpretation.

## Persistence and evidence

Save retains confirmed experiments with their source/notes, versions, baseline samples and paused checkpoints. Export creates a portable backup before changing browsers or clearing storage. Unconfirmed drawing drafts do not survive reload.

The automatic photo flow is checked separately from model understanding: text-only desktop/phone tests use an existing paper photo, captured model replies and explicit speech-device fakes while exercising real normalization, validation, simulation, cancellation and storage. They are not a newly captured photo, fresh inference or a new physical-microphone acceptance run. See [verification](VERIFICATION.md) for evidence boundaries.

Nox models rigid mechanics and a declared fan approximation, with inspectable assumptions. A model can be wrong, refused, late or unavailable. Errors remain visible and stale-result checks protect the current experiment. [Architecture](ARCHITECTURE.md) · [Attribution](../ATTRIBUTION.md)
