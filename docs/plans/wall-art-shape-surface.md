# Wall art 03 — technical implementation plan

Status: **Awaiting user review.** Prepared 2026-11-03.

Requirements: [phase-03 spec](../specs/wall-art-shape-surface.md), decisions
D1–D18 and SHAPE-UI-D1/D2, AC-1–11 and ST-1–4. Shared boundaries:
[architecture proposal](../architecture.md#phase-03-shape-and-surface--proposal).
This plan does not approve implementation. No phase-03 CAD has been qualified.

## Approval and sequence

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
The pre-existing uncommitted owning-spec review is preserved. Planning edits only
this plan and the relevant architecture proposal; implementation has not started.
