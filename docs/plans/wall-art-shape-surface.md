# Wall art 03 — technical implementation plan

Status: **Phase 03 complete under the accepted bounded-generation contract (2026-11-10). P0–P7 are implemented and verified. The 100-part starter is measured; 512/4,000-part throughput is not qualified.**

Requirements: [phase-03 spec](../specs/wall-art-shape-surface.md), decisions
D1–D18 and SHAPE-UI-D1/D2, AC-1–11 and ST-1–4. Shared boundaries:
[architecture implementation](../architecture.md#phase-03-shape-and-surface--implementation).
The initial request, “you can start implementation of this phase-03”, authorized
P0–P2. The later explicit P2 acceptance authorized P3–P7, as recorded below.
Earlier boundary failures and construction revisions remain as historical evidence;
the integrated qualification and acceptance table record the completed scope.

## Approval and sequence

On 2026-11-10 the user approved all three decisions in the complete P2 package.
After clarification that curvature is dimensionless and controls the side shape,
the user confirmed: “You can continue. This step is approved. Feel free to do
whatever is necessary to continue”. This authorizes P3–P7 under this plan.
The [accepted construction contract](../specs/wall-art-shape-surface.md#p2-acceptance--2026-11-10)
keeps starter curvature 2.2, the seven reviewed fields with C2 Spiral center, and
the conditional native-kernel accuracy contract. Existing limits remain in force.
It does not authorize publication, merge, deployment or delegated work. The earlier
approval boundaries below are retained as history, not current blocking decisions.

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

## Integrated production qualification — 2026-11-10

P3–P5 now run in the application. The accepted capability algorithms are typed
production modules; historical native test helpers re-export those modules. V3
uses explicit version dispatch, actual native/field work counters, final-solid
identification and archived STEP ownership. Surface part batches use at most 16
items; the other stages retain their 32-item upper bound. A 32-item curved starter
batch exceeded its fixed native-memory reservation. Smaller fresh heaps resolve
that failure without changing geometry, meshing or the aggregate limits.

Files use exact 3/3 tags and both seeds. Direct v1/v2 upgrades hold the original
revision and bytes until confirmation, match topology-based identities, and release
source provenance after confirmation. Controls retain raw numeric text, including
lossless ratio/percentage conversion and editable inactive settings. The numbered
plan exposes Map-only ID reasons and receives keyboard focus from its review action.

Production evidence is in
`artifacts/wall-art-shape-surface/application-2026-11-10T14-44-43.111Z/`.
`scripts/qualify-shape-surface-app.mjs` used the actual built editor, a persistent
Chromium profile and explicit leased downloads. Environment: Intel Core Ultra 9
185H, 22 logical CPUs, 33,752,997,888 bytes RAM, Windows 10.0.26200, Node 26.12.1,
Chromium 156.0.8078.4, pinned Replicad/OpenCascade 1.1.0. The report records the
kernel identifier and SHA-256 of the built index, which references hashed bundles.

| Measured action | Time | Sampled aggregate peak |
| --- | ---: | ---: |
| Cold 100-part starter | 20.68 s | 1.489 GB |
| Retained warm starter | 27.60 s | 1.344 GB |
| Retained minimum-relief edit, 20→21 mm | 28.52 s | 1.346 GB |
| Accepted STEP download | 16.86 s | 1.246 GB |
| Accepted STL download | 1.20 s | No sample during this short stage |
| Accepted 3MF download | 2.07 s | 1.162 GB |

The starter's actual bounds are 497.50 × 497.50 × 58.43 mm; the height edit reaches
59.43 mm. These are measured cell-mean heights, not forced analytic extrema.
The complete run peaked at 1,627,226,112 sampled bytes over 230 samples. The Windows
sampler includes Chromium working sets and controller RSS; shared pages can be
counted twice and samples do not establish an exact transient peak. The first
report records zero for the unsampled STL stage; the script now emits `null` for
that condition. Zero is not a memory-use claim.

Retained-design stress attempts preserve the failed evidence:

- 512 curved-side Wave parts exceeded the unchanged 120-second watchdog.
- A 2000×2000 triangular, density-12, 16-arm continuous Spiral attempt also timed out.
- A nonconvex irregular density-12 continuous Random attempt rejected at part 11
  under its native-batch memory reservation, after 24.36 s.

All three retained the previous accepted definition byte-for-byte and kept it
exportable after explicit recovery. Cancellation acknowledged in 120.64 ms with
the same accepted bytes. These results qualify bounded failure and source retention,
not a 512/4,000-part throughput tier. The approved limits remain unchanged.

Reviewed captures cover 1280 px and 320 px in both themes, forced colors, and genuine
Chromium 200% page zoom. At zoom 2, CSS width changed from 1280 to 640 and DPR doubled.
An additional genuine-zoom keyboard journey passed in both themes: numeric/range
controls, planar/blend changes, collapsed invalid-seed recovery and Map-only part
lookup. Its `zoom-keyboard.json` records the same width/DPR checks and focused-control
bounds; `zoom-keyboard-*.png` and `zoom-map-only-*.png` retain the views.
The existing document/panel scrolling and horizontally scrollable camera actions
remain intentional. The static design detector reported no regex findings in its
four input files; it did not run parsed-page contrast rules. Physical touch and
screen-reader behavior remain unverified.

The first integrated gate and browser failures are retained in
`artifacts/phase03-integrated-check-1.log`, `phase03-native-recheck.log`, and
`phase03-browser-check-{1,2}.log`. The isolated Spiral reader now passes using the
existing 500,000-triangle **independent-reader** ceiling and exact collapsed-triangle
normalization. Canonical generation remains capped at 100,000 triangles per part.
An imported spline's unmeshed native control-hull box is checked for containment;
independent tessellated bounds still must match actual placement. Two early native
timeouts passed in isolation; no universal cause is claimed. The second browser
run passed 82/84 tests; its two remaining expectations used the old starter height
for a fresh v3 design. That old-version reader journey now explicitly loads v1.

The exact 100-part files downloaded by that production run also passed native
Replicad STEP import, independent occt-import-js STEP import, Three STL/3MF readers,
and OrcaSlicer 3MF-to-STL re-export. All readers found 100 valid parts in their
assembly positions. The largest independent mesh-reader volume difference was
0.03812%; native aggregate volume differed from the canonical mesh by about 0.04055%.
The isolated reader took 37.11 s and sampled 1,341,161,472 bytes process RSS.
Evidence: `integrated-readers.json`, `independent-3mf.json`, and the 100
`obj_*_Part-*.stl` outputs beside the downloaded files. Orca reported an exclude-area
diagnostic; the check validated the actual output files, not its exit code alone.

The second shared-gate log contains native timeouts and the harness reported its
command cancelled by the server restart. A third attempt was interrupted and ended
with a Windows console-pipe error. Both logs remain available; neither is passing
evidence.

### Completion gate — 2026-11-10

`npm run check:awake` passed in `artifacts/phase03-integrated-check-4.log`:
scaffold validation, both typechecks, production build, **188 Node tests** (zero
failures/cancellations, 640.39 s), and **90 browser tests** (both development and
production, 5.7 minutes). This is the ordinary shared gate with a temporary Windows
keep-awake request; no fixture deadline or geometry limit was increased.
After this gate, the remaining old “Blade pattern” availability label was corrected
to “Wall-art surfaces”. The final `npm run build` passed
(`artifacts/phase03-final-build.log`), and `git diff --check` passed. This final edit
changed copy only; the full native/browser suite was not repeated for it.

P3–P7 are complete under the accepted bounded-generation contract. The acceptance
table below records the evidence for AC-1–11 and ST-1–4. The measured starter,
independent exports, source retention and bounded failure cases pass. Large-design
throughput, physical printing, physical touch and screen-reader behavior are not
qualified by these checks. No publication, merge or deployment is part of this handoff.

### Integrated acceptance evidence

The table maps the owning spec to runnable checks and retained review evidence.
The final shared-gate result below is separate from individual qualification runs.
Paths in the test column are relative to `tests/`; native comparison helpers now
exercise the typed production construction modules.

| Acceptance | Evidence |
| --- | --- |
| AC-1 — Seven fields | `wall-art-shape-surface.test.mjs` pins field values, family character, inactive controls, density/seed boundaries and arms 1–16. `wall-art-v3-runtime.test.mjs` independently reads each family's actual final native/mesh exports. The accepted P2 package contains the matched native family views. |
| AC-2 — Physical scale and rotation | Pure field tests cover square/wide/tall panels, shorter-side transitions, uniform and one-axis resizing, actual counterclockwise rotation, circular radial fields and unchanged fixed-XY values under layout/outline changes. Reviewed P2 fixtures supplement these analytic checks. |
| AC-3 — Top modes | Moment, contour-plane, surface-mode and continuous-footprint suites check actual area means, sloping planes, continuous caps and intermediate blends. P2 includes native mode comparisons; the browser journey checks 0/50/100% and advanced planar controls. |
| AC-4 — Starter and side profiles | The production profile measures the actual 100-part starter and its height replacement. P2 reviews curvature 1/2.2/4; domain and planar-native regressions cover fractional curvature, including values between 1 and 2. Bounds and exports retain the measured heights rather than fabricated analytic extrema. |
| AC-5 — Plinth and identification | Bare/identified-footprint suites check material rejection, residual-floor thresholds, omitted paired cuts, anchor coordinates and native-operation failures. The browser loads real invalid and Map-only candidates and verifies retained source bytes, export availability and focused part lookup. |
| AC-6 — Shared export geometry | Seven-family final-solid round trips plus the exact production 100-part downloads pass native and independent STEP, STL and 3MF readers. Orca's 100 re-exported STLs preserve valid mesh geometry and assembly placement. P2 also covers planar/curved and Map-only examples. |
| AC-7 — Controls and recovery | `browser/wall-art-shape-surface.spec.ts` covers keyboard ranges/numeric entries, preserved manual precision, conditional controls, advanced recovery and both themes at 320 px. Reviewed desktop/mobile, forced-color and genuine 200% captures are beside the production report. Assistive-technology and physical-touch testing remain unverified. |
| AC-8 — Bounded work and retention | `wall-art-v3-runtime.test.mjs` charges work before native requests/evaluations and checks per-part/job bounds. Runtime/race/storage suites cover cancellation, stale results, export ownership and cleanup. The production profile records CPU/RAM/browser/kernel/build, cold/warm/replacement/export memory, three safely rejected complexity attempts and 120.64 ms cancellation. It establishes no 512/4,000-part throughput tier. |
| AC-9 — Explicit upgrades | V3 file/identity and runtime tests check minimal-change proposals, topology correspondence, unconfirmed source retention and source-provenance release on confirmation. Browser cases cover direct v1/v2 preview, cancel, confirm, saved replay and original-file reload by keyboard at 320 px in both themes. |
| AC-10 — Versioned reproduction | V3 file/draft suites check exact version pairs, required keys, stable serialization/digests, original-version behavior, numeric precision, malformed/oversized files and inactive invalid values. Real native/runtime and browser round trips verify generated/exported results and failed-candidate retention. |
| AC-11 — Independent seeds | Field and file suites pin separate random streams, endpoint/type checks, inactive values and fixed-XY independence. Browser journeys keyboard-edit unequal layout/surface seeds, recover an invalid surface seed and preserve both through actual JSON transfers. |
| ST-1 — Select and tune | AC-1/2/3/11 checks jointly cover every family, arm count, seed and conditional field setting. |
| ST-2 — Valid shaped CAD | AC-4/5/6/8 checks jointly cover native construction, final-solid identification, independent exports and bounded failure. |
| ST-3 — Explain and recover | AC-7 browser journeys exercise the real conditional controls and real invalid/Map-only geometry; physical touch and screen readers remain outside the verified evidence. |
| ST-4 — Deliberate upgrade and replay | AC-9/10/11 checks join exact old-version dispatch, one direct confirmation, source retention, saved replay and independent seed ownership. |

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

### R3 progress — continuous native footprints

After publishing the Spiral checkpoint at `1dc362e`, the user requested continued
R3 work. Its Ubuntu/Windows PR and push checks all passed. The user subsequently
requested publishing the continuous-top work and Spiral fix before continuing;
full P2 still gates P3–P7.

The boundary-aware native builder now accepts a real phase-02 footprint. It selects
the prescribed anchor, certifies star-shaped containment and top span, then trims
bounded spline patches against the scaled native face. Shared trimmed edges define
the curved flanks. Optional plinths retain the actual base contour. Native contour
approximation, top/flank error, control-net and canonical mesh limits remain
explicit. The returned solid is local to the chosen anchor and carries its required
world translation; source layout metadata is retained. The older rectangular
comparison keeps its original coordinates and regression fixtures.

Twenty continuous Wave parts pass across four outlines and five layouts. A blended
ellipse/radial case also passes, using the real base-area mean. Independent field
volume combines top-domain moments, a separately converged native-boundary integral
and the analytic side-profile integral. A default non-adaptive native volume
estimate initially missed the tighter comparison; adaptive native integration at
1e-9 meets the unchanged 0.0001 relative field-volume threshold. Canonical mesh
qualification retains its separate 0.001 volume threshold. Failed evidence remains
in `artifacts/phase03-r3-continuous-matrix.log`.

The representative continuous Wave cap passes native and independent STEP readers
and portable STL placement checks. Local 3MF/slicer re-export also passes: the
independent STEP mesh has 9,414 triangles and relative native-volume error
0.000220870; the slicer STL has 3,620 triangles and error 0.000696354. World placement
and millimeter scale are preserved. Evidence is under
`artifacts/wall-art-shape-surface/continuous-contour-export/`. The slicer's existing
exclude-triangles message is not used as success evidence; the actual file is
checked. No physical-print or whole-family assembly qualification is claimed.

General continuous-family support is **not complete**. An ellipse/radial Spiral
fixture exceeds the existing 4,096-pole budget after trimming and flank construction,
at both investigated top ratios. A regression retains its rejection before export.
Logs: `artifacts/phase03-r3-continuous-spiral.log` and
`phase03-r3-continuous-spiral-narrow.log`. This needs bounded control-net work, not
an increased budget. Broader bare-material/identification/anchor checks, combined
construction-error accounting, full family/mode views and retained-design/browser
qualification remain pending.

#### Native test file concurrency and final verification

The first full local keep-awake run still hit native fixture deadlines: 136 of 148
Node tests passed, six failed and six were cancelled. Build/typechecks passed;
browsers were not reached. With two concurrent Node test files, 146 passed and two
existing export tests timed out. With one file, all 148 passed in 566.0 seconds,
including the new native/export checks. Logs are
`artifacts/phase03-r3-continuous-check.log`, `phase03-continuous-two-files-awake.log`
and `phase03-continuous-one-file-awake.log`. These results do not attribute every
earlier slowdown to one cause or establish a throughput guarantee.

The shared gate and `npm test` now explicitly select one Node test file at a time.
Each native fixture retains its own worker lifetime and deadline. This bounds
file-level heap multiplication instead of inheriting a CPU-count-based default.
Application worker policy, geometry limits, browser workers, test timeouts and
assertions are unchanged.

The first complete serial gate passed all 148 Node tests but timed out in one
existing cross-tab export-cleanup browser check; 69 browser tests passed. That
test passed in isolation. No reproducible storage defect was established, and
its timeout/assertions remain unchanged. Logs: `phase03-r3-continuous-serial-check.log`
and `phase03-continuous-storage-repro.log` under `artifacts/`.

The final `npm run check:awake` passed scaffold validation, both typechecks,
production build, **148 Node tests** in 245.1 seconds and **70 browser tests**.
Log: `artifacts/phase03-r3-continuous-final-check.log`. `git diff --check` passed.
This verifies the current local slice and runner change, not the remaining full
P2 requirements. Architecture/product/roadmap/README need no change for this
isolated slice; the spec status and development diagnostics are updated.

### Spiral control-net blocker — resolved for the retained fixtures

On 2026-11-05 the user requested: “ok continue and solve the blocker”. This
authorizes the bounded R3 fix, not full P2 acceptance or production integration.

The retained ellipse/radial Spiral at top ratio 0.8 had 1,078 top control points
and 18 free boundary edges. Native intersection curves retained 23–72 points on
early edges; multiplying these by the 13-row side profile exceeded 4,096 points
by edge seven. The old compact route only handled a constant transverse XY
coordinate, so it could not reduce these curved boundaries effectively.

The footprint route now tries bounded degree-5/7/9/12 candidates parameterized
by a monotone XY coordinate. Both the transverse XY coordinate and height are
compared with every original native Bézier span. Polynomial-composition residual
bounds cover complete intervals, including candidate-segment crossings. The
combined Euclidean error must fit the existing boundary allowance, tightened by
the top ratio to include its amplification at the flank base. Failed certificates
retain the original curve. Rational curves remain exact. The rectangular route
retains its degree-12 strategy and existing canonical meshes.

No field, side profile, saved parameter, error allocation or geometry budget was
changed. The part still rejects if its final native control net exceeds 4,096.
The unreduced original construction now supplies that regression, alongside the
successful compact construction.

| Top ratio | Native control points | Canonical triangles | Boundary comparisons | Relative CAD/field volume error |
| --- | ---: | ---: | ---: | ---: |
| 0.8 | 2,872 | 18,286 | 6,284 | 0.000000002381 |
| 0.4 | 1,361 | 6,092 | 4,062 | 0.000000005221 |

Both cases pass native validity, closed-mesh/winding/volume checks, the independent
field-volume oracle, native STEP reimport and independent STL placement checks.
The 20 continuous Wave fixtures, blended fixture, original invalid-linear-Spiral
mesh rejection and two C2 center export regressions also pass. The broad straight
C2 mesh remains 98,886 triangles. A separate exact polynomial-curve oracle checks
the curved reducer's coordinates, unchanged source, uncertainty rejection and
65,536-comparison work limit. Targeted result: nine tests passed in 51.4 seconds;
log `artifacts/phase03-r3-spiral-boundary-regressions.log`.

Additional exports pass two STEP readers and actual 3MF-to-STL slicer re-export:

| Top ratio | Independent STEP triangles / relative volume error | Slicer STL triangles / relative volume error |
| --- | --- | --- |
| 0.8 | 34,596 / 0.000058220 | 18,286 / 0.000306836 |
| 0.4 | 14,242 / 0.000158141 | 6,092 / 0.000565705 |

Millimeter scale and world placement pass. The separate 500,000-triangle STEP
reader ceiling does not change canonical limits. Evidence is under
`artifacts/wall-art-shape-surface/continuous-spiral-contour-export/` and
`continuous-spiral-narrow-contour-export/`. The slicer's existing exclude-triangles
message is retained; success is based on its checked output files. No physical
print or arbitrary-family qualification is claimed.

The failed count trace remains in `artifacts/phase03-r3-spiral-pole-diagnosis.log`;
successful traces are `phase03-r3-spiral-compact-boundary.log` and
`phase03-r3-spiral-compact-narrow.log`. This resolves the retained control-net
blocker. Broader family/material/identification coverage, combined error accounting,
full family/mode views and retained-design/browser qualification still gate P2.
Architecture/product/roadmap/README need no change for this isolated fix.
Full `npm run check:awake` passed scaffold validation, both typechecks, production
build, **150 Node tests** in 259.6 seconds and **70 browser tests** in 2.6 minutes.
Log: `artifacts/phase03-r3-spiral-blocker-check.log`. `git diff --check` passed.
The user requested updating PR #22 with this verified checkpoint before continuing.
Publication resolves the specified blocker, not the remaining P2 approval work.

### R3 progress — expanded continuous families

After the requested publication at `9574f92`, PR #22 and its separate push CI passed
on Ubuntu and Windows. Continued R3 work adds Dunes, Ring, Dome, Ridges and Random
to the continuous native-footprint matrix. Together with Wave, this covers **120
selected cases**: six fields, four outlines and five layouts. Selection uses the
largest eligible base; some cells repeat across outlines. This is not coverage of
every clipped fragment or parameter combination.

The independent field-volume oracle, native validity, canonical mesh checks and
ellipse/radial STEP/STL readers remain required. Initial family evidence is in
`artifacts/phase03-r3-continuous-families-matrix.log`. The portable matrix now owns
these checks. A mixed stepped/continuous Wave case remains covered separately.

Spiral's irregular cells initially exhausted the control-net budget. The isolated
footprint route now tries compact outer radial charts (degree 12, phase span up to
8), side-profile degrees starting at 8, and additional certified boundary degrees.
Every candidate must still meet the same complete-domain physical error, work and
final control-net limits. Higher-degree control hulls can extend beyond actual
surface heights; the builder also uses the analytic field range plus certified
approximation/mean error to prove vertical bounds. The original rectangular
comparison retains its prior strategies and canonical-mesh regressions.

All five selected rectangular-layout Spiral cases now pass, including the irregular
cell. The retained ellipse/radial fixtures at top ratios 0.8 / 0.4 use **826 / 616
poles**, **18,710 / 6,410 canonical triangles** and **4,242 / 3,249 boundary
comparisons**. Their independent field-volume errors are 0.0000000303 /
0.0000000163. Disabling boundary reduction still exercises control-net rejection.
The targeted Spiral extension passes four tests; log:
`artifacts/phase03-r3-continuous-spiral-expanded.log`.

A newly exercised **center-crossing ellipse/hexagonal Spiral** fits a valid native
solid with 3,550 poles but rejects at the unchanged canonical triangle/node guard.
It does not export. The portable regression retains that rejection. This case was
not part of the two previously resolved fixtures, and general Spiral support is
not qualified. Earlier failed chart, boundary and sewing experiments remain under
`artifacts/phase03-r3-spiral-center-*.log`; no tolerance was increased to accept them.

Representative continuous exports pass native STEP and an independent CAD reader,
then standard 3MF import and actual STL re-export through OrcaSlicer:

| Family | Independent STEP triangles / relative volume error | Slicer STL triangles / relative volume error |
| --- | --- | --- |
| Dunes | 7,406 / 0.000050266 | 2,568 / 0.000293517 |
| Ring | 17,876 / 0.000063549 | 8,110 / 0.000289677 |
| Dome | 6,582 / 0.000061619 | 2,318 / 0.000266060 |
| Ridges | 8,292 / 0.000087274 | 3,274 / 0.000434475 |
| Random | 5,396 / 0.000075580 | 1,824 / 0.000244408 |
| Spiral | 40,004 / 0.000061209 | 18,710 / 0.000477264 |

Closedness, winding, millimeter scale and world placement pass. The independent
STEP reader retains its separate diagnostic ceiling; canonical limits are unchanged.
Evidence is under `artifacts/wall-art-shape-surface/continuous-family-<family>-exports/`.
Logs: `artifacts/phase03-r3-continuous-family-export-readers.log` and
`artifacts/phase03-r3-continuous-family-slicer.log`. The slicer's existing
exclude-triangles message remains; success depends on inspected output files.

The first combined regression run passed 19 of 22 tests; three Spiral cases stopped
at an overly broad control-hull height bound. The analytic field-range certificate
resolved those rejections without changing material thresholds. Subsequent targeted
Spiral checks pass. Full `npm run check:awake` then passed scaffold validation,
both typechecks, the production build, **158 Node tests** in 345.4 seconds and
**70 browser tests** in 2.3 minutes. Log:
`artifacts/phase03-r3-expanded-family-check.log`. `git diff --check` passed.
The user subsequently requested adding this continuation and the center fix below
to PR #22 before continuing the phase.
Full parameter/fragment coverage, the new center tessellation rejection, broader
material/identification checks, combined error accounting, family/mode assembly
views and retained-design/browser qualification still gate P2. Architecture,
product/roadmap and README need no change for this isolated capability extension.

### Spiral center tessellation — phase-aligned charts

The user requested fixing the newly reported center case, then resumed that work
on 2026-11-09. This continues approved R3; it does not approve P2 or production
integration. The user then requested publishing the family extension and this fix
to the existing PR before continuing R3.

The retained ellipse/hexagonal fixture uses a 160×150 mm panel, continuous Spiral,
five arms, density 2, rotation 37°, phase 0.29, top ratio 0.8, curvature 2.2 and
explicit provisional C2. Its previous native solid had 3,550 control points.
Inspection of all native face triangulations found **236,744 triangles**, mostly
on the outer polar top patches, before canonical extraction rejected the budget.
The mesher still used 0.05 mm linear and 5° angular tolerances. Splitting radial or
angular charts, grading radial bands and exchanging UV axes did not resolve it.
A rational-radius experiment exceeded its diagnostic deadline. Failed traces remain
under `artifacts/phase03-r3-center-*.log`; none is accepted geometry/export evidence.

The fix changes only the chart coordinates for center-covering compact C2 Spiral:

```text
theta = eta + (2*pi*density/arms) * r
height = baseline + amplitude/2 * (1 + centerWeight(r) * cos(arms*eta + phaseAngle))
```

Here `r` is normalized radius and physical XY uses the rotated `theta`. Following
constant phase removes diagonal radial/angular height variation from the parameter
grid. The ideal map covers the same disk and preserves angular orientation at each
positive radius. Degree-8 sine fits multiplied by radius give degree-9 XY curves;
the existing quintic center envelope supplies height. Whole-domain sine/product
bounds, XY-to-height transport and rounding still enforce the same 0.0002 mm
physical-height allocation. `BoundaryPatch.angularTwist` records the mapping for
coverage checks. Off-center and rectangular comparison routes retain their prior
strategies. The field, limits, canonical mesh validation and meshing settings are
unchanged; no decimation or proximity welding is introduced.

The previously failing fixture now has **3,020 control points and 86,672 canonical
triangles**, with mesh/native relative volume error **0.000630798**. The independent
field-volume oracle differs from adaptive native volume by **3.1251e-8**. The targeted
suite passed 17 tests, including all 120 selected six-family cases, the earlier
Spiral layouts/ratios, original unreduced control-net rejection, physical field
bounds and inverse chart coverage. Log: `artifacts/phase03-r3-phase-aligned-regressions.log`.

Native STEP and independent STL checks are portable regressions. Additional local
STEP import through the independent CAD reader passes with 147,170 diagnostic
triangles and relative volume error 0.000141685. Its first raw read contained eight
exactly collapsed triangles at the polar center; applying the existing exact-only
normalization removes those zero-area records, then closed-mesh/winding/placement
checks pass. No near-point repair is used. The independent reader's existing
500,000-triangle diagnostic ceiling does not change the 100,000 canonical limit.
OrcaSlicer imports the 3MF and re-exports 86,672 valid STL triangles, preserving
millimeters and world placement; relative volume error is 0.000630798. Its existing
exclude-triangles message remains, so success is based on the checked output file.
Evidence: `artifacts/wall-art-shape-surface/continuous-spiral-center-phase-exports/`;
logs `phase03-r3-center-phase-{export,readers,readers-normalized,slicer}.log` under
`artifacts/`. No physical print or general parameter-range qualification is claimed.

Full `npm run check:awake` passed scaffold validation, both typechecks, the production
build, **158 Node tests** in 499.4 seconds and **70 browser tests** in 3.4 minutes.
Log: `artifacts/phase03-r3-center-phase-check.log`. `git diff --check` passed. The
user requested updating PR #22 with this verified fix and continuing the phase.
Broader material/identification checks, combined error accounting, family/mode assembly views and retained-design
qualification remain before P2. Architecture, product/roadmap and README need no
change for this isolated correction; the spec and development diagnostics are updated.

### R3 progress — continuous identification and final-solid handoff

After publishing the verified family/center checkpoint to PR #22 at `8cb24af`,
all four Ubuntu/Windows PR/push CI checks passed. The user requested continued R3
work, then requested updating PR #22 with the verified identification checkpoint
below and continuing the phase. Full P2 and production integration remain gated.

The isolated `identifyFootprintCandidate` adapter joins the native footprint builder
to the existing plinth/bare identification routes. It first translates a source
clone into the area-centroid frame used by the existing glyph search. It then
returns the identified solid and glyph coordinates to the selected shape-anchor
frame. Stable ID, map number, source metadata and world translation are preserved.
The returned mesh callback references the final cut solid, so canonical preview,
STL and 3MF cannot accidentally use the source callback's uncut geometry. STEP uses
that same final native solid. The caller must establish material validity first;
this adapter does not certify arbitrary input solids.

Seven real ellipse/radial continuous-family fixtures each cover these outcomes:

- Minimum relief 20 mm / amplitude 3 mm: engraved, with both native and canonical
  volumes reduced by the cuts and native STEP/independent STL checks passing.
- Minimum relief 1.3 mm / amplitude 0.1 mm: valid bare geometry with a proven
  residual-floor failure. Both marks are omitted; Map-only ID, source identity,
  native volume and the canonical mesh are retained.
- Minimum relief 0.5 mm / amplitude 0.1 mm: vertical material checks reject before
  identification. This is not converted to Map-only ID.

These selected parts use top ratio 0.8, curvature 2.2 and explicit provisional C2
for Spiral. The seven-family run passes in 48.7 seconds; each fresh worker retains
its 30-second deadline. Engraved/Map-only operation counts are 25/19, under 4,096.
Log: `artifacts/phase03-r3-continuous-identification.log`.

A separate L-shaped source has an outside area centroid and an inscribed-circle
shape anchor. The test reconstructs every four-digit glyph and arrow cutter from
the returned identification coordinates and checks that those regions are absent
from the final solid. Both plinth states pass. Injected native cut failure propagates
and retains source bytes. Log: `artifacts/phase03-r3-identification-anchor.log`.

Representative engraved and Map-only continuous Spiral exports pass native and
independent STEP readers and 3MF import/STL re-export in OrcaSlicer:

| State | Independent STEP triangles / relative volume error | Slicer STL triangles / relative volume error |
| --- | ---: | ---: |
| Engraved | 26,970 / 0.000078069 | 2,488 / 0.000327704 |
| Map-only | 30,948 / 0.000344323 | 20,406 / 0.000730704 |

The independent reader initially exceeded the unchanged 0.1% volume allowance on
the thin Map-only piece (0.001054898). Refining its diagnostic chord tolerance from
0.02 to 0.005 mm resolved that reader error. Canonical meshing and its 100,000-triangle
limit are unchanged; the independent reader retains its separate 500,000 ceiling.
No collapsed triangles were removed from these two reader meshes. Both slicer
output files pass closed-mesh, winding, volume, millimeter and placement checks.
Its existing exclude-triangles message is not treated as success evidence by itself.
The artifact script uses portable diagnostic names and records the original stable
IDs separately. Evidence is under
`artifacts/wall-art-shape-surface/continuous-identified-exports/`; logs are
`phase03-r3-identified-{export,readers,readers-diagnostic,readers-refined,slicer}.log`
under `artifacts/`. No physical print is claimed.

The first local full-gate attempt hit an existing Spiral fixture's 30-second timeout
and then the outer command's 20-minute limit. Its interrupted child processes
reported pipe/test failures; that run is not a pass. The isolated Spiral check
then passed without source changes. Logs: `artifacts/phase03-r3-identified-check.log`
and `artifacts/phase03-r3-identified-gate-timeout-repro.log`. The subsequent complete
`npm run check:awake` passed scaffold validation, both typechecks, the production
build, **166 Node tests** in 673.5 seconds and **70 browser tests** in 2.7 minutes.
Log: `artifacts/phase03-r3-identified-final-check.log`. Only the outer command allowance
was extended; fixture deadlines, geometry limits and CI configuration are unchanged.
`git diff --check` passed. No new runtime changes followed this gate.

General parameter/fragment material coverage, combined error accounting, family/mode assembly views and
retained-design qualification remain before P2. Architecture, product/roadmap and
README need no change for this isolated adapter; the spec and development diagnostics
are updated here.

### R3 progress — native assemblies and volume reference

After the user requested publication of the identification checkpoint and continued
work, PR #22 was updated to `584b646`. This subsequent slice remains local until
another publication is requested. It does not approve P2 or production dispatch.

The assembly qualifier accepts already material-checked, identified native parts.
It checks identities and finite placements before native work, copies solids to
their actual world positions, uses native bounding boxes for broad-phase selection
and checks full-solid distances for the remaining pairs. No v2 taper hull is reused.
The diagnostic retains at most 32 parts in one heap; shared aggregate triangle,
canonical-byte and pair-operation guards remain in place. Canonical byte counts
are not a measurement of native or GPU peak memory. Results return only after all
parts and clearances pass, and source ownership remains with the caller.

Two seven-part, 100×100 mm radial/ellipse Wave assemblies cover engraved and valid
Map-only outcomes. Both require ten native pair checks, with minimum checked
distance about 2.499986 mm. An overlap and a 0.8 mm gap reject; a 0.82 mm gap passes.
The earlier native sources and canonical digest remain unchanged through failed
placement/material attempts and generation of the thin replacement. STEP retains
seven valid solids; streamed STL/3MF retain the final canonical meshes, identities,
millimeters and placements. Native STEP bounds are compared with native bounds,
not with the chord-limited mesh's sampled extrema.

This exposed an inaccurate reference in checkpoint mesh qualification. The thin
center part's non-adaptive native volume was 1817.062859 mm³, while adaptive native
integration reports 1812.139284 mm³. Refining the mesh against the former reference
could never meet 0.1% and eventually exceeded the triangle budget. At the existing
0.01 mm chord setting, the mesh has 14,966 triangles and relative volume error
0.000147237 against the adaptive value. Independent area/boundary field integration
and the exact side-profile integral verify that value without using fitted CAD
poles or mesh volume as the oracle.

The shared checkpoint validator now requests adaptive native integration at 1e-9,
rejects nonfinite/nonpositive or unresolved references and includes reported
integration uncertainty in the unchanged 0.1% comparison. STEP regressions use the
same measurement precision. Shape construction, 0.05 mm/5° mesh ceilings, refinement
steps and the 100,000-triangle part limit are unchanged. Existing invalid-linear
Spiral rejection and C2 narrow/broad readers still pass; canonical counts remain
79,126 and 98,886 for those retained cases. Failed reference/bounds diagnostics are
retained under `artifacts/phase03-r3-native-assembly*.log` and
`artifacts/phase03-r3-thin-center-volume.log`.

Targeted assembly/reference and prior boundary regressions passed six tests in
64.4 seconds. Log: `artifacts/phase03-r3-adaptive-volume-oracles.log`. The engraved
assembly has 18,264 triangles / 328,920 canonical bytes; the thin Map-only assembly
has 139,010 triangles / 2,502,348 canonical bytes.

Both assembled STEP files pass native validation and an independent CAD reader for
all seven parts. Independent tessellation at 0.005 mm produces 89,808 / 124,108 total
triangles, with maximum per-part relative volume errors 0.000129225 / 0.000961921.
The independent reader retains its separate 500,000-triangle diagnostic ceiling;
canonical parts still obey 100,000. OrcaSlicer imports each streamed 3MF and re-exports
seven STL files with `--arrange 0`. All fourteen actual files pass closed-mesh,
winding, positive-volume and millimeter/world-placement checks. Triangle totals
remain 18,264 / 139,010; maximum per-part volume errors are 0.000855792 / 0.000932577.
Its existing exclude-triangles log message is not treated as export evidence: the
output files are checked. No physical print is claimed.

Reports and models are under `artifacts/wall-art-shape-surface/assembly/`, including
`generation.json`, `step-readers.json` and `slicer-readers.json`. The local evidence
script is `artifacts/qualify-surface-assembly.mjs`; logs are
`artifacts/phase03-r3-assembly-{export,readers,slicer}.log`.

Full `npm run check:awake` passed scaffold validation, both typechecks, production
build, **168 Node tests** (359.6 seconds) and **70 browser tests** (2.0 minutes).
Log: `artifacts/phase03-r3-assembly-check.log`. `git diff --check` passed. The published
`584b646` also has all four Ubuntu/Windows PR/push CI checks passing; this subsequent
assembly/reference slice remains local and uncommitted.

These are small retained-native fixtures, not browser memory or full-tier editing
qualification. General material/fragment coverage, combined construction-error
accounting, complete family/mode assembly views and browser retention remain before
P2. Architecture, product/roadmap and README need no change for this isolated slice.

### PR review — fractional side-profile endpoint

On 2026-11-10 the user requested continued implementation and fixes for PR comments.
PR #22 has one unresolved review finding:
[fractional exponents below two](https://github.com/RogerGMartins/printametric/pull/22#discussion_r4472184870).
The reported `fitPowerProfile(1.5, 100)` failure reproduced before editing. Every
leftmost refinement interval evaluated the infinite second derivative of `t^p` at
zero, so even arbitrarily loose requests rejected for `1 < p < 2`.

The shared profile fitter now bounds the polynomial's second derivative separately
from the power function's convex tangent remainder on that interval. The latter
reaches its maximum at an endpoint and remains finite. Other intervals and powers
keep the existing residual calculation. Degree choices, eight refinement levels,
physical error allowances and native/mesh limits are unchanged. A genuinely tight
fit can still reject; this does not qualify every curvature/taper combination.

Numerical regressions cover 1.01, 1.1, 1.5, 1.9 and 1.99, both profile strategies,
uniform and near-zero samples, endpoint identity and tight-allowance rejection.
Native regressions exercise the rectangle, native-footprint planar and continuous
builders at `(curvature, top ratio)` values `(1.1, 1)`, `(1.5, 0.99)` and `(1.99, 0.8)`.
All nine solids pass the independent analytic volume and canonical mesh checks;
the three 1.5-curvature solids also pass native STEP round trips.

The focused numerical/native suites passed nine tests in 6.8 seconds. Log:
`artifacts/phase03-r3-fractional-profile.log`. A representative 1.5-curvature export
passes 3MF slicer import and actual STL re-export validation: 36 triangles, relative
native-volume error 0.000141008, with millimeter scale and world placement preserved.
Local evidence: `artifacts/wall-art-shape-surface/fractional-profile/` and
`artifacts/phase03-r3-fractional-slicer.log`. No physical print is claimed.

Full `npm run check:awake` passed scaffold validation, both typechecks, production
build, **170 Node tests and 70 browser tests**. Node took 590.6 seconds; browser
tests took 2.2 minutes. Log: `artifacts/phase03-r3-fractional-check.log`.
`git diff --check` passed. No runtime or test change followed that gate.
This fix and the preceding assembly work remain local; the GitHub thread is not
marked resolved before publication. No architecture, product, roadmap or README
change is needed for this bounded correction. Full P2 remains incomplete.

### P2 review package — ready for the required decision

The user requested continuing without another partial checkpoint handoff. The
approved P0–P2 investigation now has the complete fixed comparison package below.
**P2 acceptance is pending.** This does not authorize P3–P7, production v3 dispatch,
publication or a claim that every valid parameter combination is supported.

#### Open these files

- Main review sheet: `artifacts/wall-art-shape-surface/review-2026-11-10T08-59-15.362Z/index.html`.
  It links matched front/side/isometric views, exact parameter/bounds manifests and
  native STEP/STL/3MF for every successful fixture. The invalid case shows its error.
- Starter comparison: the same directory's `starters.png`; family overview:
  `overview.png`. These images render actual exported canonical arrays.
- Machine evidence: `report.json`, `readers.json`, `browser-readers.json` and
  `slicer-readers.json` in that directory. The three source starter directories are
  recorded in `report.json`, alongside their copied review files.
- Retained-design browser evidence:
  `artifacts/wall-art-shape-surface/browser-2026-11-10T09-23-30.741Z/report.json`
  and `retained-preview.png`.

Generated evidence remains ignored. Reproduction commands are in
[development.md](../development.md#p2-native-review-package); no artifact is needed
for the portable regressions or application build.

#### Deliverable evidence

| P2 requirement | Result |
| --- | --- |
| 500×500 mm, 100-part starter; curvature 1 / 2.2 / 4 | Three complete native assemblies, same remaining parameters; front/side/isometric views and all three exports. |
| All seven families and top modes | 35 family/mode assemblies: stepped, continuous, blend 0.5, planar and narrow-top. Broad modes use ratio 0.8; narrow uses 0.12. |
| Scale, rotation, curved/nonconvex and material cases | Wide/tall rotated Wave, a seven-part curved radial assembly, an explicitly asserted sloping plane, no-plinth engraved/Map-only assemblies, and one required invalid-bare rejection. |
| Shared native/export sources and independent readers | 41 valid small assemblies / 181 parts, plus three starters / 300 parts. Two STEP readers, STL, browser 3MF and actual slicer STL checks pass; all 481 slicer placements are retained. |
| Work, timing, memory and retention | Fixed-job counters/reservations, native/mesh budgets and conditional error ledgers; real accepted/candidate native heaps, canonical copies and `WallArtPreview` allocations retained during the browser sequence below. |

The 42-case matrix contains 41 successes and one expected rejection. Maximum
generation/export wall time was 39.0 seconds; sampled Node RSS peaked at
704,327,680 bytes. Maximum counted native-construction constructors were 301 per
job; maximum reserved field evaluations were 1,572,864. The reservation covers
two moment requests plus one top sampler per part. Constructor counts do not
measure every internal kernel step and do not replace P3 runtime scheduling.

Current 100-part starter runs, including native exports and the error ledger:

| Curvature | Canonical triangles | Generation/export | Sampled process RSS |
| --- | ---: | ---: | ---: |
| 1 | 12,528 | 53.7 s | 561,065,984 bytes |
| 2.2 | 106,288 | 38.9 s | 591,020,032 bytes |
| 4 | 105,008 | 32.5 s | 577,662,976 bytes |

All remain below the existing 120-second, 2 GB and aggregate triangle limits.
Each starter reserves/counts 103,332 diagnostic operations. The three source paths
end in `09-16-20.526Z`, `09-17-14.546Z` and `09-17-53.638Z` respectively. The
ordinary 2.5 mm square-footprint gap and contained homothetic sections retain the
clearance margin; curved review assemblies also use actual native-solid distances.
This is fixed-fixture evidence, not a throughput guarantee for arbitrary designs.

#### Error contract presented for approval

`shape-surface-error-ledger.mjs` separately reports analytic field/integration or
plane-height error, side-profile position error, contour approximation, and boundary
reduction amplified by the inverse top ratio. It then reports the maximum native
face/edge/vertex tolerance and exact-method BRep consistency. The largest combined
conditional value in the 181-part matrix is **0.000330909 mm**, below the proposed
0.001 mm allowance. Starter maxima are approximately 0.000000162 / 0.000195638 /
0.000000162 mm for profiles 1 / 2.2 / 4.

**This sum is conditional on the native kernel's numerical contract.** Stored
topology tolerances and exact-method consistency are not an independent global
distance proof for Boolean intersection/trim/sewing. Reports explicitly retain
`formalKernelErrorProof: false`; no sampled image or volume agreement is presented
as such a proof. Analytic approximation certificates, independent readers, material
checks and volume/placement tests supply separate evidence. The user must accept
this engineering contract or request a stronger native-error investigation before
the final construction contract is frozen. No tolerance or triangle budget was
increased to obtain these results.

The fixed fixtures also retain the existing finite-number/range/work validation,
native/mesh validity, minimum-material and clearance checks. They do not establish
complete parameter/fragment coverage. P3/P6 must retain bounded rejection and add
the production runtime's complete-version, archive, material and capacity checks.

#### Browser retention and exports

The local profile uses Windows x64 build 10.0.26200, Intel Core Ultra 9 185H
(22 logical processors), 33,752,997,888 bytes installed RAM and Node 26.12.1.
The unchanged Playwright 1.64.1 installation selects Chromium 156.0.8078.4
(revision 1248); native dependencies are Replicad 1.2.0 and
replicad-opencascadejs 1.1.0. `environment.json` in the review directory records
these values after qualification on the same machine, not a separate performance run.

The minified fixture initially exposed reliance on a native wrapper's constructor
display name. All four affected isolated native builders now use `instanceof Shell`.
A portable renamed-class regression reproduces the issue without changing the
native closed-shell checks. The failed browser report remains available.

The final headed Chromium sequence retained the accepted native worker, canonical
buffers and actual preview while rejecting invalid bare material, cancelling another
candidate, building a replacement and exporting it:

| Measurement | Result |
| --- | ---: |
| Initial curved Wave assembly | 7 parts, 18,214 triangles, 11.42 s including render |
| Replacement continuous Spiral | 4 parts, 324,754 triangles, 32.77 s including render |
| Cancellation acknowledgment | 4.46 ms |
| Invalid/cancelled candidate preserves accepted digest | Passed |
| Sampled Chromium processes + controller peak | 1,569,140,736 bytes / 2,000,000,000 limit |
| Revision-pinned STEP / STL / 3MF downloads | 1,769,564 / 16,237,784 / 6,359,560 bytes |

The 46 roughly one-second memory samples can double-count shared process pages and
cannot establish an exact transient peak. Accepted and candidate native heaps,
canonical/renderer copies and export allocations are real; the full application
shell and 512/4,000-part qualification remain P3/P6 work. Independent browser 3MF
checks confirm the downloaded replacement's four placements. Browser/server/worker
cleanup runs on both success and failure; no hardware print was started.

#### Verification and decision

This package supplies checkpoint evidence, not full application acceptance:

| Acceptance IDs | P2 evidence and remaining scope |
| --- | --- |
| WA-SHAPE-AC-1/2/3 | Seven-family fields, physical-scale examples and five top-mode views; final visual/numerical approval remains required. |
| WA-SHAPE-AC-4 | Three complete 100-part native starters and reimports; approve curvature 2.2 and the displayed scale. |
| WA-SHAPE-AC-5/6 | Engraved, Map-only and rejected bare fixtures; final-solid STEP/STL/3MF and all 481 reader/slicer placements. General material coverage and production revision handling remain later work. |
| WA-SHAPE-AC-8 | Bounded fixed jobs and actual retained native/renderer/export measurements; full application and capacity attempts remain P3/P6 work. |
| WA-SHAPE-AC-11 | Pure independent-seed validation/reproducibility checks; editor and saved-file acceptance remain later work. |
| WA-SHAPE-AC-7/9/10 | Production controls, confirmed upgrades and v3 save/load are deferred to P3–P7; this checkpoint does not mark them passed. |

Fixed-matrix native/mesh readers, all 481 browser 3MF placements, all 481 actual
slicer outputs, the three starter reader runs, and the retained-design browser
sequence pass. Logs: `artifacts/phase03-p2-review-final-matrix.log`,
`phase03-p2-review-final-readers.log`, `phase03-p2-review-complete-views.log`,
`phase03-p2-complete-slicer.log`, `phase03-p2-starters-ledger-readers.log` and
`phase03-p2-browser-final.log`.

The final full `npm run check:awake` passes scaffold validation, both typechecks,
the production build, **172 Node tests and 70 browser tests**. Node tests took
647.2 seconds; browser tests took 2.6 minutes. Output:
`artifacts/phase03-p2-complete-recheck.log`. `git diff --check` passes.

The preceding full run had 169 Node passes, one failed outline fixture and two
cancelled Spiral fixtures at their existing 30-second deadlines; it did not reach
the browser stage. All three cases passed unchanged in a focused reproduction,
then the complete rerun passed without code, timeout or budget changes. Preserve
`artifacts/phase03-p2-complete-check.log` and
`artifacts/phase03-p2-timeout-reproduction.log`; the intermittent slowdown's cause
was not established by this run. The earlier standby diagnosis does not establish
the cause of these failures.

Required user decisions before P3:

1. Keep provisional starter curvature **2.2**, with the displayed 1–4 scale, or
   choose a different result from the actual native starter views.
2. Accept the seven displayed fields/top modes and **C2 Spiral center** as the final
   direction, or identify visual changes. The saved/default field remains unchanged
   until the approved production version is implemented.
3. Accept the conditional native-kernel error contract and demonstrated bounded
   construction, or request stronger qualification. Confirm continuation to P3–P7
   only after these decisions are recorded in the spec and plan.

The sole actionable PR review finding (fractional curvature below two) is fixed
and regression-tested locally. Its GitHub thread stays open until publication.
All work since PR head `584b646` remains local; this review package is not a merge,
deployment, physical-print claim or implicit phase-03 production release.
