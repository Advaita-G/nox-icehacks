# Actual runtime checks — November 14, 2026 Pacific

These receipts use the real configured Momen provider through the local production API entrypoint. They are **failed actual inference attempts**, not captured-response successes or deployed/browser end-to-end acceptance. The source is a generated synthetic drawing, not a new camera/paper photo; no physical speech or media capture is claimed. UTC timestamps after midnight belong to November 14 Pacific.

| Receipt | Result and boundary |
| --- | --- |
| [Fresh post-fix image-first check](fresh-postfix-receipt.json) | Zero conversation rows before exactly one corrected image call. Numeric image ID matched the upload result; upload/create/poll returned 200, then FAILED / API 502 in 2.974 s. Safe booleans confirm the pool-shutdown/custom-chat error text; raw error remains private. No scene or strict 3D validation success. |
| [Earlier numeric-ID comparison](numeric-image-id-comparison.json) | Before/after failures at 3.551/2.739 s. The latter used an already-failed pool; its own causal limitation remains intact. |
| [Earlier corrected live receipt](numeric-image-id-live-receipt.json) and [before-type-fix receipt](before-numeric-image-id.json) | Actual request/source/source-code fingerprints for that earlier comparison. |
| [Transport review](numeric-transport-review.json) | Narrow numeric-ID source review and 14/14 injected-transport tests passed. This does not prove live vision works. |
| [Local test/build summary](local-tests-build.json) | Completed logs report 218/218 root tests, 110/110 input tests and a root typecheck/production build pass. It is an extracted log summary, not another run. |

The five actual/review JSON receipts are exact safe copies. The [manifest](runtime-receipt-manifest.json) records their source/published hashes. No provider URLs, credentials, signed upload URLs, raw database/wire records or image bytes are included. The fresh check removes the earlier already-failed-pool confound; the internal cause and a repair remain unresolved. See [verification](../../VERIFICATION.md#actual-configured-provider-failure).
