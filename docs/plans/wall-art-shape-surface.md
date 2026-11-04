# Wall art 03 — technical implementation plan

Status: **R3 has seven-family contour moments, native flat/sloping footprint checks, anchor/floor probes and three exported 100-part starters. R3 remains in progress; the full P2 checkpoint is not complete (2026-11-04).**

Requirements: [phase-03 spec](../specs/wall-art-shape-surface.md), decisions
D1–D18 and SHAPE-UI-D1/D2, AC-1–11 and ST-1–4. Shared boundaries:
[architecture proposal](../architecture.md#phase-03-shape-and-surface--proposal).
The user requested “you can start implementation of this phase-03” after reviewing
this plan. This authorizes P0–P2 under the checkpoint below, not P3–P7.
Earlier boundary failures and their construction revisions are recorded below.
No production phase-03 generator or full visual checkpoint has been qualified.

## Approval and sequence

On 2026-11-04, after reviewing this plan's current checkpoint and remaining scope,
the user said “approved continue”. This authorizes continued R3 implementation,
starting with bounded native-contour Spiral moments. It does not replace the full
P2 visual/contract decision or authorize P3–P7, publication or delegation.

The user requested an **early native-CAD visual checkpoint before committing to
final curvature and surface construction**. Use two implementation stages:

```text
review this plan → approve bounded checkpoint work P0–P2
  → validated native samples + exports + visual review
  → STOP: user reviews curvature/families; update and approve contract freeze
  → P3–P7 production integration and qualification
```

Approval of this plan authorizes only P0–P2 when implementation is requested.
P3–P7 are the proposed continuation, not permission to pass the checkpoint
automatically. Neither a successful test nor a pleasing screenshot replaces the
checkpoint decision. Material scope, dependency, architecture or limit changes
require renewed review. No delegation is requested; build owns all tasks and tests.

The spec currently asks to freeze construction before implementation. Interpret
the requested checkpoint as a bounded pre-production investigation, followed by
that freeze. P0 records this sequencing in the spec after plan approval; it does
not mark provisional formulas or curvature approved. No v3 production startup or
public saved-file dispatch is enabled during the investigation.

## Existing implementation and reuse

- `model/definition.ts` supports exact pairs 1/1 and 2/2. `design-file.ts` uses a
  six-key format-1 envelope, fatal UTF-8 decoding, 1 MiB and depth-16 limits.
- `layout-coordinator.ts` validates before native work, enumerates/partitions,
  builds parts, checks clearance and atomically returns a complete snapshot.
  It reuses bases only for matching footprint inputs. Native batches have at most
  32 items, three initial/two replacement workers and fixed memory reservations.
- `batch-protocol.ts` and `DesignClient` currently assume v2 archived results;
  `confirmUpgrade()` specifically accepts v1→v2. Extend their discriminated
  contracts deliberately; a generic cast of v3 into `ParametersV2` is not reuse.
- `relief-v2.ts` constructs X-only ruled taper. `engraving.ts` has no reason field
  for map-only results and uses v2 height assumptions. Neither can simply be reused
  unchanged for varying top heights and no-plinth pieces.
- Shared snapshots, canonical mesh validation, STEP fragments, STL/3MF streaming
  and temporary-file leases already provide the required export route. Retain them.
- `Workspace.tsx` currently places Display before tool controls. Reorder slots
  without adding tool imports to shared code. Draft parsing currently handles
  only versions 1/2; maintain version-specific controls for old accepted designs.

Use installed Replicad 1.2.0 / replicad-opencascadejs 1.1.0, React, Three/Fiber,
fflate and existing test readers. No dependency, service, build configuration or
license change is proposed. Installed single-thread kernel declarations expose
`GeomAPI_PointsToBSplineSurface`, `BRepOffsetAPI_ThruSections`, face construction,
sewing and solid construction. Their presence is not evidence that the required
trimmed height-field solids work; P1 must test actual calls and ownership.

## Proposed technical contracts

All choices in this section are proposals for this plan. Formula/curvature and
native-construction details remain provisional through P2.

### Definitions, files and migrations

Add `ParametersV3 = Omit<ParametersV2, 'reliefHeight'>` plus `minimumRelief`,
`stepBlend`, `planarTops`, `concavity`, `plinthEnabled`, `family`, `depth`, `density`,
`rotation`, `phase`, `spiralArms`, and `surfaceSeed`. Inherited `topRatio` now has
the v3 two-axis meaning. Maintain explicit ordered key lists and exact validation
per version; do not default missing imported values.

Proposed v3 file shape:

```text
format: printametric-wall-art; formatVersion: 1
modelSchemaVersion: 3; generatorVersion: 3
seed: layout seed
parameters: all ParametersV3 fields except seed, including surfaceSeed
```

Retain the 1 MiB UTF-8/depth-16 limits; no assets, meshes or native snapshots in JSON.
Validate unknown keys, types, finite values, all inactive values, enum membership,
integer seeds/arms and preflight limits before starting a heap. The digest includes
the version and every ordered parameter, including inactive values and both seeds.
Retain exact 1/1 and 2/2 parsing, serialization and generation. UI increments do
not quantize imports or valid manual input. Store ratios, not displayed percentages.

`migrate-v3.ts` produces a parameter candidate only. For v2, preserve footprint,
identification, source top ratio, base thickness and layout seed; map relief height
to minimum relief, amplitude to 0, plinth on and straight profile (proposed
`concavity=1`). Initialize other new controls exactly as D18 specifies. For v1,
compose the existing pure `migrate-v1.ts` mapping with this mapping, including no
physical marks; do not generate or accept intermediate v2 CAD. Both routes produce
one complete v3 preview and require one confirmation.

Keep source bytes and the original accepted native source throughout preview.
After confirmation, retain original imported bytes as separately labelled session
provenance, not as the current v3 save payload. Saving the accepted v3 revision
serializes v3. This avoids the current `originalBytes` shortcut returning an old
definition after an upgrade. Record bounded provenance ownership in the client;
do not add project persistence or retain an unbounded history of imported files.

### Field coordinates, randomness and identities

- Implement fields in pure tool-local modules with no CAD, React, browser globals
  or renderer imports. Evaluate centered assembly XY using `L=min(width,height)`
  and inverse rotation. Preserve nominal dimensions through boundary overflow.
- Start P1 with the spec's seven formulas. Proposed endpoint evaluation normalizes
  360° to 0° and phase 1 to 0, retaining the original valid saved values. Compare
  both endpoints in fixtures before freezing this mathematical equivalence.
- Preserve the existing `wa-g2|layout|...` FNV-1a/Mulberry32 stream unchanged.
  New surface stream proposal: UTF-8 FNV-1a over
  `wa-g3|relief|<family>|<surfaceSeed>`, then Mulberry32 words divided by 2^32.
  Freeze draw order: Dunes q1–q3; Ridges q1; Random direction then phase for
  each k=1..6. No per-cell draws; field values must not depend on enumeration.
  Check vectors for 1/5000/9999 and unequal layout/surface seeds independently.
- Reuse native partitions, cell/component keys, numbering order and exclusions.
  V3 IDs use a v3 prefix plus the stable layout/component identity. Keep reusable
  partition geometry separate from version-specific IDs; derive explicit old/new
  correspondence by cell/component key, not by current array position or prefix
  replacement alone. Surface edits preserve v3 IDs and map numbers.
- Base-cache keys contain footprint inputs only. Surface/height edits reuse bases,
  never shaped snapshots. Version-aware identity remapping must not reseed layouts
  or mutate a retained accepted snapshot during upgrade.

### Native construction candidates and stopping rules

P1 evaluates the following approach; it is not a settled kernel design:

1. Restore exact native footprint faces. Choose the specified interior anchor,
   preserving local-to-assembly translation. An interior centroid is not proof
   that a nonconvex footprint is star-shaped about it. Validate the complete
   scaled-section envelope and self-intersection; reject unproven/invalid taper
   without moving anchors opportunistically or dropping parts. For the fallback
   anchor, investigate deterministic branch-and-bound over signed native boundary
   distance, bounded by the same subdivision/work caps. Freeze its distance error
   and lexicographic tie tolerance in P2; unresolved containment is an error.
2. Integrate the field over the base area with deterministic adaptive quadrature.
   Use a fixed subdivision order and area/error bounds, including curved boundary
   uncertainty, rather than vertex means or two similar sample grids as proof.
   Target normalized error at most `min(0.001, 0.00025/max(depth,1))`: amplitude must
   not magnify a nominal mean error beyond the proposed 0.00025 mm height allocation.
   Freeze integration limits and reference values at P2; failure to converge rejects.
3. Form `H=stepBlend*M+(1-stepBlend)*F`. Fully stepped uses a native plane. Planar
   mode uses area-weighted least squares over the top domain, with constraints
   over its entire native boundary, including curved extrema. Propose solving
   the three-coefficient constrained problem with deterministic constraint
   refinement; no pointwise clamp, horizontal fallback or silently curved result.
4. For continuous tops, investigate bounded tensor-product spline patches in XY,
   trimmed by the scaled native top footprint. Construct matching parametric side
   patches from the agreed flank profile, sew top/sides/base and validate one solid.
   Native planes/ruled surfaces remain exact where applicable. Reuse exact plinth
   extrusion and fuse only when needed. Plain lofting of horizontal slices is not
   assumed to create the correct varying top. For base-boundary point B and anchor
   A, propose top correspondence T=A+topRatio*(B-A), side XY=A+scale(t)*(B-A),
   and side Z=baseZ+t*(topZ(T)-baseZ). This makes boundary matching explicit;
   verify regularity near t=1 for strongly curved profiles. Faceted mesh-to-STEP
   is forbidden.
5. Explicitly treat Ridges creases, Dome's boundary and Spiral's center; partition
   at nonsmooth loci or use a bounded, measured approximation. Spline overshoot
   cannot violate [0,1], material minima, top domain or the error allocation.
   Use independent residual/bound checks, not only the samples used for fitting.
6. Target 0.001 mm total native construction deviation; keep CAD tolerance
   0.001 mm and mesh chord/angle ceilings 0.05 mm/5°. P2 must itemize the combined
   integration, curve, trim, top and flank error budget and show it is attainable.
   Kernel sewing tolerance alone does not certify deviation from the target field.

Bound fitting and integration before allocation. Proposed investigation caps:
8 refinement levels, 65,536 field evaluations per part, 4,000,000 per job,
4,096 spline control points per part and 256 constructed surface patches per part.
Count CAD operations separately under the existing 200,000 job cap. These are
initial guardrails to measure, not advertised capacity. P2 freezes or revises them
with evidence and review; do not start an unbounded fallback when a cap is reached.
Abortable worker lifetime remains the backstop for synchronous native calls.

After bare-solid validation, apply physical identification. Prove local remaining
material under the complete requested cutter footprint, not merely maximum height
or plinth thickness. A proven engraving-only floor failure yields both marks
omitted plus `map-only/residual-floor`; kernel/measurement uncertainty is an error.
Keep glyph-fit fallback distinct. Bare invalidity always rejects. Derive mesh,
actual bounds, volume and archived B-rep from the same final solid.

Do not reuse `polygonClearanceHull`'s v2 taper certificate for v3 without proof.
Use conservative assembly bounds for broad phase; validated v3 envelopes may
certify separation, otherwise perform native distance checks. Preserve the 0.81 mm
clearance check and 1.2 mm material/top/residual-floor minima. Meshes must retain
closed positive-volume components and native/mesh volume agreement within 0.1%.

### Snapshot, error and editor interfaces

Extend tool-local batch and snapshot types with explicit version tags. Dispatch
`buildPartV2` or `buildPartV3` after exact validation; preserve v2 geometry paths.
Use one coordinator/export lifetime implementation for archive-backed versions,
with direct version switches, not a generator plugin registry. Public entry points
accept `unknown`; partition helpers consume a validated footprint projection.

The accepted archive-backed snapshot carries its full tagged definition, immutable
parts/bases/exclusions, digest/revision, actual bounds and budget accounting. Add
per-part shape anchor and identification reason in tool metadata; shared `Part`
and serializers need no knowledge of surface families or wall-art parameters.
Proposed errors add `stage`, `candidateRevision`, and bounded `affectedPartIds`
to existing code/message/field. Plan lookup only selects IDs from its own revision.

Replace v1-specific upgrade state with `{sourceRevision, candidateDefinition,
candidateSnapshot, correspondence}`. Confirm only against the still-current
source revision; cancel/stale completion disposes candidate allocations without
touching accepted arrays or native export sources. Keep original, candidate and
export-pinned memory counted, including upgrade-preview renderer copies.

Retain newest-edit queueing and accepted-value cancellation regressions. An
in-flight export pins its source; later edits never retarget it. No new export
starts with invalid drafts, pending geometry or an unconfirmed preview. Leases
survive successful download until explicit release, including for v3.

Keep v3 controls tool-local. Add focused Surface/Shape components and a numeric
draft/range helper only where shared behavior is real. Percent conversion happens
at the UI boundary; numeric text is authoritative. No-effect controls stay editable
and validated. Reuse native disclosures, recovery focus and camera sequence logic.
App composes slots; shared Workspace renders tool controls before Display without
knowing their fields. Old versions retain their original controls and upgrade action.

## Ordered tasks and completion checks

Paths below are relative to `src/tools/wall-art/` unless fully qualified. All tasks
include purpose/units/ownership comments and relevant documentation, not just code.

| Task / dependency | Files and responsibility | Acceptance / completion evidence |
| --- | --- | --- |
| **P0 — Checkpoint contracts** / plan approval | New `model/parameters-v3.ts`, `validation-v3.ts`, `surface-random.ts`; pure `geometry/surface-fields.ts`; tests in `tests/wall-art-shape-surface.test.mjs`; owning spec sequencing update | AC-1/2/4/10/11: exhaustive boundary/inactive validation, fixed-XY independence, phase/angle candidates, shorter-side and overflow invariants. Keep prototype definitions out of production dispatch. Pin provisional fixture IDs and numeric vector format. |
| **P1 — Small native path** / P0 | New `geometry/surface-sampling.ts`, `surface-fit.ts`, `relief-v3.ts`, `generate-v3.ts`; narrow helpers in `native-operations.ts` as required; `tests/support/` isolated native runner; `scripts/qualify-wall-art-shape-surface.mjs` and small dev-only fixture | AC-1–6/8: actual installed-kernel capability smoke, deterministic means/planes, single valid native solids, curvature comparisons, nonconvex containment, no-plinth floor checks. Explicit allocation cleanup and capped failure cases. Export sample STEP/STL/3MF through existing shared writers and independently reimport. No production UI switch. |
| **P2 — Native-CAD visual checkpoint; STOP** / P1 | Qualification script/fixture, `artifacts/wall-art-shape-surface/checkpoint/`, this plan evidence and owning spec reviewed numerical addendum | Deliver the checkpoint below. Record user's actual choices and unresolved failures. Approve final curvature, formula/construction contract and revised continuation before P3. No automatic approval from passing tests. |
| **P3 — Version, identity and archived generation** / explicit checkpoint approval | `model/{definition,design-file}.ts`, new `migrate-v3.ts`; `geometry/{batch-protocol,native-batch,batch-worker,layout-coordinator,layout-metadata,engraving,clearance}.ts`; v3 builders; `tests/wall-art-shape-surface.test.mjs` plus focused native test files | AC-1–5/8/10/11: freeze exact key lists/digests/vectors/IDs, preserve old geometry, versioned batch validation, complete partition reuse, real runtime counters and atomic rejection. All 20 outline/layout combinations covered, with curved/nonconvex cases; all seven fields, not only starter. |
| **P4 — Upgrade/export ownership** / P3 | `editor/{design-client,layout-host,layout-export,useWallArt}.ts`, `geometry/export-worker-v2.ts` (retain file name unless rename adds clarity), batch STEP route; version-race/runtime/export tests | AC-5/6/8–11: direct v1 and v2 upgrade/confirm/cancel; source bytes/provenance and live CAD retained; stale/newer edits and export races; actual format round trips, denied storage/quota, cancellation and lease release. Shared exporters stay parameter-independent. |
| **P5 — Gridline integration** / P4 | `editor/{WallArtControls,WallArtPlan,WallArtWorkspacePreview}.tsx`, `definition-drafts.ts`, `useWallArt.ts`, new Surface/Shape controls; `src/app/App.tsx`, `src/shared/workspace/Workspace.tsx`, `src/styles.css`; `tests/browser/wall-art-shape-surface.spec.ts` | AC-7/9–11: fresh v3 startup only now; approved drawer order, numeric/range/manual precision, every family and arm count, seed labels, error/no-effect notices, map-only lookup with correct revision, upgrade/save/load/download. 320 px/both themes/forced colours/genuine200% zoom and reviewed screenshots. Preserve drawer/camera and old-version journeys. |
| **P6 — Integrated qualification** / P5 | Test matrix and qualification script; browser/runtime regressions; artifacts; plan evidence | All AC-1–11/ST-1–4: `npm run check`, independent exports+slicer, complete generation/replacement/export memory/time, invalid/cancel boundaries, old-file compatibility. Record each criterion pass/fail/unverified and actual limitations. |
| **P7 — Documentation and handoff** / P6 | Paths in documentation table below | Match verified behavior, commands and status; remove misleading current-tense historical claims without deleting evidence. Review exact diff and check gate. No commit/push/PR/deployment without request. |

### P2 deliverables and explicit review gate

The first checkpoint runs before production version dispatch, full UI integration
or a final surface-construction commitment. It must include:

1. Complete **500×500 mm / 100-piece starter** with approved pitch/gap/plinth,
   heights, density and top ratio. Front, side and isometric captures must render
   the tessellation of its validated native solids, with parameter manifest and
   actual bounds. Compare curvature 1, 2.2 and 4 under otherwise identical settings.
2. All seven families as small real native assemblies; include stepped and
   continuous tops, plus broad-top blend 0/0.5/1 and a genuinely sloping planar top.
   Review narrow default tops separately so they do not hide construction defects.
3. Square/wide/tall physical-scale/rotation examples; clipped curved edges and
   nonconvex radial sectors. Show valid plinth-off, engraving-floor map-only and
   invalid bare-part cases, with errors rather than fabricated successful shapes.
4. Native STEP, STL and 3MF for comparison fixtures; independent CAD/mesh-reader
   dimensions, volume, solid count, topology, curved-face and placement checks.
   Inspect mesh exports in an available slicer. Export evidence is from the same
   final solids used in the captures, not a separate visualization algorithm.
5. Actual initialization/generation/export times, memory estimates and process
   measurements where available; sample/patch/operation/triangle counts, deviation
   checks, native calls used and cleanup evidence. A successful small fixture is
   not full-range or 512/4000-part qualification.

Put generated models/images/reports in ignored `artifacts/`; retain small parameter
and numeric reference fixtures in tests so evidence is reproducible without local
artifacts. The qualification command must fail on invalid geometry, exhausted
sampling, bad exports or budgets; a partial sheet cannot be reported as passing.

**Review asks:** approve or adjust actual starter curvature and its numeric scale;
approve the seven actual appearances and top modes; accept the demonstrated
construction/error bounds. Record failures and engineering changes separately from
visual preference. If the full starter or a required family cannot pass, stop and
revise the plan; do not silently ship stepped-only geometry, hide a family, use
faceted STEP, raise budgets or accept a concept image instead.

## Verification and budget strategy

Retain 120 seconds per generation/selected export, literal 2,000,000,000 bytes,
4,000 retained decorative parts, 100,000 contour vertices, 200,000 CAD operations,
100,000 triangles per part and 2,000,000 total. V1 keeps its exact original limits.
Parameter preflight rejects knowable excessive requests; runtime accounts for
partition, sampling, fitting, surfaces, meshes, archives, copied arrays and renderer
allocations. Each native heap reserves 333,333,333 bytes; do not assume more complex
parts fit a 32-item batch. Use 32 as a maximum and split by conservative estimated
work/memory before scheduling; reserve all active heaps and retained versions.

Calibrate estimates with actual browser process measurements; estimates and
measured peaks are separate evidence. Preserve the accepted model during failed
generation, upgrade or export. No hidden tolerance relaxation or part removal.
Measure default, high-density/continuous, planar, plinth-off and nonconvex cases,
then retained replacement and explicit exports. Include a 512-part attempt and
bounded ceiling attempts, not a mandatory successful 4000-part timing target.
Repeated cold/warm measurements follow C4 where claiming latency; record failures
without reviving waived throughput promises. Cancellation feedback targets 200 ms
while worker termination completes separately. Record actual hardware/browser/build.

Tests use Node's existing runner and both Playwright projects. Split expensive CAD
matrices across fresh test workers to avoid test-heap accumulation. Cover every
family, arm count, outline/layout pair and conditional branch with appropriate
normal/boundary/invalid/error cases; do not confuse this with an exhaustive Cartesian
product. Include targeted high-risk intersections (nonconvex+continuous, seeded
irregular+upgrade, no-plinth+engraving, broad planar+maximum amplitude). Preserve the
five controlled version-race regressions and accepted-value queued-edit recovery.
Wrong-version/missing-seed/invalid-inactive inputs use sentinels to prove rejection
before CAD. Physical prints, screen readers and touch need separate honest evidence.

## Documentation tasks

Current shared docs were checked against the integrated code. README already
describes generator 2; the suite index/editor spec still contain obsolete
phase-02-proposed/not-implemented text. Architecture/development retain historical
capacity investigations alongside current integration descriptions. Reconcile
those specific conflicts in the assigned tasks. The roadmap's earlier statement
that no general CAD/export feasibility prototype is needed does not qualify these
new surfaces; P1–P2 are the requested feature-specific construction/visual check.

| Path | Assigned update and completion check |
| --- | --- |
| `docs/specs/wall-art-shape-surface.md` | P0 staged-gate wording; P2 approved formulas/curvature/numeric tolerances and vectors; P6 evidence per AC. Preserve the approved decision ledger and record actual review outcomes. |
| `docs/specs/wall-art.md`, `wall-art-editor.md`, `website-foundation.md` | P3/P5 reconcile phase02 status, independent seeds and option ledger, direct-v3 upgrade and drawer ordering/Advanced rules. Preserve historical evidence and later-phase scope. |
| `docs/architecture.md` | Proposal added in planning; P3/P4 replace with verified version/ownership/metadata implementation and references, not duplicate equations. Clearly label historical phase02 investigations. |
| `docs/product.md`, `docs/mvp-roadmap.md` | P0 record approved scope as planned; P7 mark implemented only after evidence. Preserve capacity caveats and deferred mounting/packing/assets. |
| `README.md`, `src/app/content.ts`, `src/tools/wall-art/content.ts` | P5/P7 verified usage: independent seeds, nominal scaling, actual bounds, controls/inactive states, old-file/direct upgrade, map-only and explicit export/release. No claims from conceptual images. |
| `docs/development.md` | P1/P6 reproducible native fixture command, frozen manifests/vectors, browser/reader/slicer commands and version/revision/stage breakpoints. P7 current setup/usage/status; older capacity probes explicitly historical. Log safe metadata, not complete designs by default. |
| Setup/configuration/dependencies/licenses | No planned changes. Existing runners discover Node/browser tests; verify discovery rather than install new tooling. Any new kernel/package requirement stops for review. |

## Readiness and planning verification

Unresolved by design until P2: exact curvature scale/default, seven native visual
results, native fitting/trim/sewing method, combined error allocation and calibrated
sampling/patch caps. Proposed file keys, stream keys, identity correspondence and
ownership above are reviewable technical choices, not implemented facts. No other
core product choice is reopened by this plan.

Planning verification on 2026-11-03: `npm run check` passed scaffold validation,
both typechecks, production build, **87 Node tests and 70 browser tests**. Log:
`artifacts/phase03-plan-check.log`. Existing native-module externalization and
bundle-size warnings remain. Tracked-diff whitespace review and the new plan's
whitespace/local-link checks passed. This gate verifies the existing application
and repository conventions, not the proposed v3 path.
At that planning checkpoint, the pre-existing owning-spec review was preserved;
implementation had not started. The following evidence supersedes that status.

## Implementation checkpoint — native construction blocker

The user approved P0–P2 on 2026-11-03. P0 now has strict checkpoint-only parameters,
seven pure fields, an independent surface random stream and literal reference
vectors. Tests cover all numeric/inactive bounds, nonfinite inputs and arithmetic
overflow, integer controls, analytic Wave values, physical rotation/scaling,
seed independence and provisional endpoint behavior. Production dispatch still
rejects version 3. These tests do not freeze the provisional formulas or curvature.

P1 established an installed-kernel native route for **rectangular continuous-top
capability fixtures**. A fixed-grid scalar B-spline top retains physical XY
parameterization. Flanks derive from the same top boundary control points and one
shared vertical scale curve. This avoids the gaps from independently fitted faces.
Native sewing, closed-solid validation and explicit handle cleanup are exercised.
Flat fixtures match an independent analytic profile-volume integral for straight,
2.2 and 4 curvature. One curved Wave fixture passes native STEP round-trip, a second
independent CAD reader and an independent STL reader, including millimeter placement.

The current construction is **not** a general clipped-footprint generator. It has
no certified global deviation bound, area mean, constrained planar fit, plinth,
identification cuts or nonconvex containment. The full starter, 3MF/slicer checks,
actual-CAD visual review and retained application budgets remain unverified.

### Failed capability evidence

`node scripts/qualify-wall-art-shape-surface.mjs` now includes regular cells and
boundary cells by default: seven families × three locations × two top ratios ×
three curvatures = **126 fixtures**. Each uses a 47.5 mm square, continuous top,
20 mm minimum relief and 30 mm amplitude. Fixed fixture inputs and stable IDs are
in each report. The script returns nonzero on any failed fixture or watchdog.

Latest full run: **108 diagnostic passes, 18 rejections**, completed in **52.1 s**,
with **506,224,640 bytes** sampled whole-process RSS. It returned exit code **1**.
Log: `artifacts/shape-surface-native-checkpoint.log`; timestamped JSON reports live
under `artifacts/wall-art-shape-surface/checkpoint/`. This is Node-process sampling,
not an exact transient peak, browser measurement or production capacity claim.

| Region | Maximum sampled top deviation | Result against proposed 0.00025 mm top allocation |
| --- | --- | --- |
| Spiral center, ratios 0.12 / 0.8 | 0.7710 / 5.2261 mm | Reject for all three side curvatures |
| Ridges crease, ratio 0.8 at both boundary locations | 0.3851 mm | Reject for all three side curvatures |
| Dome edge, ratios 0.12 / 0.8 | 0.002923 / 0.02173 mm | Reject for all three side curvatures |

Off-grid samples can demonstrate these failures; they cannot certify a passing
fixture over its complete domain. A CAD-valid solid alone does not establish
fidelity to the intended field.

An earlier Spiral run exceeded the literal 2 GB process cap **during meshing** a
known poor fit. Stage instrumentation established this location; it was not a
demonstrated fitting-memory failure. The meshing helper now rejects excessive or
nonfinite sampled deviations before entering the mesher. Native regressions cover
all three failed regions and a mesher sentinel proves this ordering. Earlier logs
`artifacts/shape-surface-native-{boundaries,spiral-stages}.log` remain as failure
evidence. A later 84-fixture boundary-only run completed with 18 rejections and
505,196,544 bytes sampled RSS. No tolerance or budget was relaxed.

**Gate result:** P1 is incomplete and P2 has not passed. Per the explicit stop rule
above, revise the native construction before continuing; do not treat these
diagnostics as a reduced-scope visual checkpoint.

| Acceptance coverage | Evidence at this checkpoint |
| --- | --- |
| AC-1/2/11 — fields and independent seeds | Pure numeric/seed/scaling regressions pass; actual seven-family native coverage fails at the listed regions. |
| AC-3/4 — means, planes and shape | Straight/curved rectangular volume checks pass. Means, constrained planes, full starter and general native boundaries are unverified. |
| AC-5 — bare material and identification | Zero-relief/no-plinth parameter rejection passes. Native floor checks and Map-only ID behavior are unimplemented. |
| AC-6 — exports | One continuous Wave STEP passes two CAD readers and STL passes an independent reader. Full matrix, 3MF and slicer remain unverified. |
| AC-7/9/10 — UI, upgrades and files | Existing application regressions only; no v3 UI, migration or file support. Tests confirm production rejects v3. |
| AC-8 — bounded work | Diagnostic watchdog and known-bad-fit pre-mesh rejection exist; production counters, cancellation, retained designs and full phase-03 budgets remain unqualified. |

### Construction revision — approved

Keep all seven approved appearances, parameter ranges, native STEP requirements
and existing time/memory limits. Replace a smooth patch across nonsmooth regions
with a bounded piecewise native construction. On 2026-11-03 the user approved this
revision: “approved. if needed do a pr before continuing”. R1–R3 may proceed;
the complete P2 visual/contract review still gates P3–P7. A checkpoint PR preserves
the initial investigation and failed-case evidence before revised construction.

| Step | Work and owned files | Required evidence before proceeding |
| --- | --- | --- |
| R1 — Boundary-aware numerical domains | `geometry/surface-sampling.ts`, `surface-fit.ts` and focused field/native tests | Explicit Dome circle, Ridges crest/trough curves and Spiral center/join domains. Bound subdivision and error over each domain, including between samples. Preserve the current field formulas; any smoothing or visible change returns for review. |
| R2 — Shared-edge native patches | `geometry/relief-v3.ts` and isolated `tests/support/` fixture helpers | Construct and trim native patches with shared edges; assemble one solid. Put the Spiral origin on patch boundaries rather than fitting one smooth Cartesian patch across it. Count patches/control points/operations before allocation. All 18 failed fixtures must pass an independent domain-error check, solid/mesh checks and exports within the existing budgets. A finer grid alone is not proof. |
| R3 — Resume the rest of P1, then P2 | Existing P1/P2 file scopes and qualification runner | Add area means, constrained planes, actual clipped/nonconvex parts, plinth and identification floor checks. Deliver the complete starter/family/mode/export visual matrix already required above. Stop for actual visual and contract approval before P3. |

This revision deliberately establishes whether the nonsmooth fields can be built
before expanding the assembly and UI work. If a domain cannot be bounded or built
within the limits, report that exact failure rather than accepting sampled-only
accuracy, hiding a family or using a faceted STEP substitute.

### Verification of this implementation checkpoint

Targeted command:
`node --test tests/wall-art-shape-surface.test.mjs tests/wall-art-shape-native.test.mjs`
passed **12 tests** after the pre-mesh rejection fix. The deliberately failing
126-fixture qualification is separate from regression success: tests verify known
rejection and old application behavior, not completion of P1/P2.

Full `npm run check` passed on 2026-11-03: scaffold validation, both typechecks,
production build, **99 Node tests** and **70 browser tests** (2.4 minutes for the
browser suite). Output: `artifacts/phase03-implementation-check.log`. Existing
bundle-size and `node:module` externalization warnings remain; the WebGL error in
the browser log belongs to the intentional failure-recovery fixture. These passes
do not resolve the native qualification failure above. `git diff --check` also
passed. The later revision approval permits the checkpoint PR and R1–R3 work;
production integration and new dependencies remain outside that approval.

## Revised construction checkpoint — Spiral tessellation blocker

The approved R1–R3 revision improved the boundary cases but did not pass R2.
Checkpoint [PR #22](https://github.com/RogerGMartins/printametric/pull/22) initially
preserved the P0/native investigation at `f802425`. The user subsequently requested
updating that PR with the verified R1–R3 capability work below before continuing.
The full P2 acceptance gate remains separate from publication.

### Implemented investigation

- `geometry/surface-sampling.ts` separates Dome's circular join, Ridges' crest and
  trough strips, and Spiral's center/join into bounded parameter domains.
- `geometry/surface-fit.ts` uses Bernstein coefficient bounds and interpolation
  remainders instead of accepting agreement at sampled points. Position errors
  propagate through field derivative bounds. The analysis includes explicit
  floating-point allowances for elementary functions; it is not a formal proof
  of every platform's `sin`/`pow` implementation.
- The isolated native helper trims those patches against a rectangular top,
  constructs shared-boundary flanks and checks the resulting native solid.
  Boundary-curve reduction requires a whole-interval residual bound and monotone
  coordinate correspondence. Native knot-removal success alone is insufficient.
- Straight, proposed 2.2 and proposed 4 side profiles remain in the matrix.
  Top/profile component allowances remain 0.0002 mm each. Boundary reduction
  reserves at most 0.00005 mm after taper amplification. This does not establish
  the complete trimmed/assembled generator's global error certificate.
- Tessellation uses the existing 0.05 mm/5-degree starting settings and bounded
  finer attempts. Exact repeated-position, zero-area triangles at collapsed polar
  edges are removed before unchanged mesh validation. No nearby-point welding,
  nonzero-area triangle removal, hole filling or relaxed topology check is used.

Patch/control-point limits remain 256/4096, with bounded numerical work. Native
capability helpers remain under `tests/support/`; neither v3 production dispatch
nor a general clipped-part generator has been introduced.

### Measured result and diagnosis

`node scripts/qualify-wall-art-shape-surface.mjs --piecewise` completed **36** fixed
cases: **33 passed, 3 rejected**. The run took **66.8 seconds**, with sampled
whole-process Node RSS **1,223,573,504 bytes**. This is not an exact transient peak
or browser-retention measurement. All cases produced valid native solids and met
the numerical component bounds, but the following failed mesh acceptance:

| Family/location | Top ratio | Curvature | Failure |
| --- | --- | --- | --- |
| Spiral, centered at `[0, 0]` | 0.12 | 1, 2.2, 4 | Open/non-manifold/inconsistently wound mesh; finer attempts eventually exceed 100,000 triangles per part. |

The failed cases retain their original formulas. Their failure is not permission
to export the valid CAD solid while supplying an invalid preview/STL/3MF mesh.
The command exits 1 and reports `checkpointComplete: false`.

Evidence: `artifacts/shape-surface-piecewise-refined-mesh.log` and timestamped
`native-piecewise-*.json` reports under `artifacts/wall-art-shape-surface/checkpoint/`.
Earlier failed construction and meshing reports remain available.

Shared-native-edge projection, direct triangulation extraction, rectangle-corner
domain splitting and forced edge/pcurve parameter alignment did not resolve the
failure. Unreduced boundary curves exceeded the triangle budget in a narrow
straight-side probe. The final shared-edge diagnostic found 78 invalid-connectivity
edges; corresponding boundary coordinates already agreed in Float32. Maximum
projection was about 2.85e-14 mm. Therefore a rounding crack is **not an established
root cause**. Unsuccessful helper code remains only in ignored artifacts, including
`diagnose-phase03-seams.mjs` and `shape-surface-native-seams.mjs`.

### Verification and remaining gate

The targeted domain, residual-bound and native suites pass **8 tests**:

```sh
node --test tests/wall-art-surface-domains.test.mjs tests/wall-art-surface-certificates.test.mjs tests/wall-art-boundary-native.test.mjs
```

These include native STEP reimport and independent STL placement for passing
Spiral/Ridges/Dome fixtures, plus a real narrow-Spiral regression that requires
rejection despite native-solid validity. They do not claim a second independent
CAD reader, 3MF or slicer qualification for this revised construction. The earlier
two-reader Wave evidence belongs to the initial route.

Full `npm run check` passed on 2026-11-03: scaffold validation, both typechecks,
production build, **107 Node tests** and **70 browser tests** (5.4 minutes for the
browser suite). Output: `artifacts/phase03-boundary-check.log`. Regression success
includes rejection of the known invalid Spiral mesh; it does not qualify that
geometry. `git diff --check` passed.
R2 is incomplete. R3 and the full P2 visual/export checkpoint remain pending,
including means, planar fitting, clipped/nonconvex parts, plinth/identification,
the complete starter and retained-design budgets. No curvature or final surface
construction is approved by these partial results.

### Center comparison — approved

Preserve the current failing fixture and limits. Compare its existing linear
Spiral-center blend with a bounded, smoother center transition designed to remove
the angular singularity, then require native-solid, unchanged mesh, error-bound
and export checks. Include matched native views before selecting any changed
formula. This is an experimental comparison, not a claim that smoothing will
solve the unresolved meshing failure. The R1 approval explicitly requires review
before smoothing or changing a field. On 2026-11-03 the user approved this bounded
comparison and a public-behavior reference review. The existing linear field remains
the baseline; no final replacement formula is selected by this approval. No family
removal, parameter restriction, dependency upgrade or budget increase is proposed.

### Center comparison results — formula not selected

The comparison is a checkpoint-only argument, not a saved parameter or editor
option. `spiral-center.ts` keeps `linear` as the default. Inside the existing
radius `r < 0.02`, let `t=r/0.02`: baseline weight is `t`, C1 is `3t²−2t³`, and C2
is `10t³−15t⁴+6t⁵`. All become 1 outside this region. Only the central 5 mm radius
changes on a 500 mm panel. The candidates remove the corresponding center
derivative singularity; this does not prove the cause of the earlier mesh failure.
Bernstein product bounds and physical-coordinate error transport include the
changed envelope. Error allocations, 4,096 poles, 100,000 triangles, 120 seconds
and 2 GB remain fixed.

Each matrix has twelve Spiral cases: two top ratios, two locations, and side
profiles 1/2.2/4. Every command fails while any fixture fails.

| Transition | Passing cases | Remaining failure |
| --- | --- | --- |
| Linear | 9/12 | Three narrow-center meshes fail connectivity and bounded refinement. |
| Cubic C1 | 9/12 | Three narrow-center candidates fail native-solid validity. |
| Quintic C2 | 11/12 | Broad center, ratio 0.8, straight sides exceeds 100,000 triangles at the first mesh tolerance. |

C2 completed in 17.3 s with sampled whole-process RSS of 554,950,656 bytes. Its
narrow-center meshes contain 84,550 / 45,110 / 66,450 triangles; passing broad-center
curved meshes contain 96,352 / 97,352 triangles. This leaves little margin and does
not qualify arbitrary parameters or large assemblies. C1 took 11.7 s / 653,041,664
bytes. Logs: `artifacts/shape-surface-smooth-center-run.log` and
`shape-surface-smooth-c1.log`. A bounded lower-degree reconstruction did not resolve
the broad failure and was reverted; retain `shape-surface-smooth-c2-bounded-degree.log`.

#### Native views and exports

`artifacts/shape-surface-comparison/native-center-comparison.png` shows matched
actual-CAD views, with `viewer.html`, fixed-parameter JSON and manifests beside it.
It compares linear/C2 at both top ratios and curvature 2.2. The invalid linear
narrow mesh is labelled diagnostic-only and has no printable export. C2 shows a
softer central transition while retaining the surrounding form. This observation
does not approve its silhouette or formula.

The valid C2 narrow fixture passes STEP through Replicad and a second CAD reader,
including volume and millimeter placement. The independent mesher emits collapsed
polar-edge triangles: only exactly repeated-vertex zero-area triangles are removed
before unchanged manifold/volume checks. No proximity welding or hole repair.
STL passes its independent reader. Both narrow and broad curved 3MF fixtures pass
Three's reader for closed meshes, volume, bounds and `[137, -46, 9]` translation.

OrcaSlicer imports the narrow 3MF and produces an actual 45,110-triangle STL with
matching dimensions and volume (relative error 0.000944315). It preserves XY but
moves the floating input down 9 mm onto the bed; `slicer-evidence.json` records this.
Original 3MF placement was verified separately. The initial `--info` call failed
without diagnostics; `--arrange 0 --export-stl` succeeded and its file was checked.
No physical print was performed.

The explicit `--comparison-artifacts` C2 run, including exports, repeats 11/12 at
20.9 s / 616,534,016 sampled RSS bytes and exits 1. This is not latency qualification.
Native exports are written only after mesh checks pass. All artifacts remain local.

#### Public-behavior observations

A public trial was inspected through ordinary controls in disposable contexts.
No source, implementation formulas or assets were copied. With movement reset and
continuous Spiral selected, square panels rendered visibly faceted geometry: the
100-piece view reported 2,190/7,536 total triangles for narrow/broad tops; an 81-piece
odd-grid view reported 2,028/5,988. These are UI-reported counts, not verified files.
Downloads were unavailable. A spiral-looking preset combined Dome with separate
movement, so its appearance cannot establish standalone Spiral field behavior.
These observations establish neither native STEP capability nor an algorithm
that can replace the independently developed CAD route.

#### Decision and verification

Recommendation: review C2 as the provisional direction for further construction,
then resolve the broad/straight budget case under the same limits before P2. C2
is not selected automatically; comparison approval does not approve a replacement
formula. C1 is not a qualified fallback. Full starter, means/planes, general
clipping, identification, retained editing and whole-assembly exports remain pending.

The user answered “yes” to this direction on 2026-11-03. Continue C2 construction
and resolve the broad-top/straight-side case under the existing limits. This is
provisional direction approval, not final P2 acceptance or production integration.
The original linear comparison remains reproducible.

Three pure comparison tests pass. The targeted C2 native regression passes after
exact collapsed-triangle normalization in the independent reader. Full
`npm run check` passed: scaffold validation, both typechecks, production build,
**111 Node tests** and **70 browser tests** (2.0 minutes for the browser suite).
Output: `artifacts/phase03-center-comparison-check.log`. These regressions do not
override the remaining native qualification failure. `git diff --check` passed.

### C2 construction checkpoint — triangle blocker resolved

Following the approved provisional C2 direction, narrower angular charts reduce
the mesher's refinement cost without changing the field. C2 now uses angular
degree 10 with sector count `ceil(angleSpan*arms/4)`; linear/C1 retain degree 12
and the previous divisor 6. Every chart still carries the same whole-domain error
check. Radial construction, tolerances, native validation and production budgets
are unchanged. Degree-8 boundary reduction and whole-cycle angular charts did not
qualify and were reverted; their diagnostic logs remain in artifacts.

The supervised twelve-case C2 matrix now **passes 12/12**, exits 0, and still
reports `checkpointComplete: false`. It took 26.0 s with sampled whole-process
RSS of 703,201,280 bytes. Evidence: `artifacts/shape-surface-c2-narrower-charts.log`.
This is a small diagnostic matrix, not repeated latency or browser qualification.

| Centered case | Canonical triangles | Control poles |
| --- | ---: | ---: |
| Narrow top, straight sides | 73,868 | 1,264 |
| Narrow top, curvature 2.2 | 79,126 | 2,408 |
| Narrow top, curvature 4 | 66,836 | 1,576 |
| Broad top, straight sides — former failure | 98,886 | 2,024 |
| Broad top, curvature 2.2 | 92,086 | 3,960 |
| Broad top, curvature 4 | 93,008 | 2,552 |

All canonical meshes pass closed/manifold/winding and 0.1% native-volume checks
below 100,000 triangles. All native constructions stay below 4,096 poles and the
existing error allocations. The worst broad cases have little headroom; these
results do not guarantee other parameters or assembly sizes.

The narrow curved and formerly failing broad straight fixtures each pass two
STEP readers and independent STL checks. The independent STEP reader creates its
own tessellation: 60,178 and 108,632 triangles respectively, versus canonical
79,126 and 98,886. That diagnostic uses an explicit 500,000-triangle test ceiling;
it does not replace the 100,000-triangle canonical part assertion or alter runtime
budgets. Topology, volume and placement checks remain unchanged.

The explicit artifact run also passes 12/12 (`shape-surface-c2-chart-exports.log`).
`artifacts/shape-surface-comparison/native-c2-chart-comparison.png` adds matched
straight-sided views. Four C2 3MF files (both ratios, straight/curvature 2.2) pass
the independent browser reader. OrcaSlicer imports and re-exports the formerly
failing broad/straight file as a valid 98,886-triangle STL, with relative native
volume error 0.0000092108, preserved dimensions/XY and the documented -9 mm bed
shift. Evidence: `smooth-c2-0.8-c1-slicer-evidence.json` beside the comparison.

Targeted C2 reader regressions pass. Final `npm run check` passed scaffold validation,
both typechecks, production build, **112 Node tests** and **70 browser tests**
(2.3 minutes for the browser suite). Log: `artifacts/phase03-c2-chart-final-check.log`.
The original linear rejection regression remains.

The first full run passed all Node tests but failed four development-browser
checks while loading or generating models. Targeted runs reproduced delays even
after stopping the owned review servers and rebuilding Vite's cache. Failure
traces and logs remain under `artifacts/phase03-c2-chart-*`. Vite debug output
showed multi-second source resolution. An isolated watcher-exclusion experiment
loaded promptly; a later control also recovered, so no single cause is proven.
The final configuration excludes generated `artifacts/` and `playwright-report/`
trees from development watching. Source/test-fixture hot reload remains enabled;
artifact pages require manual refresh. No test timeout or assertion was relaxed.
All checks then passed. The local review servers were stopped during diagnosis;
the retained native screenshots remain available.

R3 still owns means, planar fitting, general clipped/nonconvex parts, plinth and
identification, complete starter/family views, assembly exports and retained-design
budgets. This resolves the specific R2 triangle blocker, not the complete P2 gate.

### R3 progress — area, native footprints and assembled starter

**Scope remains investigative.** The user requested continuation of the approved
R3 work. The following are implemented capability slices, not a general generator,
production version dispatch or approval of the complete P2 checkpoint.

#### Area and top modes

`surface-moments.ts` now has rectangular area/first-moment routes for all seven
families. Harmonic fields use analytic integrals; Dome uses disk/rectangle
primitives; Ring uses bounded Gauss quadrature; Ridges integrates across its
half-cycle boundaries; Spiral uses bounded adaptive charts with the selected
center envelope. Explicit derivative/remainder bounds control stopping, rather
than agreement of sample grids. Work exhaustion is an error. Floating/libm
allowances remain explicit assumptions, not a formal platform arithmetic proof.
The original linear Spiral still exhausts work on some center/join rectangles;
it is never silently replaced by C2. Nonrectangular integration remains pending.

Rectangle planar fitting solves the constrained area-weighted three-variable
least-squares problem. All four corners constrain the entire plane to [0,1].
The native planar builder proves nested-section injectivity with Bernstein bounds
and rejects a folded sloping taper. Four exact vertical subdivisions reduce native
meshing cost without changing the profile or its error allowance.

Continuous Wave/Dunes/Random now use bounded Cartesian harmonic patches; Ring uses
bounded radial patches. Existing Dome/Spiral/Ridges domains remain. An isolated
native mode probe passes **28 cases**: all seven fields, each stepped, half-blended,
continuous and planar. Stepped/blended cases have actual fused plinths; continuous
and planar cases have none. Canonical meshes pass the unchanged closed-mesh,
100,000-triangle and 0.1% volume checks. This is a representative rectangle matrix,
not coverage of all mode/footprint/parameter combinations. Log:
`artifacts/phase03-r3-surface-modes.log`. All seven continuous representative
families also pass native STEP/STL round trips.

#### Native flat footprints

`shape-surface-footprint-native.mjs` restores real phase-02 contours and proves
star-shaped containment about the selected anchor using the rational Bernstein
sign of `X*Y'−Y*X'`. Caps and flanks share the same native boundary. Offset-curve
conversion has an explicit 0.00000001 mm bound; uncertain containment rejects.
This route currently constructs flat tops only. A concave star-shaped fixture is
accepted; an outside-anchor fixture is rejected. Maximum-inscribed-circle anchor
fallback and general sloping/continuous footprints remain pending.

The four-outline/five-layout matrix checks the largest and smallest eligible
clipped bases: **39 valid parts and one proven rejection**. The rejected radial
fragment extends outside its original footprint at an intermediate taper scale;
it is retained as rejection evidence, not dropped from a design. Native area-based
analytic volume and adaptive CAD volume agree; all accepted meshes pass. The
adaptive CAD measurement uses its reported integration error, rather than relying
on the less accurate default volume routine.

A separate exact-topology adapter maps mesh endpoints to their corresponding CAD
vertices, with at most 0.0000001 mm adjustment. It resolves near-zero rounding
differences on a hexagonal fixture. It does not search spatial neighbors, weld
nearby surfaces or fill holes. The older Spiral failure remains a rejection test;
this limited vertex result does not establish that earlier failure's cause.

#### Complete Wave starter evidence

`qualify-shape-surface-starter.mjs` builds the actual 500×500 mm, 100-piece stepped
Wave starter with plinths, numbers and orientation marks. Five fresh native heaps
build twenty parts each, then assemble native STEP and streamed STL/3MF. Overall
time, sampled process RSS, aggregate triangles and fixed diagnostic operation
reservations are bounded. The operation reservation is not a precise count of
every internal kernel operation or a qualified production scheduler.

| Side profile | Canonical triangles | Generation + exports | Sampled process RSS |
| --- | ---: | ---: | ---: |
| Straight (1) | 12,528 | 22.2 s | 541,704,192 bytes |
| Provisional inward curve (2.2) | 106,288 | 35.8 s | 576,045,056 bytes |
| Strong inward curve (4) | 105,008 | 27.9 s | 572,198,912 bytes |

Each run completes under 120 seconds / 2 GB, with actual top heights
**31.5663–58.4337 mm**, not assumed envelope endpoints. These are single Node
diagnostic runs, not repeated browser capacity claims. Reports, models and preview
manifests are in `artifacts/wall-art-shape-surface/starter-<profile>-<timestamp>/`.
Logs: `phase03-r3-starter.log`, `phase03-r3-starter-straight.log` and
`phase03-r3-starter-strong.log` under `artifacts/`.

All three assemblies pass two STEP readers (100 native solids / 100 independently
retessellated parts), STL checks for all 100 placements, and the browser 3MF reader
for all 100 placements. Independent readers retain their separately documented
diagnostic ceilings. The default 2.2 assembly also imports into OrcaSlicer and
re-exports **100 valid STL parts**, preserving world placement; maximum relative
native-volume error is 0.000441702. No physical print was performed. An initial
reader script API mistake and a mistyped slicer input filename were corrected;
their failed logs remain evidence, not successful checks.

`artifacts/wall-art-shape-surface/starter-review.png` contains matched front, side
and isometric views of all three native assemblies. The side view follows the
wave direction. These views are available for user review, not recorded approval.

#### Remaining R3 scope and verification

General clipped-domain integration and constrained planes, continuous/sloping
nonrectangular solids, anchor fallback, local no-plinth engraving-floor proof and
Map-only reasons, full family assembly/mode views, end-to-end error accounting,
and retained-design/browser work budgets remain incomplete. Existing plinth
engraving is reused only where its 1.2 mm floor contract actually applies.
R3 must finish those checks before the full P2 review stop; P3–P7 remain gated.

Targeted moments, profile, footprint, domain and mode checks pass. Full
`npm run check` passed: scaffold validation, both typechecks, production build,
**124 Node tests** and **70 browser tests** (2.1 minutes for the browser suite).
Output: `artifacts/phase03-r3-check.log`. `git diff --check` passed. These checks
cover the implemented capability paths, not the remaining full P2 requirements.

### R3 progress — contours, planes, anchors and bare identification

After publication of `2b21017` to PR #22, the approved investigation continued with
the following capability slices. PR checks passed on Ubuntu and Windows for that
published commit; its separate Windows push job was cancelled. The evidence below
belongs to subsequent local work until another checkpoint is published.

- **Native contour moments:** Wave, Dunes, Random and Ring use signed radial fans
  over rational Bézier boundaries. Gauss remainder/complex-domain bounds control
  refinement. Contour approximation contributes a separate area-error allowance.
  Concave-domain integration does not establish taper containment. Work remains
  capped at 65,536 field evaluations, 4,096 chart creations/poles and depth 8.
  Ordinary floating-point/libm assumptions remain explicit. Dome/Ridges/Spiral
  contour integration rejects instead of using an uncertified approximation.
- **Native sloping caps:** area-weighted plane fitting uses the actual domain
  moments, bounded constraint exchange and whole-boundary rational certificates.
  A relaxed objective bounds fitting error; uncertainty above 0.0002 mm rejects.
  Exact affine pole transforms make native planar caps with curved trim. Flank
  bounds reject folding. Twenty outline/layout combinations pass native-solid and
  canonical-mesh checks. A curved ellipse/radial cap passes native STEP volume
  and independent STL triangle/placement checks. Additional local two-reader STEP
  and 3MF/slicer evidence is recorded below.
- **Anchor fallback:** keep an interior area centroid; otherwise bound the largest
  inscribed-circle radius using native signed distances and deterministic search.
  Proposed constants are 0.0000001 mm distance error, 0.0005 mm radius tolerance,
  0.000001 mm candidate tie tolerance, 4,096 samples and depth 24. Exhaustion rejects.
  The outside-centroid L fixture repeats its result, bounds the known radius and
  retains world placement for a sloping cap. An independent area-moment check
  corrected the fixture's supplied centroid from `[36,36]` to `[33,33]`.
  Source metadata stays unchanged; the returned solid carries its selected-anchor
  translation. Numerical tie selection remains a P2 contract-review item.
- **Bare identification:** a temporary reference prism supplies only the existing
  2D glyph placement. Every number/arrow prism is checked against the real solid
  through the requested cut depth plus 1.2 mm. One proven missing prism omits both
  marks with `residual-floor`; failed 2D placement uses `glyph-fit`. Without a proven
  failure, ambiguous residues reject. Operational CAD failures always propagate.
  No reference prism is fused to the part. Tests cover valid engraving, narrow tops,
  invalid bare material, disabled marks, native failure and unchanged source solids.
  Slab offsets of −0.1/−0.01 mm below the floor produce Map-only ID; the exact floor
  and +0.01 mm engrave. The −0.001 mm fixture rejects as uncertain. Sloping material
  also proves a missing floor despite its taller edge. This is capability evidence,
  not complete bare-material validation for arbitrary continuous tops.

The original 40 native footprint selections now use actual Wave area means for
stepped heights: 39 accepted meshes and one proven intermediate-taper rejection.
All four supported fields have bounded means on those selections. Pure regressions
compare independent rectangular and polar integrals, orientation and concave area;
they reject invalid coordinates, weights and exhausted work. The circular plane
oracle checks both inactive and active constraints.

An early ellipse integration exhausted work with a coarse polynomial bound. Exact
finite Taylor bounds tightened that estimate without raising limits. A plane case
initially exceeded its height-error allocation; refining the numerical interior
margin resolved it without changing the acceptance allocation. Failed diagnostic
logs remain under `artifacts/phase03-r3-contour-*.log`.

Combined contour/footprint/identification/anchor regressions passed nine tests in
18.0 seconds before the additional floor-boundary regression. The extended floor
and anchor checks then passed three tests. Logs: `artifacts/phase03-r3-combined.log`
and `artifacts/phase03-r3-floor-anchor-boundaries.log`.

Local export probes cover the curved sloping cap and a valid bare Map-only part.
Both STEP files pass native solid/volume checks and an independent CAD reader's
mesh, placement and volume checks. Independent STEP meshes contain 2,816 / 332
triangles with relative volume errors 0.000088529 / 0.000680764. OrcaSlicer imports
their standard 3MF files and re-exports actual 2,060 / 484-triangle STL files. Those
files pass closed-mesh, winding, world-placement and volume checks; relative volume
errors are 0.000172246 / 0.000437896. Their source Z is already zero, and placement
is preserved. Orca logs its existing exclude-triangles message but exits zero;
success is based on the checked output files. Evidence is under
`artifacts/wall-art-shape-surface/contour-export/`, with `step-reader-evidence.json`
and `slicer-evidence.json`. The local script is
`artifacts/phase03-r3-contour-export.mjs`. No physical print is claimed.

Full `npm run check` passed scaffold validation, both typechecks, production build,
**132 Node tests and 70 browser tests** (2.1 minutes for the browser suite).
Log: `artifacts/phase03-r3-contour-check.log`. Existing build warnings remain;
the WebGL error is from the deliberate failure-recovery test. `git diff --check`
passed. These checks cover this capability slice, not complete P2 acceptance.

Remaining R3 work includes Dome/Ridges/Spiral nonrectangular moments, general
continuous native tops, broader identification/material/anchor coverage, combined
error accounting, full family/mode assembly views and retained-design/browser
budgets. The full P2 review and P3–P7 approval gate still apply. Architecture,
product/roadmap and README need no change for these isolated capability probes;
the spec status and development diagnostics are updated here.

### R3 progress — Ridges and Dome contour moments

The user requested continued approved R3 work on 2026-11-04, then requested a PR
update and resolution of the verification issue. This extends the previous
checkpoint in PR #22. The full P2 review still gates production integration.

Ridges and Dome now integrate actual native rational contours, including concave
domains. Green boundary integrals provide area means and first moments. Their
primitives have continuous first derivatives and bounded weak second derivatives
across field creases or the disk edge. Composite midpoint remainder bounds cover
whole intervals; agreement of sampled grids is not the acceptance rule. Shared
rational derivative helpers bound the native curves without polygon substitution.
Geometric and field stages share the existing 65,536 evaluation and 4,096 chart
creation limits. Arithmetic/libm assumptions remain explicit; exhaustion rejects.

- Ridges uses periodic triangular-wave primitives. Subtracting terms whose closed
  boundary integrals vanish reduces cancellation without changing the field,
  phase or surface seed. The initial nonperiodic form exhausted work during tight
  planar fitting; `artifacts/phase03-r3-ridge-planes.log` preserves that failure.
- Dome uses radial fluxes for `max(0,1-r²)`. Control-hull bounds distinguish curves
  inside, outside or crossing its disk. Constant line determinants retain signed
  cancellation rather than charging every short edge for its coordinate box.
  Initial square/triangle plane probes exceeded 65,536 evaluations. The tighter
  bounds resolved them without increasing limits or relaxing precision. Failed
  logs remain `phase03-r3-dome-planes.log` and `phase03-r3-dome-planes-bounded.log`.

Pure regressions compare rectangular closed forms, independent disk-area slices,
exact centered Dome disks, concave decompositions, world moments across anchors,
reversed/rationally rescaled curves and deterministic repeats. Ridges covers
density 0.2/12, phase endpoints, seed endpoints and 200 mm amplitude; Dome covers
inside/on/outside/crossing disk boundaries and 200 mm amplitude. Excess precision
and work still reject. Native probes now evaluate all six supported fields on the
40 selected clipped footprints. Plane matrices add **20 Ridges and 20 Dome cases**
to the existing 20 Wave cases. Each uses the same native containment, fitted-height,
solid/mesh and independent volume checks. Dome can legitimately produce a flat
plane on a symmetric footprint; each outline matrix also requires a sloping case.
The Dome-only matrix passed in 27.0 seconds; this is diagnostic timing, not a
capacity tier (`artifacts/phase03-r3-dome-planes-flux.log`).

Ellipse/radial planes pass native STEP volume and independent STL placement checks
in the regression matrix. Additional local Ridges/Dome files pass a second STEP
reader and 3MF import/re-export through OrcaSlicer. Actual slicer output files are
checked for closed meshes, winding, volume and unchanged millimeter placement;
an exit code alone is not acceptance. Evidence is under
`artifacts/wall-art-shape-surface/{ridge,dome}-contour-export/`, including
`step-reader-evidence.json` and `slicer-evidence.json`. The ignored local script
`artifacts/phase03-r3-contour-export.mjs` selects `--ridges` or `--dome`. No physical
print or full-family assembly qualification is claimed.

| Representative plane | Independent STEP triangles / relative volume error | Slicer STL triangles / relative volume error |
| --- | --- | --- |
| Ridges | 3,428 / 0.000104076 | 2,110 / 0.000159599 |
| Dome | 4,686 / 0.000088978 | 2,762 / 0.000198705 |

The independent STEP reader retains its separate 500,000-triangle diagnostic
ceiling; generated canonical parts remain capped at 100,000. Orca again logs its
exclude-triangles message; the checked files establish this round-trip result.

#### Shared-gate blocker — 2026-11-04

The first full `npm run check` for this extension passed scaffold validation, both typechecks and the
production build, then stopped at Node tests: **136 passed, one failed and two
were cancelled out of 139**. The flat-footprint outline worker exceeded its
30-second watchdog. The existing v2 rectangle/triangular and rectangle/radial
export cases also exceeded their 30-second test limits. Browser tests did not run
in that gate. Log: `artifacts/phase03-r3-ridge-dome-check.log`.

At that point the failure had not been attributed to a cause. Isolating the two existing
export cases reproduced a passing triangular case followed by a radial timeout.
A fresh-process trace of the unchanged radial fixture completed its native build,
STEP readers and mesh exports in about three seconds. The same trace after a
triangular worker exceeded 30 seconds, including when the first worker exited
naturally. This is evidence of a sequence-dependent slowdown, not proof of its
owner or a geometry defect. The ignored diagnostic is
`artifacts/diagnose-radial-export.mjs`; traces are
`phase03-r3-{radial-stage-trace,two-worker-stage-trace,natural-exit-stage-trace}.log`
under `artifacts/`. A combined two-file isolation run also reached its shell's
120-second limit; it is not a completed test run.

A separate browser run completed 42 passing tests and recorded two 30-second
camera-test failures before the shell stopped it at 300 seconds. Zoom in timed
out while filling Seed; Zoom out timed out while pressing its button. The suite
is incomplete, not a browser pass. Log:
`artifacts/phase03-r3-ridge-dome-browser.log`; failure traces are in `test-results/`.
Neither test deadlines nor geometry/error limits were increased. The targeted
native and export evidence above remained valid, but publication was blocked
on a passing shared gate. `git diff --check` passed. The resolution follows.

#### Shared-gate resolution — Windows idle standby

The subsequent investigation reproduced intermittent native timeouts even with
two test files, and then with serial files. Limiting concurrency alone did not
resolve them. During the serial probe, an existing v2 export reported 835.8 seconds
despite a 30-second test deadline. Windows System events identify Modern Standby
entry at **19:48:04 on 2026-11-04** (event 506, Idle Timeout) and exit at **20:01:55**
(event 507, keyboard input). That suspension matches the long elapsed interval.
Earlier short slowdowns were not individually attributed; no geometry defect was
established by those timing failures.

With a temporary system/display keep-awake request, the unchanged full gate passed:
scaffold validation, both typechecks, production build, **139 Node tests** in 77.2
seconds and **70 browser tests** in 2.4 minutes. This includes the previously failing
native and camera tests. Log: `artifacts/phase03-awake-check.log`. No timeout,
geometry/error budget, test concurrency or assertion was relaxed.

`npm run check:awake` now provides that opt-in Windows setup using the existing
gate entry point. Its PowerShell thread restores the previous execution state in
`finally`; process exit also releases the request. It changes no persistent power
setting and does not override explicit user sleep. Normal `npm run check` and CI
keep their existing behavior. The development guide records usage and diagnosis.

The committed wrapper was then verified through `npm run check:awake`: the same
complete gate passed again, with **139 Node tests** in 109.3 seconds and **70 browser
tests** in 4.8 minutes. Log: `artifacts/phase03-publish-check.log`. Timing remains
machine-dependent; both runs preserve the existing individual deadlines. The
earlier failed logs remain available. `git diff --check` passed before publication.

Spiral nonrectangular moments, general continuous native tops, broader material/
identification/anchor coverage, combined construction-error accounting, complete
family/mode assembly views and retained-design/browser budgets remain R3 work.
This extension adds no production dispatch, dependency or saved-format change.
Architecture, product/roadmap and README need no update for this isolated slice.

### R3 progress — Spiral contour moments

The user's subsequent approval continues R3 after the published/reviewed checkpoint
at `7638e86`. It does not approve full P2 or begin P3–P7. This extension integrates
Spiral over actual native rational contours, including concave and origin-touching
domains. All seven families now have bounded contour-moment routes; exhaustion
still rejects, so this is not an arbitrary-parameter throughput guarantee.

The radial Green primitive uses finite polynomial/exponential integrals inside the
center envelope and a decaying correction outside it. Linear, C1 and C2 centers
remain explicit diagnostic arguments; linear remains the default. Integer angular
modes avoid a branch discontinuity. Whole-chart complex bounds control Gauss
remainder; origin and envelope-join charts have separate error bounds. Geometry
and integration share 65,536 evaluations and 4,096 chart creations, with depth 8.
Each exponential integral has at most 32 Taylor terms or a short recurrence.
Floating-point/libm assumptions remain explicit rather than a formal proof.

Tight fitting initially exhausted its arithmetic allowance. Exact line determinants
and the actual radial primitive's decay tightened the estimate without increasing
the allowance or work limits. A circle exactly on the center join exposed loose
Cartesian radius bounds; positive rational Bernstein coefficient ratios now bound
the complete squared radius. Failed diagnostic logs remain in
`artifacts/phase03-r3-spiral-planes*.log` and `phase03-r3-spiral-contours.log`.
The latter also records an under-resolved independent polar oracle; increasing
its independent sample resolution met the unchanged comparison tolerance.

Pure checks compare rectangular integrals, centered-circle angular identities,
an asymmetric disk crossing the envelope join, and an off-center disk at the
1e-8 plane-fitting precision. They cover arms 1/5/16, low/high density, phase,
rotation, reversed/rescaled rational spans, anchor invariance, explicit center
modes and bounded rejection. The join fixtures explicitly use a 150 mm reference
length, placing the join at 1.5 mm rather than relying on the 500 mm default.
Independent sampled oracles supplement, rather than replace, acceptance bounds.

Twenty provisional-C2 native sloping fixtures pass across four outlines and five
layouts. Existing flat fixtures now evaluate all seven families, including linear
Spiral. Native validity, closed canonical meshes, fitting uncertainty, volume,
triangle/pole caps and source placement remain checked. The ellipse/radial fixture
also passes native STEP and independent STL checks in the portable test suite.

Local `--spiral` export evidence is under
`artifacts/wall-art-shape-surface/spiral-contour-export/`. Native STEP reimport passes;
the independent STEP reader produces 3,964 valid triangles with relative native
volume error 0.000105943. OrcaSlicer imports the standard 3MF and re-exports 2,334
valid STL triangles with relative volume error 0.000164764. World placement and
millimeter scale pass. The slicer's existing exclude-triangles message remains;
success is based on the checked output file. Independent STEP retains its separate
500,000-triangle diagnostic cap; canonical geometry stays under 100,000 per part.
No whole-family assembly, browser-capacity or physical-print claim follows.

`npm run check:awake` passed scaffold validation, both typechecks, production build,
**145 Node tests** in 68.9 seconds and **70 browser tests** in 2.1 minutes. The gate
includes the corrected join fixtures and complete native contour matrix. Log:
`artifacts/phase03-r3-spiral-check.log`. `git diff --check` passed. The user then
requested updating PR #22 with this verified checkpoint and continuing R3.

Remaining R3 work:
general continuous native tops, broader material/identification/anchor coverage,
combined construction-error accounting, complete family/mode assembly views and
retained-design/browser budgets. The full P2 review remains required. Architecture,
product/roadmap and README need no change for this isolated numerical capability;
the spec status and development diagnostics are updated here.
