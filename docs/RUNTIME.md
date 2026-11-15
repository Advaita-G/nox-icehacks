# Nox: start a conversation

## Enter the room

The first view centers on **Nox**. Tap the name once and grant microphone permission when the browser asks. Nox then listens between its spoken replies; there is no hold-to-talk step. The browser may request permission again in a later session. **Keyboard** opens the optional typed input and uses the same action pipeline when voice is unavailable or inconvenient.

Say **“Create a ramp and ball.”** This bounded request creates a fresh three-body local scene: fixed floor, fixed ramp and dynamic ball. Dimensions and coefficients are declared defaults. Nox starts the actual solver after the scene settles into the same room, with its conversation docked below. No model call, drawing recognition or captured response is used for this request. Custom dimensions or additional objects must be preserved through the custom proposal path rather than silently replaced with these defaults.

Continue with **“pause,” “keep a baseline,” “select the ball,” “double its mass,” “yes, apply,” “reset,” “run it,” “compare,”** and **“save.”** Normal physical edits are explained before spoken confirmation or Apply commits them. A manual edit begins a new version from the paused visible state; compare reports version measurements, not an automatically controlled mass-only experiment. **“Cancel”** discards a pending request or proposal.

The promoted `4797df4` core passed all eight deployed cases at four sizes with normal/reduced motion, including review, explicit confirmation, Save and exact reload. These checks used synthetic speech devices and real physics/storage. Earlier startup and review-layout failures are preserved as history, not current open failures. This is not a universal-device or physical-microphone claim. [Observed scope](VERIFICATION.md#current-deployed-core-88-pass)

**Stop** is available during active voice and pending work. It turns voice off, cancels pending work and pauses the experiment rather than permitting a delayed automatic start. Browser speech support varies and may use an online recognition service; speech synthesis supplies narration. Speech failures remain visible. Recent conversation is held in memory for this session, not stored by Save.

## Add a drawing when you need one

The conversation reveals contextual **Camera** and **Add drawing** controls. You can also drop or paste an image into the room. Camera capture depends on the device/browser; a desktop may open a normal file picker. Use a JPEG, PNG, WebP or AVIF the browser can decode. Unsupported or damaged files produce an error; convert a camera's HEIC to JPEG or PNG if needed.

Nox normalizes the source and starts model checking automatically. The normalized image remains visible with actual pending state and phase text. The implemented pipeline turns a validated ready response into a running 3D scene and waits for answers to critical questions. **Current live calls fail at Momen before returning a usable scene, so fresh drawing conversion does not work.** The source and previous valid experiment remain available after failure. Manual canvas drawing is available through **Tools** and retains preview/confirmation controls.

The interpretation prompt attempts objects, characters, scenery, abstract forms and mechanisms through explicit rigid-body, compound or shallow-extrusion approximations. Noncritical scale, depth, mass and material coefficients become declared estimates. It preserves source grounding and important visual features. Fluids, electricity and deformation are not simulated: visual proxies must be labelled, and behavior that changes the user's intended result requires a critical-intent question. A failed, invalid or cancelled result preserves valid work.

Model requests have a 120-second deadline each. Checking is pending work, not an estimated percentage; clarification rounds and service latency affect total time. No universal conversion-time or recognition guarantee is claimed.

## Optional tools and demonstrations

**Tools** keeps Draw, Source, Library, Parts, measurements and workbench/file controls available without making them the starting workflow. The labelled Library examples replay stored experiments through the real solver.

Say **“show me what you can do”** for a local spring demonstration. It creates and measures two real five-second runs before/after doubling mass, compares sampled periods and saves the experiment. This and the local ramp creation are separate from fresh model inference.

## Live model configuration

**Configured and funded does not mean healthy.** The Momen backend is synced, authentication works and participant-funded AI points are available, but actual image interpretation fails with an internal “Connection pool shut down” error. A fresh clone with zero conversations also failed its first image request after the numeric image-ID correction; the outgoing ID was independently verified. Fresh photo interpretation and free-form model edits are not working. Bounded local creation, numerical edits and solver controls remain separate. Earlier actual live cases used GPT 6 Luna through Momen; [current receipts](VERIFICATION.md#actual-configured-provider-failure) describe the new failure.

For local setup, run `npm ci` and `npm run dev`, then open the printed URL. Use the repository root for the current 3D product; `packages/input` includes shared modules and a preserved earlier prototype. The [README](../README.md) lists root/input-package verification commands.

Only when authorized to configure the runtime, copy `.env.example` to an ignored server-local `.env`. The Momen adapter requires `NOX_LIVE_CALLS=enabled`, `NOX_MODEL_PROVIDER=momen`, project external ID, admin token, agent ID and instruction/request/image argument keys. Its agent must accept an actual image for interpretation and return the structured data specified by Nox's prompts. Real values belong in server/deployment secrets, never browser code or the public repository. There is no automatic paid fallback.

Production endpoints include `/api/status`, `/api/interpret`, `/api/command` and `/api/access`. Live calls use a server-side judge access code (`NOX_DEMO_ACCESS_CODE`, at least 32 characters). Use the access flow or private judge link supplied by the project owner; no credential is published here. `configured: true` confirms configuration is present, not successful inference. Access permission and provider health are separate checks.

## Persistence and evidence

The [94-second unlisted core demo](https://youtu.be/9IRrXUZZexE) is uploaded, saved and anonymously embed-verified. It records the earlier built-in workflow, with scripted speech and the image-provider failure explicitly labelled. It is not a fresh vision or physical-microphone test; no human watch/listen review is claimed. The Devpost entry remains a draft awaiting user review and submission.

Save retains confirmed experiments with their source/notes, versions, baseline samples and paused checkpoints. Export creates a portable backup before changing browsers or clearing storage. Unconfirmed drawing drafts do not survive reload.

The automatic photo flow is checked separately from model understanding: text-only desktop/phone tests use an existing paper photo, captured model replies and explicit speech-device fakes while exercising real normalization, validation, simulation, cancellation and storage. Those checks do not establish a newly captured photo, fresh inference, physical-microphone acceptance or verification of every later interface change. See [verification](VERIFICATION.md) for dated evidence boundaries.

Nox models rigid mechanics and a declared fan approximation, with inspectable assumptions. A model can be wrong, refused, late or unavailable. Errors remain visible and stale-result checks protect the current experiment. [Architecture](ARCHITECTURE.md) · [Attribution](../ATTRIBUTION.md)
