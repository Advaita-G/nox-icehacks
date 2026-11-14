# Verification and evidence boundaries

Updated November 14, 2026 for photo-first Nox. The latest local source passed **201/201 root tests**, **110/110 input-package tests**, and both production builds/typechecks. It extends `760fd41` with cancellation aliases that discard a pending critical question instead of treating “cancel the request” as an answer; the new regression covers that boundary. The resulting root build is `main-CPfShkvY.js` / `index-kjaBBva9.js`, with `main-D8_HSnH1.css`. Use the [README commands](../README.md#run-locally) to reproduce the suites. Provider tests use injected transports and captured replies; they make no paid inference calls. The build retains its existing large-chunk warning.

## Current automatic photo and conversation checks

**14 text-only production-browser cases passed** at **1280×800** and **375×667**, using full headless Chromium on the development Mac's Apple M4/ANGLE Metal renderer. The tested application assets were `main-Bt81X1s-.js` and `main-D8_HSnH1.css`.

These checks used an existing paper photograph, the earlier actual model replies #103/#104 with only request/source identity mapping, and explicit SpeechRecognition/speech-synthesis device fakes. Image normalization, scene validation, physics, measurements and browser storage were real. They establish integration behavior for those controlled replies, **not fresh image understanding, a new photograph, a physical microphone/speaker session or a live latency benchmark**.

| Recorded checks | Observed result |
| --- | --- |
| Upload → pending check → automatic validated 3D model/run | The normalized 1280×720 photo and actual animated scan remained visible. Stop stayed available. One captured interpretation request reached a real solver clock above one second with no Build, Confirm or Library click. |
| Spoken model-backed edit and confirmation | Fake speech requested moving the cup 40 cm. Its x coordinate stayed at 1.75875 until reviewed confirmation, then became 2.1587501. A second run and measured baseline comparison followed. |
| Save and actual reload | Original photo/source hash, baseline samples, three versions and checkpoints matched exactly after reload; the app reopened paused at the retained version/time. The actual Source control displayed the retained image. |
| Cancel while checking | A late captured reply was fulfilled after cancellation and did not replace or run the previous valid experiment. |
| Invalid file and provider failure | The invalid file caused no interpretation request. Both errors stayed visible and retained the previous source/scene/version and cup pose. |
| Stop during the reveal | Stop turned voice off and left the clock at 0.000 s after the reveal cleared, with no delayed auto-start. |
| Photo before microphone start | Upload began checking with the microphone off. Talk remained available, gave the appropriate checking greeting, then automatic model/run and Save succeeded. |

The first six rows ran at both widths: **12 cases**. The photo-before-microphone flow added **2 cases**. There were no unexpected page errors or external page requests. All browsers were closed after testing; no screenshots or media captures were generated.

[Full 12-case receipt](evidence/photo-auto-2026-11-14/photo-flow-results.json) · [Upload-first 2-case receipt](evidence/photo-auto-2026-11-14/photo-first-results.json). These public copies omit only the private local input-file path. Original local records are `results-20261114-121638.json` and `results-20261114-121926.json` in the test output directory.

The receipts retain their exact tested source hashes. Afterwards, `src/input/ui.ts` received a provider-status/help-copy update explaining automatic photos and manual canvas interpretation; the current source differs there. The final 201/110 suites and both builds include that copy update and the cancellation-alias regression. The 14 browser cases are evidence for the named asset candidate, not a claim that a later public deployment was re-exercised.

## Anonymous deployed application and access boundary

A separate fresh anonymous full-Chromium smoke passed on the [pinned deployed candidate](https://nox-icehacks-eowmrsh75-idk-41a8.vercel.app), serving `main-Cv9doz2f.js` / `index-DE8gYxUo.js` / `main-D8_HSnH1.css` from `760fd41`.

- At 1280×800, typed “show me what you can do” performed two actual 5.008-second spring runs, changed mass 1 → 2, reported sampled periods about 1.57 → 2.22 s, saved the baseline/three versions/checkpoints, and restored exactly after actual reload.
- At 320×667 and 768×900, text/accessibility and layout checks found contained controls and 44 px camera/upload labels, Talk, Stop and typed input. Keyboard/drawer/help checks passed.
- No API mocks, synthetic model replies or UI captures were used in this deployed smoke. Its browser made no API requests and recorded no page errors. The demonstration is local; it does not verify a fresh model request or physical speech.
- The separately recorded anonymous status was `configured: false`, `provider: null`, `accessRequired: true`. That is the protected anonymous view, not proof that the runtime behind the gate has been exercised.

[Production smoke receipt](evidence/photo-auto-2026-11-14/production-smoke-results.json). The final cancellation aliases were added after this deployed receipt and passed the 201-test suite and new build above; this receipt does not claim to test their later deployment. The stable `nox-icehacks.vercel.app` alias is a planned promotion target until the final release checks confirm it.

The judge-link helper is covered by focused source tests: a private access code is removed from the URL before exchange through the same-origin gate; ordinary links make no auth exchange, and invalid/failed links do not expose the code or enable inference. Provider credentials stay server-side. Auth unit tests and anonymous local features are distinct from an authorized production model call, which remains a separate live check.

## Rendering and loading fixes

The final candidate disables renderer antialiasing, caches derived viewport resources, and fixes the loader's cached-import path. A reproduced cold desktop photo run also showed that starting physics during the source reveal could trip the unchanged delayed-frame guard. The shared warmup now waits for the real reveal to finish before collecting stable paused frames; the assistant waits for actual solver advancement before announcing a running experiment. Photo help/permission layout stays stable through checking. Stop/new input/visibility cancellation prevents a delayed start.

The final photo cases passed after these changes without a manual playback recovery. **FixedClock limits were not relaxed.** This is scoped development-Mac evidence; it does not establish performance on every device or visual preference. Earlier drawing-first checks at five sizes and any earlier recovered pauses are historical evidence, not the current photo-first acceptance result.

## Evidence types

| Evidence | Establishes | Does not establish |
| --- | --- | --- |
| Numerical/contract tests and solver replay | Checked geometry, constraints, physical responses, atomic edits, samples and checkpoint behavior within the declared model. | Correct interpretation of every image or all-device performance. |
| Current captured-response photo/conversation checks | Automatic photo lifecycle, reviewed operations, real solver/persistence and cancellation for the supplied replies. | Fresh inference, physical speech or a newly captured camera image. |
| Earlier actual provider sessions | Generated scenes and language operations for those recorded inputs/model/date. | Fresh current-head acceptance or a new photo when an earlier source was reused. |
| Earlier physical-microphone/export evidence | Speech-derived command and recovery data within its recorded scope. | Drawn-source retention for template-based experiments or a new device session on this candidate. |

## Reproducible recorded cases

- [Ramp/cup](evidence/f1-comparison-2026-11-10/Nox-ramp-and-cup.json): editable recorded versions retain the original source; the corrected braced-cup setup holds the ball through its recorded 30-second comparison.
- [Fan/friction](evidence/fan-friction-comparison/Nox-fan-and-friction.json): based on a manually corrected scene; the low-friction box travels about 0.423 m in five seconds while the original surface keeps it near rest.
- [Spring cart](evidence/spring-cart-comparison/Nox-spring-cart.json): corrected slider alignment; stiffness 20 → 40 N/m changes measured period about 0.993 → 0.705 s. This is a different experiment from the local assistant demonstration that doubles mass.
- [Seesaw reply](evidence/live-22-seesaw-2026-11-12/attempt-3/conv-91-response.json): its follow-up fixtures exercise missed support, property/movement/connection edits and rejection regressions. Invalid replies remain invalid test inputs.
- [Earlier paper-photo scene](evidence/live-22-photo-2026-11-12/conv-103-response.json) and [cup move](evidence/live-22-photo-2026-11-12/conv-104-response.json): actual earlier model output reused by the current controlled browser checks; not new recognition.

Fixtures remain at the relative paths required by application imports and tests. Credentials, private Git history, personal agent/team instructions and UI capture media are excluded from this public export.

## Remaining live boundary

The **120–180-second photo-to-running-model response is an aim, not a measured guarantee**. Each model request has a 120-second deadline; setup, service latency and clarification rounds affect total time. Controlled replies cannot prove the live provider meets that aim.

Fresh current-candidate photo interpretation/free-form edits require the actual configured runtime and authorized judge access. A fresh result must identify the application commit, provider/model, input, timing and observed outcome. New camera/microphone acceptance requires a real device session. Public hosting/access is checked separately at its actual deployed URL; a localhost result is not deployment evidence.
