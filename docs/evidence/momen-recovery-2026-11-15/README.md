# Momen recovery, November 15, 2026

Actual requests on the original already participant-funded Momen project confirm the vendor's service repair. No purchase, model/config switch, paid plan or automatic retry was used. The configured model was not freshly queried. Project credentials, private support mail and presigned upload URLs are excluded.

## Actual app acceptance

| Source | Interpretation | Genuine model edit | Outcome |
| --- | --- | --- | --- |
| UI `d1ed836`, original canonical route | 21.331 s | 9.241 s | Automatic real 3-body run, explicit yes before velocity 0 → 2 m/s, physical motion, exact source/2-version/checkpoint Save/reload |
| Candidate `59793ca`, actual registered metric Momen route | 14.790 s | 7.293 s | Same complete workflow passed; edited solver reached 2.5917 s and ball x≈3.9571 m; exact library survived reload |

Both checks used one interpretation and one command, actual model replies and no response interception/retry. Speech recognition/TTS were synthetic test devices. Inputs were generated digital JPEGs, not physical camera photos. Capture was only the isolated app page, without screenshots, desktop or microphone capture. Both browsers closed without errors. [Original current-UI receipt](app-flow/live-receipt.json) · [Final candidate receipt](final-app-flow/live-receipt.json).

The [published raw 62.72-second take](https://github.com/Advaita-G/nox-icehacks/releases/tag/momen-recovery-2026-11-15) belongs to the first row: current UI, genuine canonical Momen output, silent footage with synthetic speech. It is source for the final HyperFrames film, not a new YouTube upload. MP4 SHA256: `8db3ccb603d1911ae59f9225f525406ba0827f66f50437643e8a9289145ac572`. Downloaded MP4/WebM/evidence ZIP hashes and full MP4 decode passed.

## Broad input checks and retained failures

[Frozen corpus](corpus.json) and [input images](inputs/) predate these calls. Gold subject/expected descriptions were not sent to the model; only genuine notes for fluid/lever intent were supplied. All attempts retain complete raw replies, status/timings and solver results.

| Input | Actual result and geometry finding |
| --- | --- |
| Annotated ball/plank | Original control ready in 37.956 s; 1 m sphere, 1 kg mass, 3 m plank and support contacts match. Approximate ball source-box IoU 0.938. Metric pilot also preserves supplied numbers; its shape-cast contact overlap is 0.136 mm, inside the explicitly checked 1 mm tolerance. |
| Chair | Direct canonical generation was strict-valid but disconnected: legs were underground and ~0.206 m below the seat. Metric pilot and final adapter instead produce connected frame members; exact box-adjacency checks pass for all 6 and 9 members respectively. |
| House | Wall/pointed-roof contact is coherent. Initial metric facade simplified window grids despite its message; final-adapter output includes panel + two divider parts per window. A fresh identical-contract repeat also preserves roof contact. The input's bottom line is its foundation, not an independently drawn floor; inferred extra ground is reasonable. |
| Tree | Rigid scenery with trunk, branches and rounded canopy; depth is inferred. No biological motion claimed. |
| Character | Rigid head/torso/two-arm/two-leg proxy with face detail. Two final-contract calls return strict-ready scenes in 92.266 s and 43.258 s. This is not animated walking or exact anatomy. |
| Car | Cabin, chassis, two round wheels and drawn ground; explicit rigid approximation without an invented motor. Metric wheels are part of the rigid body because no wheel motion was requested. |
| Abstract shapes/table | Triangle silhouette, box, sphere, table/legs and floor. The metric model chooses pyramid depth rather than the frozen gold's triangular-prism wording; that 3D depth is ambiguous in the actual 2D input and remains an approximation, not an exact prism match. |
| Blank | Root intake rejects the uniform image before inference; regression tests cover this path and retain faint nonuniform drawings. No new vendor call. |
| Essential fluid | Original canonical route asks for a rigid proxy. Metric guard asks the same concrete question before any vendor call and rejects an answer requiring actual fluid flow. It does not claim fluid simulation. |
| Free-pivot lever | Original canonical generation has a real hinge. Initial metric generation was rejected by a blanket joint/support guard, despite an already correctly placed fixed base. Candidate accepts only a redundant contact that leaves the explicit joint pose unchanged within 1e-6 m; moved bases/misaligned anchors still reject. A fresh final-adapter call returns a real free hinge, aligned world anchors and no motor in 30.205 s. |

The initial metric development pass returned **7 ready results from 8 actual generation calls**, plus the zero-call fluid clarification; its lever rejection remains in `metric-pilot/case-10`. The final registered adapter returned **4/4 ready** selected cases and **2/2 ready** identical-contract house/character repeats. These are generation/validation counts, not population accuracy percentages. The two final app requests are recorded separately. No hidden retries replaced a failure. Earlier 23 Cloudflare development attempts remain at [experimental commit `8d12752`](https://github.com/Advaita-G/nox-icehacks/tree/8d12752cd86da89c4ca6925160abc7f460dde231/docs/evidence/drawing-reliability-2026-11-14).

## Reproduction and review boundaries

Run `node --experimental-strip-types docs/evidence/momen-recovery-2026-11-15/audit-geometry.mjs` from the repository root. It performs offline assertions over preserved actual replies: retains the original chair failure, verifies metric chair connectivity, both final house roof contacts, supplied measurements/support, actual free-hinge anchors and zero-call fluid handling. [Computed geometry report](geometry-review.json). The first ball-contact audit used 0.1 mm and failed on the preserved 0.136 mm overlap; the published check explicitly uses 1 mm and retains the measured value. Canonical runtime validation was not loosened.

Candidate `59793ca` passes 263/263 root tests, 110/110 freshly rerun input tests and both typecheck/builds. Current client JS/CSS are byte-identical to the checked `d1ed836` UI; server interpretation changed. Hosted GitHub Actions was previously account billing-locked before jobs, so local success does not establish hosted CI success.

**Requirements coverage:** the bounded recovery, metric/contact fixes and complete local app workflow pass. Arbitrary real-world drawing accuracy, physical microphone/camera acceptance, final film/channel publication and final Devpost account save remain unverified. **Code quality:** focused compiler/adapter/middleware tests pass; credentials, auth, deadline, cancellation, canonical identity/geometry/joint checks, reviewed edits and persistence stay intact. Independent review and pinned deployment acceptance remain release gates. Conservative compound body frames can exceed visible extents; actual primitive/convex geometry remains in meters. Complex shapes and absent depth/materials remain declared approximations.

`SHA256.json` covers the published evidence files. The raw fixtures are model outputs and should be treated as untrusted data.
