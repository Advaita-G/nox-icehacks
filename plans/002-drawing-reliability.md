# Drawing reliability and public-repository audit

Baseline: public `Advaita-G/nox-icehacks` main `df80b2f`; application deployment `0784006`. Current request: make broader drawing conversion reliable, audit the actual GitHub repository/README, and follow WORKFLOW.md. Background only; no screenshots, paid overages or Devpost submission. No BMad project configuration is installed, so this is the native implementation spec.

## Findings and scope

The current vision model generates the complete canonical physics schema, normalized compound geometry, duplicate body/grounding lists and support arithmetic. Preserved failures demonstrate mismatched provenance and incorrect scaled geometry. Prompt-only experiments failed. Keep canonical scene validation, command review, cancellation, source identity, physics limits and persistence intact.

Replace only Cloudflare's canonical drawing generation with a smaller drawing plan: metric primitive/convex geometry, inline per-body provenance, explicit support references and optional supported mechanics. Nox compiles defaults, rotations, normalized geometry, request/source identity and declared support contact into the existing canonical scene. This is an explicit intermediate representation, not post-hoc repair of invalid canonical model output. Commands and other providers retain their current contracts. No new dependency, preset selection or automatic retry/fallback.

## Acceptance criteria

1. Each body has exactly one inline grounding entry; the compiler binds trusted request/source identity and produces complete canonical fields. Reject duplicates, unknown references, unknown fields, invalid numbers and stale/invalid source input.
2. Metric geometry compiles without asking the model to multiply nested normalized frames. Test spheres, rotated primitives, convex gables, compounds and thin parts against actual rendered/collision geometry. Preserve supplied dimensions; disclose estimated/default values.
3. Explicit `stackAbove` relationships resolve against the real collider shapes, including a sphere on a tilted board. No floating roof/support gaps or unsupported horizontal relocation. Reject cycles and supports that do not intersect the placement path. Preserve intentional gaps when no support is declared.
4. Supported joints/forces remain canonical and strictly validated; unsupported central behavior asks a concrete clarification. Cancellation/120s request limits, judge access, reviewed edits and Save/reload remain effective.
5. Freeze a diverse image corpus before inference: the failed unlabelled house, annotated sphere/plank, another mechanism, furniture, organic/character forms, abstract geometry and ambiguity/unsupported cases. Record every fresh call, first-attempt status, geometry/feature checks, clarification and failures. Repeat representative inputs; do not select only passing attempts or claim population accuracy from a small corpus.
6. Exercise actual candidate image upload → compiled valid scene → real physics → model-backed reviewed edit → explicit yes → Save/reload in isolated headless Chromium. Include cancel/error paths and narrow-screen checks through text/DOM; no screenshot auditing.
7. Audit current GitHub tree, setup commands, both suites/builds, hosted CI status, README claims/links, API/auth boundaries, dependencies/credits, release assets and deployment provenance. Publish only verified changes and accurately state remaining human/device/vendor limits.

## Tasks

| Task | Delivered behavior | Blocked by | Acceptance | Status |
| --- | --- | --- | --- | --- |
| T1 | Small drawing plan compiles to the existing validated scene | None | Criteria 1–4, focused regression tests | Local implementation/regressions pass; generation acceptance unresolved |
| T2 | Diverse fresh inputs have recorded, independently checked outcomes | T1 | Criterion 5, no hidden retries | 23 requests recorded; fidelity/latency criteria failed |
| T3 | Actual app workflow and failure paths work on candidate | T2 | Criterion 6 | Negative paths pass; full flow failed rendering warm-up; fresh calls quota-blocked |
| T4 | Public repository, README and release match delivered behavior | T3 | Criterion 7, separate requirements/code-quality review | Audit published separately; candidate stays experimental |

Requirements coverage and code quality must be reviewed separately after the final changes. A valid JSON response, passing solver or green build alone does not establish drawing fidelity or whole-product completion.

## Current decision

Main's bounded intake/framing/exclusion/docs fix is separate from this prototype. The prototype branch is `experiment/drawing-plan-reliability`; no promotion or production model switch. The 23 direct requests and all failures are retained in `docs/evidence/drawing-reliability-2026-11-14/`. Final local candidate checks: 249 root tests, 110 input tests and both builds pass. Eight unedited Qwen plans replay through corrected metric compilation and one second of solver execution, but the pinned-lever intent is missing, repeats time out, and the final Gemma generation check did not return usable ready geometry. These are not very-reliable recognition acceptance.

Requirements coverage: **Changes needed**. Code quality: **Pass for the local prototype's bounded compilation/guard logic**, with generation fidelity, provider availability and complete browser runtime explicitly unresolved. Cloudflare's hard free quota is exhausted; no paid usage was enabled.

## November 15 Momen recovery candidate

Momen support reported the common upstream service defect fixed. The original already participant-funded project passed a fresh provider request and an actual current-UI image → reviewed edit → simulation → Save/reload session, without a purchase or model/config change. Its direct canonical corpus then exposed a chair with disconnected legs, despite valid JSON and solver execution.

Reuse this existing compiler for **Momen's canonical drawing route only** on `review/restored-momen-drawings`, based on the checked living-room candidate. Momen receives the trusted output schema in its instructions because its existing adapter previously discarded that argument. Commands retain their canonical route; Cloudflare keeps its existing canonical implementation. No retry, model switch, dependency, auth or validation bypass. A joint-connected body's redundant support declaration is accepted only if the computed contact leaves its explicit Y pose unchanged within 0.000001 m; moving the joint pose still rejects, and final canonical anchor checks remain intact.

Independent review of `59793ca` passed requirements coverage and code quality, while flagging an unnecessary 54,427-character schema appended to commands. The final adjustment puts the same drawing schema text into the drawing wrapper and restores Momen's original adapter unchanged. Drawing wire instructions/schema remain byte-identical to the measured candidate; commands keep the original canonical instructions without the duplicate schema. This reduces scope and credit use without another prompt experiment. Final root/focused tests, build and a pinned hosted command check cover this last change. The English fluid regex is a narrow notes-only optimisation; model intent handling and strict rigid-body validation still apply to other phrasing.

The scope reaches `server/drawing.ts`, Momen schema delivery, provider registration, the scene-schema export, focused compiler/adapter/middleware tests, exact raw-response evidence and current runtime/README claims. Existing callers without an output schema retain their previous contract. Tests currently pass 263/263 and the root build; generation fidelity, representative repeats and an actual candidate app flow remain acceptance gates. Earlier Cloudflare failures remain valid historical failures and must not be overwritten by this provider recovery. Minor facade detail and inferred depth must be assessed from actual geometry, not just messages.

## Delivered November 15

The earlier task table and failed Cloudflare decision above are historical. Reviewed Momen release `8cfcc5a` is merged to main (`b188a52`) and promoted at https://nox-icehacks.vercel.app , deployment `dpl_6L5RE42x4pVpkyw44yocoAzDvmnV`. T1 passes compiler/strict-boundary regressions. T2 has the frozen diverse corpus, all raw outcomes, actual chair connectivity/roof/support/hinge checks and final-contract house/character repeats; these establish bounded cases, not population accuracy. T3 passes actual local and hosted image → reviewed model edit → explicit yes → physics → exact Save/reload, alongside earlier byte-identical-UI cancellation/phone checks. T4 passes public-source/claim/deployment audit and separate scoped requirements/code-quality review; 263 root, 110 input, 27 focused checks and both builds pass. Final hosted smaller-command call passes in 6.921 s; stable alias, all three client assets and access/origin guards match.

The failed experimental PR #1 is closed unmerged, preserving all earlier Cloudflare failures. The completed app is not held for another capacity or prompt loop. Remaining project delivery is concrete: final HyperFrames artifact polish/channel upload, authenticated final Devpost draft save/reopen/preview, physical mic/new paper-photo acceptance and Advaita's explicit final submission approval. No submission, human acceptance or universal recognition is asserted. Current evidence: `docs/evidence/momen-recovery-2026-11-15/README.md`; current account-field boundary: `docs/SUBMISSION.md`.
