# Nox

**Speak an idea, see it take shape in 3D, and keep changing it with Nox.**

## Inspiration

We wanted a space where trying an idea feels like talking to someone who can build beside you. A rough drawing, an object you describe or a question about motion should lead into the same conversation, without a dashboard of controls becoming the first task.

## What it does

The room opens with Nox. Start a conversation, show a rough drawing with Camera or Add drawing, and let it become a rigid 3D model in the same space. Nox preserves the source, makes estimated dimensions and materials inspectable, and asks about critical ambiguity. A usable model must pass strict validation before the real simulation starts.

Then talk to change it. Nox applies clear reversible edits, acknowledges the actual result and retains the previous version. Ask an amount or answer a short clarification; “undo” goes back. Removal and mechanism changes retain review. Keep a baseline, compare measured versions and save the source, versions and paused checkpoint. Keyboard input is available on demand; optional controls live behind Tools.

The deployed vision path uses NVIDIA Nemotron 3.5 Super VL through OpenRouter’s free endpoint. Judges open the normal public link without a code or account. Upload a picture and Nox automatically builds it into a 3D physics model. Missing sizes and physical values are estimated, not turned into a questionnaire. Ordinary requests stay attached to the image; follow-up phrases such as “a bit heavier” and “more inclined” produce clear reversible edits with spoken acknowledgement and a retained version. Ambiguous requests can ask one short question, and “undo” restores the previous version. Nox computes degree rotations and declared support contact itself. Actual generated ramp and chair flows passed with no measurements, real physics and exact source/version Save/reload. Speech in automated checks is synthetic. The server pins the free model with zero price ceilings; free capacity has a finite daily quota and no paid fallback. The film records an earlier genuine Momen session; it predates the current provider and conversational repair and is not physical microphone/camera evidence.

Broader drawings exposed a practical problem: nested physics output could leave disconnected parts even when JSON passed validation. We now request metric shapes and compile them into the same validated scene, placing declared supports against actual collision geometry. Current free-model chair, house and character cases run through validation and physics; targeted checks verify connected chair members. A lever response that omitted its claimed hinge now asks a critical clarification rather than starting incorrect motion. Earlier Momen hinged-lever success and all current failed attempts are retained separately. Organic forms and missing depth still need approximations; no universal recognition or timing guarantee is claimed.

For an optional local start, “Create a ramp and ball” creates fresh declared geometry without inference. “Show me what you can do” computes two real spring runs before and after doubling mass and compares sampled periods. Recorded Library examples remain labelled optional experiments.

## How we built it

TypeScript and Vite power Nox, Three.js renders its physical geometry, and Rapier3D advances rigid bodies at 120 fixed steps per second. Browser speech and optional keyboard share an action pipeline. Bounded local requests create fresh scene data; NVIDIA Nemotron 3.5 Super VL supplies actual vision/language responses through OpenRouter’s pinned free endpoint. Metric geometry compiles before canonical validation; clear reversible edits apply directly while destructive/mechanism changes remain reviewed. Momen with participant credits and Gemma 4 through Cloudflare were earlier runtimes, retained as provenance and evidence rather than current-provider claims.

Advaita Gupta built physics, measurements, recovery, integration and correctness review. Juwon built sketch/photo intake, interpretation, voice/editor, runtime integration and the assistant interface. Both contributed UX and testing. Codex and Claude Code assisted implementation and review; third-party engines, models and significant AI contributions are credited in the repository.

## Challenges and learning

A plausible model can have a missing support or a joint that starts apart. We made assumptions inspectable and added validation from actual bad replies. Broad drawings also require a distinction between representing a subject and simulating its behavior: a rigid figurine is useful, but it must not be presented as a walking character or a deformable body. Delayed responses need source/version identity so cancellation or a new drawing cannot silently edit another experiment.

The automatic spring demonstration uses comparable starting conditions. Ordinary manual edits begin a new version from the paused visible state, so the recorded ramp speed comparison describes different versions rather than isolating the effect of mass. Samples and checkpoints make the saved result repeatable through reload.

## Accomplishments

The deployed anonymous generated-image workflow produces a validated model, runs real physics, accepts a second model-interpreted velocity edit only after confirmation, and retains exact source, versions, baseline and checkpoint through Save/reload. The assistant reflects actual listening, speech, processing and interruption events; proposals stay separate from confirmed physics. Current root and input suites/builds pass, with scoped requirements, code-quality and security reviews recorded. Earlier independent peer reviews cover their identified source checkpoints. Invalid or cancelled results preserve valid work; failures and test fixtures are disclosed alongside the bounded passing results.

## Limits and next steps

Nox models rigid mechanics and a declared fan approximation. Water, cloth and electrical objects may be represented by explicit rigid visual proxies; fluid flow, deformation and electricity are not simulated. Browser speech support varies, and model interpretation can be unavailable, refused or wrong. Results describe the declared simulated setup. Captured-reply tests, fresh local demonstrations and actual live-model/device evidence are identified separately.

The earlier local core passed eight deployed create/run/review/confirm/Save/reload cases across four viewport sizes and both motion settings, with synthetic speech and real physics/storage. The current living-assistant interface and metric drawing route are merged and deployed, with fresh real-inference, geometry, cancellation and persistence checks. The [76-second HyperFrames film and source](https://github.com/Advaita-G/nox-icehacks/releases/tag/final-film-2026-11-15) disclose scripted speech, generated images and separately labelled local commands. More varied real photographs, physical device testing and human review of the final interface and film remain next steps.

Built with TypeScript, Vite, Three.js, Rapier3D, NVIDIA Nemotron 3.5 Super VL, OpenRouter, historical Momen/Cloudflare/Gemma 4, browser speech, Codex and Claude Code. Prepared tracks: Best AI Hack, Best Design & UX and Best Deployed / Shipped App.

---

## Devpost field audit — not part of the story

Checked November 15, 2026, Pacific. This section contains prepared field values and evidence of the last saved state; it does **not** assert that account fields were updated. The owned draft was last observed as 4/5, with the older story/video. Neither agent has an authenticated, focus-safe account connection; no personal browser takeover or cookie extraction is permitted.

| Field | Prepared value / required check | State |
| --- | --- | --- |
| Project name | **Nox** | Previously observed saved; recheck in final account preview. |
| Elevator pitch | **Speak an idea, see it take shape in 3D, and keep changing it with Nox.** | Exact current copy prepared above; prior voice-first pitch was saved, exact new copy not verified saved. |
| Project story | Copy from `# Nox` through the Built with paragraph above, excluding this audit. Covers inspiration, behavior, implementation, challenges/learning, accomplishments and next steps. | Updated copy prepared; saved story is older. |
| Built with | TypeScript; Vite; Three.js; Rapier3D; NVIDIA Nemotron 3.5 Super VL; OpenRouter; Momen/Cloudflare/Gemma 4 (historical); Web Speech API; Codex; Claude Code. | Values reflect actual current/historical usage; final tag selections not verified saved. |
| Public source | https://github.com/Advaita-G/nox-icehacks | Public repository exists. Keep the private development history private. |
| Try it | https://nox-icehacks.vercel.app | Use the plain public URL. Actual anonymous image/edit/physics/Save-reload passes; no code, account or private launcher is required. |
| Demo video | Final 75.7 s HyperFrames export: [published film, captions, editable source and verified hashes](https://github.com/Advaita-G/nox-icehacks/releases/tag/final-film-2026-11-15). SHA256 `2e065d2f350bc135dd575d4c964cf82a95468941946e12826ad37dcfdadb3eaf`. | Original film by Juwon; Codex completed bounded provenance/end-card/caption/LF fixes. HyperFrames 0 errors/0 warnings, full decode/changed encoded frames and downloaded asset hashes pass. No new supported channel URL: background browser host unavailable, all existing CDP connections unhealthy. Old saved YouTube `9IRrXUZZexE` is historical; GitHub MP4 is not a replacement for the required supported-video field. |
| Cover/gallery | [1200×800 original cover](../public-media/nox-cover.png), [editable SVG](../public-media/nox-cover.svg). Caption: **Nox — a voice-first room for exploring 3D ideas. Original illustration; not an application screenshot.** | Existing cover/caption previously saved; final gallery/required markers not freshly verified. No new audit screenshot is needed. |
| Team | Advaita Gupta and Juwon, using their existing verified Devpost accounts. | Both creators previously observed; recheck membership/registration in the owner preview. Do not create or substitute accounts. |
| Tracks | Best AI Hack; Best Design & UX; Best Deployed / Shipped App, where offered and applicable. | Prepared selections; actual saved selections unverified. The public free runtime passes its bounded anonymous flow; its daily quota remains finite. No hardware or first-hack claim is made. |
| AI/third-party disclosure | Significant Codex/Claude Code implementation and review assistance; hosted foundation models; Rapier/Three.js and dependency notices. See [attribution](../ATTRIBUTION.md) and [third-party notices](../THIRD_PARTY_NOTICES.md). | Disclosure is in the story and repo; review any event-specific declaration against the actual question. |
| Extra questions / required markers | Read every remaining form page and answer from verified project/team facts. | Account-only check remains pending; no answer or eligibility declaration is invented. |
| Final review / terms / submission | Save the full draft, leave and reopen it, compare all fields and links, and inspect owner preview. **Keep terms unchecked and Submit untouched until Advaita reviews and explicitly approves submission.** | Not submitted. |

[Official event page](https://icehacks.devpost.com/) checked November 14: deadline **November 15, 2026, 6 PM Pacific**. Its submission checklist requires a supported working video of at most three minutes, a write-up, source/live link, tools and applicable tracks; the separate rules page calls video optional. Meet the stricter video requirement and retain the public source. The current free NVIDIA runtime removes the need to wait for Cloudflare's reset. These dates do not establish final submission.

Current ownership and finish checks live in [team issue #25](https://github.com/Advaita-G/nox/issues/25). Claude delivered the independent UI/Stop fix, both metric-code reviews and the HyperFrames film; Codex completed its bounded final export corrections and published/reverified the delivery. Codex integrated the original Momen recovery and the later public, code-free NVIDIA free runtime. Juwon's optional independent runtime comparison stopped after one empty-reply failure and zero points, with no scene or retry; it does not invalidate the separately observed working original runtime. Physical-device checks still need Juwon personally. Final channel URL and authenticated background Devpost save/reopen/preview remain blocked by the unavailable browser host, rather than missing user approval. The user reiterated background-only; no personal window/settings takeover or cookie copy occurred. No assignment substitutes for actual account/device delivery.
