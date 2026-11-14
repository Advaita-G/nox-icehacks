# Verification and evidence boundaries

This clean source export starts from application commit `9e7064a85a9b89ebc523a8bb887a07d228429811`, with production Vercel routes and judge access added on November 14. The integrated candidate passed **157/157 root tests**, **110/110 input-package tests**, and the root build/typecheck. The earlier clean export also passed the standalone input build/typecheck after separate lockfile installs. Reproduce these checks with the README commands. Model/provider tests use injected transports and captured replies; they make no paid inference calls. The production build retains a large-chunk warning; no cross-device performance promise is made.

Text-only production-browser checks covered 1280×800, 375×812, 375×667, 320×667 and 768×900: drawing/undo, clarification, preview/Confirm, reviewed edits, real solver samples, matched-time baseline comparison and photo Confirm/Run/Save/reload. Source, run and checkpoint data were retained exactly, with no console errors. These used captured model replies, not fresh interpretation or a new human microphone session. Two baseline runs recovered explicitly from one delayed-frame pause each; no guard was weakened. No audit screenshots or video were generated.

## Evidence types

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Numerical tests and real solver replay | Checked geometry, constraints, physical responses, deterministic samples and checkpoint behavior within the declared model. | Correct interpretation of every new image or all-device performance. |
| Captured-response interface flow | Preview/Confirm, command Review/Apply, solver/comparison, cancellation and source/history recovery for the supplied reply. | A fresh model request or a human microphone session on every later candidate. |
| Earlier actual provider sessions | Real generated scenes and ordinary-language operations for those recorded inputs, model and date. | A newly captured photo when the source was reused, or final live acceptance of an untested later build. |
| Earlier physical-microphone/export packet | Actual speech-derived command data and retained samples/versions/checkpoints in its recorded scope. | Drawn-source retention for template-based experiments. |

## Reproducible cases

- [Ramp/cup experiment](evidence/f1-comparison-2026-11-10/Nox-ramp-and-cup.json): editable recorded versions retain the original source; the braced-cup setup holds the ball through the recorded 30-second comparison.
- [Fan/friction experiment](evidence/fan-friction-comparison/Nox-fan-and-friction.json): based on a manually corrected scene; at five seconds the low-friction box travels about 0.423 m while the original surface keeps it near rest.
- [Spring cart experiment](evidence/spring-cart-comparison/Nox-spring-cart.json): uses a corrected slider alignment; doubling stiffness 20 → 40 N/m changes measured period from about 0.993 to 0.705 seconds. Corrections are intentional and not presented as unmodified model success.
- [Seesaw captured reply](evidence/live-22-seesaw-2026-11-12/attempt-3/conv-91-response.json) and subsequent fixture replies exercise missed support, mass/movement/connection edits and failure regressions. The regression suite also retains invalid scenes; their presence is not a success claim.
- [Paper-photo scene](evidence/live-22-photo-2026-11-12/conv-103-response.json) and [cup-move reply](evidence/live-22-photo-2026-11-12/conv-104-response.json) came from an earlier live interpretation of an existing photo. They do not establish a newly captured photo on the final interface.

The synthetic geometry/source examples and selected raw replies are retained at their original relative paths because application asset imports and tests depend on them. Personal process documents, screenshots, private history and credentials are excluded.

## Final build

A final live result must identify its application commit, provider/model, browser, fresh input and actual outcome. Final acceptance includes a fresh canvas, newly captured paper photo, real spoken movement/property edits, Review/Apply, common-time comparison, Save/reload/source/baseline/versions/checkpoints and export/import. A labelled replay or prior passing suite cannot replace missing observations. Public hosting is separately checked at its actual URL.
