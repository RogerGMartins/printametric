# Wall art 02 — implementation plan

Status: **Generator 2 is implemented and locally verified, with version-1 compatibility, numbered plans, exclusions and disk-backed exports. The shared gate passes 82 Node tests and 70 browser tests. The accepted timing limitation remains: 120 seconds / 2 GB, with no 4000-part throughput claim. Worker-count investigation remains closed.**

Requirements: [phase 02](../specs/wall-art-layouts.md),
[suite C1–C4](../specs/wall-art.md), and the
[phase-01 checkpoint](wall-art-core.md#implementation-checkpoint--2026-11-02).
Acceptance references below use the `WA-LAYOUT-AC-` prefix.

## Baseline and decisions

Planning baseline: `feat/wall-art-core` at `135b06f`, including both camera review
fixes. PR #18 was still OPEN when checked for this planning session. Local `main`
does not yet contain phase 01. Merge/rebase coordination is required before starting
phase-02 implementation; this plan does not authorize merging or publishing.
Implementation starts on local `feat/wall-art-layouts`, based on `135b06f`, to keep
phase-02 work out of the still-open phase-01 PR. Reconcile with main before publishing.

User decisions recorded during this planning review (2026-11-02):

| Decision | Selected scope |
| --- | --- |
| Outlines/layouts and size | All four outlines and five layouts; dimensions 80–2000 mm |
| Capacity | Qualify the 4000-part ceiling in this phase, not a 512-part release |
| Relief | Retain X-only taper; all-direction taper stays in phase 03 |
| Identification | Include underside numbering and an orientation mark |
| Compatibility | Retain generator 1 for exact old-file reproduction; explicit upgrade to generator 2 |

The original capacity release gate above is superseded by the
[approved measured-capacity continuation](#measured-capacity-continuation--approved).

Earlier approved core defaults and minima remain the starting point: 500×500 mm,
pitch 50, gap 2.5, base 10, relief 20, top ratio 0.12, seed 1; 1.2 mm material/tip,
0.8 mm inter-part clearance plus 0.01 mm allowance. Keep the Gridline bottom drawer,
client-side CAD, explicit exports and previous-valid-design recovery.

The technical contracts below were approved by the user's explicit “approved” reply.
T1 records these decisions in the owning specs and reconciles their references.
Planning edits only this plan and the architecture proposal; it does not mark
phase-02 behavior as implemented or overwrite the existing spec drafts.

## Scope and release gates

Include exact native outlines, five deterministic partitions, gap offsets,
fragment diagnostics/acknowledgment, stable IDs, numbered 2D lookup, recessed
numbers and direction marks, size shortcuts, and all three assembled exports.
PDF/print kits, bed packing, SVG imports, surface fields, projects and mounting
remain owned by their later specs.

The 512-part point is an internal measurement checkpoint, not the requested release
limit. Qualify 4000 retained components, 100,000 contour-complexity units,
100,000 triangles/part and 2,000,000 total, 200,000 counted CAD operations,
512 MiB estimated geometry memory and 768 MiB measured worker peak ceiling.
Generation watchdog: 120 s. Keep the existing 1 MiB parameter-only file limit and
depth 16; the suite's 16 MiB allowance is unnecessary before embedded assets.
CAD/chord/angular tolerances stay 0.001 mm / 0.05 mm / 5°.

These are limits to verify, not permission to raise constants and claim support.
Derive reachable maxima for each family under the stated size/pitch ranges. Use
real maximum-size designs plus a valid synthetic 4000-component fixture for the
hard limit when an exact count is not reachable through controls. Do not advertise
a fictional UI combination. Exceeding any combined budget rejects the candidate.
The user accepted the observed timing limitation in the continuation below.
Time-limited jobs must fail explicitly and preserve the accepted design. Geometry,
memory and export failures remain blockers; never coarsen curves to pass a gate.

### Early feasibility gates

1. Native intersect/offset must preserve ellipse/circle curves and correctly return
   disconnected components. No faceted replacement of curved STEP boundaries.
2. X-only contraction is not necessarily contained in an arbitrary footprint.
   Radial annular sectors are not convex. Prove solid validity and neighbor clearance
   for the complete relief, not just the gapped bases. Reject an invalid retained
   part; do not clip its relief, rotate its taper, or drop it silently.
3. Distinct engravings remove phase 01's identical-solid optimization. Measure
   numbered, marked solids and STEP peak memory early, including retained accepted
   geometry. No claim that the 100-part timings extrapolate to 4000.
4. Show and review original glyph/arrow fixtures before integrating the editor.
   Geometric validity is separate from physical readability; record the latter as
   unverified until a separately authorized physical check supplies evidence.

## Data and compatibility contracts

### Version dispatch and files

Introduce a tool-local discriminated `DesignDefinition` with exact pairs `1/1`
and `2/2`. Keep the existing file envelope (`formatVersion: 1`, same six top-level
keys). Version 2 parameters add `outline`, `layout`, `straightBoundary`,
`engravingDepth`, `numeralRatio`, and `orientationMark`; seed remains top-level.
Every key is required, including inactive values. Reject unknown/mixed pairs and
fields before any CAD call. Include the version pair in the canonical digest.

Retain the existing v1 validator, limits, generator, IDs and serialization behavior.
Old files open in a labelled generator-1 mode with their existing editable fields
and exports. New layout/numbering controls require **Upgrade design**. Opening a
file must never upgrade it as a side effect.

Upgrade copies the seven original numeric geometry fields and seed, sets rectangle,
square, straight boundary true, engraving depth **0**, numeral ratio 0.34 and
orientation mark false. This preserves the original solid geometry on upgrade;
IDs change to generator-2 keys and the UI explains that numbering changes.
Preview and confirm the candidate before accepting a new unsaved definition.
Keep original file bytes through success/failure, and offer an explicit original-file
download after upgrading. Cancel/failure retains v1. There is no downgrade.

New v2 designs use the approved core numeric defaults, rectangle/square/straight
boundary, engraving depth **1 mm**, numeral ratio **0.34**, orientation mark **true**.
The new physical cuts are visible in the upgrade/new-design explanation, not hidden
changes to v1. `orientationMark` is inactive and retained when engraving depth is 0.

### Canonical layout metadata

Keep shared mesh/export types independent of wall-art parameters. Add tool-local
layout metadata to a wall-art result wrapper rather than importing layout enums
into shared code. It contains nominal outline, accepted base contours, excluded
components, numbering/mark status, actual bounds, version and a geometry-set key.
Contour paths carry directed native curve descriptions (line, arc, ellipse or a
bounded native spline when offset requires one), never kernel handles.

Each part retains shared mesh, bounds, volume, translation, ID and map number.
The local origin is the **post-inset base area centroid**, before engraving;
engraving does not move the origin. Layout metadata maps IDs to footprints,
orientation and `engraved` / `map-only` / `disabled` status with reason.

Keys: square `s:r,c`; hexagonal `h:q,r`; triangular `t:i,j,parity`;
irregular `v:i,j`; radial `d:center` or `d:ring,sector`. IDs prefix these with
`wa-g2-` and a deterministic component suffix. Sort components by centroid Y
descending, X ascending, area descending, then canonical contour encoding for a
complete tie break. Retained map numbers sort by centroid Y descending, X ascending,
then cell/component key. Comparison quantization is for tests, not geometry edits.
Height, engraving and seed changes on nonrandom layouts must not change IDs.

## Geometry pipeline

```text
strict definition → bounded site/cell enumeration → native outline clipping
 → native gap offset → fragment classification → stable parts and numbers
 → X-tapered solids → underside cuts → CAD/clearance/mesh validation
 → accepted meshes + contour/map metadata → explicit selected export
```

### Outlines, lattices and random sites

Use the spec's affine rectangle/ellipse/hexagon/arch formulas and native curves.
Do not constrain aspect ratios. Square partition stays identical to v1.
For point-up hexagons let side `a=pitch/√3`, centers
`(pitch*(q+r/2), 1.5*a*r)`; vertices start at angle 30° and advance 60°.
For triangles use vertices of lattice vectors `(pitch,0)` and
`(pitch/2,√3*pitch/2)` with a vertex at the origin; split each lattice rhombus on
its short diagonal into up/down cells. Fixed indices/parity define keys.
Radial uses the spec's center disk, ring widths, rounded sector counts and +X start;
document ring-index origin and last guard ring in fixtures.

Irregular uses grid tiles centered at `((i+0.5)*pitch,(j+0.5)*pitch)` for integer
indices; each site gets independent X/Y jitter within ±0.3 pitch. Enumerate tiles
intersecting the outline bounding box expanded by one pitch; support neighbors
outside this range are computational helpers, never extra retained cells.
Construct Voronoi polygons by deterministic half-plane intersection in TypeScript,
then create native line wires. No new triangulation dependency is planned.

Use the jitter bound to avoid all-pairs work: every point of the infinite tiled
plane has a site within `R=0.8*√2*pitch`. A site's Voronoi cell lies within radius R;
only sites within 2R can affect it. Start with its R-bounding square and examine
the fixed ±4 tile neighborhood, with distance rejection and sorted-key ties.
T2 must prove the neighborhood bound, compare against an all-sites oracle on small
fixtures, and test outer guards; this optimization cannot change the partition.

Proposed random contract: UTF-8 FNV-1a 32-bit hash of
`wa-g2|layout|<decimal-seed>|<i>,<j>` initializes Mulberry32. Each site takes its
first two unsigned outputs, divides by 2^32, then uses `(u-0.5)*0.6*pitch`.
All integer mixing uses explicit unsigned 32-bit operations and `Math.imul`.
For each draw, increment state by `0x6D2B79F5` modulo 2^32, then compute
`t=imul(state^(state>>>15),state|1)`,
`t ^= t + imul(t^(t>>>7),t|61)`, and return `(t^(t>>>14))>>>0`.
This keyed stream prevents iteration order or an added site from shifting others.
Other future domains use distinct names; only the layout domain is implemented now.
Freeze these computed draft vectors for key `0,0` in T1 tests:

| Seed | X uint32 | Y uint32 |
| --- | --- | --- |
| 1 | 3194330800 | 1565438069 |
| 5000 | 3837443427 | 2391406162 |
| 9999 | 4253378167 | 4224923447 |

### Clipping, offsets and fragments

Clip before gap inset. Only rectangle + hexagonal/triangular + straightBoundary=false
keeps whole cells selected by centroid; show their actual overflow. All other cases
clip, retaining inactive toggle values with an explanation. Radial obeys every outline.

Use the pinned Replicad/OCCT planar intersection and inward offset, with explicit
ownership/cleanup. Use geometric inward offsets, not centroid scaling for gaps.
Specify offset joins and normalize seams/orientation deterministically in T2 fixtures;
use intersection/miter joins for straight convex corners and native trims for curves.
Unexpected failed offsets are errors, not an excuse to classify a part as tiny.
Split and identify disconnected components after clipping and again after offset.

Remove only components below area 4 mm² or material span 1.2 mm. Record parent key,
location/contour, area and reason even when offset collapses a genuinely tiny region.
Boundary values exactly 4 and 1.2 remain eligible; use native measures and bounded
numerical uncertainty, not rounded UI values. A numerically ambiguous threshold
fails with context instead of switching between kept/dropped results by platform.
Define span as minimum supporting-line width for convex components; for nonconvex
annular components additionally check wall/neck clearance between nonadjacent
boundary branches. T2 must freeze branch-adjacency and curved-distance fixtures;
bounding-box width alone is insufficient. All-removed and unsupported retained
top geometry fail while preserving the previous accepted design.

### Solids, numbering and orientation

Extrude the post-inset footprint for the base. At relief height >0, transform each
top contour by `(x,y) → (topRatio*x,y)` in centroid-local coordinates and use matched
native ruled lofts, then fuse with the base. Zero relief makes only the plinth;
ratio 1 uses a straight extrusion. Validate holes/components, top span and complete
solid clearance. Use an XY AABB spatial index to find possible neighbors, then native
solid distance/intersection checks with the 0.81 mm clearance requirement. Overlapping
XY projections are candidates, not automatic collisions. No quadratic full-set scan.

Propose original seven-segment outline digits, authored as fixed polygons in a
6×10-unit cell, 1.6-unit strokes and 1-unit inter-digit advance gap. Record each
digit's segment mask and exact polygons as source fixtures, unioning bars before
cutting. This avoids font downloads, system metrics and new font licenses.
The 0.8 mm stroke minimum means this glyph set needs height ≥5 mm even though the
spec's general absolute floor is 3 mm. Show map-only IDs when it cannot fit.

The orientation mark is a recessed arrow, not an outer-edge notch. It points toward
assembly +Y and is shown with that convention in the numbered map. Author one
4×5 mm arrow polygon with a 0.8 mm shaft and a 0.8 mm gap above the number block.
Text and arrow share engraving depth; their footprint must keep 1.2 mm edge clearance
and cuts must leave 1.2 mm residual floor. Backside construction flips text/arrow
through local X so the underside is readable after that physical turn.

Try centered number+arrow placement in the post-inset interior with a deterministic
interior-anchor fallback for a nonconvex sector. Select the largest fitting glyph
height no larger than requested, on a documented 0.05 mm decrement lattice; never
below the stroke-constrained minimum. Use native containment, not a text bounding
box alone. When the requested combination cannot fit, leave both cuts absent,
report map-only status and show its contour/rotation in the lookup. Disabling the
mark can permit numbers alone. Depth 0 means intentionally unengraved, not a warning.
Every retained part stays present. T3 fixtures freeze 1/6/9/10/99/100/999/1000/4000,
underside reading direction, asymmetric contours and mark-disabled cases.

## Worker, export and UI integration

The user approved the rendered contour, digit and orientation-mark review sheet
with “yes” on 2026-11-03. Evidence is
`artifacts/wall-art-layouts/fixture-review.{html,png}`, generated by
`scripts/render-layout-fixtures.mjs`. This completes the visual fixture review gate
and authorizes T4/T5 integration under the measured-capacity continuation below.
Physical print readability remains unverified.

Dispatch by definition version in the existing worker; no second worker pool or
framework. Make generation/export budgets version-specific. Preserve v1 limits.
Preflight counts cells/sites/contour complexity and estimated operations before
CAD, then count actual components, operations, triangles and buffers during work.
Native operations that cannot be interrupted remain protected by the main-thread
watchdog. Report coarse stage/count progress between bounded batches, never fake
percentage progress for one blocking operation.

Include accepted native state, candidate, copied contours/meshes, native writer
allocations, XML strings, UTF-8/ZIP buffers and download bytes in resource accounting.
T3 measures before/after each expensive stage and calibrates estimates. If two native
revisions cannot fit, stop for review of a recovery-based replacement strategy;
do not discard accepted CAD silently. Keep STEP-worker retirement after export.
Streaming 3MF XML into fflate ZIP chunks is the preferred bounded replacement for
the current all-strings-at-once writer. Exporters receive explicit bounded policy
from the caller; no shared import of tool constants. Remove the current hard-coded
500,000 triangle limit only through version-aware checks, not an unbounded writer.

Exclusion acknowledgment is session state keyed to the canonical excluded-set
description, not a blanket boolean or an imported file flag. It gates model export
in both client and worker for the captured revision. Unchanged exclusions can retain
acknowledgment across pure height edits/restoration; changed exclusions require a new
action. Stale warnings cannot authorize a newer revision. Parameter JSON save is
still available; it contains no pre-authorized acknowledgment.

Extend the existing bottom drawer: common dimensions, size actions, outline/layout;
advanced pitch/gap/boundary, base/relief/top and numbering/mark controls. Use labelled
native selects, checkboxes and numeric fields. Width/height shortcuts submit one
candidate. Invalid drafts remain editable; failed imports keep the current fields
and accepted model. Keep warnings/recovery outside the collapsed drawer.

Add **3D / Numbered plan** as preview-only controls in Design. The 2D SVG uses
accepted contour data, with +Y up and explicit assembly/front versus underside
reading notes. Show exclusions with a non-colour-only treatment and a count.
Provide a paged/filtered keyboard part lookup so 4000 entries do not become 4000
Tab stops; selected entry shows ID, number, outline and numbering/mark status.
SVG annotations are preview-only and are never printable solids. Keep Assembly
and Print layout placeholders until their actual workflows ship.

Review screenshots at desktop, 320 px and genuine 200% zoom, both themes. Preserve
current camera once-only/clipping regressions, focus recovery, modal behavior,
stable canvas bounds and no-WebGL controls/export fallback.

## Ordered implementation tasks

Build owns integration and all listed code/tests for this plan. This explicitly
reassigns the draft's QA test-file ownership; no delegation is requested.

| Task / depends on | Files and responsibility | Acceptance / completion check |
| --- | --- | --- |
| T1 — contracts / approved plan, core baseline | `model/{definition,parameters-v2,validation-v2,migrate-v1,random}.ts`; retain existing v1 modules; extend `design-file.ts`, versioned budget dispatch; `tests/wall-art-layouts.test.mjs`, `tests/wall-art-contracts.test.mjs`, `tests/support/wall-art-layout-cases.mjs`; owning specs below | AC-1/2/5/7: exact schemas, old-file reproduction, explicit atomic upgrade/cancel, vectors, every field/enum N/B/I/E inventory, pre-CAD sentinels. Freeze any unresolved geometry fixture rules before T2 implementation. |
| T2 — planar geometry / T1 | `geometry/layouts/{outlines,square,hexagonal,triangular,irregular,radial,clip,contours}.ts`, `geometry/layout-metadata.ts`; extend layout tests | AC-1–5/7: full 4×5 matrix and both boundary values, native curved trims, guard/lattice oracles, deterministic components, area/span thresholds and all-removed errors. Review canonical default/boundary contour fixtures. |
| T3 — solids and large-format qualification / T2 | `geometry/{generate-v2,engraving,glyphs,clearance}.ts`; `shared/export/{step,stl,three-mf}.ts`, bounded policy in shared types; `scripts/qualify-wall-art-layouts.mjs`; independent format tests | AC-4–8: numbering/arrow native cuts, all-family STEP/STL/3MF round trips, 512 then 4000 limits, every real family maximum, calibrated retained/export memory, curved face inspection and repeated STEP retirement. Stop on failed requested tier before UI integration. |
| T4 — accepted state and export consent / T3 | `geometry/{worker,protocol}.ts`, `editor/{worker-client,state,useWallArt}.ts`, `tests/wall-art-worker.test.mjs` | AC-4/5/7–9: v1/v2 dispatch, timeout per version, exclusion-set acknowledgment, pinned export and stale rejection, upgrade/original-byte retention, failed/cancelled/stale actions cannot enable export. |
| T5 — controls and numbered lookup / T4 | `editor/{WallArtControls,WallArtPreview,WallArtPlan,PartLookup}.tsx`, `src/app/App.tsx`, `src/styles.css`, tool/app copy as needed; `tests/browser/wall-art-layouts.spec.ts` | AC-3–7/9: all shortcuts/enums independently selected, inactive conditions, invalid text and closed-panel recovery, mark/map-only lookup, acknowledgment, upgrade cancel/confirm, keyboard/narrow/zoom/both-theme screenshots. Preserve generic Workspace boundary. |
| T6 — integrated evidence and docs / T5 | `playwright.config.ts`, coverage inventory, qualification script, documentation paths below | AC-1–9: new browser file runs in both projects; full shared gate Windows/Linux; headed integrated-GPU timing, Firefox correctness, offline slicer, explicit evidence for every acceptance ID and every option. User reviews screenshots and glyph fixtures. |

No dependency installation or kernel upgrade is planned. First verify the pinned
APIs for planar offsets, affine top contours, boolean cuts and resource disposal.
If a missing binding or a new geometry library is needed, stop for dependency,
license and plan review rather than substituting an approximate algorithm.

## Verification and documentation handoff

- Test all 20 outline/layout combinations, each applicable boundary mode, seeds
  1/5000/9999, 80×2000 and 2000×80, each shortcut, and every numeric boundary.
  Separate valid contour coverage from valid final relief: test successful zero-relief
  fixtures and explicit unsupported-top failures where the X taper cannot be safe.
- Validate native solids and shared meshes, positive volume, winding, topology,
  holes, minimum material, clearance and actual bounds. Independent readers check
  all families and asymmetric two-part placement; inspect analytic curved STEP faces.
- Measure 5 cold / 20 warm runs at default, 512 and the qualified upper workload.
  Targets: 512 ≤30 s and 4000 ≤120 s p95; input/cancel acknowledgment ≤200 ms.
  Use the recorded Windows 11 integrated-GPU profile and pinned Chromium; record
  CPU, RAM, renderer and kernel. Report median/p95, startup and worker/native/buffer
  memory separately. Do not label WASM capacity as the complete worker heap.
- Include generation and all export formats at the upper tier, accepted+candidate
  overlap, repeated regenerate/export/cancel/retry cycles, allocation and writer
  failures, worker death and missing WebGL. A 120 s watchdog requires scoped browser
  test timeouts above 120 s; ordinary tests keep their current bounds.
- Keep portable regressions in `tests/`; local generated models, captures and timing
  reports go under `artifacts/wall-art-layouts/`. CI must not depend on those artifacts.
- Offline OrcaSlicer checks use `--arrange 0` to verify assembly placement. Physical
  readability, touch and screen-reader evidence remain separately reported and never
  inferred from meshes or screenshots. Do not start a print without authorization.

| Document | Required implementation update |
| --- | --- |
| `docs/specs/wall-art-layouts.md` | T1 records chosen tier, X taper, original glyph/arrow rules, version/upgrade table, 1 MiB file policy and precise fixture contracts; T6 records actual evidence/status. |
| `docs/specs/wall-art.md` | T1 records generator-2 random vectors, version compatibility, 4000 qualification commitment and orientation option/case coverage; T6 distinguishes qualified limits from proposals. |
| `docs/specs/wall-art-core.md` | Link preserved v1 behavior and explicit upgrade; retain historical core evidence. |
| `docs/specs/wall-art-shape-surface.md` | Retain later all-direction taper; correct the assumption that all phase-02 footprints are convex, since radial sectors can be nonconvex. |
| `docs/specs/wall-art-editor.md`, `wall-art-projects.md`, `wall-art-print-kit.md` | Reference the implemented plan/lookup, numbering orientation, exact versions and original-byte retention; leave richer editor, history/library and printable documents in their phases. |
| `docs/architecture.md` | Promote the proposal only after approved implementation; record actual version dispatch, canonical contour metadata, acknowledgment and bounded export accounting. |
| `docs/product.md`, `docs/mvp-roadmap.md` | Reconcile the current after-MVP placement of expanded outlines with this approved next-phase scope; report actual qualified capacity, not just dimensions. |
| `README.md`, `docs/development.md` | Actual controls, old-file upgrade, nominal/actual size, map-only/arrow convention, memory/debug/qualification and slicer reproduction. |
| `docs/specs/website-foundation.md` | Update Design's controls and numbered plan availability; preserve shell and historical foundation evidence. |
| `LICENSE`, `THIRD_PARTY_NOTICES.md`, `public/licenses/` | No change planned: original glyph polygons and existing pinned dependencies. Revisit notices only if dependency scope is separately approved. |

## Planning verification and approval stop

Current code, package pins, worker lifetime, version-1 schema, shared writers and
browser discovery were inspected. Replicad documentation and installed type
declarations expose planar intersection/offset and directional stretch; this is API
research, not proof that all proposed curved fixtures work. The random draft vectors
above were computed with a standalone Node expression; no application files changed.

Planning gate passed with Node 24.15.0:
`npx --yes --package=node@24.15.0 -c "npm run check"` completed scaffold validation,
both typechecks, production build, 30 Node tests and 56 Chromium browser tests
(57.4 s for browser tests). These verify the phase-01 baseline, not the proposed
phase-02 features. Existing large-bundle and Emscripten browser-external warnings
remain; no application, dependency or configuration changes accompany this plan.

Review the proposed arrow/glyph fit, no-cut upgrade defaults, numbered-plan location,
and the 4000-part stop gate. Exact native offset/nonconvex-span fixtures and large-tier
measurements are explicit T1–T3 gates, not claimed completed work. A material change
to these contracts requires renewed review. Approve this plan or request changes;
implementation starts only in a later invocation.

## Implementation checkpoint — native capacity blocker

The user subsequently approved this plan. Work started on local
`feat/wall-art-layouts`, based on phase 01's `135b06f`; PR #18 was still open.
No phase-02 changes have been published.

T1 now has strict v2 numeric/enumerated/inactive-field validation, exact 1/1 and 2/2
definition dispatch, bounded JSON parsing, an explicit no-cut upgrade candidate,
keyed random vectors and executable parameter cases. Existing editor/worker entry
points still accept only v1. Atomic upgrade UI, original-file download and v2 worker
integration are not implemented. The original digit/arrow polygons are authored;
fixture review and complete native containment/placement remain open.

The high-risk T3 memory experiment was pulled forward before completing T2 or
connecting the editor. `scripts/qualify-wall-art-layouts.mjs` builds synthetic
distinctly numbered and arrow-marked blades with native Boolean cuts, validates
solids and meshes, and attempts one assembled STEP. It does not pretend that its
64-column synthetic arrangement is reachable through the UI, or qualify all layouts.

- A 32-part smoke run completed native generation and STEP (3.59 MB output),
  with 100 MiB WASM capacity. This is feasibility evidence, not a supported tier.
- The final 512-part run stopped at **342 retained parts**, after about **15.95 s**:
  WASM capacity reached **623,509,504 bytes (594.625 MiB)**, exceeding the 512 MiB
  estimated geometry budget even before export and accepted/candidate overlap.
  Controller-plus-worker peak RSS was 635,834,368 bytes. RSS was sampled every
  10 ms from the controller; it is not presented as an isolated browser-worker heap.
- Earlier runs stopped at 345 parts. Explicit transform/compound cleanup and
  single-build, non-destructive, history-disabled Boolean operations did not resolve
  the growth. A diagnostic that released each finished native solid also stopped
  at 345. Repeatedly remeshing one v1 solid stayed at 100 MiB for 512 iterations.
  These narrow the investigation but do not establish the native root cause.
- Curved API probes succeeded for clipped/inset ellipses at 500×500, 80×2000 and
  2000×80. They do not replace the required 4×5 matrix, span or native export checks.

Evidence is in ignored `artifacts/wall-art-layouts/native-capacity-{32,512}.json`
and `release-diagnostic-512.json`. The script's failure exit is intentional when
a budget fails; it is an optional qualification command, not a passing CI claim.
The partial code passed `npm run check` under Node 24.15.0: scaffold validation,
both typechecks, production build, **34 Node tests and 56 Chromium tests**. These
verify the contracts and preserved phase-01 behavior, not phase-02 release capacity.
The current partial implementation cannot qualify 512 or 4000 parts. T2–T6 remain
incomplete. Do not increase budgets, reduce the requested tier, change the kernel,
discard accepted CAD or integrate the new controls without renewed plan review.

The user selected **Investigate 4000-part path**: retain the requested scope,
investigate memory and batching/export options, then present a revised technical
plan before changing the kernel or accepted-model retention. The following revision
is the result of that investigation and was subsequently approved as recorded below.

## Capacity revision — approved

The user explicitly approved this revision with “yes” after reviewing the proposed
native snapshots, bounded batches and temporary disk-backed exports. Execute the
feasibility tasks below; retain their stop gates and the original 4000-part goal.

### Findings and limits of the evidence

The original all-live-solids/all-in-memory-export approach has two separate risks:

1. **Native heap growth.** Stage instrumentation records the nine heap expansions
   in the 342-part failure during meshing. This locates the allocation pressure,
   not the retained allocation's owner. Repeating one plain or recessed solid's
   meshing, extraction or validation 512 times stays at 100 MiB. Creating and
   releasing a fresh recessed solid each time reaches 127.0625 MiB with meshing,
   or 199.0625 MiB with validation instead. Therefore neither a blanket mesher leak
   nor retained output solids alone is an established root cause. Do not claim a
   fix based on allocator capacity, force garbage collection in production, or
   rely on finalizer timing.
2. **Output size.** The synthetic 32-part sample numbered 3969–4000 produces
   **7,073,887 bytes of native STEP**. A simple 125× extrapolation is about
   **884 MB**, already above the 512 MiB in-memory budget before CAD, meshes and
   copies. This is an estimate from one fixture, not a measured 4000-part output.
   Worker recycling alone cannot solve this export-buffer problem.

The installed `BinTools.Write/Read` bindings successfully round-trip those 32
numbered solids, with solid validation and CAD/mesh volume agreement. Their native
snapshots total **1,386,934 bytes**, or **215,080 bytes** with existing fflate gzip.
Compression is byte-for-byte reversible. This suggests a compact retention route,
but does not yet prove curved topology, cross-worker restoration or all layouts.
The same probe finishes at 199.0625 MiB WASM capacity and 483,491,840 bytes sampled
controller-plus-worker RSS. It takes 4.90 s including initialization and STEP;
generation/archive validation alone takes 2.66 s. Earlier runs were slower.
These measurements do **not** establish the 120-second 4000-part target; throughput
optimization is required before claiming the proposed architecture is sufficient.

Reproduction sources: `scripts/diagnose-wall-art-memory.mjs` and the extended
`scripts/qualify-wall-art-layouts.mjs`. Metadata is under
`artifacts/wall-art-layouts/isolated-memory.json` and
`native-capacity-32-from-3969.json`. These are optional diagnostics, not CI fixtures.

### Proposed architecture changes

Keep all four outlines, five layouts, numbering, orientation, versions and export
formats. Keep the 4000-part ceiling, existing tolerances, 512 MiB estimate,
768 MiB measured peak, 120-second watchdog and previous-valid-design behavior.
Keep the installed kernel for the first feasibility pass. A kernel rebuild or
upgrade still needs a separate source/license/dependency proposal and approval.

```text
accepted snapshot: parameters + canonical meshes + compressed native CAD chunks
                                  |
candidate batches -> validate -> provisional snapshot -> atomic acceptance
                                  |
explicit export -> restore one CAD chunk -> native STEP chunk -> streamed file
```

The snapshot remains native CAD, not reconstruction from display triangles.
The approved changes are:

- **Retain compressed native snapshots instead of all live v2 CAD handles.**
  Each snapshot is immutable and contains the pinned kernel/archive version,
  definition digest, part IDs, canonical contour/mesh metadata and checksums.
  It is private session memory, not a new user design-file format. Keep both the
  accepted snapshot and provisional candidate within the combined memory budget.
  Reject a candidate without releasing the accepted snapshot. Failed restore,
  cancel or timeout must preserve the previous design and its export source.
- **Use one bounded native batch at a time.** Start experiments at at most 32
  engraved parts, lower the batch size for measured complexity, and terminate each
  batch worker after transferring its owned output. Await termination before
  starting another native heap. No simultaneous kernel pool. Measure every
  retained/copy/decompression buffer; batch size is not itself a memory proof.
  Whole-assembly clearance needs a separate spatially indexed pass restoring
  neighboring native parts in bounded groups. It cannot be skipped at a boundary.
- **Stream large exports through a temporary browser file.** The origin-private
  file system (OPFS) supplies a disk-backed file during an explicit export only.
  Propose a 2 GiB temporary-storage ceiling, separately from RAM; qualify maximum
  fixtures against it before accepting this as a supported export limit. No
  automatic project persistence. Enforce quota, secure-context and API checks;
  expose a clear failure if unavailable. Keep existing in-memory export only when
  its complete allocation fits the budget. Do not silently reduce part count or
  emit partial files. Storage-dependent large exports must be documented before
  they become a user-facing capability.
- **Produce one standard native STEP file from bounded native fragments.**
  Investigate a strict streaming STEP Part 21 assembler for the pinned writer's
  emitted subset. Preserve all native entities, names, millimeter contexts and
  assembly placements. Remap entity IDs and references outside quoted strings
  and comments; require matching schemas and reject unsupported constructs.
  Do not concatenate fragments blindly or convert them to meshes. Native-reader
  round trips and adversarial lexical fixtures gate this path. If assembly
  preservation cannot be proved, stop and review the export design.
- **Keep final output disk-backed.** STEP assembly and 3MF ZIP output must not
  materialize an entire output string, byte array or copied Blob in RAM. Measure
  browser download memory using the disk-backed File. Define the file/URL lifetime
  before implementation: cancellation/failure removes partial files; successful
  downloads retain their source until safe release. Provide explicit cleanup and
  recover abandoned export files on the next explicit export. Abrupt browser
  termination can leave temporary bytes; disclose that lifecycle instead of
  promising immediate deletion. Test simultaneous tabs without deleting another
  tab's active export. Temporary storage is limited to explicit export work.

API reference: [MDN origin-private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).
Synchronous access handles run in dedicated workers; close them before obtaining
the download File. API documentation is not evidence that download memory or
cleanup behavior meets these limits in the supported browsers; R3 measures that.

### Revised tasks and stop gates

The original full-tier timing gate in this section is superseded by the
[approved measured-capacity continuation](#measured-capacity-continuation--approved).
All native correctness, bounded storage and recovery checks remain required.

Perform R1–R3 before committing to the remaining headless T2/T3 work. If those
probes pass, complete T2/T3 and R4 together; they supply the real layout fixtures
needed for qualification. **T4–T6 editor integration stays blocked until R4 passes.**
Build owns these tasks; this revision authorizes no delegation. Experimental
helpers stay in `scripts/`/test support until their gate passes; the editor stays v1.

| Task | Work and owned paths | Required evidence / stop condition |
| --- | --- | --- |
| R1: native lifetime and throughput | Extend `scripts/diagnose-wall-art-memory.mjs` and capacity probe with fresh-shape ownership isolation, bounded batches and four-digit cases. Compare explicit native pocket construction with Boolean cuts only if needed, preserving the same solid. | Localize growth sufficiently to bound a batch without forced GC. Validate analytical volume, closed meshes and dimensions. Measure batch startup and per-part costs; do not extrapolate a small success into a tier claim. A required kernel change returns for review. |
| R2: exact native snapshots | Add experimental snapshot round-trip fixtures in `tests/support/` and probe scripts; cylinder, ellipse/arch trims, nonconvex radial part, engraving, nonzero placements and mixed part IDs. | Fresh-worker restore preserves native surface types/topology, volume, scale and placements; checksum/version corruption fails atomically. Measure accepted + candidate + active batch + UI copies. Prove clearance across batch boundaries. Keep user JSON unchanged. |
| R3: streamed export feasibility | Prototype STEP fragment assembly, bounded 3MF output and disk-backed browser download in isolated script/fixture scope. | Independent STEP readers and Orca `--arrange 0` accept the assembled result; names, curves, units and positions survive. Lexer tests cover strings containing `#`, escaped quotes, comments, forward references, dangling IDs, schema mismatch and truncation. Verify actual Chromium/Firefox download, quota denial, cancellation, cleanup, multi-tab ownership and memory. No production storage change before this gate. |
| R4: qualify the requested tier | Complete the headless T2/T3 layout/solid paths, then run the original 512/4000 fixtures with all resource costs, accepted/candidate overlap, neighbor checks and selected exports. | 512 p95 ≤30 s, 4000 p95 ≤120 s, input/cancel acknowledgment ≤200 ms, full memory/disk limits; 5 cold and 20 warm runs on the approved profile. Generation and selected export timings reported separately, each within its watchdog. A failure pauses work for another decision; no silent limit increase or tolerance reduction. |
| R5: integrate only the proven route | Reconcile T4 ownership/protocol/export contracts and owning specs, then resume T4–T6 in dependency order. | All original acceptance IDs remain required. Update architecture, development, project/file-lifetime and export documentation. Integrate snapshots/storage into the editor only after R1–R4 pass; keep v1 reproduction exact. |

The native snapshot and disk-backed export route is a **candidate**, not a promise
that 4000 complex engraved parts meet the existing timing limits. Approving this
revision authorizes the bounded feasibility work and its proposed retention/storage
contracts; it does not approve a kernel change, reduced release tier, larger memory
budget, changed geometry, commit, PR or deployment. Stop after the feasibility
results if any original gate still fails.

Revision verification: `npm run check` under Node 24.15.0 passed scaffold validation,
both typechecks, production build, **34 Node tests and 56 Chromium tests** (6.0 min
for browser tests). This confirms the current partial implementation and phase-01
regressions; it does not qualify the proposed batching, snapshots, streaming or
4000-part capacity. The user subsequently approved the revision as recorded above.

### Feasibility implementation evidence

The approved revision now has experimental helpers in `tests/support/` and
`scripts/qualify-layout-batches.mjs`. The application still uses generator 1.

- Batches retain compressed native snapshots and independent mesh arrays in the
  controller. Each native worker transfers its outputs and terminates before the
  next starts. Compiled WASM code and small immutable native glyph templates can
  be reused across fresh heaps. This does not share native handles or WASM memory.
- A first 512-part run completed with 4,118,225 retained bytes and 362,303,488 bytes
  peak controller-plus-worker RSS. Its **115.13-second** runtime failed the
  30-second checkpoint. A later compiled-code/template-reuse run stopped at the
  120-second watchdog after 256 parts, at 289,447,936 bytes peak RSS. These runs
  bound the experimental memory path; neither qualifies throughput or measured
  accepted/candidate/UI overlap. Timing varies greatly between batches.
- The perforated-profile alternative also stopped at 120 seconds after 256 parts,
  at 297,164,800 bytes peak RSS. Its small 32-part run passed at 2.41 seconds, which
  did not predict the longer run. Neither path meets the original timing gate.
- Fresh-worker binary snapshots preserve cylinder, trimmed ellipse, arch,
  nonconvex annular-sector and engraved-part surface types, volume and mesh bounds.
  Wrong identity/kernel/version, corrupt bytes and size violations reject before
  native access. The experimental helper has an 8 MiB per-snapshot guard; this is
  not a new supported-design limit.
- An alternative native construction extrudes a perforated bottom layer and joins
  it to the upper blade. Native intersection-volume comparisons and closed-mesh
  checks match Boolean pockets for 1, 6, 9, 10, 99, 100, 999, 1000 and 4000. This is
  a fixture optimization experiment, not a replacement v2 generator.
- A bounded STEP fragment assembler preserves strings/comments while remapping
  entity IDs, checks the pinned AP214 schema, millimeter units and reference
  closure, and rejects unsupported syntax. Two restored native fragments with
  unequal nonzero placements pass Replicad and independent occt-import-js import,
  including analytic cylinder surfaces and engraved geometry. This small test
  does not qualify a full-size export or browser temporary storage.

R2 still needs measured snapshot overlap and cross-batch clearance. R3 still needs
large-file throughput/memory, streaming 3MF, actual OPFS download/lifetime tests and
slicer verification. The 4000-part tier and editor integration remain unqualified.

Per the approved stop condition, pause before integrating or widening this route.
Recommended next decision: a controlled browser/CPU profiling pass using the same
fixtures, separating CPU work, worker startup and scheduling delays. Do not treat
these variable Node timings as a completed approved-browser p95 measurement. Any
kernel/dependency change or revised target still needs a concrete proposal and
user review. No reduced part ceiling or larger memory budget is assumed.

The user approved that profiling pass and requested a parallelism comparison.
The experimental comparison uses one or two independent single-threaded kernels,
not a changed kernel build. Two-worker experiments reserve 192 MiB per batch,
with retained data counted against the same 512 MiB estimate and 768 MiB sampled
RSS ceiling. The application remains single-worker. A production pool still needs
measured browser memory, accepted/candidate overlap and a reviewed integration
decision. CPU measurements use per-thread CPU time alongside wall time; benchmark
cases run sequentially to avoid competing with each other.

Verification after this feasibility pass: `npm run check` under Node 24.15.0 passed
scaffold validation, both typechecks, the production build, **40 Node tests and
56 Chromium browser tests** (1.3 min for browser tests). Existing bundle-size,
Emscripten browser-external and upstream Three.js diagnostics remain. The deliberate
missing-WebGL test exercises its error boundary. These passing correctness checks
do not turn the failed capacity probes into a supported 4000-part tier.

### Controlled CPU and parallelism investigation

The user approved profiling and asked whether multiple CPU cores could help.
The production editor and earlier batch probe used one single-threaded native
kernel at a time. The experimental probe now supports one or two independent
heaps, never shared native handles. This changes research tooling only.

The Node 24.15.0 single-worker run stopped after 416/512 parts at 120.03 s, with
29.69 s whole-process CPU time and 301,400,064 bytes peak RSS. Individual batches
showed large CPU/wall gaps: one used 1.66 s thread CPU over 22.92 s elapsed.
This establishes that CPU execution alone does not explain the earlier elapsed
times; it does not identify the OS scheduling/waiting cause. A subsequent two-worker
run completed 512 parts in 22.03 s, with 30.67 s process CPU and 456,327,168 bytes
peak RSS. Those differently scheduled runs are not a valid direct speedup ratio.

A separate production-built fixture ran in headed pinned Chromium at 1280×800.
Four sequential cases used worker counts 1/2/2/1:

| Workers | Parts | Elapsed | Maximum excess 50 ms timer delay |
| --- | --- | --- | --- |
| 1 | 512 | 23.640 s | 27.8 ms |
| 2 | 512 | 12.777 s | 16.6 ms |
| 2 | 512 | 12.812 s | 14.7 ms |
| 1 | 512 | 23.849 s | 30.8 ms |

All four produced the same ordered identity/placement/mesh digest and retained
4,175,926 bytes. The measured mean speedup is about **1.85×**. This is a repeatable
small comparison, not the required 5-cold/20-warm p95 qualification. Browser timing
includes fetching/compiling the same-origin WASM, templates, batch startup and
generation; it excludes the final comparison digest. The test has no editor/UI
mesh copies, accepted revision or neighbor-clearance pass. Browser native peak
memory remains unmeasured. Timer delay is not an input/cancel acceptance result.

Evidence: `artifacts/wall-art-layouts/batches-512-32-cut-w{1,2}.json` and
`artifacts/wall-art-layouts/browser-parallelism.json` (initial 512 comparison).
The script now includes the part count in report filenames to preserve comparisons.

The subsequent two-worker **4000-part** browser probe stopped at the original
120-second watchdog after **704 parts** (120.011 s). It retained 5,876,438 bytes;
the maximum excess main-thread timer delay was **4958.6 ms**. This indicates a
long-run responsiveness problem as well as a failed throughput gate. The timer
alone cannot distinguish OS scheduling, browser suspension, GC or other causes.
Evidence: `artifacts/wall-art-layouts/browser-parallelism-4000.json`.

Conclusion: two workers are a useful candidate, with a repeatable 512-part benefit,
but adding cores alone has not qualified the requested tier. Keep the application
single-worker and the 4000-part integration gate closed. The next bounded technical
step is a trace of the long-run stalls and measured browser native memory/overlap,
before proposing a production two-worker scheduler. Do not increase concurrency,
memory limits or the watchdog based on the small successful comparison.

Verification after profiling: scaffold validation, both typechecks, production
build and **40 Node tests passed**. The first full browser run passed 53/56, with
timeouts in two camera cases and development navigation. All five targeted
production/development reruns of those cases passed without code or timeout changes.
A second full gate passed 54/56 but timed out in different, existing 320/768 px
foundation cases. **The current full `npm run check` is therefore not passing.**
No assertion or timeout was weakened. The production bundle hashes are unchanged
by this research pass. Variable runtime remains unresolved; a passed targeted
rerun is not a substitute for a passing full gate. Retained second-run traces are
under `artifacts/wall-art-layouts/profiling-check-failures/`.

### Three-worker experiment approval

The user requested three workers and explicitly approved **768 MiB estimated
memory / 1 GiB measured whole-process memory** for this experiment. Keep the
120-second timeout and 4000-part target. Application limits and concurrency stay
unchanged pending review of the results. Each concurrent batch reserves 192 MiB;
three reservations leave 192 MiB for retained models and other estimated buffers.

The Node 24.15.0 512-part probe completed in 27.614 s, with 78.999 s process CPU
time and 599,310,336 bytes peak sampled whole-process RSS. Its ordered geometry
digest matches the completed two-worker Node run. These separately timed Node
runs do not establish that three is faster than two. The controlled browser
comparison uses 2/3/3/2 order under the same experimental limits. It additionally
samples this browser's process working sets plus the controller, rather than
claiming WASM capacity alone measures browser memory. Shared pages may be counted
twice, and periodic samples can miss transient peaks.

The initial measured browser comparison exceeded 1 GiB during its first two-worker
case (1,150,922,752 bytes summed working sets plus controller). This included Vite
compiler state retained by the probe process, so it is not a three-worker result.
The revised probe builds in a child process, waits for its exit, and uses a minimal
static server during profiling. This removes avoidable test-harness memory without
changing the approved limit or invoking forced garbage collection. The original
failure remains in `browser-parallelism-512-2-3-3-2.json`; new evidence uses the
`-isolated.json` suffix.

The isolated-build 512-part browser comparison completed all four cases:

| Workers | Generation time | Peak sampled browser + controller working sets |
| --- | --- | --- |
| 2 | 14.793 s | 933,470,208 bytes |
| 3 | 11.691 s | 961,482,752 bytes |
| 3 | 11.541 s | 967,540,736 bytes |
| 2 | 14.633 s | 948,379,648 bytes |

Three workers reduced mean time by about 21% (1.27× throughput). All four produced
the same ordered geometry digest as the earlier browser fixture. Timer excess was
12.4–17.7 ms. This is a synthetic 512-part checkpoint, not full layout, native
export, accepted/candidate/UI-overlap, cancellation or p95 qualification. Sampled
working sets include the dedicated browser and test controller, not unrelated
browser sessions; they remain a conservative aggregate rather than isolated native
worker memory. Evidence: `browser-parallelism-512-2-3-3-2-isolated.json`.

The subsequent **three-worker 4000-part synthetic run completed** in 84.555 s
(125 batches). It retained 38,523,348 bytes of meshes/snapshots/templates. The
sampled aggregate peak was 1,066,643,456 bytes (1017.2 MiB), only about 6.8 MiB
below the experimental 1 GiB cap. Maximum 50-ms timer excess was 17.5 ms. Ordered
geometry digest: `4608c1c88b2bfdfddd70b90e0ada9977286f1dee6fdfa299b3f2cc75456fe9a1`.
Evidence: `browser-parallelism-4000-3-isolated.json`.

This supports three workers as a throughput candidate. It does **not** qualify
the release: only one full-tier run was measured, actual previous accepted model
plus candidate and UI buffers are not present, and the probe does not include
layout clipping, cross-part clearance or full-tier exports. The small remaining
memory margin requires real overlap/export measurements and repeatability before
reviewing a production pool or changing release budgets. The older two-worker
4000 timeout remains evidence; the changed harness and system variability prevent
attributing the entire difference to the extra worker.

After the experiments, `npm run check` under Node 24.15.0 passed scaffold
validation, both typechecks, the production build, **40 Node tests and all 56
Chromium production/development tests**. Browser tests took 1.0 minute. No timeout
or assertion was weakened; the earlier timeout evidence remains recorded above.
`git diff --check` also passed. The existing bundle-size, Emscripten browser-external
and upstream/test-only Three.js warnings remain. No changes were committed or pushed.

### Retained-design gate — follow-up

The user requested continuation. The next experiment retains a completed synthetic
design's native snapshots and canonical meshes, plus independent CPU preview
position/index buffers, while generating its replacement. This tests actual live
buffers instead of the earlier doubled-byte estimate. It remains a lower bound:
no renderer, GPU allocation, normals, application shell or clearance pass is present.
The approved experimental 768 MiB estimate, 1 GiB sampled aggregate and 120-second
per-generation timeout remain unchanged. Reports use `-isolated-overlap.json`.

The 512-part smoke sequence completed twice in 12.518 s and 12.486 s. The second
job retained 512 accepted parts and 5,644,630 bytes of native snapshots/canonical
meshes/independent preview buffers. Both geometry digests matched the prior browser
fixture. Sampled aggregate peaks were 980,566,016 and 1,009,049,600 bytes. This smoke
run preceded the additional final acceptance-memory sample; it is not a full-tier
or renderer-overlap qualification.

The 4000-part sequence then reached the retention gate:

| Job | Result | Generation time | Peak sampled aggregate |
| --- | --- | --- | --- |
| Initial design | 4000 parts completed | 95.848 s | 1,052,749,824 bytes |
| Replacement with previous design retained | Aborted on memory limit; last reported progress 1920 parts | Last progress at 43.251 s | 1,079,369,728 bytes |

The previous design retained **52,669,860 bytes**, including **14,146,512 bytes**
of independent CPU preview position/index buffers. At the last progress event,
the candidate retained 16,886,319 bytes. The sampled peak exceeded the 1 GiB limit
by 5,627,904 bytes (about 5.37 MiB). Browser closure was the experiment's deliberate
memory guard; the exact completed count at closure is unknown. Do not interpret the
last progress count as a final native completion count. The initial model's geometry
digest matched the prior full-tier result. Its maximum timer excess was 18.1 ms.

Evidence: `artifacts/wall-art-layouts/browser-parallelism-4000-3-3-isolated-overlap.json`.
Sampling includes a final acceptance-memory measurement, but still cannot establish
the transient peak or isolate native worker memory. No renderer/GPU, actual layout
clipping, cross-part clearance or export allocations were present. Therefore this
failure blocks a fixed three-worker production policy even for this lower-bound
fixture. Large-export and 5-cold/20-warm qualification have not started.

Keep the existing budgets and accepted-model preservation contract. The recommended
next revision is a bounded investigation of reducing active batch concurrency when
a previous model is retained, with the same 4000-part/120-second limits. Such a
policy must prove both memory and throughput; it is not approved for application
integration by the earlier successful one-design benchmark. Do not discard the
accepted source, widen the limit or claim full-tier support from these results.

The user approved the next experiment ("yeah try that"): use the existing overlap fixture with
`LAYOUT_PARTS=4000 LAYOUT_OVERLAP=1 LAYOUT_SEQUENCE=3,2`. Generate the initial model
with three workers, then its replacement with two while retaining the initial
source and preview buffers. Keep the same 768 MiB estimate / 1 GiB sampled cap and
120-second job timeout for both. Compare ordered geometry and retention metadata.
Stop if either generation fails; passing this probe would permit repeatability and
export experiments, not production integration or a supported-tier claim.

After adding the final acceptance sample and explicit retained-part/preview checks,
the 512-part smoke sequence passed again: 12.398 s and 12.305 s, with sampled peaks
988,168,192 and 997,560,320 bytes. The second job retained all 512 previous parts
and the expected independent preview buffers; both geometry digests matched.
This verifies the updated probe's success path, not the failed 4000-part gate.

Verification after these changes: `npm run check` under Node 24.15.0 passed
scaffold validation, both typechecks, the production build, **40 Node tests and
56 Chromium production/development tests** (1.1 minutes). `git diff --check` passed.
Existing build/upstream/test-fixture warnings remain. The production bundle is
unchanged by this retention probe; no application pool or storage behavior was added.

### Three-then-two-worker retention result

The approved `LAYOUT_PARTS=4000 LAYOUT_OVERLAP=1 LAYOUT_SEQUENCE=3,2` probe
completed both jobs with the existing experimental limits:

| Job | Workers | Completed parts | Time | Sampled peak |
| --- | --- | --- | --- | --- |
| Initial design | 3 | 4000 | 83.098 s | 1,040,375,808 bytes |
| Replacement retaining the initial design | 2 | 4000 | 113.522 s | 1,044,348,928 bytes |

Both ordered geometry digests match the previous successful 4000-part result.
The replacement retained all 4000 previous parts: 52,669,860 bytes of native
snapshots, canonical meshes and independent CPU preview copies. Both jobs reported
16.5 ms maximum timer excess. This is not a cancellation acknowledgment measurement.
The replacement had only 6.478 seconds of timeout margin and 29,392,896 bytes
(about 28 MiB) below the sampled memory cap.

Evidence: `artifacts/wall-art-layouts/browser-parallelism-4000-3-2-isolated-overlap.json`.
This is one successful synthetic retention sequence, not p95 qualification. The
sampling limitations and absent renderer/GPU, layout clipping, clearance and export
allocations still apply. The next gates are repeated retained-design runs and
bounded large-export experiments. Production concurrency and memory limits remain
unchanged. No code changed for this run; the preceding 40-Node/56-browser shared
gate remains the latest application verification.

### Final worker-count experiment — investigation closed

The user requested one last higher-concurrency test, permitted 1.2 GB, and asked
to move on. The test used four workers for both jobs, retaining the initial
4000-part design during replacement. The sampled cap was **1,200,000,000 bytes**
(decimal GB), with a 1 GiB allocation estimate, unchanged 192 MiB per-batch
reservation and 120-second watchdog. This approval applied to the experiment.

| Job | Result | Time / last progress | Sampled peak |
| --- | --- | --- | --- |
| Initial design, four workers | Completed 4000 parts | 65.826 s | 1,176,952,832 bytes |
| Retained-design replacement, four workers | Memory guard aborted | Last reported 3200 parts at 53.566 s | 1,204,072,448 bytes |

The initial geometry digest matched the prior completed 4000-part probes. The
replacement retained the prior 52,669,860 bytes and reported 30,097,195 candidate
bytes at its last progress event. Its exact completion count at browser closure
is unknown. The peak exceeded the cap by 4,072,448 bytes; it is a failed gate,
even though the excess is small. Renderer/GPU, layout operations and export
allocations remain absent, and sampled working sets are not exact transient peaks.

Evidence: `artifacts/wall-art-layouts/browser-parallelism-4000-4-4-isolated-overlap.json`.
No further worker-count sweeps are planned. Use the demonstrated three-worker
initial / two-worker replacement strategy as the implementation candidate, with
bounded reservations and retained-source preservation. Resume the existing
geometry/export feasibility work; integrate a production pool only through the
approved capacity gates. This result does not increase application limits or
qualify the full layout suite. All earlier failed evidence remains retained.

Final-experiment verification: `npm run check` under Node 24.15.0 passed scaffold
validation, both typechecks, the production build, **40 Node tests and 56 Chromium
production/development tests** (1.7 minutes for browser tests). Existing build and
upstream warnings remain. The application bundle is unchanged by the probe.

### R3 disk-backed export checkpoint

The user requested continued implementation and a PR **only when complete**.
R3 now has an isolated browser fixture, bounded streamed 3MF output, and OPFS
leases with cross-tab ownership and a shared 2 GiB output reservation limit.
Files remain available until explicit release after download; later explicit
export work reclaims abandoned jobs. No application storage path has changed.

Verified in Chromium 156 and Firefox 157 with disposable persistent profiles:

- Native STEP fragments download as a single file with cylindrical surfaces and
  part names. The independent native-reader fixture remains in the Node tests.
- Streamed 3MF downloads and loads in the independent Three reader with exact
  millimeter bounds and both nonzero placements. Orca `--info --arrange 0` reports
  both tetrahedra manifold. Its existing default-profile exclusion diagnostic
  remains; this CLI rejects STEP input, so STEP evidence uses the native readers.
- Cancellation and output-bound failures release file handles before cleanup.
  Quota denial, live-tab protection, reservation conflicts and closed-tab cleanup
  pass. Portable development-browser regressions cover cancellation and leases.
- A **256 MiB** byte fixture downloads with an exact streamed SHA-256 check in both
  browsers. Chromium's sampled browser/controller peak was **850,567,168 bytes**.
  This is a storage/download test, not a geometry capacity claim. Firefox memory
  was not measured. Evidence: `artifacts/wall-art-layouts/disk-exports/qualification-persistent-1-bytes268435456-both.json`.
- Chromium assembled **4000 repeated native fragments / 7,780,000 entities** into
  a **416,049,122-byte STEP file in 49.3 seconds**, downloaded it, and checked the
  stream without materializing the complete file in JavaScript. The sampled peak
  through its subsequent checks was **912,785,408 bytes**. This run later failed an
  orphan-cleanup test assertion, after the large export had completed. Explicit
  awaited cleanup polling fixed that harness issue; both browsers then passed the
  lifecycle checks with the small native fixture. Keep the original full-run
  failure in `qualification-persistent-2000.json`, rather than labeling it all-pass.

Earlier private-context and byte-array automation runs exceeded the memory cap.
They exposed unsuitable test conditions: private storage need not be disk-backed,
and serializing native byte arrays through automation inflated controller memory.
The corrected fixture fetches bounded fragments directly in the worker and runs
native preparation/build in child processes which exit before measurement. Old
failure evidence remains in the same artifacts directory. No memory limit was
raised. A transient sampler failure from disappearing process IDs was corrected by
filtering the current process list against the dedicated browser's known IDs.

These results allow the remaining headless geometry work to proceed. R4 still
requires actual distinct layout solids, restoration/writer costs, accepted model
and renderer overlap, repeated timings, selected full-size exports and cross-batch
clearance. Repeated source fragments are not a substitute for those checks. The
editor and application export path remain v1 until that gate passes.

### T2/T3 headless geometry checkpoint — real capacity gate failed

The implementation now contains pure lattice enumeration, native built-in outlines,
clipping/insets, component metadata, X-only relief, physical identification and
full-solid clearance helpers. `generate-v2.ts` builds one canonical part from a
trusted internal base contour. Aggregate budgets, batch retirement, atomic model
acceptance and the editor connection remain coordinator work, not a completed v2
application route.

Small-fixture evidence covers:

- All 20 outline/layout combinations with both boundary settings, analytical
  outline areas at extreme aspect ratios, a larger-neighborhood Voronoi oracle,
  stable IDs/numbering, area/span boundaries and explicit exclusions.
- Flat solids across all families; tapered solids at 80×120 mm and ratio 0.99,
  native validity, closed meshes, analytical volume within 0.01%, and native
  assembly clearance. Each tapered family runs in a fresh heap. A retained narrow
  hexagon/triangle fixture at ratio 0.8 correctly fails the 1.2 mm top requirement;
  flat generation of that same base succeeds. This is not full parameter coverage.
- Native face offsets avoid the pinned drawing helper's reversed tall-ellipse
  offset. Internal face snapshots preserve vertex tolerances. Stored 2D contours
  transform face-local UV coordinates into assembly XY, tested with translated,
  rotated and reversed faces.
- Nonuniform transformation of an elliptical offset returns no curve in the
  pinned helper. The taper path converts only offset curves to native splines,
  requiring a successful native approximation and maximum reported error ≤1e-7 mm,
  bounded at 200 segments/degree 8. Loft bases retain original native wires. The
  affinity axis is +Y because OCCT scales perpendicular to that axis; regression
  checks explicitly require changed X and unchanged Y dimensions.
- Physical numbers 1/6/9/10/99/100/999/1000/4000 with the mark enabled/disabled:
  independent polygon-union pocket volumes, unchanged source solids, closed
  meshes, underside text direction and the physical +Y arrow. Small fixtures
  prove map-only retention, size reduction, disabled engraving, floor rejection,
  operation-budget failure and a number that fits only after disabling the arrow.
- Clearance grid candidates match a brute-force bounds oracle. A 4000-item
  separated-bounds fixture uses no native pair checks. Native boxes below/above
  0.81 mm and overlapping solids verify the final distance guard.

The fitter tries the area centroid then a deterministic 3×3 bounding-box grid,
top-to-bottom and left-to-right. Heights use `5 + n×0.05` mm. Accepted placements
require native containment and 1.2 mm boundary distance; glyph unions are retained
only within their native batch. Full curved/nonconvex span certification, largest
requested-height behavior from span bounds, interior-anchor fixtures and reviewed
glyph/contour images remain open. Small passing fixtures do not close T2/T3.

The real browser probe uses a 1600×800 mm rectangle/square layout at pitch 50,
producing 512 distinct numbered parts. It runs native partitioning, relief,
engraving, validation, shared meshes and compressed snapshots in batches of 32,
using the fixed three-worker initial candidate and shared compiled WASM. It checks
clearance after all parts exist. The 120-second watchdog, 768 MiB reservations and
1 GiB sampled browser/controller cap remain unchanged. This is a new real-geometry
gate, not another worker-count comparison.

| Real 512-part attempt | Last reported completed parts | Last progress time | Sampled peak | Outcome |
| --- | ---: | ---: | ---: | --- |
| Per-part glyph unions | 32 | 3.323 s | 1,206,218,752 bytes | Memory abort |
| Batch-owned unit glyph templates | 384 | 11.032 s | 1,077,116,928 bytes | Memory abort |

The second result is **not** a completed 512-part model. Last progress does not
describe every worker's in-flight work. It retained about 4.4 MB of reported
candidate data when last observed; the sampled whole-process peak also includes
native heaps, JavaScript, browser processes and controller memory. Sampling is
about once per second and can double-count shared pages; it is not an exact peak.
Both failures occur before a previous accepted design, renderer/GPU buffers or
exports are present. Neither failure changes the application limits or qualifies
the synthetic 4000-part result as a real editing capacity claim.

Evidence:

- `artifacts/wall-art-layouts/real-512-2026-11-02T21-54-00-151Z.json`
- `artifacts/wall-art-layouts/real-512-2026-11-02T21-57-10-472Z.json`

The existing stop-on-failed-tier gate now applies to real geometry. Review the
native allocation/retention strategy before editor integration. Worker-count
investigation remains closed; no smaller release tier or larger application
memory cap is implied. The user's PR request remains conditional on completion.

Checkpoint verification: `npm run check` under Node 24.15.0 passed scaffold
validation, both typechecks, the production build, **54 Node tests and all 58
Chromium production/development tests**. Node tests took 69.7 seconds; browser
tests took 1.1 minutes. The application still builds the v1 route.

An earlier complete run passed all Node tests but timed out in the existing
development navigation journey (57/58 browser tests passed). The trace showed
successful navigation actions with cumulative delay, not a failed state assertion.
The unchanged targeted case passed in 11.4 seconds, then the complete gate passed
with that case at 5.5 seconds. No timeout, retry or assertion was relaxed. Retained
failure evidence is in `artifacts/wall-art-layouts/check-navigation-timeout/`.
The passing regression gate does not override the separate real-capacity failures.

### Memory revision — 2 GB approved

The user requested: “it should be ok, lets do the memory limit as 2gb for now and
continue. then do the pr”. This approves continued implementation with a literal
**2,000,000,000-byte** v2 memory limit. It replaces the earlier v2 estimated and
measured memory limits for current qualification; historical failed reports retain
their original limits. The browser sampler includes the dedicated browser process
group and controller RSS. Estimated accounting includes accepted/candidate buffers
and active native-batch reservations. Native batches reserve one sixth of the total
each (333,333,333 bytes), so three active heaps reserve half the total and leave
room for retained data and browser overhead. This replaces the old 192 MiB internal
reservation within the approved aggregate cap. The three-worker initial/two-worker
replacement candidate, 120-second watchdog, geometry tolerances,
4000-part target and temporary disk reservation remain the current contracts.

Resume the real 512-part checkpoint, then the larger real geometry, replacement,
rendering and export gates. The larger cap is permission to qualify, not evidence
that those gates pass. Finish the feature and checks before creating the requested PR.

Results under the approved cap:

| Fixture | Result | Elapsed | Sampled peak |
| --- | --- | ---: | ---: |
| 1600×800 rectangle/square, 512 numbered parts | Completed once | 19.4365 s | 1,201,004,544 bytes |
| 2000×2000 rectangle/triangular, top ratio 0.99 | Watchdog; 2816 parts last reported | 120.0186 s | 1,262,333,952 bytes |

The triangular probe first exposed coarse-mesh volume error on a clipped edge
part. Bounded refinement at 0.05, 0.01, 0.002 and 0.0004 mm resolves that case
without weakening C2 volume agreement or the triangle ceiling. A regression checks
the canonical numbered part and rejects invalid input before CAD. A subsequent
attempt hit the old 192 MiB per-batch reservation, which is superseded by the
approved aggregate allocation above. Convex native polygon half-planes now reject
impossible glyph placements before constructing cutters; accepted placements still
pass native containment and distance checks. These are geometry-preserving changes.

Evidence in `artifacts/wall-art-layouts/`:

- `real-512-2026-11-02T22-13-17-018Z.json`: completed 512 parts, 512 engraved,
  80,912 triangles, 22,292 counted operations, 5,422,547 retained bytes.
- `real-rectangle-triangular-2000x2000-2026-11-02T22-21-02-620Z.json`: timed out
  with 504,556 candidate triangles, 147,461 counted operations and 39,347,640
  retained bytes last reported. Earlier geometry/reservation failures remain saved.

Both runs are initial generation only. The large run did not complete generation
or reach final clearance. Replacement, renderer and export allocations, all-family
maximum cases and cold/warm p95 qualification remain open. The 2 GB memory revision
does not authorize a longer watchdog; the existing failed-tier review stop applies
to the timing failure.

Verification after the memory revision and mesh/fitting changes: `npm run check`
under Node 24.15.0 passed scaffold validation, both typechecks, the production build,
**55 Node tests and all 58 Chromium production/development tests**. Node tests took
40.2 seconds; browser tests took 1.1 minutes. The regression gate passes, but the
separate large-layout timing qualification still fails.

The user selected **“Keep 120 s (Recommended)”** at the timing review. Continue
profiling and geometry-preserving optimization within the approved literal 2 GB
cap, the 120-second watchdog and the existing part/geometry limits. The three-worker
initial / two-worker replacement candidate remains fixed. This authorizes the next
optimization pass, not a longer timeout or a worker-count comparison.

### Native timing optimization — initial large job passes

The stage profiler (`scripts/profile-native-layout.mjs`) measured 32 numbered
interior triangles: relief construction took 961 ms and engraving 1251 ms, versus
280 ms for mesh generation and 129 ms for archival. A polygon-only optimization
constructs the vertical base and ruled relief with one three-section native loft,
removing the base/relief Boolean union. The same relief stage then took 188 ms.
Curved bases retain the analytic extrusion and separate relief union.

The next large run built all 3808 parts but timed out during clearance. Native
straight-edge contours now supply a conservative convex envelope containing both
base and X-transformed top vertices. Bilinear ruled sides stay inside that envelope.
Separated support intervals, with the CAD tolerance allowance, prove separation
without restoring both native snapshots. Curved contours and unproven pairs retain
the full-solid native distance check. No display-mesh approximation proves clearance.
The all-family regression also checks every original AABB pair natively, including
pairs eliminated by the new envelope. An independent diagonal-triangle fixture
retains a sub-minimum gap and eliminates only sufficient gaps.

The unchanged large fixture then completed once:

| Result | Measurement |
| --- | ---: |
| Retained / excluded parts | 3808 / 80 |
| Engraved / map-only IDs | 3646 / 162 |
| Generation including clearance | 92.2022 s |
| Sampled browser/controller peak | 1,129,480,192 bytes |
| Canonical triangles | 705,608 |
| Counted operations | 171,380 |
| Retained data estimate, including metadata | 53,052,350 bytes |

Evidence: `artifacts/wall-art-layouts/real-rectangle-triangular-2000x2000-2026-11-03T06-58-00-279Z.json`.
The earlier clearance timeout remains in the same directory with timestamp
`2026-11-03T06-52-54-894Z`. All 14 focused partition/identification regressions
passed after these changes. This is one initial job, not p95 or editing capacity.

The next fixture retains actual accepted native snapshots and canonical meshes
while a two-worker replacement runs. Height-only edits may reuse immutable base
contours when every footprint input matches; changed footprint inputs repartition.
Shared contour data is not mutated, and replacement failures preserve the accepted
snapshot. This fixture still precedes renderer and export qualification.

The first retained height-edit probe completed initial generation in **89.3635 s**
and replacement in **119.4954 s**, with a combined sampled peak of
**1,138,114,560 bytes**. It retained the previous 53,052,350 bytes while changing
relief height from 20 to 21 mm. Both jobs produced 3808 parts. The replacement
reused immutable bases, used two workers, and retained 53,054,064 bytes. Evidence:
`artifacts/wall-art-layouts/real-rectangle-triangular-2000x2000-replacement-2026-11-03T07-05-15-473Z.json`.
Its half-second margin does not qualify repeatable editing or renderer overlap.

A subsequent convex-base engraving certificate proves containment and edge
clearance from native straight-edge half-planes and every glyph/arrow vertex.
It requires a 1.2 mm clearance plus twice the CAD tolerance. Curved, concave or
uncertain placements retain native containment and distance checks. Independent
tests reconstruct each glyph bar and verify native outside area and boundary
distance for all 18 numeral/mark cases and the clipped triangular regression.
All 14 partition/identification tests and the app typecheck passed. Removing Boolean
simplification and enabling partial-coincidence gluing did not improve timing;
both experiments were reverted. The profiler still attributes most engraving time
to the final pocket Boolean and validation (954 ms per 32 interior triangles).

### Actual renderer qualification

`LAYOUT_RENDER=1` mounts the production `WallArtPreview` in the isolated fixture.
The accepted renderer stays mounted during replacement. Its normal arrays,
materials and GPU allocations coexist with accepted native snapshots and candidate
batches. The fixture checks actual canvas pixels before accepting the rendered
candidate; generation plus rendering stays inside the same 120-second watchdog.
This includes the renderer, not the application shell or exports.

The 512-part rendered height-edit probe passed once: **15.2072 s** initial,
**16.5491 s** replacement, and **1,109,745,664 bytes** sampled peak. Actual rendering
took 353/115 ms and produced nonblank 1265×640 frames. Evidence:
`artifacts/wall-art-layouts/real-rectangle-square-1600x800-replacement-render-2026-11-03T07-23-48-339Z.json`.
Earlier renderer-fixture failures remain recorded: the probe initially mistook
canvas fallback HTML for a failure and created the WebGL context before Three,
which changed its framebuffer options. Both fixture errors were corrected without
changing the production renderer. These earlier results are not capacity evidence.

The subsequent large rendered-fixture request failed **before rendering**:
`real-rectangle-triangular-2000x2000-replacement-render-2026-11-03T07-26-01-398Z.json`.
Initial generation reached 1920 completed parts at 120.0117 s, with 121,787 counted
operations, 320,342 triangles and 32,904,592 retained candidate bytes last reported.
Sampled peak was 1,089,531,904 bytes. No accepted design or canvas existed yet, and
the replacement did not run. This is a timing failure, not evidence that renderer
allocation caused it. No other test or benchmark command ran concurrently.

The earlier successful 3808-part generation and near-timeout replacement remain
valid single-run observations, but this failure demonstrates unqualified timing
repeatability. The source of the variation is not established. R4's failed-tier
review stop applies before editor integration or the requested completion PR.
The 2 GB cap, 120-second watchdog, geometry tolerances and fixed worker policy
remain unchanged. No production v2 dispatch or exports have been enabled.

Regression verification after this checkpoint: `npm run check` under Node 24.15.0
passed scaffold validation, both typechecks, the production build, **56 Node tests
and all 58 Chromium production/development tests**. Node tests took 42.7 seconds;
browser tests took 1.1 minutes. This passing regression gate does not override the
separate failed large-layout timing qualification.

### Measured-capacity continuation — approved

The user requested: “its fine for now. just record the limit. how many parts can
be done within that time. lets continue further”. This approves continuing the
remaining geometry, export and editor work without making repeatable 4000-part
throughput a prerequisite. It does not raise the timeout or memory cap, approve
invalid geometry, or establish a smaller guaranteed capacity from partial progress.

| Evidence at the current 120-second limit | Interpretation |
| --- | --- |
| 512 parts: 15.2 s initial / 16.5 s replacement, actual renderer retained | Completed measured editing case; one run, not a universal guarantee |
| 3808 parts: 89.4 s initial / 119.5 s replacement, no renderer | Completed once; timing was not repeatable |
| Latest large request: 1920 completed parts at timeout, before rendering | Partial progress only; not an accepted design or a 1920-part supported limit |

Keep 4000 as the hard retained-part ceiling, 120 seconds per generation/selected
export and literal 2 GB aggregate memory. Actual capacity depends on geometry and
the machine. No automatic truncation, dropped pieces or smaller substitute design.
Expose timeout/budget failures and retain the previous model and its export source.
The UI/docs may report completed measurements but must not advertise a guaranteed
part count or the failed full-tier p95 target. Preserve historical failed evidence.

Continue T2/T3 correctness and all-family exports, then T4/T5 bounded v2 integration
with cancellation, atomic acceptance and exclusion consent. Verify integrated
representative cases and failure recovery in T6. Large-tier repeatability remains
recorded as an unqualified performance limitation rather than a stop on further
implementation. The requested completion PR still follows the remaining acceptance
checks and the shared regression gate; this decision does not mark the feature done.

### Continued geometry and export checks

The all-family export regression now builds the actual clipped, tapered and
engraved geometry for all **20 outline/layout combinations**. Each family uses
a fresh native heap. It archives and restores each part, assembles bounded native
STEP fragments, reimports through Replicad and independent occt-import-js, and
checks native validity, volume, curved surfaces, names, units and placement.
STL is checked by Three's reader; streamed 3MF is checked for exact canonical
vertex/index data and assembly transforms. These are small correctness fixtures,
not capacity measurements. Sources: `tests/wall-art-layout-exports.test.mjs` and
`tests/support/layout-export-worker.mjs`.

The browser probe now accepts `LAYOUT_EXPORTS=step,stl,3mf`. It uses a disposable
persistent profile to qualify disk-backed output while retaining the accepted
native snapshots and actual renderer. STEP restores at most 32 parts in a fresh
native heap and supplies one fragment at a time to the streaming assembler.
STL and 3MF use the same accepted canonical meshes. Each selected export has its
own 120-second watchdog. Download leases are released after actual download.
Independent mesh-reader inspection is additional test allocation included in
the sampled process peak, not part of export timing.

The real 512-part square probe completed generation, height replacement and all
three downloads within their separate 120-second limits:

| Stage | Measured time | Download size |
| --- | ---: | ---: |
| Initial generation + preview | 16.9099 s | — |
| Replacement + preview, accepted design retained | 41.9640 s | — |
| Native STEP, 16 streamed fragments | 76.3898 s | 87,848,849 bytes |
| Binary STL | 0.7037 s | 4,045,684 bytes |
| Standard 3MF | 1.1007 s | 309,437 bytes |

Combined sampled peak: **1,157,406,720 bytes**. Three's independent readers confirmed
80,912 STL triangles and 512 3MF objects with bounds `[-798.75,-398.75,0]` to
`[798.75,398.75,31]` mm. The full 87.8 MB STEP download has not been independently
reimported; small all-family STEP outputs have. Evidence:
`artifacts/wall-art-layouts/real-rectangle-square-1600x800-replacement-render-2026-11-03T08-09-41-054Z.json`.
The 42-second replacement is another reason not to claim the original 30-second
512-part p95 target. It stays within the accepted 120-second limit.

OrcaSlicer imported the real 512-part 3MF with `--arrange 0`; its reported objects
were manifold and had the expected 47.5×47.5×31 mm dimensions. An attempted STL
re-export exposed a Windows filename problem: Orca used colon-containing stable
IDs as filenames. Despite exit code 0, it produced no files. The v2 streamed 3MF
writer now uses portable `Part-N` display names and retains full stable identity
in the standard `partnumber` attribute. The regression checks both. A new four-part
3MF passed Three's reader and Orca then produced all four expected nonempty STL
files in `artifacts/wall-art-layouts/orca-portable-names/stl/`. The original failed
512 export remains evidence; it is not reported as a successful re-export.

Curved numeral sizing no longer uses a coarse inscribed-polygon span as the
requested size. Span bounds refine until they select the same 0.05 mm glyph step;
an unresolved boundary fails explicitly. Complete native circles, including two
semicircle edges, use their exact diameter. Tests cover rotated ellipse bounds,
1.19/1.2/1.21 mm circular span thresholds, and the full 16.15 mm requested number on
a 47.5 mm radial center disk. Native glyph containment remains independently checked.

`scripts/render-layout-fixtures.mjs` produces the contour/glyph review sheet in
`artifacts/wall-art-layouts/fixture-review.html` and `.png`. It shows all twenty
native post-gap contour families, original digits, and minimum-size number/arrow
combinations. The agent inspected the sheet; user fixture approval remains open
under the original T2/T3 review gate. Physical print readability remains unverified.

Full verification after these changes: `npm run check` under Node 24.15.0 passed
scaffold validation, both typechecks, production build, **59 Node tests and all
58 production/development browser tests**. Node tests took 160.8 seconds, including
the new twenty-family native export matrix; browser tests took 1.8 minutes.
The application still dispatches generator 1. V2 coordinator/editor integration,
production disk-export lifetime and remaining acceptance checks precede the PR.

### Integrated editor checkpoint — 2026-11-03

After the user approved the contour/glyph sheet, T4/T5 connected generator 2 to
the editor. This checkpoint supersedes the v1-only implementation status above.
New designs use pair 2/2. Pair 1/1 keeps its original worker and saved bytes;
upgrade requires a generated preview and explicit confirmation.

The production coordinator validates before CAD, runs bounded fresh native heaps,
and accepts complete candidates atomically. It retains the previous design on
failure, cancellation and timeout. Export captures one accepted revision, restores
bounded native STEP batches, and streams output to leased temporary browser files.
Edits queue during export. Explicit release ends the successful download's lease;
failure and cancellation close workers before cleanup. No project persistence was
added. See the architecture document for module ownership and data flow.

| Acceptance | Integrated evidence |
| --- | --- |
| AC-1/2 | Native outline/extreme-aspect and deterministic cell tests; all twenty outline/layout families |
| AC-3 | Both boundary modes, radial clipping and actual bounds; browser whole-cell warning and inactive-policy explanations |
| AC-4 | Area/span boundaries, fragment metadata and all-removed failure; current-exclusion acknowledgment gates export |
| AC-5/6 | Stable numbering, native glyph/floor/clearance checks, explicit map-only IDs and enlarged native-contour lookup |
| AC-7 | Pure import/range/budget checks before CAD; real failed-candidate and cancelled-job retention, late-result rejection and watchdog tests |
| AC-8 | Twenty-family STEP/STL/3MF round trips; actual browser downloads; version-1 compatibility; pinned-revision/queued-edit tests |
| AC-9 | Both-theme 320 px keyboard/error recovery, all outline/layout selectors, numbered-plan lookup, and genuine 200% browser zoom |

Visual checks used the application at 1280 and 320 CSS px in both themes. The
numbered plan, enlarged lookup and controls remain reachable without page-wide
horizontal overflow. At genuine Chromium page zoom, `getZoom()` returned 2,
the viewport changed from 1280 to 640 CSS px, and DPR doubled from 1 to 2.
Evidence: `artifacts/wall-art-layouts/editor-review.json` and
`editor-<width>-<theme>-<view>.png`, plus the zoom captures produced by
`verify-editor.mjs`. The images were inspected. The design detector reported no
findings. Screen-reader, physical-touch and physical-print behavior remain unverified.

Integration checks exposed and corrected a startup race: an import could inherit
the cancelled startup job's WASM-fetch signal. Compiled-code loading now belongs
to the host, while each job can independently stop waiting. A browser regression
holds the WASM request and imports a design during startup. Earlier foundation
checks assumed only one `details`/`summary` in the page; they now target the workspace
drawer explicitly while preserving its focus, history and lifetime assertions.

Capacity remains the user-accepted measured limitation, not a promise that every
4000-part combination completes. The 120-second / 2 GB guards and 4000-part hard
ceiling apply to generation; each selected export has its own 120-second guard.
The measured 512-part fixture completed all stages. Large-tier p95 timing and
physical print readability are not qualified.

The final native export matrix now reports each outline/layout family as its own
bounded test. The earlier single 180-second test expired after nineteen families
while other native suites ran concurrently; no geometry assertion failed. Each
family keeps the same independent-reader checks and now has a 30-second timeout
with explicit worker termination on abort. This changes test organization, not the
application's generation/export watchdog or geometry tolerances.

Final local gate: `npm run check` under Node 24.15.0 passed scaffold validation,
both typechecks, the production build, **all 82 Node tests and all 70 Chromium
production/development browser tests**. Node tests took 178.1 seconds and browser
tests took 3.7 minutes. Actual editor STEP/STL/3MF downloads, file release, invalid
imports, explicit upgrades, cancellation, quota failure and collapsed error recovery
passed in both browser projects. Production asset inspection found no qualification
fixture entry points. `git diff --check` also passed.

An earlier run passed all native checks and 67 browser cases but failed three
workspace journeys: role locators excluded the tips checkbox inside the closed
drawer. Label-based state inspection now checks that hidden retained control;
the three targeted cases and subsequent full gate passed. No application timeout,
geometry tolerance or state assertion was relaxed.

Publication is stacked on the still-open phase-01 branch/PR #18. Local verification
does not establish remote CI success; the PR reports that status separately.
