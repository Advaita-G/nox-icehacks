# Verification and evidence boundaries

Updated November 14, 2026 for the **Nox-only voice room**. Completed local runs passed **218/218 root tests** and **110/110 input-package tests**; the corrected source also passed root typecheck/production build. The candidate includes the `948e9dc` Tools/gizmo fix and preservation of Momen's numeric image IDs. Its latest local client assets are `main-BeN3EFcV.js`, `main-MEbMjkZu.css` and `index-Bc3XoacH.js`; named browser receipts below cover their own earlier assets. Use the [README commands](../README.md#run-locally) to reproduce the suites. Injected provider tests do not establish working inference; actual calls are reported separately.

**Fresh drawing conversion and free-form model edits are not working.** Momen is configured, synced and participant-funded, but actual image calls fail internally. The local core has passing checks alongside an unresolved startup pause in the deployed matrix; this is not a ready or all-pass release claim. Earlier GitHub-hosted checks could not start because the repository owner's account was billing-locked ([observed run](https://github.com/Advaita-G/nox-icehacks/actions/runs/43638844038)); completed local counts are not a claim that hosted CI passed.

## Actual configured-provider failure

The latest real-provider check used a **generated synthetic drawing**, normalized to 1600×1000, 57,213 bytes, SHA256 `9f26fc39b99f7a0d37d7edf84968f0eb92f64d6c1114c8824057ef7c4d6e681a`. It was not a new camera/paper photograph or physical-speech session. The local production API entrypoint used the real Momen provider, Gemini 3.8 Flash, plain text/non-streaming output and no new resource purchase. No model response was intercepted or retried.

On a fresh clone independently checked to have **zero conversation rows**, exactly one corrected image request returned **HTTP 502 / PROVIDER_ERROR in 2.974 s**. Upload-slot creation, conversation creation and result polling returned HTTP 200; the result was `FAILED`. Pass-through observation confirmed a numeric, safe-integer image ID equal to the upload API's value. One subsequent database read found one failed row with `SERVER_INTERNAL_ERROR`; safe boolean checks confirm “Connection pool shut down” and `CUSTOM_CHAT_REQUEST_ERROR` in its private error message. The raw message, credentials and URLs are excluded from published evidence.

No raw model scene was returned, so strict 3D interpretation validation, automatic run and model-edit success were **not reached**. The API reports the failure without applying a scene. The earlier before/after comparison also failed (3.551 s before, 2.739 s after), but its post-fix request used an already-failed pool and cannot establish prevention of the first failure. The later fresh-clone test removes that particular confound; the internal cause remains unresolved.

[Fresh corrected image-first receipt](evidence/runtime-2026-11-14/fresh-postfix-receipt.json) · [Earlier numeric-ID comparison](evidence/runtime-2026-11-14/numeric-image-id-comparison.json) · [Focused transport review](evidence/runtime-2026-11-14/numeric-transport-review.json) · [Runtime receipt scope](evidence/runtime-2026-11-14/README.md).

## Deployed voice-room matrix: 7/8, with bounded retries

The deployed **`8eb042b`** candidate was checked at 320×667, 375×667, 768×900 and 1280×800 with normal and reduced motion. The initial complete matrix is **7/8 PASS, overall FAIL**. It used real local physics and synthetic recognition/TTS, with no credentials or model calls.

The 1280×800 reduced-motion ramp case created three bodies but paused at **0.025 s**, reporting that the solver paused before the run was established. One isolated retry then passed, followed by three fresh-process diagnostic passes reaching about 1.7 s. Those retries did not reproduce the failure and are **not an eight-case matrix rerun or proof that the startup issue is fixed**.

The later local `948e9dc` Tools check passed in normal/reduced motion on `main-CAVvyYTU.js`: WebGL draw counts changed **7 → 20 → 7** as Tools opened/closed while paused. This establishes that manual transform rendering follows Tools visibility, not repair of the earlier startup pause. The latest production build is newer than these named browser receipts.

[Deployed matrix](evidence/voice-room-2026-11-14/production-matrix-8eb042b.json) · [Single isolated retry](evidence/voice-room-2026-11-14/production-isolated-1280.json) · [Three-process diagnostic](evidence/voice-room-2026-11-14/production-diagnostic-summary.json) · [Local Tools check](evidence/voice-room-2026-11-14/tools-local-check-948e9dc.json). Public copies remove URLs, private paths and stack traces while retaining results; the [manifest](evidence/voice-room-2026-11-14/production-receipt-manifest.json) records source and published hashes.

## Earlier controlled local room checks

At **1280×800** and **375×667**, two complete browser flows passed on `main-CwljF86v.js`, plus **eight empty-room exit cases**. Actual scene validation, Rapier physics, measurements, image normalization and browser storage ran. SpeechRecognition and speech synthesis were explicit device fakes. The photo path used the earlier actual #103 model reply with request/source identity remapped, not a fresh provider request. Its recorded SHA256 matches the [captured #103 reply](evidence/live-22-photo-2026-11-12/conv-103-response.json).

| Current controlled check | Observed result |
| --- | --- |
| Nox-only arrival and optional keyboard | The pre-JavaScript Nox placeholder hid the old workbench. The interactive path reached Nox then Keyboard; the room stayed within both tested viewports. |
| Natural spoken ramp creation | One synthetic start/recognition flow created a fresh floor, ramp and ball and automatically advanced the real solver, with **zero model or replay requests**. |
| Reviewed local edit, baseline and recovery | Ball mass became 2 kg only through the reviewed change. Each saved baseline retained 28 samples; source-independent local scene data, versions and checkpoint matched after actual reload. Reload returned to Nox-only arrival; spoken resume revealed the retained scene. |
| Controlled photo interpretation | The normalized source and real `source-scan` animation stayed visible while a response was held. One captured interpretation became a validated, automatically confirmed running scene, followed by a reviewed local edit and Save. Saved solver time was 0.900 s on desktop and about 0.858 s on phone. |
| Cancellation, error and Stop | A reply delivered after cancellation could not apply, including after a later yes. A controlled 503 retained the valid experiment. Stop halted recognition and physics; typed source access remained reachable. |
| Empty-room exits | Cancel, Stop, provider failure followed by Back, and clarification followed by Back passed at both widths: source closed, zero scene objects and room returned to conversation. |
| Reduced motion | The checked scan, signal, source, scene and panel selectors reported no animation and 0 s transitions. |

An **earlier bounded local smoke** passed at **1280×800** on `main-bCFecXw6.js` / `main-MEbMjkZu.css` / `index-DH1jtNxO.js`. It confirmed Nox-only arrival, a synthetic spoken request creating three fresh ramp bodies with a real clock above 0.8 s, zero model/status requests, and Stop leaving recognition inactive and physics paused. Computed keyboard-input placeholder contrast was **7.16:1**, above the checked 4.5:1 threshold; this is a specific computed-text check, not a complete accessibility or visual-preference claim.

The full workflow's `main-CwljF86v.js` and the later `main-bCFecXw6.js` are **byte-identical**: 5,086,528 bytes, SHA256 `d8c38aa51f6985f7561c77d6a78b02076786146c7c630dbbd40c51151fe1d813`. The later CSS/bootstrap build received the bounded desktop smoke; the complete two-width workflow was not rerun under those later asset names. Both receipts report no unexpected errors and no media capture. No live model, newly captured photograph or physical microphone/speaker acceptance is established.

[Full voice-room workflow receipt](evidence/voice-room-2026-11-14/workflow-results.json) · [Current-build smoke receipt](evidence/voice-room-2026-11-14/current-build-smoke.json) · [Receipt scope and integrity](evidence/voice-room-2026-11-14/README.md).

## Earlier automatic photo and conversation checks

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

The receipts retain their exact tested source hashes. Afterwards, `src/input/ui.ts` received a provider-status/help-copy update explaining automatic photos and manual canvas interpretation. That earlier revision passed 204 root/110 input tests and both builds with cancellation aliases and named voice controls. These 14 cases belong to their named photo-first candidate, not the current Nox-only room or a later deployment.

## Earlier anonymous deployed application and access boundary

A separate fresh anonymous full-Chromium smoke passed on the [pinned deployed candidate](https://nox-icehacks-eowmrsh75-idk-41a8.vercel.app), serving `main-Cv9doz2f.js` / `index-DE8gYxUo.js` / `main-D8_HSnH1.css` from `760fd41`.

- At 1280×800, typed “show me what you can do” performed two actual 5.008-second spring runs, changed mass 1 → 2, reported sampled periods about 1.57 → 2.22 s, saved the baseline/three versions/checkpoints, and restored exactly after actual reload.
- At 320×667 and 768×900, text/accessibility and layout checks found contained controls and 44 px camera/upload labels, Talk, Stop and typed input. Keyboard/drawer/help checks passed.
- No API mocks, synthetic model replies or UI captures were used in this deployed smoke. Its browser made no API requests and recorded no page errors. The demonstration is local; it does not verify a fresh model request or physical speech.
- The separately recorded anonymous status was `configured: false`, `provider: null`, `accessRequired: true`. That is the protected anonymous view, not proof that the runtime behind the gate has been exercised.

[Production smoke receipt](evidence/photo-auto-2026-11-14/production-smoke-results.json). Subsequent cancellation aliases passed a separate production browser check on `d0393b2` / `main-CPfShkvY.js`: typed and synthetic spoken cancellation after a critical photo question made no second request, applied nothing and kept physics paused at 0.000 s. Named stop/cancellation also passed a separate local production-build check on `main-BJRwfRGF.js`, with synthetic speech and a held photo request. Neither check used fresh inference or a physical microphone.

The earlier application source **`7749a8b`** was promoted at [nox-icehacks.vercel.app](https://nox-icehacks.vercel.app), pinned deployment `dpl_3ed5qM7S6xBxbg3wAMQXkiic2i3C`. Anonymous HTTP checks verified that release's page, entry, application and CSS bytes. The API reported the missing provider connection; this promotion is not current voice-room deployment evidence or a fresh-inference claim.

A fresh anonymous browser check on that stable domain ran both actual spring runs to 5.041667 simulated seconds, measured periods about 1.57 → 2.22 s and restored the saved baseline/three versions/checkpoints exactly after reload. A separate fresh browser passed the real judge-link exchange with no token retained in URL/history and an HttpOnly/Secure/SameSite Strict cookie. Neither check made inference calls; unlocked status remained `configured: false`. [Stable application receipt](evidence/photo-auto-2026-11-14/stable-production-results.json) · [Stable access receipt](evidence/photo-auto-2026-11-14/stable-judge-access-results.json).

The judge-link helper has focused source tests and a real browser exchange on the pinned deployed candidate: the private code was removed from URL/history, the accepted cookie was Secure/HttpOnly/SameSite Strict, and unlocked status accurately remained `configured: false`. Ordinary links make no auth exchange; invalid/failed links do not expose the code or enable inference. Provider credentials stay server-side. Access checks and anonymous local features are distinct from an authorized production model call, which remains a separate live check.

Focused receipts: [critical-question cancellation](evidence/photo-auto-2026-11-14/critical-question-cancel-results.json), [named voice controls](evidence/photo-auto-2026-11-14/named-voice-results.json), [judge access](evidence/photo-auto-2026-11-14/judge-access-results.json).

## Rendering and loading fixes

The source retains disabled renderer antialiasing, cached derived viewport resources and the loader's cached-import fix. A reproduced earlier cold desktop photo run showed that starting physics during the source reveal could trip the unchanged delayed-frame guard. Shared warmup waits for the real reveal to finish before collecting stable paused frames; the assistant waits for actual solver advancement before announcing a running experiment. Stop/new input/visibility cancellation prevents a delayed start.

Earlier controlled photo/local room cases passed within their scopes; the deployed room matrix retains the failed startup case described above. **FixedClock limits were not relaxed.** This development-Mac evidence does not establish performance on every device or visual preference. Earlier drawing-first checks at five sizes and any earlier recovered pauses remain historical evidence.

## Evidence types

| Evidence | Establishes | Does not establish |
| --- | --- | --- |
| Numerical/contract tests and solver replay | Checked geometry, constraints, physical responses, atomic edits, samples and checkpoint behavior within the declared model. | Correct interpretation of every image or all-device performance. |
| Current voice-room controlled checks | Nox-only arrival, fresh local ramp creation, reviewed edits, controlled photo lifecycle, real solver/persistence and cancellation for the supplied reply. | Fresh inference, physical speech, a newly captured camera image or deployment of the current UI. |
| Actual current provider calls | Configured/authenticated transport reaches Momen and returns failed image-conversation results, including a fresh numeric-ID first-call check. | Successful drawing recognition, a usable generated scene or end-to-end model editing. |
| Deployed `8eb042b` matrix and diagnostics | Seven successful cases, one recorded startup failure, and later bounded passes that did not reproduce it. | An all-pass matrix, a proven startup repair or fresh inference. |
| Earlier actual provider sessions | Generated scenes and language operations for those recorded inputs/model/date. | Fresh current-head acceptance or a new photo when an earlier source was reused. |
| Earlier physical-microphone/export evidence | Speech-derived command and recovery data within its recorded scope. | Drawn-source retention for template-based experiments or a new device session on this candidate. |

## Reproducible recorded cases

- [Ramp/cup](evidence/f1-comparison-2026-11-10/Nox-ramp-and-cup.json): editable recorded versions retain the original source; the corrected braced-cup setup holds the ball through its recorded 30-second comparison.
- [Fan/friction](evidence/fan-friction-comparison/Nox-fan-and-friction.json): based on a manually corrected scene; the low-friction box travels about 0.423 m in five seconds while the original surface keeps it near rest.
- [Spring cart](evidence/spring-cart-comparison/Nox-spring-cart.json): corrected slider alignment; stiffness 20 → 40 N/m changes measured period about 0.993 → 0.705 s. This is a different experiment from the local assistant demonstration that doubles mass.
- [Seesaw reply](evidence/live-22-seesaw-2026-11-12/attempt-3/conv-91-response.json): its follow-up fixtures exercise missed support, property/movement/connection edits and rejection regressions. Invalid replies remain invalid test inputs.
- [Earlier paper-photo scene](evidence/live-22-photo-2026-11-12/conv-103-response.json) and [cup move](evidence/live-22-photo-2026-11-12/conv-104-response.json): actual earlier model output reused by controlled browser checks; the current room workflow uses #103. Reuse is not new recognition.

Fixtures remain at the relative paths required by application imports and tests. Credentials, private Git history, personal agent/team instructions and UI capture media are excluded from this public export.

## Remaining live boundary

Each model request has a 120-second deadline; setup, service latency and clarification rounds affect total time. Controlled replies do not prove recognition quality or a universal conversion-time guarantee.

The configured runtime must return a valid interpretation before fresh photo conversion or free-form model edits can be called working. Current actual image checks fail. A successful future result must identify application source, provider/model, input, timing and observed outcome. New camera/microphone acceptance requires a real device session. Public hosting/access is checked separately at its deployed URL; a localhost result is not deployment evidence. Final video, owner review and actual submission remain separate delivery work.
