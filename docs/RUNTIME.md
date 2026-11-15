# Nox: start a conversation

## Enter the room

The first view centers on **Nox**. Tap the name once and grant microphone permission when the browser asks. Nox then listens between its spoken replies; there is no hold-to-talk step. The browser may request permission again in a later session. **Keyboard** opens the optional typed input and uses the same action pipeline when voice is unavailable or inconvenient.

Choose **Camera** or **Add drawing**, or drop/paste an image, to turn a rough drawing into a model. After validation, the scene takes the room and Nox docks below it. The current live film follows this image-first path, then a model-backed velocity edit, confirmation, real simulation and Save/reload.

Pause, select a part and ask for a change. Normal edits are explained before **“yes, apply”** or Apply commits them. **“Cancel”** discards a pending request or proposal. Keep a baseline, reset/run, compare and save; a manual edit starts a version from the paused visible state, so comparison is not automatically a controlled single-variable experiment.

**Stop** is available during active voice and pending work. It turns voice off, cancels pending work and pauses the experiment rather than permitting a delayed automatic start. Browser speech support varies and may use an online recognition service; speech synthesis supplies narration. Speech failures remain visible. Recent conversation is held in memory for this session, not stored by Save.

## Add a drawing when you need one

The conversation reveals contextual **Camera** and **Add drawing** controls. You can also drop or paste an image into the room. Camera capture depends on the device/browser; a desktop may open a normal file picker. Upload JPEG, PNG or WebP. AVIF and HEIC are not accepted by the intake validator; convert them to JPEG or PNG. Unsupported or damaged files produce an error. Exactly uniform images are rejected before an interpretation request; this is not a general blur or image-quality detector.

Nox normalizes the source and starts model checking automatically. The normalized image remains visible with actual pending state and phase text. The implemented pipeline turns a validated ready response into a running 3D scene and waits for answers to critical questions. The direct Cloudflare Gemma 4 path passed one bounded generated-JPEG interpretation and reviewed velocity-edit workflow. Its returned ball source box was vertically misplaced; this is not precise mapping or universal drawing recognition. The source and previous valid experiment remain available after failure. Manual canvas drawing is available through **Tools** and retains preview/confirmation controls.

The interpretation prompt attempts objects, characters, scenery, abstract forms and mechanisms through explicit rigid-body, compound or shallow-extrusion approximations. Noncritical scale, depth, mass and material coefficients become declared estimates. It preserves source grounding and important visual features. Fluids, electricity and deformation are not simulated: visual proxies must be labelled, and behavior that changes the user's intended result requires a critical-intent question. A failed, invalid or cancelled result preserves valid work.

Model requests have a 120-second deadline each. Checking is pending work, not an estimated percentage; clarification rounds and service latency affect total time. No universal conversion-time or recognition guarantee is claimed.

## Optional tools and demonstrations

**Tools** keeps Draw, Source, Library, Parts, measurements and workbench/file controls available without making them the starting workflow. The labelled Library examples replay stored experiments through the real solver.

Say **“Create a ramp and ball”** for a fresh local three-body scene with declared defaults. It runs real physics without inference. Custom details belong on the custom proposal path instead of being silently replaced. The earlier core passed eight deployed local create/run/review/confirm/Save/reload cases at four sizes and two motion settings with synthetic speech. [Observed scope](VERIFICATION.md#earlier-deployed-core-88-pass).

Say **“show me what you can do”** for a local spring demonstration. It creates and measures two real five-second runs before/after doubling mass, compares sampled periods and saves the experiment. This and the local ramp creation are separate from fresh model inference.

## Live model configuration

**November 15 release:** restored participant-funded Momen is now the stable runtime at https://nox-icehacks.vercel.app . Application `8cfcc5a`, repository `b36e51f`, is promoted from [the pinned deployment](https://nox-icehacks-dt5d0nvdg-idk-41a8.vercel.app); the stable alias, client hashes, private judge auth, locked anonymous inference and origin guard were checked. Earlier metric source `59793ca` passed the complete real app path locally (14.790 s interpretation, 7.293 s edit) and hosted (19.078 s, 7.142 s), including explicit yes, physics and exact Save/reload. Final source keeps identical drawing wire instructions and removes an unnecessary duplicate command schema; its actual hosted command passes in 6.921 s with only velocity/revision changed. The drawing wrapper supplies the trusted schema; metric geometry/supports compile before unchanged canonical validation. No mocked model replies, automatic retries, purchase or overage. [All source/timing boundaries and evidence](evidence/momen-recovery-2026-11-15/README.md).

The next two paragraphs describe the earlier deployed Cloudflare checkpoint and historical Momen outage, rather than the restored local candidate. Configuration presence still does not establish quota or health.

As observed November 14 (Pacific), the Cloudflare account's hard 10,000-neuron daily free allocation is exhausted. New model calls are quota-blocked until 00:00 UTC, next November 15 at 4 PM Pacific. The authenticated status endpoint can still report configuration present; it is not a quota/health check. No paid usage was enabled. [Audit and remaining verification](AUDIT-2026-11-14.md) · [Cloudflare allocation/reset policy](https://developers.cloudflare.com/workers-ai/platform/pricing/).

One deployed generated-JPEG case passed actual interpretation, unchanged strict 3D validation, real simulation, a second model response proposing velocity 0 → 2 m/s to the right, explicit confirmation, and exact source/checkpoint Save/reload. Interpretation took 42.46 s and the edit request 21.90 s in this case. Speech input was scripted; physical microphone and fresh camera-photo acceptance were not tested. The ball’s returned source box was vertically misplaced, so precise image-region mapping is not established. The model is Gemma 4 26B A4B directly through Cloudflare Workers AI. The earlier Momen projects remain participant-funded but unstable; preserved failures and the sent vendor-support report are historical evidence, not a successful current route. Earlier Qwen/Gemma responses were invalid or timed out; those failures are preserved separately. The current trusted output-schema route selects photo bounding-box fields or canvas stroke-ID fields from the validated source kind; unchanged canonical validation still checks actual identity, geometry and physical validity. [Observed scope](VERIFICATION.md#bounded-cloudflare-live-workflow).

For local setup, run `npm ci` and `npm run dev`, then open the printed URL. Use the repository root for the current 3D product; `packages/input` includes shared modules and a preserved earlier prototype. The [README](../README.md) lists root/input-package verification commands.

Only when authorized to configure the runtime, copy `.env.example` to an ignored server-local `.env`. The direct Cloudflare adapter requires `NOX_LIVE_CALLS=enabled`, `NOX_MODEL_PROVIDER=cloudflare`, `NOX_CLOUDFLARE_ACCOUNT_ID` and `NOX_CLOUDFLARE_API_TOKEN`; select the documented `@cf/google/gemma-4-26b-a4b-it` through `NOX_CLOUDFLARE_MODEL`. `NOX_CLOUDFLARE_MAX_TOKENS` is an application cap from 1 to 16384, sent as `max_completion_tokens`. The chosen runtime uses Gemma 4 on Workers Free with a hard daily allocation; no paid upgrade or automatic provider fallback is enabled. Model replies still face strict identity, geometry and operation validation. Real values belong in server/deployment secrets, never browser code or the public repository. The historical Momen adapter remains separately available, not an automatic fallback.

Production endpoints include `/api/status`, `/api/interpret`, `/api/command` and `/api/access`. Live calls use a server-side judge access code (`NOX_DEMO_ACCESS_CODE`, at least 32 characters). Use the access flow or private judge link supplied by the project owner; no credential is published here. `configured: true` confirms configuration is present, not successful inference. Access permission and provider health are separate checks.

## Persistence and evidence

The [113-second live review film, captions and editable source](https://github.com/Advaita-G/nox-icehacks/releases/tag/live-review-2026-11-15) record the real bounded image/edit workflow, with scripted/recreated speech disclosed. Downloads match the published checksums. Human watch/listen and physical-device acceptance remain pending. The [94-second YouTube film](https://youtu.be/9IRrXUZZexE) is historical built-in footage with explicit provider-failure disclosure. The Devpost draft still has the old video/story; updated text is prepared in [SUBMISSION.md](SUBMISSION.md), but account-only changes are pending under the user's background-only instruction.

Save retains confirmed experiments with their source/notes, versions, baseline samples and paused checkpoints. Export creates a portable backup before changing browsers or clearing storage. Unconfirmed drawing drafts do not survive reload.

The automatic photo flow is checked separately from model understanding: text-only desktop/phone tests use an existing paper photo, captured model replies and explicit speech-device fakes while exercising real normalization, validation, simulation, cancellation and storage. Those checks do not establish a newly captured photo, fresh inference, physical-microphone acceptance or verification of every later interface change. See [verification](VERIFICATION.md) for dated evidence boundaries.

Nox models rigid mechanics and a declared fan approximation, with inspectable assumptions. A model can be wrong, refused, late or unavailable. Errors remain visible and stale-result checks protect the current experiment. [Architecture](ARCHITECTURE.md) · [Attribution](../ATTRIBUTION.md)
