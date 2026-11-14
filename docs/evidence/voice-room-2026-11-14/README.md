# Voice-room receipts — November 14, 2026

These are exact JSON copies of local browser receipts, checked for secrets and private workstation paths before publication. No fields needed redaction. The localhost URL identifies the test target; it is not a deployed-release claim.

| Receipt | Scope | SHA256 |
| --- | --- | --- |
| [workflow-results.json](workflow-results.json) | Two complete flows at 1280×800 and 375×667, plus eight empty-room cancellation/Stop/error/question exits. | `518881ebb4627248635618bfd2c9c3bac7e2280b6677cf9a6a328f01503018d0` |
| [current-build-smoke.json](current-build-smoke.json) | Later 1280×800 smoke: Nox-only arrival, computed placeholder contrast, fresh local ramp/run and Stop. | `8ff02c5fdbac3c1db81b9e0a96f9f7cbcb2c7456eab1c80129d8506f00d54753` |

Physics, scene validation, image normalization, measurements and storage were real. Recognition and speech synthesis were explicit device fakes. The photo workflow replayed [earlier model reply #103](../live-22-photo-2026-11-12/conv-103-response.json), SHA256 `bc98993bb94b362cecf23b08a315d0cfa2765db9368bb51382fd38379a87722a`, with request/source identity remapped. No current live provider, fresh recognition, new photograph or physical microphone/speaker acceptance is proved. Both receipts report `mediaCapture: false`.

The full workflow names `main-CwljF86v.js`; the later smoke names `main-bCFecXw6.js`. Their application JavaScript is byte-identical: 5,086,528 bytes, SHA256 `d8c38aa51f6985f7561c77d6a78b02076786146c7c630dbbd40c51151fe1d813`. The later CSS/bootstrap received only the bounded desktop smoke, not another complete two-width workflow. Its receipt records all three current asset hashes.

Separately reviewed completed local test logs report 217/217 root tests and 110/110 input-package tests. See [verification](../../VERIFICATION.md) for current results, historical deployment checks and the remaining live boundary.
