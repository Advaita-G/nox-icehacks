# Ordinary drawing conversation, November 15

The user's supplied screenshot is the failure report, not published here: a visible drawing had a cancelled interpretation, then an ordinary build request went to the text-only empty-scene route and asked for dimensions/mass. Earlier exact-command automated acceptance did not cover that interaction. The generated [rough sketch](rough-sketch.png) is the exact image the user uploaded; [input identities](inputs.json) bind it and the existing unlabelled chair image.

## Delivered behavior

Upload stages the normalized source and Nox acknowledges readiness. “Can you build it into a 3D model, a physics model?” carries the actual image and intent to vision before any preset/text-only route. Missing measurements are estimated and disclosed. Unbuilt sources remain attached after closing, cancellation or error. Duplicate spoken/typed requests during a build cannot supersede its result. A requested ready drawing runs after validation. Later edits speak a brief reply, show exact differences (rotation in degrees), and wait for yes.

Qualitative changes propose bounded defaults instead of asking for every coefficient: 25% mass or a five-degree incline. The free provider's command plan expresses rotations in degrees with a named support. Existing quaternion math and actual collider shape casts compute canonical rotate/move operations; canonical validation still rejects invalid data. This is a declared intermediate representation, not repairing an invalid returned quaternion. Other providers/public request schemas, physics guards, free-only price caps and confirmation remain unchanged.

## Actual calls, including failures

All rows use isolated full Chrome for Testing 156 headless, generated inputs, empty numerical notes and synthetic recognition/TTS. Model responses in these rows are real and unmocked; no automatic inference retries occurred.

| Recorded attempt | Outcome |
| --- | --- |
| [First ramp attempt](first-attempt-failed/flow.json) | Image ready, 30.988 s; ball moved 0.944 m. Mass edit 1 → 1.25 kg, 3.376 s. Incline reply 4.301 s returned an invalid multi-axis quaternion; strict validation rejected it. The attempt is **FAIL**, retained with exact API envelopes. |
| [Local ramp after degree compiler](local-ramp/flow.json) | Image 30.005 s, mass 3.381 s, incline 2.329 s. Full flow passes: 1.015 m motion, no measurement questions, duplicate typed build did not cancel the image, yes for both edits, three versions and exact Save/reload. |
| [Non-ramp chair](local-chair/flow.json) | Unlabelled picture, generic build request, no dimensions; ready in 28.736 s. “Make the chair a bit heavier” proposes 25% more mass in 2.603 s. Yes, two versions, source and exact Save/reload pass. This predates the final explicit structural-support default instruction. |
| [Final hosted ramp](final-hosted/flow.json) | Fixed structural supports with no measurements. Image 81.523 s, mass 5.847 s, incline 3.851 s. Real ball motion 1.064 m, explicit yes for both edits, solver rerun after the incline, three versions and exact Save/reload pass. |

The first hosted predecessor also passed the conversation/edits/storage sequence, but its AI estimated a movable ramp. The final drawing instruction explicitly defaults independent structural supports to fixed unless movement/free-mechanism intent is requested. Final acceptance includes a fresh solver run after the incline, rather than only a changed starting display. Current hosted receipts and deployment identity are recorded alongside this file.

The [first fixed-default hosted attempt](fixed-default-first-failed/flow.json) is a real **FAIL**: after 33.439 s, a model drawing plan could not compile; HTTP 502 retained the image and applied nothing. A [separate captured diagnostic](diagnostic/receipt.json) returned a compiler-valid plan in 79.828 s at exactly zero cost. Its original [provider envelope](diagnostic/provider-envelope.json) retains keep-alive whitespace byte-for-byte under a narrowly scoped whitespace exception. These outcomes show variability, not a silent model retry, a guaranteed ready result or instant recognition. The UI's ordinary retry retains the image and never asks users to correct internal numerical geometry.

## Recovery and interface evidence

[Phone recovery](recovery.json): 375×812 normal and 320×640 reduced motion pass keyboard submission, cancellation, late-result suppression, error retention and ordinary retry with the **same** normalized image identity. Actual inference calls: **zero**; responses are controlled fixtures from the real ramp reply. Controls checked ≥44 px, no horizontal overflow or browser errors. No screenshots taken. [Initial harness expectation failure](recovery-initial-test-expectation.json) expected the injected upstream text, while the client correctly showed a safe generic error; the corrected check accepts that safe message.

Speech checks establish recognition callbacks → actions → synthesized replies → listening again. They do **not** establish physical microphone recognition, real speaker output/human hearing or camera acceptance. Image calls took about 30–82 seconds in these cases; there is no instant-response guarantee. Geometry/depth/materials remain estimated; two drawings are not population accuracy. Unsupported central physics can still require a critical-intent question.

## Deployment

Stable https://nox-icehacks.vercel.app is promoted to `dpl_GoANnR3Fdfxx5UcHYV4Sg6NaDVkD`, pinned https://nox-icehacks-j1cg3e7k4-idk-41a8.vercel.app . [Deployment receipt](deployment.json) binds all 72 runtime/source/config files to Vercel uploaded source UIDs and all six client assets to downloaded bytes. Git metadata predates the edits and is not treated as changed-source proof. The final commit is separately verified against these same file hashes.

## Verification and review

Root **282/282**, shared input **110/110**, both typechecks/builds pass. Focused tests cover source-aware routing, cancellation/attachment lifetime, retained intent through clarification, exact degree conversion on every axis, actual support contact for boxes/convex/compound bodies, invalid IDs/degrees/supports/old quaternion rejection, and unchanged public/canonical contracts. Existing large-chunk build warning remains. Hosted GitHub CI was billing-locked; no hosted-green claim.

Requirements coverage: **Pass for the checked generated-image conversational flow**, with physical devices and broader accuracy unverified. Code quality: **Pass for the scoped source/routing/compiler change**. Security review: server-only credentials, pinned free model/zero price ceilings/no paid fallback, same-origin/body/schema/deadline checks, explicit edit confirmation, strict finite geometry and cancellation retained. No new dependency, credential, purchase, auth-policy or physics guard change. Source/client identity and free quota receipts are included; usage is timestamped, not an unlimited-availability promise.

The earlier final film, YouTube/Devpost account transport and personal device/human acceptance are separate delivery gates. No Devpost submission or new film upload is claimed by this repair.
