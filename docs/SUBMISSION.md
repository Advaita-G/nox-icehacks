# Nox

**Speak an idea, see it take shape in 3D, and keep changing it with Nox.**

## Inspiration

We wanted a space where trying an idea feels like talking to someone who can build beside you. A rough drawing, an object you describe or a question about motion should lead into the same conversation, without a dashboard of controls becoming the first task.

## What it does

The room opens with Nox. Start a conversation, show a rough drawing with Camera or Add drawing, and let it become a rigid 3D model in the same space. Nox preserves the source, makes estimated dimensions and materials inspectable, and asks about critical ambiguity. A usable model must pass strict validation before the real simulation starts.

Then talk to change it. Nox explains proposed physical edits and waits for “yes” before applying them. Pause, select a part, change its motion or properties, keep a baseline, compare measured versions and save the source, versions and paused checkpoint. Keyboard input is available on demand; optional controls live behind Tools.

The current vision path uses Gemma 4 26B A4B directly through Cloudflare Workers AI. The live review film records a generated annotated JPEG becoming a strict-valid three-body scene in 42.46 seconds, then a second genuine model response proposing initial velocity 0 → 2 m/s in 21.90 seconds. The edit waits for yes; Rapier moves the ball and Save/reload preserves the exact source and checkpoint. The main take is continuous at 1×, including processing waits. Speech is scripted/recreated; this does not establish physical microphone or camera acceptance. The ball's source box is inaccurate.

Broader drawing reliability remains a limitation: responses can omit important parts, fail validation or time out. A separate unlabelled house response had inconsistent part IDs. Nox retained valid work instead of silently substituting a preset. Further generation experiments have not passed their acceptance checks and are not deployed. We do not claim universal recognition or conversion time.

For an optional local start, “Create a ramp and ball” creates fresh declared geometry without inference. “Show me what you can do” computes two real spring runs before and after doubling mass and compares sampled periods. Recorded Library examples remain labelled optional experiments.

## How we built it

TypeScript and Vite power Nox, Three.js renders the geometry, and Rapier3D advances rigid bodies at 120 fixed steps per second. Browser speech and optional keyboard input share an action pipeline. Bounded local requests create fresh scene data; server-side model replies become validated scene data and reviewed operations. The current model uses direct Cloudflare Workers AI hosting of Gemma 4 26B A4B. Earlier actual live interpretation cases used GPT 6 Luna through Momen with participant credits; those later projects became unstable and vendor support was contacted.

Advaita Gupta built physics, measurements, recovery, integration and correctness review. Juwon built sketch/photo intake, interpretation, voice/editor, runtime integration and the assistant interface. Both contributed UX and testing. Codex and Claude Code assisted implementation and review; third-party engines, models and significant AI contributions are credited in the repository.

## Challenges and learning

A plausible model can have a missing support or a joint that starts apart. We made assumptions inspectable and added validation from actual bad replies. Broad drawings also require a distinction between representing a subject and simulating its behavior: a rigid figurine is useful, but it must not be presented as a walking character or a deformable body. Delayed responses need source/version identity so cancellation or a new drawing cannot silently edit another experiment.

The automatic spring demonstration uses comparable starting conditions. Ordinary manual edits begin a new version from the paused visible state, so the recorded ramp speed comparison describes different versions rather than isolating the effect of mass. Samples and checkpoints make the saved result repeatable through reload.

## Accomplishments

One complete live generated-image workflow produced a validated model, ran real physics, accepted a second model-interpreted velocity edit only after confirmation, and retained the exact source, versions and checkpoint through Save/reload. We also kept invalid or cancelled results from replacing valid work. These are bounded observed results, with failures and test fixtures disclosed alongside them.

## Limits and next steps

Nox models rigid mechanics and a declared fan approximation. Water, cloth and electrical objects may be represented by explicit rigid visual proxies; fluid flow, deformation and electricity are not simulated. Browser speech support varies, and model interpretation can be unavailable, refused or wrong. Results describe the declared simulated setup. Captured-reply tests, fresh local demonstrations and actual live-model/device evidence are identified separately.

The earlier local core passed eight deployed create/run/review/confirm/Save/reload cases across four viewport sizes and both motion settings, with synthetic speech and real physics/storage. The [113-second live review](https://github.com/Advaita-G/nox-icehacks/releases/tag/live-review-2026-11-15) adds actual image and model-edit evidence with its limits disclosed. Juwon's expressive living-assistant redesign is implemented in a separate review candidate; its local and controlled photo workflows pass, but it has not replaced stable production or received final human/device acceptance. Broader drawings, physical device testing and human review of the final interface and film remain pending. Devpost remains a draft; submission requires the user's explicit approval.

Built with TypeScript, Vite, Three.js, Rapier3D, Cloudflare Workers AI, Gemma 4 26B A4B, Momen, historical GPT 6 Luna, browser speech, Codex and Claude Code. Prepared tracks: Best AI Hack, Best Design & UX and Best Deployed / Shipped App.

---

## Devpost field audit — not part of the story

Checked November 15, 2026, Pacific. This section contains prepared field values and evidence of the last saved state; it does **not** assert that account fields were updated. The owned draft was last observed as 4/5, with the older story/video. Neither agent has an authenticated, focus-safe account connection; no personal browser takeover or cookie extraction is permitted.

| Field | Prepared value / required check | State |
| --- | --- | --- |
| Project name | **Nox** | Previously observed saved; recheck in final account preview. |
| Elevator pitch | **Speak an idea, see it take shape in 3D, and keep changing it with Nox.** | Exact current copy prepared above; prior voice-first pitch was saved, exact new copy not verified saved. |
| Project story | Copy from `# Nox` through the Built with paragraph above, excluding this audit. Covers inspiration, behavior, implementation, challenges/learning, accomplishments and next steps. | Updated copy prepared; saved story is older. |
| Built with | TypeScript; Vite; Three.js; Rapier3D; Cloudflare Workers AI; Gemma 4; Momen; GPT 6 Luna (historical); Web Speech API; Codex; Claude Code. | Values reflect actual current/historical usage; final tag selections not verified saved. |
| Public source | https://github.com/Advaita-G/nox-icehacks | Public repository exists. Keep the private development history private. |
| Try it | https://nox-icehacks.vercel.app | Stable app responds; AI is currently quota-blocked. Preserve the existing private judge-access link in the account field without publishing its code. |
| Demo video | Existing hosted backup: https://youtu.be/9IRrXUZZexE (94 s, older local-workflow film). Latest genuine-model 113 s MP4: [versioned release](https://github.com/Advaita-G/nox-icehacks/releases/tag/live-review-2026-11-15). | Backup link previously saved. New film still needs a supported YouTube/Vimeo/Youku URL and anonymous playback check; a GitHub MP4 download is not a substitute for that required field. Film must identify the UI/source it actually shows. |
| Cover/gallery | [1200×800 original cover](../public-media/nox-cover.png), [editable SVG](../public-media/nox-cover.svg). Caption: **Nox — a voice-first room for exploring 3D ideas. Original illustration; not an application screenshot.** | Existing cover/caption previously saved; final gallery/required markers not freshly verified. No new audit screenshot is needed. |
| Team | Advaita Gupta and Juwon, using their existing verified Devpost accounts. | Both creators previously observed; recheck membership/registration in the owner preview. Do not create or substitute accounts. |
| Tracks | Best AI Hack; Best Design & UX; Best Deployed / Shipped App, where offered and applicable. | Prepared selections; actual saved selections unverified. Shipped-app readiness still depends on working judge access/runtime. No hardware or first-hack claim is made. |
| AI/third-party disclosure | Significant Codex/Claude Code implementation and review assistance; hosted foundation models; Rapier/Three.js and dependency notices. See [attribution](../ATTRIBUTION.md) and [third-party notices](../THIRD_PARTY_NOTICES.md). | Disclosure is in the story and repo; review any event-specific declaration against the actual question. |
| Extra questions / required markers | Read every remaining form page and answer from verified project/team facts. | Account-only check remains pending; no answer or eligibility declaration is invented. |
| Final review / terms / submission | Save the full draft, leave and reopen it, compare all fields and links, and inspect owner preview. **Keep terms unchecked and Submit untouched until Advaita reviews and explicitly approves submission.** | Not submitted. |

[Official event page](https://icehacks.devpost.com/) checked November 14: deadline **November 15, 2026, 6 PM Pacific**. Its submission checklist requires a supported working video of at most three minutes, a write-up, source/live link, tools and applicable tracks; the separate rules page calls video optional. Meet the stricter video requirement and retain the public source. The free inference reset at **4 PM Pacific** leaves **two hours before the deadline**; finish independent preparation before reset. These dates do not establish final submission.

Current ownership and finish checks live in [team issue #25](https://github.com/Advaita-G/nox/issues/25#issuecomment-6896868979). Claude delivered the independent technical UI review and Stop-state fix. Advaita then explicitly assigned Claude the Cloudflare capacity/fresh-vision lane and the HyperFrames film plus unlisted YouTube upload; new pickup, capacity and channel access remain unconfirmed. Separately verified available $0/funded Cloudflare capacity may be used before the exhausted deployed account resets. Codex holds inference until explicit handback and owns final integration/physics review and Devpost claims. Physical-device checks still need Juwon personally. No saved-draft or new-upload completion is established by the assignment.
