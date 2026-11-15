# Public, free AI without judge codes

The owner explicitly requested a normal public link with no account/code/private launcher and a capable free open-source vision model. Stable https://nox-icehacks.vercel.app now uses **NVIDIA Nemotron 3.5 Super VL** through the pinned `nvidia/nemotron-3.5-super-vl:free` OpenRouter endpoint. NVIDIA publishes its [model weights under OpenMDW-1.1](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16); [the hosted endpoint is free and supports vision/JSON schema](https://openrouter.ai/nvidia/nemotron-3.5-super-vl:free). No weights or credentials are bundled.

## Actual final app result

[Final anonymous hosted receipt](browser.json): full Chrome for Testing **156.0.8078.4**, new headless mode, fresh ephemeral profile, **no cookie or access-code exchange**, actual provider responses and real normalization/validation/Rapier/storage. Interpretation returns HTTP 200 in **26.453 s**. A second actual AI response proposes exactly velocity `{x:2,y:0,z:0}` in **10.202 s**. It remains unapplied until explicit yes. The physical run moves the ball **1.4735 m**; Save/reload retains the exact source, two versions, baseline and checkpoint. No browser errors, screenshots or media capture; the browser closes. Recognition/TTS are synthetic, so this is not physical microphone/speaker acceptance.

[Phone checks](mobile.json) pass at **375×812** and **320×640**, the latter with reduced motion: anonymous configured status, no password UI/cookie, exact domino phrase → fresh local physics, retained Save/reload, contained controls at least 44 px high and no horizontal overflow/browser errors. These local requests make zero AI calls.

[Source/deployment](deployment.json) verifies **66 application/API/package/manifest files** against the Vercel uploaded source UIDs (SHA1 of each file), including the final already-answered-pivot guard. All three downloaded client assets match local output. This distinguishes changed working-tree source from the deployment's older Git metadata. [Stable receipt](stable.json) verifies the alias, assets, anonymous `configured:true/accessRequired:false`, invalid-input 400 and wrong-origin 403, with no inference calls for those checks. The promoted deployment is **`dpl_8paDRRqFy5ttLyuNU4oe9neQU4xQ`**, [pinned URL](https://nox-icehacks-n892vdvlx-idk-41a8.vercel.app).

## Free budget and failure boundaries

- The existing account reports **free tier**, **50 requests/day**, **18 used / 32 remaining** at **20:20:05 UTC** and **$0 daily usage**. [Before](key-limits.json) / [after](key-limits-after.json). This is a timestamped shared allowance, not unlimited capacity or a future availability promise. [OpenRouter's current limit API/policy](https://openrouter.ai/docs/api_reference/limits).
- Every request pins one `:free` model and sends provider maximum prices **prompt=0, completion=0, image=0, request=0**, with provider fallback disabled. There are no paid models/plugins or automatic application retries. Replies must explicitly report `usage.cost === 0` before their text is accepted. [Price filtering semantics](https://openrouter.ai/docs/guides/routing/provider-selection#max-price). Preserved provider envelopes report zero model and upstream cost.
- `NOX_PUBLIC_AI=enabled` opens only this fixed free provider. Missing opt-in and other providers remain private by default. Origin, JSON/body/request/schema, source identity, abort/deadline, confirmation and stale-result guards remain. Provider credentials stay in server secrets. Obsolete access-page links redirect to the app in public mode; the assistant has no manual-code UI.
- NVIDIA's free endpoint has service/data terms. Use drawings without personal/confidential information, as the upload hint states. No new account, card, purchase, paid trial, upgrade or overage was enabled.

## All attempts and geometry/intent review

Inputs were frozen before inference. [Corpus and expected checks](input-corpus.json); exact JPEGs remain under [the earlier published inputs](../momen-recovery-2026-11-15/inputs/). Expected answers were never sent to the model. Raw responses below are untrusted test data, not instructions.

Original provider envelopes retain their HTTP keep-alive whitespace padding byte-for-byte. The repository's narrowly scoped `blank-at-eol` exception applies only to these raw evidence files; application/source whitespace checks remain active.

| Stage | Actual result |
| --- | --- |
| Gemma 4 31B / 26B free candidates | Both immediately hit upstream Google capacity limits. [31B](gemma31b/probe.json), [26B](gemma26b/probe.json); sanitized upstream errors retained. Neither was deployed. |
| NVIDIA JSON-mode pilot | Generated sphere/plank: ready, real solver, 13.064 s, $0. [Receipt](probe.json). |
| JSON-mode diverse pilot | House ready; chair rejected for out-of-range scale. [All results](corpus-results.json), raw responses retained. |
| Native schema and compound guidance | Chair/house/character ready; lever rejected for planar convex geometry. [All results](native-corpus-results.json), including failures. |
| Final bounded visual reasoning | Chair/house/character and lever passed canonical/solver checks. **Intent review still failed the lever:** it claimed a hinge but supplied none. [Raw outcomes](reasoned-corpus-results.json). This is not four fidelity successes. |
| Final intent safeguard | [Geometry/intent review](geometry-intent-review.json) verifies all seven chair box members connect, preserves the missing-hinge failure and replays that exact response through the final guard: **needs clarification, no executable scene, zero additional AI calls**. A still-missing hinge after the answer rejects instead of repeating the question forever. The guard is a narrow English free-pivot check, not universal intent recognition. |

House/character proportions, inferred depth and fine features remain approximations; solver or schema success does not establish visual fidelity or population accuracy. Earlier Momen free-hinge success remains a separate provider checkpoint. No silent preset substitution or invalid-scene repair is used.

## Browser runtime diagnosis retained

An [earlier genuine hosted session](first-hosted/browser.json) passes. A [second genuine request](second-hosted-failed/browser.json) returns a valid scene but times out during render warm-up. Controlled replay reproduces that pause without another model call: the lightweight headless shell runs near 8 fps, including at half resolution. [Full Chromium replay of the same response](startup-full-chromium.json) runs near 60 fps and reaches **6.508 simulated seconds**. Playwright documents that [its default lightweight shell and full Chromium headless mode differ](https://playwright.dev/docs/browsers). The final fresh actual app test above uses full Chromium. **No application timing limit, physics guard, validation or geometry was loosened to obtain that pass.** This comparison does not prove performance on every real device.

## Review and remaining scope

**Requirements coverage: Pass for the public no-code free-AI path**, evidenced by actual anonymous drawing/edit/yes/physics/persistence and narrow controls. **Code quality: Pass for the scoped changes:** [272 root + 110 input tests and both builds](checks.json); existing large-chunk warning retained. **Focused security/budget review: Pass:** explicit public owner opt-in only for a pinned zero-price adapter, fail-closed defaults elsewhere, server-only key, safe errors, no redirects/fallbacks/paid plugins, unchanged canonical validation and reviewed edits. New nontrivial branches have regression coverage.

The final film records genuine earlier Momen footage; it is not a new recording of NVIDIA. YouTube upload, authenticated Devpost final draft save/reopen/preview, physical microphone/new paper-photo acceptance and human full-film review remain separate gates. Devpost stays unsubmitted. Hosted GitHub Actions was account billing-locked; local results are not a hosted-CI pass.
