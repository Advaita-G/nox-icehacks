# Automatic pictures and direct conversation

This is the user's explicit correction to the earlier staged-upload flow: **upload itself must build**, without another command. Clear reversible spoken edits should apply and acknowledge; a missing degree amount may get one short question or a modest default. The same behavior applies to different objects.

## Implementation

Photo selection, camera, drop/paste and the legacy photo picker all reach the existing image callback, which starts interpretation immediately. No fabricated user build utterance is appended; automatic requests have empty notes unless the user supplied notes. Source identity, pending-turn/cancel guards, compiler validation and automatic model/run remain intact. Errors retain the picture for retry.

Validated pose/property/geometry/world edits apply atomically, retain the previous version and speak an acknowledgement computed from the actual before/after scene. Rotation acknowledgement uses the real angle; it does not trust a generated “done” claim. “Undo” selects the previous retained version with no model call or history deletion. Removal, replacement and mechanism changes still require explicit review. Ambiguous model responses remain questions, with no executable change until resolved. Browser voice opt-in and typed input still share the same action path.

## Evidence

[Controlled interface checks](interface.json) pass at 1280×800 and 375×812 with a ramp, plus 320×640 reduced motion with a chair. The generated model replies are fixtures derived from previously recorded real drawing responses; **zero inference calls** occurred in this matrix. It checks automatic upload/no build command, duplicate build suppression, cancel/late response/error retention, automatic re-upload, direct qualitative mass edit, a short degree question/answer, direct 12-degree edit, local undo, and removal still awaiting review. No horizontal overflow, browser errors or screenshots; checked controls are ≥44 px.

The hosted fresh-inference check uses at most **two** of the remaining free requests: automatic interpretation and an explicit 12-degree model edit. Mass doubling is intentionally parsed locally in that run; it is not presented as a fresh model-backed qualitative mass test. The separate controlled matrix checks qualitative mass/direct acknowledgement. This leaves capacity for the user instead of repeating the unchanged provider experiment.

Root **286/286**, input **110/110** and the root typecheck/build pass. New focused checks cover generic chair/rotation acknowledgements, direct-edit boundaries, selected-part “it,” and local undo routing. Canonical schemas, model provider, degree compiler, physics/frame guards, free price ceilings and credentials are unchanged. Existing large-chunk build warning remains; hosted GitHub CI has been owner-billing-locked.

## Hosted result and deployment

[Fresh hosted flow](hosted/flow.json): image selection alone sends vision with empty notes, no user build command and no numerical form. The genuine model returns ready in 79.297 s; real ball motion is 0.995 m. Local mass doubling applies without yes. A genuine model-backed **12-degree** ramp edit returns in 3.054 s and applies without yes; computed quaternion delta independently verifies exactly 12°. The solver reruns, undo uses no inference and retains all three versions, and source/history/checkpoint Save/reload is exact. Browser errors: zero. Speech recognition/TTS are synthetic; model replies/physics/storage are real.

Pinned deployment: https://nox-icehacks-dmb6hlt0s-idk-41a8.vercel.app (`dpl_HQkmL7aD7VfZ6dkoYvvBiU7bEbc1`). The deployment receipt matches all 72 source/config bytes and six downloaded assets; final committed blobs are checked against the same hashes. Stable alias/status/asset verification is recorded separately.

## Review and limits

Requirements coverage is tied to the hosted/interface receipts. Code quality/security review passes the bounded action policy: edits are already validated and atomic, prior versions remain available, removal/mechanics keep review, late results cannot apply after cancellation, and acknowledgements follow successful application. No dependency, purchase, paid fallback, new credential or host-auth change.

The free model can be slow or emit rejected geometry, as documented in the [previous real attempts](../conversation-flow-2026-11-15/README.md). This UI correction does not make inference instant or establish universal recognition. Speech in automation is synthetic; physical microphone/speaker and human audio acceptance remain unverified. Earlier film/account/submission gates are separate; no upload or Devpost submission is claimed here.
