# Wall art 01 — implementation plan

Status: **Implemented and locally verified.** On 2026-11-02 the user approved
this plan and requested implementation. Scope: [wall-art core](../specs/wall-art-core.md), stories WA-CORE-ST-1–3,
acceptance WA-CORE-AC-1–10, and the applicable [C1–C4 contracts](../specs/wall-art.md#common-contract-c1--units-coordinates-and-identity).

## Decisions and approval boundary

On 2026-11-02 the user selected the fixed, simple, editable blade array. The user
then accepted the proposed starting settings and requested this plan:

- 500 × 500 mm nominal panel, 50 mm pitch, 2.5 mm gap, 10 mm base, 20 mm relief,
  and 0.12 top-width ratio. Default output: 100 separate parts, 30 mm total depth.
- 1.2 mm minimum material/tip width and 0.8 mm minimum free clearance.
- At most 100 parts reachable through this slice's parameters; 128 is a defensive
  guard. A 10 s warm-generation target and a 30 s generation timeout require measurement.

These answers and the technical proposals below are approved, including the
spec reconciliation in T1. This approval does not cover later phases.
Build owns all listed implementation and test paths for this
slice, explicitly reassigning the default QA test ownership. No delegation is planned.

### Approved contract freeze

- Adopt the remaining ranges/steps in the core parameter table and seed default 1,
  range 1–9999. Steps are UI increments, not rounding constraints. Use exactly model
  schema 1 / generator 1; reject every other pair. Keep later pairs proposed.
- Freeze C4's first-slice limits: 4096 contour vertices, 100,000 triangles per part,
  500,000 total, 10,000 estimated CAD operations, 256 MiB estimated geometry job
  memory, and 1 MiB saved-file limit. Include retained meshes, candidate work,
  export buffers and snapshot retention in memory accounting. Expanded tiers do
  not apply. Calibrate estimates against actual allocations before qualification.
- Adopt CAD tolerance 0.001 mm, clearance allowance 0.01 mm, chord deviation at most
  0.05 mm and angular deviation at most 5°. Reject failure; never relax tolerances
  or minimum dimensions automatically.
- Freeze **no random draws in generator 1**. Seeds 1, 5000 and 9999 produce identical
  geometry and IDs; saved parameters/digests retain the different seed. Amend the
  suite's blanket PRNG gate to require the algorithm, named substreams and test
  vectors before the first random generator version. An unused PRNG adds no value
  to this slice and does not establish later compatibility.
- Qualify on the C4 Windows 11 x64 desktop profile: at least four physical cores,
  16 GiB RAM, integrated graphics, pinned Chromium, production build, 1280×800,
  no throttling. Record exact hardware/software. Run five cold and twenty warm
  repetitions for default and worst supported cases; warm p95 ≤10 s, input/cancel
  acknowledgment ≤200 ms. Record startup/download separately. Linux CI and Firefox
  check correctness; desktop results do not qualify mobile performance.

## Implementation shape

The [implemented architecture](../architecture.md#wall-art-core-implementation)
owns shared boundaries. This plan assigns the concrete work.

```text
numeric drafts / JSON file
          ↓ strict validation + budget estimate
latest candidate → CAD worker → valid solids → shared validated mesh
                       │                         ↓
                       │                 atomic accepted revision
                       │                         ↓
                       │                  preview + summaries
                       └── explicit export snapshot → STEP / STL / 3MF → download
```

The previous accepted revision stays visible until a new candidate passes every
check. Editable JSON contains parameters; it is not a cache of generated geometry.

| Paths | Responsibility |
| --- | --- |
| `src/tools/wall-art/model/{parameters,validation,budget,design-file}.ts` | Version-1 fields/defaults, strict unknown-input validation, cell estimates and editable JSON; no React, Three or CAD imports |
| `src/tools/wall-art/geometry/{generate,worker,protocol}.ts` | Blade construction, tool-specific typed messages and worker dispatch |
| `src/tools/wall-art/editor/{state,worker-client,useWallArt}.ts` | Pure draft/candidate/accepted transitions, worker lifecycle and React integration; do not put design state in foundation preferences |
| `src/tools/wall-art/editor/{WallArtControls,WallArtPreview}.tsx`, `content.ts` | Numeric/file/export UI, actual summaries, preview adapter and availability copy |
| `src/shared/geometry/{types,kernel,validate-mesh}.ts` | Tool-independent mesh/part contracts, injected CAD initialization, solid/mesh checks and explicit resource ownership |
| `src/shared/export/{step,stl,three-mf,download}.ts` | Writers consume canonical solids/meshes, never wall-art parameters or the viewport scene; browser download cleanup |
| `src/app/App.tsx`, `src/shared/workspace/Workspace.tsx`, `src/shared/workspace/types.ts` | App composes tool slots; Workspace retains layout, disclosure and focus recovery without importing a tool |

Paths name intended responsibilities; split further only when implementation needs
it. Keep Node filesystem loading in test support. Browser production imports must
not reach tests, Node APIs, OpenCode tooling or `artifacts/`.

### Canonical geometry and validation

1. Validate exact fields/types/versions, finite numbers, ranges and combined limits
   before initializing or calling CAD for a submitted design. Repeat the boundary
   checks in the worker; a UI check alone is insufficient.
2. Derive rows/columns using positive half-up rounding and exact panel partitioning.
   Compute footprints and top widths before CAD. Use the specified plinth plus
   centered, X-tapered relief construction; fuse to one solid per cell. Height zero
   constructs only the plinth; ratio one uses straight walls without degenerate lofts.
3. Stable IDs use `wa-g1-r<row>-c<column>` with zero-based rows from +Y to −Y and
   columns from −X to +X. `mapNumber` is one-based row-major order. Parts use local
   base-centroid origins, Z=0, and translation-only assembly transforms in version 1.
4. Validate kernel success, exactly one solid per part, CAD validity and positive
   volume. Check against analytical blade volume and bounds. For this upright
   convex pattern, containment within separated footprints proves inter-part
   clearance; do not add an unbounded general collision engine.
5. Tessellate once at C4 tolerances. Resolve duplicate face-seam vertices into a
   closed indexed mesh without changing shape or hiding invalid edges. Validate
   finite coordinates, indices, triangle area, winding, edge incidence, connected
   component, positive volume and bounds. Reject seam/validity failures rather than
   performing an undocumented repair. Test malformed meshes independently.
6. Store the validated position/index arrays in the worker and transfer a copy to
   the UI; transferring the only copy would detach the export source. Use one
   explicit numeric representation for preview and mesh export. Account for both
   copies. Rendering normals/materials are separate display data.

Default actual solid bounds are 497.5 × 497.5 × 30 mm, distinct from the nominal
500 × 500 mm panel. Every part is 47.5 × 47.5 mm at its base and 5.7 mm wide at its
top. Analytical volume is `length * (baseWidth * baseThickness +
reliefHeight * (baseWidth + topWidth) / 2)`. Tests use these independent oracles.

The worker retains solids. Public result metadata follows C1: revision ID,
parameter digest, units, ordered parts, bounds, diagnostics and budget use. Compute
the digest from fixed-order versioned parameters, not object insertion order.
Revision IDs identify requests; they are not part IDs or a substitute for the digest.

### Saved JSON and errors

Proposed exact envelope keys: `format`, `formatVersion`, `modelSchemaVersion`,
`generatorVersion`, `seed`, `parameters`. `format` is `printametric-wall-art`;
all versions are 1. `parameters` holds the seven non-seed numeric fields from the
spec; seed occurs once at the top level. Reconstruct the complete parameter value
only after strict validation. Never include meshes, handles, camera or project data.

Check byte length before decoding, use strict UTF-8, then validate JSON object shape,
depth ≤16, known safe keys, exact versions, ranges and generation budget. The public
object validator applies the same rules to non-JSON input, including NaN/infinity.
Retain original imported bytes until the replacement revision is accepted. A failed
parse or generation leaves accepted parameters, geometry and retained bytes intact.

Normal Save design serializes the accepted definition. During kernel failure,
offer a distinct Save ungenerated parameters action only for structurally valid
parameters; label its status in the UI and filename. Its envelope is the same
editable definition and must still pass generation on load. Do not claim validity
from a file label. Invalid numeric drafts cannot be saved as a valid definition.

Errors carry a stable code, field/part IDs where relevant, safe version/budget
context and recovery action. Do not expose raw kernel stacks or full designs in logs.

### Worker scheduling, cancellation and resource ownership

- Protocol requests: initialize, generate, accept/discard candidate, export and
  release. Include a worker-epoch token and monotonic request/revision IDs. Validate
  message payloads; reject unknown message types, stale epochs and stale revisions.
- Keep one active CAD operation and only the newest queued generation candidate.
  A valid result is provisional until the current client request accepts it. Only
  then swap accepted parameters, summaries and mesh atomically and release the old
  result. Late or discarded results cannot commit or erase the visible error.
- Export has its own captured accepted revision and format. Serialize operations in
  the same worker; edits may queue during export but cannot retarget it. One export
  at a time; retain its source until completion/failure/cancellation. Bound live
  results to the accepted result plus one candidate or export-pinned result.
- Yield between bounded construction steps when possible. The main thread owns
  the 30 s generation watchdog; a synchronous WASM call cannot process cancellation.
  Cancel acknowledges immediately, clears queued work and restores the prior
  accepted definition. Terminate a blocked worker and advance its epoch.
- Termination destroys **all** its CAD handles. Keep the prior validated mesh and
  parameters on the client, show recovery, and rebuild that accepted definition in
  the fresh worker. Export stays disabled until its CAD result is restored and
  validated. Never claim that terminated handles survived or silently export a new
  draft. Failed recovery offers explicit Retry and parameter save.
- Give explicit export cancellation the same hard-stop recovery path. Cancelling
  queued generation does not cancel an unrelated export; distinguish the actions.
  Disposal uses `finally` for temporary shapes/writers/files. Release replaced
  arrays, GPU buffers, export bytes and object URLs. StrictMode setup/cleanup must
  not leak workers or commit responses from the abandoned instance.

### Export writers and independent readers

| Format | Writer decision | Verification |
| --- | --- | --- |
| STEP | Replicad `exportSTEP` from named, assembly-positioned copies of accepted solids; explicit model/output `MM`; never transform the retained source in place | Reimport to CAD, check solid validity/count/volume and cylinder surface type. Independently import with `occt-import-js` for dimensions, placement and face structure |
| Binary STL | Small bounded `DataView` serializer over shared indexed arrays; apply assembly transforms once, calculate face normals, emit mm coordinates | Three `STLLoader` parses actual bytes; compare triangles, components, bounds and scale |
| Standard 3MF | Minimal Core 1.4 model writer plus `fflate` ZIP; explicit millimeter unit, unique positive resource IDs, separate local meshes and build transforms; stable part IDs in `partnumber` | Validate package relationships, content types and emitted core schema subset; browser `ThreeMFLoader` independently parses meshes/transforms; target slicer import |

3MF entries are `[Content_Types].xml`, `_rels/.rels` and `3D/3dmodel.model`.
Use escaped XML, locale-independent numbers and the core namespace. Reference every
part once in build items; no printer configuration or material extension is needed.
Use `.model.3mf` to distinguish the standard model. STL filenames include `mm`;
all filenames use a fixed safe prefix and captured revision suffix.

Load the selected format adapter only on explicit export where practical. Replicad
may bundle export symbols with the geometry package; code presence is not a call.
Tests must prove no serialization, package bytes or download URLs occur on edits,
navigation or preview interaction. JSON save is a separate explicit action.

Automated fixtures: one blade; a two-part assembly with unequal, nonzero placements;
an analytic cylinder; and a 100 mm calibration dimension. An independent STEP mesh
import alone cannot prove analytic CAD preservation: also inspect the reimported
CAD face type and solid topology. Slicer GUI inspection remains additional evidence.

### Dependencies and packaging

Registry metadata and published APIs checked on 2026-11-02. Candidate exact pins:

| Dependency | Pin | Purpose / license |
| --- | --- | --- |
| `replicad` | `1.2.0` | CAD wrapper and native STEP; MIT |
| `replicad-opencascadejs` | `1.1.0` | Matching single-thread WASM distribution; package declares LGPL-2.1-only |
| `three`, `@types/three` (dev types) | `0.187.0` each | Preview and test mesh readers; MIT |
| `@react-three/fiber` | `9.8.2` | React preview; published peers accept installed React/React DOM 19.3.1; MIT |
| `fflate` | `0.8.3` | 3MF ZIP packaging; MIT |
| `occt-import-js` (dev only) | `0.0.23` | Independent STEP import path; LGPL-2.1 |

Replicad 1.2.0 itself declares the 1.1.0 kernel line in its development dependencies.
This is compatibility evidence, not a passed application integration test. Recheck
resolution and licenses in T2; keep one root lockfile. No state-management library,
worker RPC framework, general CAD kernel or additional preview toolkit is needed.

Use `replicad-opencascadejs/wasm?url` with `locateFile` and a module worker created
through `new Worker(new URL(..., import.meta.url), { type: 'module' })`. Propose
Vite `worker.format: 'es'` for worker dynamic imports. Serve hashed WASM from the
same origin, with correct MIME type; use the single-thread build so pthread
cross-origin isolation is not a requirement. Verify dev and production loading.
Use a separate worker TypeScript configuration if required to keep DOM/WebWorker
globals separate, and include it explicitly in the shared check.

Published single-thread WASM size is 22,980,267 bytes, about 21.9 MiB uncompressed.
Measure actual transfer/compression and initialization; do not block the shell on
loading it. Inspect the pinned angular-tolerance API conversion with the cylinder
fixture. Measure exposed `wasmMemory.buffer.byteLength` plus tracked JS buffers;
WASM capacity alone is not total live memory, and freed allocations need not shrink
the heap. Track disposal counts and repeated-run high-water behavior as well.

Before distributing the kernel, verify its exact corresponding source/build inputs,
OCCT version/exception and transitive notices. Record the distribution arrangement
in `THIRD_PARTY_NOTICES.md` with required license/source material under
`public/licenses/`; expose a same-site notices link from About. Preserve root
`LICENSE` verbatim. A metadata license string is not completed redistribution
review. Missing source provenance or incompatible terms block T2's exit; return to
the user if resolving them requires a different kernel, license or hosting approach.

### Gridline integration

Keep the existing spec's single bottom disclosure. Add explicit tool slots for the
preview, status, controls, summaries and notices. Workspace owns opening/focusing
the disclosure through a small recovery request contract; the tool owns numeric
field refs. App keeps the tool session mounted across view navigation, so returning
to Design retains the accepted model. Print layout and Assembly keep their current
unavailable workflows; availability changes and geometry controls are Design-only.

Use native labelled numeric fields with units, visible range/error text, the seed
no-effect notice and the relief-zero ratio notice. Enter/blur validates a candidate;
deduplicate Enter followed by blur. Partial text remains a draft, disables model
export and does not call CAD. Revert restores accepted values. Error notices remain
outside the collapsed drawer; Review opens it and focuses the relevant field.

Fit the accepted bounds in a neutral-material R3F preview with on-demand rendering.
Basic inspection must have keyboard equivalents for any pointer camera action.
Camera changes never regenerate geometry or serialize files. Preserve focus on an
edited field when results arrive. Preview failure/context loss leaves controls,
summaries and CAD exports usable; isolate it with a Canvas fallback/error boundary.
Keep pending/failed/cancelled/export states visible and politely announced. Verify
both themes, 320 px, genuine browser 200% zoom and stable canvas bounds with the
drawer open. Review screenshots before calling WA-CORE-AC-9 complete.

## Ordered tasks and completion checks

All tasks are executed by build after plan approval. Each task includes current
comments explaining units, ownership and non-obvious constraints. Stop for renewed
review if a task requires a material contract change.

| Task | Depends on | Files / work | Completion check |
| --- | --- | --- | --- |
| T1 — Freeze contracts and pure validation | Plan approval | Core/suite spec decision records; `model/` files; `shared/geometry/types.ts`; `tests/wall-art-core.test.mjs`, `tests/wall-art-contracts.test.mjs`, `tests/support/wall-art-cases.mjs` | AC-1/2/3/8: range/joint/version/depth/byte checks and analytical fixtures. Every active field/action/format/conditional branch maps to runnable N/B/I/E cases. Test reduced-cap rejection with a CAD-call sentinel and synthetic too-thin inputs. Mark later suite options unimplemented, not covered by core. |
| T2 — Canonical CAD and three-format round trips | T1 | Root manifests/lockfile; `shared/geometry/`, `shared/export/`; `geometry/generate.ts`; `tests/support/wall-art-kernel.mjs`; core tests; test-only reader fixture; Vite/typecheck configuration as needed; notices/licenses | AC-1–5/8: real Node/browser WASM initialization; named solids, native curved face, closed meshes, independent three-format reimports and 100 mm calibration. Freeze tolerances/API units and measured estimator inputs. Complete kernel provenance/license review before exit. This is the production headless path, not a throwaway prototype. |
| T3 — Worker and accepted-state lifecycle | T2 | `geometry/{worker,protocol}.ts`; `editor/{state,worker-client,useWallArt}.ts`; focused state/worker tests and test-only failure fixtures | AC-3/6/7/8/10: newest-only scheduling, atomic acceptance, serializer-call sentinels, captured export revision, hard cancel/timeout recovery, crash/retry, disposal and StrictMode cleanup. No stale commits or exports while restoration is pending. |
| T4 — Minimal editor and preview | T3 | Controls/preview components; App and Workspace slots/types; tool/app content; `src/styles.css`; existing foundation journeys and new `tests/browser/wall-art-core.spec.ts` | AC-1/6–10: real edit/save/load/download flow, invalid import/draft retention, focus/error recovery, no-WebGL export, stable full-width preview and retained design across navigation. Update obsolete Design-empty expectations while preserving shell/storage/dialog assertions. |
| T5 — Integrated gate and qualification | T4 | `playwright.config.ts`, `scripts/run-check.mjs`, test support and specs; `.github/workflows/ci.yml` only if required for new check steps/evidence | AC-1–10: shared gate discovers core tests in production and development; independent readers are exercised automatically. Windows/Linux reproducibility, Firefox correctness, 5 cold/20 warm measurements, genuine zoom, slicer import and screenshot review have recorded results. Required unverified checks remain blockers, not passes. |
| T6 — Document actual behavior and hand off | T5 | Shared docs and spec updates in the table below; checkpoint in this plan | Every AC has pass/fail/unverified evidence and artifact paths. Run final `npm run check`; inspect scoped diff and production assets. Report qualification/manual gaps and stop for user review. |

### Verification details that must not be missed

- `npm test` already discovers `tests/*.test.mjs`. Playwright currently selects only
  `foundation.spec.ts` and `development.spec.ts` in its project filters; explicitly
  include the new core spec in both projects. Browser test timeout must exceed the
  generation watchdog in timeout journeys without weakening normal waits globally.
- Existing foundation tests forbid every canvas/file input and accept only JS/CSS
  asset requests. Replace those Design-only assumptions with real model checks;
  allow expected same-origin WASM assets. Retain production fixture/Node/SDK exclusion,
  no external asset requests, theme-storage sentinels and exact root license checks.
- Run headless geometry without a GPU. Keep expensive CAD tests bounded and avoid
  initializing many kernels in parallel test processes. Store small original golden
  metadata in tests; generated models, screenshots and timings belong in ignored
  `artifacts/wall-art-core/`. Portable tests cannot require that artifact directory.
- Use Node tests for pure/state/CAD/round-trip assertions and Playwright for actual
  uploads/downloads, worker failures and focus. Test fixtures can inject controlled
  delays/failures; production must have no hidden debug query flags or test globals.
- Compare repeated numeric arrays at C2's 0.001 mm quantization and compare platform
  golden IDs/topology, bounds within 0.01 mm and volume within 0.1%. Repeat across
  seeds and non-step-aligned finite input values; do not demand identical STEP bytes.
- Pin/record the local CAD reader and target slicer versions during verification.
  Reader and slicer import must confirm assembly placement rather than auto-arrange
  or scale the model. Screen-reader/physical-touch checks need separate evidence;
  no hardware print is part of this plan.

## Required documentation reconciliation

Planning changes only this plan and the architecture proposal. T1 records the
settled decisions in their owning specs; T6 records verified behavior. Historical
foundation evidence remains historical.

| Document | Required change / completion check |
| --- | --- |
| `docs/specs/wall-art-core.md` | Record accepted defaults/minima and approved remaining bounds; exact envelope/IDs and inert-seed rule; link this plan; replace stale missing-plan text; track AC evidence |
| `docs/specs/wall-art.md` | Date/scope core C2–C4 approval; PRNG freeze applies to first random version; update core coverage/qualification status only |
| `docs/specs/wall-art-editor.md` | Retain link to the fixed initial example; distinguish already available minimal core controls from later catalogue/colour/inspection work |
| `docs/architecture.md` | Promote approved proposal and document verified contracts, actual dependency/worker/export boundaries and recovery ownership |
| `docs/product.md` | Resolve the current first-generator “angle” promise: angle belongs to later movement, not version 1. Link the bounded fixed starter and staged print preparation |
| `docs/mvp-roadmap.md` | Link core as milestone 3's first slice and identify partial milestone 4 delivery; mark only verified checklist items, leaving packing/library/expanded editor open |
| `README.md` | Replace Design's unavailable status; explain edit, JSON save/load, selected export and assembled-model/mm semantics with verified commands |
| `docs/development.md` | Actual dependency/WASM setup, worker and serializer breakpoints, reproducible failure injection, independent reader checks, performance/zoom commands and evidence |
| `docs/specs/website-foundation.md` | Update active Design availability expectations; retain Gridline, Print layout/Assembly placeholders and exact-license behavior |
| `THIRD_PARTY_NOTICES.md`, `public/licenses/` | Pin attribution/license/source provenance and required redistribution material; verify same-site About link and production contents |

No change to root `LICENSE`, hosting deployment configuration or the later mounting
contract is required. A failed technical gate is reported before proceeding rather
than changing those decisions implicitly.

## Review questions and implementation gates

The user approved the version-1 inert seed, remaining numeric/tessellation budgets,
desktop qualification profile, dependency/reader choices and worker recovery
behavior on 2026-11-02. These decisions do not need to be asked again.

T2 must establish kernel compatibility, source/license provenance, correct angular
units and real independent export round trips. T5 must establish performance,
memory and manual acceptance evidence. These are explicit verification gates, not
claims already demonstrated by documentation research. Failure that requires a
different kernel, wider budget, changed geometry or reduced supported scope comes
back to the user for a decision. Before each later phase, actively ask its unresolved
questions and propagate recorded answers to affected specs.

## Implementation checkpoint — 2026-11-02

T1–T6 are implemented. Build performed the work directly, including the assigned
tests. No delegation, commit, push, deployment or hardware print was performed.
After this implementation handoff, the user accepted the result ("looks good")
and requested `/pr`. That authorizes the feature commit, push and PR; it does not
authorize merge, deployment or the next phase.
The initial fixed pattern and approved limits are unchanged. Later phases still
require their own active decision review and plan approval.

### Acceptance evidence

| Acceptance | Local result and evidence |
| --- | --- |
| AC-1 | Pass: default 100 valid blades, stable IDs, 497.5 × 497.5 × 30 mm actual bounds; Node and browser first visit |
| AC-2 | Pass: field boundary matrix, non-step values, analytical geometry, zero relief and ratio endpoints in `tests/wall-art-core.test.mjs` |
| AC-3 | Pass: exact keys/types/finite ranges, synthetic 128/129 counts, reduced-budget CAD sentinel and minimum-width estimator checks |
| AC-4 | Pass: one canonical tessellation; independent STL/3MF readers; native STEP reimport retains a cylindrical face, two solids and unequal nonzero placements |
| AC-5 | Pass: millimeter calibration and counts in independent readers; OrcaSlicer imports and no-arrangement 100-part 3MF-to-STL round trip preserve each placement within 0.01 mm |
| AC-6 | Pass: controlled worker tests pin revision/format across queued edits; actual browser downloads for all formats and JSON; no download on editing/camera/navigation |
| AC-7 | Pass: latest-only queue, duplicate Enter/blur, stale epoch, cancellation, crash, fake-clock watchdog and STEP-worker retirement tests; repeated native/browser export cycles |
| AC-8 | Pass: strict version/UTF-8/depth/1 MiB JSON boundary tests; browser rejected import preserves the accepted model; actual editable save/load |
| AC-9 | Pass for keyboard/browser scope: both themes, 320 px and desktop, genuine 200% page zoom, error focus, camera actions and dialogs. Screen-reader and physical-touch behavior remain unverified. |
| AC-10 | Pass on the recorded desktop: measured cold/warm generation, cancellation acknowledgement, bounded repeated exports, timeout and missing-WebGL/kernel recovery checks |

The executable inventory is `tests/support/wall-art-cases.mjs`; the guard test
checks its active parameter and named-test references. These results do not claim
every future suite option, physical strength, or mobile performance qualification.

### Checks and measured profile

- `npx --yes --package=node@24.15.0 -c "npm run check"`: scaffold validation,
  both typechecks, production build, **30 Node tests and 48 Chromium tests passed**.
  Browser tests covered both production and development, including StrictMode.
- Ubuntu under WSL, Linux x86-64, official Node 24.15.0 (download SHA-256 verified):
  the then-current eight core/worker/inventory tests passed, including native CAD
  and independent exports. Windows ran the later STEP-retirement test as well.
  Full Linux browser CI has not been run or published in this session.
- Performance host: Windows 11 Home 10.0.26200, Core Ultra 9 185H, 16 physical
  cores / 22 logical processors, 32 GiB RAM. Headed Chromium 156.0.8078.4,
  1280 × 800 CSS px, verified Intel Arc D3D11 renderer (not the installed RTX GPU
  or headless SwiftShader). Five fresh-context cold-ready runs: 1.034–1.188 s.
  Twenty warm runs per profile: p95 **204.9 ms default**, **213.5 ms worst profile**
  (100 parts, relief 120, base 40, ratio 0.1). Cancel acknowledgement: **61.9 ms**.
  Fresh-context timings include local asset loading/init; they are not a WAN test.
- `node scripts/qualify-wall-art.mjs`: 20 isolated native generation/export cycles
  passed with first/last WASM capacity 104,857,600 bytes. The browser qualifier also
  passed 20 actual STEP downloads with worker restoration between them. The budget
  includes tracked buffers and WASM capacity; it is not a total browser RSS claim.
- Chromium 156.0.8078.4 and Firefox 157.0 passed 12 theme/size combinations at
  1280/768/320 px, drawer lifetime, error recovery and support journeys. Genuine
  Chromium page zoom was 2: CSS viewport 1256 × 801 became 628 × 400 and DPR 1
  became 2. Both themes passed keyboard/dialog checks.
- Screenshot review covered desktop/mobile and both themes. Headed Intel captures
  confirm the model remains visible above the open drawer. Headless full-viewport
  captures sometimes omit the partially covered WebGL layer even though its buffer
  and clipped screenshot contain the model; use the headed captures for visual
  signoff. The portable regression checks composited model pixels above the drawer.

Local evidence is in ignored `artifacts/wall-art-core/`: `browser-qualification.json`,
`resource-cycles.json`, `slicer-verification.json`, `headed-*-open.png`, browser size
captures, zoom captures and the three starter exports. No artifact is needed by CI.

OrcaSlicer reports manifold input. Run its export with `--arrange 0` because its
default CLI rearranges objects. All 100 returned STL bounds matched their row/column
assembly placement. The installed binary does not report usable release metadata;
the tested `OrcaSlicer.dll` SHA-256 is
`4b05da998f09b0c40d672eaad89b3a3399de1d0b955430f1f91452563ddab2be`.
It returned success with a default-profile `calc_exclude_triangles` diagnostic.
This is model import/round-trip evidence, not slicing or physical-print evidence.

### Implementation decisions established by testing

- Generate and validate one native prototype, then clone its identical native shape
  and copy the authoritative mesh for every cell. This avoids repeated native
  construction and tessellation without changing geometry, part IDs or ownership.
- Explicitly dispose owned native wrappers. Native STEP writing still retains heap
  allocations, so terminate its worker after success or failure; retain the visible
  accepted design and rebuild CAD before another export. The approved memory ceiling
  remains 256 MiB. Generation-only reuse stayed at 100 MiB for 25 consecutive jobs.
- Keep camera and lighting preview-only. Preserve the WebGL drawing buffer for
  on-demand rendering; keep narrow camera controls in a keyboard-scrollable row.
- Pin dependencies and provide source/license provenance in `THIRD_PARTY_NOTICES.md`
  and `public/licenses/`. About links to the same-site notices and preserves the
  exact root license. The custom kernel's angular meshing argument is radians.

Known nonblocking output: the build warns about its 1.20 MB main JS chunk (329 kB
gzip) and the Emscripten conditional `node:module` branch. The separately served
WASM asset is 22.98 MB (7.32 MB gzip). Browser execution passes; upstream Fiber emits
a Three Clock deprecation warning. Missing-WebGL tests intentionally log a renderer
error. Physical print/fit and assistive technology checks are not claimed. The user
accepted the visual result before requesting the PR. Later mounting, packing,
presets and projects remain outside phase 01.

## Planning verification

On 2026-11-02, `npm run check` passed scaffold validation, both typechecks, the
production build, 21 Node tests and 38 Chromium browser tests (28.7 s for the browser
suite). `git diff --check` also passed. These results verify the existing foundation
only; they do not complete any new wall-art acceptance ID. No application code,
configuration or dependency installation accompanied planning.

### Research references

- [Replicad library/worker integration](https://replicad.xyz/docs/use-as-a-library/),
  published `replicad@1.2.0` and `replicad-opencascadejs@1.1.0` package metadata/types.
- [Vite worker bundling](https://vite.dev/guide/features.html#web-workers).
- [Fiber Canvas fallback](https://r3f.docs.pmnd.rs/api/canvas) and
  [on-demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance).
- [3MF Core 1.4](https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md),
  [fflate 0.8.3](https://github.com/101arrowz/fflate/tree/v0.8.3).
- [Independent STEP reader](https://github.com/kovacsv/occt-import-js),
  [OCCT licensing](https://dev.opencascade.org/resources/licensing).
