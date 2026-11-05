# Application architecture

Decision: start with a client-side TypeScript application. The first product is
an interactive model editor; generation and downloads can run in the browser.
This keeps hosting simple and compute costs low while supporting personal local
use. These are implementation decisions, not claims about code already shipped.

## Selected stack

| Layer | Choice | Reason |
| --- | --- | --- |
| UI | React + TypeScript | Accessible forms, editor state, and reusable controls across tools |
| Build/dev server | Vite | Fast development and portable static production output |
| 3D preview | Three.js + React Three Fiber | Three's geometry/rendering ecosystem with React-managed scene lifecycle |
| Styling | Plain CSS, native HTML controls | Responsive original UI without a component-system dependency |
| Geometry | TypeScript generators with Replicad / OpenCascade.js WASM | Retain CAD solids for native STEP; tessellate those same solids for rendering and printing |
| Export | STEP from CAD solids; binary STL and standard 3MF from tessellation | All three formats are required; preserve units and part identity across adapters |
| Saved designs | Versioned JSON files | Portable, local save/load without accounts or a database |
| Tests | Node's built-in runner; Playwright for browser flows | Keep the existing runner for geometry; exercise the real editor and downloads |
| Hosting | Static build on the owner's web server | No application server needed for the initial generator |

Install application dependencies with the first runnable slice, not merely to
declare the architecture. Pick compatible stable versions and commit the root
npm lockfile. React, react-dom, and React Three Fiber must have compatible majors
(the documented React 19 pairing is Fiber 9). Check current peer dependencies
when installing rather than independently choosing each package's latest version.
Use current Node 26 (at least 26.12.1) for development and CI, matching the Node 26
types. `.node-version` selects the runtime major. The existing OpenCode SDK is
development tooling and must not enter the browser bundle.

STEP changes the earlier mesh-only decision: the canonical model must retain
boundary-representation (B-rep) solids, not just triangles. Replicad is the
recommended high-level API over OpenCascade.js. Verify exports during generator
implementation as described below. Mesh-to-STEP conversion is not equivalent.

## Data flow and boundaries

```text
form drafts / imported JSON
          |
          v
parse + validate + enforce generation budget
          |
          v
versioned parameters + explicit seed
          |
          v
deterministic CAD generator -> validated canonical B-rep solids
                                   |
                                   v
                              tessellation -> refreshed preview

explicit Export/Download click -> snapshot accepted generation + selected format
                                   |
                                   v
                        validate + serialize STEP, STL, or 3MF
                                   |
                                   v
                              download file
```

The UI owns uncommitted text inputs, selection, camera, and loading/error state.
It must not treat a draft such as an empty numeric field as a valid parameter.
Failed imports preserve the previous valid design. Export must correspond to
the displayed accepted design, never a stale asynchronous generation result.
Mark pending changes clearly and disable export while a result is stale/invalid.

Parameter changes refresh geometry and the 3D preview, coalescing rapid edits and
discarding stale results. They must not generate STEP/STL/3MF files or invoke
export serialization, packaging, or download creation. Only an explicit
Export/Download action starts that work, and only for the selected format.
Load format-specific export code on demand where practical. Reuse the accepted
solids/tessellation rather than rerunning the generator merely to serialize them.

An export captures the accepted generation ID, parameter snapshot, and format
at click time. Subsequent edits must not silently retarget that export; retain
its source objects until it completes or explicitly cancel it. Show exporting
and failure states, prevent duplicate submissions, and release temporary bytes
and download URLs afterward. Verify that edits invoke no file exporters and that
one click exports the selected format from the captured generation.

The geometry layer validates parameters at its public boundary; HTML limits do
not protect imports. Keep pure parameter validation separate from CAD operations.
Generators use explicit parameters and seeds, with no React state, renderer,
global randomness, or current time. Keep geometry checks runnable without a GPU.

CAD solids live in a dedicated Web Worker, with stable part IDs, units, and
generation IDs. Send serializable mesh arrays and metadata to the UI rather than
WASM handles. The worker exports from the same accepted generation. Release
superseded kernel objects as well as old GPU buffers. Specify linear/angular
tessellation tolerances so mesh approximation of curved CAD surfaces is bounded.

The preview adapter constructs Three BufferGeometry from the solid's tessellation. Lighting,
materials, outlines, grids, and selection effects are preview-only. Use on-demand
rendering when idle, invalidate on camera/control changes, and dispose of replaced
GPU resources. Provide an understandable error if WebGL is unavailable.

Export adapters consume only the intended canonical solids or their validated
tessellation. Do not serialize the viewport scene, helpers, or display-only offsets.
For multi-part designs, the spec must distinguish assembly transforms from
print-bed transforms. Check all baked transforms and output dimensions.
**STL has no unit metadata or colours**: encode coordinates numerically in
millimeters, label the download accordingly, and verify dimensions in a slicer.
The selected STL serializer must consume the shared mesh arrays rather than
independently remesh at an undocumented tolerance. Three's STLExporter is an
available adapter; it serializes surfaces, not repair or printability certification.

**STEP** must contain valid CAD solids with explicit units, preserving analytic
surfaces where the generator uses them. STEP is CAD interchange, not the original
parametric feature history; the versioned JSON remains our editable source design.
**3MF** must be a standards-compliant model package with explicit millimeter units,
part objects/IDs, and transforms. Select and test a 3MF writer separately; do not
assume Replicad or Three's STLExporter writes it. A general 3MF model is not a
Bambu/Orca project with printer profiles, plate setup, filament assignments, or
sliced toolpaths. Colour/material extensions need explicit slicer compatibility tests.

Saved JSON must identify the generator, format/generator versions, parameters,
and seed. Reject unknown versions and oversized files before costly work; do not
silently reinterpret older designs. Define tolerances for numerical reproducibility
across supported runtimes. Introduce migrations only when a version actually changes.

## Implementation shape

Use one application and one package/lockfile. Create these modules as needed:

- `src/app/`: application startup coordination, navigation, theme, and Help/About.
- `src/tools/<tool>/`: each tool's UI, parameters, validation, and generator.
  Wall-art code uses `src/tools/wall-art/geometry/` and
  `src/tools/wall-art/editor/`; printable algorithms never depend on React.
- `src/shared/`: tool-independent workspace UI and types, reusable geometry
  infrastructure and format writers under `shared/geometry/` and `shared/export/`.
  Shared exporters consume canonical contracts, not a particular tool's parameters.
- `tests/`: headless geometry tests and browser journeys.

Dependencies flow from `app` to `tools` and `shared`, and from `tools` to `shared`.
Shared code imports neither `app` nor a tool; tools do not import each other.
App composes tools with shared components through explicit props and contracts.
Keep tool-specific code local; move it to shared only when it has a clear common
responsibility. Avoid generic `utils` dumping grounds, tool registries, plugin
systems, and layers that only forward calls. Create folders when they contain code.

```text
app (shell and composition)
 ├── tools/wall-art (tool-specific content, editor and generator)
 └── shared (common workspace UI, types and CAD/export infrastructure)
tools/wall-art ──> shared
```

The shell connects each tool to common capabilities; shared code stays independent.

These are boundaries, not a request to create empty folders or a plugin framework.
Follow the website-first [MVP roadmap](mvp-roadmap.md). Open directly into the
wall-art workspace; add a catalogue when more tools justify it.
React state is sufficient initially; a global state library needs a concrete use.

### Website foundation

These boundaries were approved for task-by-task implementation on 2026-10-30.
T1 supplies the entry point and separate browser/Node typechecks. T2 adds independent
state and browser adapters. T3 connects them to the responsive workspace, display
settings, and themes. T4 adds SupportDialog, Help/About content, and bundled license text.
T5 integrates the production/development browser gate. T6 checked module boundaries,
effect cleanup, and the included production graph: only app code, React/React DOM,
scheduler, license text, styles, and build helpers are shipped. Verification evidence
and remaining visual/assistive-technology gaps live in the
[T6 checkpoint](plans/website-foundation.md#t6-checkpoint--2026-10-31).

```text
hash / history ── navigation adapter ──┐
storage / OS ──── theme adapter ───────┼── App state ── workspace / dialogs
user settings ─── pure validation ────┘
```

App coordinates accepted UI state and browser effects. Components render that state
and send user actions back; they do not read storage or interpret routes.

| Module | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/app/App.tsx` | Bootstrap, session state, browser subscriptions, navigation/dialog focus coordination |
| `src/app/bootstrap.ts` | One-time route/storage/OS snapshot before React rendering; injectable browser for tests |
| `src/app/state.ts` | UI preference types/defaults and pure validation; no React or browser globals |
| `src/app/navigation.ts` | Pure hash resolution plus isolated history/event adapter |
| `src/app/theme.ts` | Validated theme persistence, effective scheme, and isolated storage/OS adapter |
| `src/app/ThemeControl.tsx` | Native sun/moon action, mode status, and Use system focus restoration; no storage access |
| `src/app/content.ts`, `SupportDialog.tsx` | View copy, Help/About, and same-site license access |
| `src/tools/wall-art/content.ts` | Wall-art availability copy and later-view empty states |
| `src/shared/workspace/Workspace.tsx`, `WorkspaceDisplay.tsx` | Common workspace layout, empty preview, summaries, and labelled display settings; receive tool content through props |
| `src/shared/workspace/types.ts` | Pure display preference and workspace content contracts; no app/tool imports |
| `src/styles.css` | Shared tokens, themes, responsive layout, and visible focus |

Use React state and native browser APIs for this slice. Test pure logic with Node
and integrated behavior with Playwright. Geometry/export lives in the independent
wall-art core layers described below. See the
[foundation plan](plans/website-foundation.md) for tasks, dependencies, and checks.

Implemented integration contracts:
- `createFoundationState` returns fresh defaults. `transitionFoundation` validates
  unknown preference values and updates field errors without browser effects.
  Navigation and storage notices have separate lifetimes; successful field updates
  clear only that field's error. Display types stay in `shared/workspace/types.ts`.
- `createNavigationAdapter(window)` has no construction effects. Bootstrap calls
  `read(true)` once; subscribe to hash changes after mounting and apply `navigate`
  results directly after ordinary link activation. `pushState` emits no event;
  hash-changing Back/Forward emits `hashchange`, so no duplicate `popstate` listener
   is needed. Updates carry heading-focus/dialog-close intent; App handles heading
   focus after commit, consuming a ref flag even for active-view navigation. Initial
   entry never sets that flag. Dialog cleanup runs before App's heading-focus effect.
  Prevent the skip link's default hash change when connecting routing, and focus
  main directly: `#workspace` is not a view route.
- Bootstrap calls `readThemePreference(() => window.localStorage)` once outside
  rendering. An explicit selection first passes the state boundary and applies in
  memory, then calls `writeThemePreference`; its result updates the storage notice.
  Never persist from an Effect or revert the selected theme after a write failure.
- `readSystemScheme` falls back to Light. Mount `subscribeSystemScheme` for System
  with a bound `query => window.matchMedia(query)` and run its cleanup on preference
  change/unmount. It immediately reports the current OS scheme to cover changes
  since bootstrap. Derive the effective scheme and use `applyColorScheme` for the
   root `data-theme` and native-control `color-scheme` with shared CSS tokens.

Current Gridline presentation boundaries:
- App owns a pure reducer and OS snapshot, with cleaned-up navigation/media Effects.
  Layout Effects synchronize the root scheme, title, and requested heading focus.
  Bootstrap applies the initial scheme before mounting. No Effect writes storage.
- `tools/wall-art/content.ts` supplies empty-state and unavailable-section content.
  App selects it by view; shared Workspace knows no route or tool identity. Preview
  precedes settings in the DOM. App supplies title, heading ref, shell notices, and
  availability copy explicitly. Workspace owns the full-window preview and one
  bottom settings disclosure; its overlay does not resize the canvas. Panel content
  scrolls within half the workspace height. Short windows allow document scrolling.
- Workspace owns field refs and pending recovery focus. Its native disclosure reports
  actual toggles, ignoring matching programmatic open events. Session-only
  `settingsOpen` defaults false and survives navigation, not reload. WorkspaceDisplay
  renders controlled tips/background fields. Errors remain outside the disclosure;
  recovery opens it and focuses the checkbox or selected radio without clearing errors.
  Only a valid edit clears that field. Notice scrolling stays separate from settings.
- Theme notices include an explicit Retry theme storage action. It submits the
  current valid preference again without toggling. The sun/moon button selects the
  opposite effective scheme; Use system writes `system` and focuses the toggle.
  Both use the existing validation/storage path. Failed writes keep memory and old
  stored bytes; successful retries clear the notice. The persisted key is unchanged.
- The error fixture under `tests/fixtures/` mounts the real App with rejected
  updates. It is typechecked but has no production entry/import. Its test-only
  unmount export verifies effect cleanup. T5 runs the shared browser journeys
  through Playwright against separate owned production/development servers.
  Browser probes stay in `tests/browser/`; no test controls enter App.

T4 support-dialog boundaries:
- App owns `supportPanel` and stable Help/About opener refs. It mounts one
  `SupportDialog` for an accepted panel. Dialog actions do not change URL/history,
  display preferences, or storage. Reload starts with no dialog.
- SupportDialog opens with `showModal()` in a layout effect and focuses its heading.
  Native modal behavior makes the background inert. Tab wraps between the actual
  button/disclosure controls, including after a backdrop click focuses the dialog.
  Backdrop clicks do not dismiss it; Escape and Close request `supportPanel: none`.
- Cleanup closes the native dialog and restores its opener. On navigation, cleanup
  runs before App's layout effect focuses the new view heading. The same cleanup
  balances StrictMode's development setup cycle without stale close-event handlers.
- Help/About copy lives in `app/content.ts`. `LICENSE?raw` bundles the unchanged
  repository text into About's native disclosure. Wrapped, preformatted text shares
  the dialog's scroll container; there is no nested modal, fetch, or download.
- Dialog styles use the current Gridline tokens. Help documents the working toggle,
  Use system action, and bottom settings panel.

#### Code practices for the foundation

The [single-UI plan](plans/gridline-application.md), approved on 2026-10-31, records
the Gridline migration, study cleanup, and fresh verification. The presentation
contracts above replace the earlier side-inspector layout without changing the
dependency direction. Historical T6 evidence describes the previous application.

- **Dependency direction:** `App` composes adapters and UI. UI receives typed props
  and callbacks; shared UI uses shared types, not app state types or browser adapters. Adapters
  may use pure validation, but never import UI. Pure modules have no browser globals
  or import-time side effects. Use relative imports and explicit module exports.
- **React:** use function components and Hooks. Keep shared accepted state in App;
  keep element refs and local focus behavior with their component. Derive labels
  and the effective theme from existing values rather than storing duplicate state.
  Use typed actions and pure transitions for related state/error updates. Keep App
  as the composition layer; extract focused hooks when subscription logic grows.
- **Effects:** rendering and state transitions stay pure. User actions trigger
  writes; Effects synchronize browser systems and clean up listeners. Dialog DOM
  operations belong to the dialog component. Enable root `StrictMode`; initialization
  and setup/cleanup must tolerate its development checks without duplicate history,
  storage writes, subscriptions, or focus changes. Read initial browser preferences
  through a bootstrap adapter outside rendering and pass the snapshot to App.
- **TypeScript:** enable `strict`, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes` for application code. Use literal unions for allowed
  values and tagged success/error results. Validate `unknown` at external boundaries;
  do not replace checks with `any`, unchecked casts, or non-null assertions. Use
  type-only imports and erasable syntax for modules run directly by Node tests.
- **Vite:** use the official React plugin and separate browser and Node/tooling
  TypeScript configurations. Run application typechecking as well as `vite build`:
  Vite transpilation alone does not check types. Browser code must not import the
  OpenCode SDK, Node APIs, or test fixtures. Treat client environment values as public.
- **Components and CSS:** split by responsibility, not arbitrary line counts.
  Keep display settings controlled by accepted state. Use semantic HTML, native
  keyboard behavior, shared CSS tokens, and scoped class names. Extract shared
  controls when actual reuse appears; measure before adding memoization.
- **Verification:** Node tests cover pure transitions and adapter failure paths;
  Playwright covers user-visible behavior, real focus, and production output.
  Also exercise the development build with StrictMode enabled. Typechecking and
  tests enforce concrete contracts; review checks dependency direction and Hooks usage.
- **Readability and diagnosis:** follow the KISS rules in AGENTS.md. Document module
  purpose and explain non-obvious transitions, browser workarounds, and cleanup.
  Use descriptive function names and explicit error results so breakpoints and
  failure reports lead to the responsible operation. Keep technical explanations
  here and runnable debugging instructions in docs/development.md; add a focused
  tool document only when its contracts need more detail than the feature spec.

Guidance: [React state](https://react.dev/learn/choosing-the-state-structure),
[Effects](https://react.dev/learn/you-might-not-need-an-effect),
[StrictMode](https://react.dev/reference/react/StrictMode),
[TypeScript options](https://www.typescriptlang.org/tsconfig/), and
[Vite TypeScript](https://vite.dev/guide/features#typescript).

### Generator-2 layout implementation

New sessions use generator 2; versioned imports dispatch through `DesignClient`.
Generator 1 retains the worker path documented below. The approved layout plan
owns geometry contracts and the accepted capacity limitation.

```text
versioned drafts/import -> validate -> DesignClient
  v1 -> original worker -> original accepted CAD and mesh
  v2 -> compiled WASM -> disposable native batches -> provisional archives/meshes
                                                     -> clearance -> atomic acceptance
accepted revision -> explicit export -> bounded native STEP fragments / mesh stream
                                    -> temporary browser File -> download -> release
```

`layout-coordinator.ts` owns the 120-second job, aggregate budgets, stable numbering,
exclusion identity and three-initial/two-replacement worker policy. Each native
heap processes at most 32 items and reserves 333,333,333 bytes. Accepted archives,
canonical mesh arrays and renderer estimates remain reserved during replacement.
Cancellation retires candidate workers without discarding accepted export sources.
Only immutable compiled code and unchanged base contours are reused; native handles
never cross heaps. Imported files contain parameters, not private native snapshots.

`DesignClient` pins accepted revisions during export and queues the latest edit.
An explicit v1 upgrade first creates a separate preview; confirmation alone replaces
the accepted definition and original imported bytes. Failed imports and candidates
retain the previous valid design. Fragment acknowledgment is keyed to the exact
exclusion set and is checked again by the export worker.

`layout-export.ts` owns a temporary storage lease, a disk writer and at most one
native STEP batch. Shared writers stream STL/3MF or strictly remapped native STEP
fragments with bounded buffers. Cancellation closes workers before storage cleanup.
The downloaded File remains leased until explicit release; subsequent exports can
reclaim abandoned directories only after the owning tab's lock disappears. This
requires secure-context OPFS and quota; storage failure is visible, never a partial
download. No automatic project storage or background export is added.

The numbered plan consumes native contour paths and accepted IDs; its labels and
selection never alter printable geometry. The 3D preview and mesh exports consume
the same canonical arrays. Tool controls remain in the Gridline bottom drawer.
The following capacity-investigation sections preserve historical evidence; the
current route is the implementation described here.

### Phase-03 shape and surface — proposal

**P0–P2 investigation approved; production integration remains proposed.** See the
[phase-03 technical plan](plans/wall-art-shape-surface.md).
The [owning spec](specs/wall-art-shape-surface.md) records product/UI decisions;
actual native surfaces and curvature are not yet qualified. The user approved a
bounded headless investigation, followed by an explicit native-CAD visual stop
before production integration. The plan owns tasks and proposed numerical methods.

- Keep pure v3 fields, independent relief randomness, validation, migration and
  native construction tool-local. Preserve exact v1/v2 routes and v2 layout random
  streams. Extend exact definition dispatch to 3/3 only after the checkpoint.
  Proposed JSON retains the format-1 six-key envelope with layout `seed` outside
  parameters and required `surfaceSeed` inside; no native data enters saved files.
- Extend archive-backed batches/snapshots with explicit version tags and direct
  part-builder dispatch. Reuse validated partition geometry without changing old
  IDs in place. Freeze topology-key correspondence across upgrades. Surface edits
  reuse footprints, not shaped CAD. No generic generator registry or second pool.
- A v3 native builder produces final bare/engraved solids, their canonical mesh,
  actual bounds, stable anchor and identification reason. Tool metadata distinguishes
  floor-only Map-only ID from invalid material or failed CAD. Shared mesh/export
  writers remain independent of wall-art fields and generator versions.
- `DesignClient` owns source-revision-bound upgrade previews for direct v1→v3 and
  v2→v3. Retain the original export source until confirmation. Separate preserved
  original-file provenance from current accepted JSON serialization after upgrade.
  Budget accepted/candidate/export-pinned archives, native heaps and renderer copies
  together. Stale completion cannot accept or dispose the wrong revision.
- Keep existing disposable batches and disk-backed export leases. Validate any
  v3-specific clearance certificate rather than assuming X-only v2 taper bounds
  apply. Preserve approved limits; capacity must be measured for this geometry.
- Gridline retains one outer drawer. Tool Surface/Shape/Layout/Files controls
  precede shared Display. App composes slots; shared Workspace knows no tool fields.
  Accepted/candidate/error metadata supplies UI truth, not renderer inference.

No stack, dependency, hosting, storage service or license change is proposed.
Implementation must replace this proposal with verified facts and checkpoint links;
it must not label the investigation as shipped generator-3 support.

### Generator-1 core implementation

The approved implementation follows these boundaries. The
[phase-01 plan](plans/wall-art-core.md) records the user's accepted starter/settings,
task dependencies, qualification evidence and remaining gates.

- Keep tool parameters, JSON validation, generation, worker protocol and editor
  state under `src/tools/wall-art/`. Keep independent canonical mesh types, CAD
  initialization/validation and format writers under `src/shared/`. Shared writers
  consume validated parts and transforms, never wall-art parameters or a Three scene.
- App owns the mounted tool session alongside foundation state and composes explicit
  preview/control/summary/notice slots into Workspace. Workspace retains the existing
  disclosure and a small open/focus recovery contract. It imports no tool. Design
  gets geometry controls; navigation retains the session while later views retain
  their unavailable workflows. Foundation preferences do not become project storage.
- One module worker owns CAD handles and accepted mesh arrays. Versioned parameters
  and bounded serializable messages cross the boundary; UI receives copied mesh
  buffers and metadata. Worker epochs and request IDs prevent stale acceptance.
  A provisional candidate becomes accepted atomically after all checks succeed.
- Queue only the newest generation request. Serialize CAD generation and explicit
  exports, capturing the accepted export revision/format at click time. Retain at
  most accepted plus candidate/export-pinned result; account for retained and copied
  buffers. Selected export adapters load on demand where practical. No parameter,
  camera or navigation action serializes model files.
- A blocked synchronous kernel call requires worker termination for hard cancellation
  or timeout. Termination also destroys accepted CAD handles. Keep the last valid
  mesh/parameters on the client; restore CAD from that definition in a fresh worker
  and disable exports until restoration validates. Do not present lost handles as
  export-ready. Errors retain visible prior geometry and explicit Retry/Revert actions.
- The native STEP writer retains memory inside its kernel despite wrapper cleanup.
  Retire the worker after each STEP export, then rebuild accepted CAD (or the latest
  queued edit). A failed STEP operation also destroys that worker and offers Retry.
  This bounds native lifetime without changing the 256 MiB budget. Repeated browser
  downloads and isolated native workers verify this path; generation-only reuse
  stayed at 100 MiB WASM capacity in the 25-job check.
- Preview uses on-demand rendering and the canonical mesh arrays. Camera, lighting,
  and drawing-buffer preservation are renderer-only. The bottom drawer overlays the
  canvas without changing its dimensions; narrow camera actions scroll horizontally.
- Dependencies are pinned in the root manifest and lockfile. Use the single-thread WASM build
  as a same-origin Vite asset, with ES-format workers for dynamic export imports.
  Verify package/source licenses, matching APIs, startup cost and measured memory
  during the first headless implementation task before qualifying the slice.
- Verify independent STEP import plus reimported analytic CAD faces, and independent
  STL/3MF parsing from actual bytes. The shared gate must discover Node tests and
  wall-art browser tests in both production/development projects. Manual slicer,
  visual, accessibility and performance evidence remains separate from CI timing.

Native loft, fuse and STEP writer handles are explicitly deleted, including on
failure. They must not depend on JavaScript finalizers to release WASM memory.
The default 100-part mesh has 2,000 triangles. The initial WASM capacity is 100 MiB;
capacity plus retained/copied mesh and serialization estimates is bounded at 256 MiB.
This estimate is not the browser's total process memory. The separate WASM download
is about 23 MB uncompressed (7.3 MB gzip); host compression affects cold startup.

### Wall-art layouts — approved implementation in progress

The user approved the [phase-02 plan](plans/wall-art-layouts.md) on 2026-11-02.
The planned extensions follow these boundaries. Headless geometry helpers now
implement small tested portions; the editor and aggregate generation/export route
remain pending. These are not measured production capacity claims.

- Keep exact version-1 generation alongside a version-2 definition and generator.
  Dispatch through a tool-local tagged definition; old files retain their original
  geometry until an explicit upgrade. Upgrade preserves original bytes and creates
  a new unsaved revision. Shared exporters remain independent of tool versions.
- Layout algorithms, native clipping/offsets, random site streams, component keys,
  engraving and orientation metadata belong to `tools/wall-art/geometry/`. The
  tool result adds accepted contours and numbering/exclusion metadata around the
  shared mesh contract. The 2D numbered lookup consumes these accepted contours;
  neither the renderer nor an SVG approximation constructs printable geometry.
- Preserve the existing worker epoch/revision and previous-valid-result protocol.
  Exclusion acknowledgment is bound to the actual exclusion set and captured
  revision, checked in both client and worker before model export. Saved parameters
  do not carry consent. Worker restoration cannot authorize a changed exclusion set.
- Pass explicit, validated export budgets to shared writers. Qualify the requested
  4000-part tier with distinct engraved solids, accepted/candidate overlap, native
  writer allocations and bounded 3MF XML/ZIP serialization. Preserve per-version
  limits and STEP-worker retirement. Do not confuse WASM capacity with complete
  worker memory or advertise a tier from part-count validation alone.
- App continues to compose the existing bottom drawer and preview slots. Tool-owned
  3D/numbered-plan controls and accessible part lookup add no route, side inspector,
  storage service, second kernel pool or generic plugin abstraction.

The original retention/export approach failed the early capacity gate. The
[capacity revision](plans/wall-art-layouts.md#capacity-revision--approved)
proposes immutable compressed native snapshots, one bounded CAD batch at a time,
and disk-backed streamed exports. **The user approved that revision on 2026-11-02.** It changes
v2 accepted-model ownership and adds temporary export storage; neither behavior is
implemented. The installed kernel and current v1 worker protocol remain in use.

Experimental fresh-worker archive and small native STEP-fragment tests now pass.
Earlier bounded Node probes failed the throughput target. The controlled browser
comparison meets the single-run 512 checkpoint. The first two-worker 4000-part probe
timed out; the later three-worker probe completed within 120 seconds under separately
approved experimental memory limits. See the plan's evidence. These helpers live only in
scripts/test support. No snapshot
retention, temporary browser storage or fragment writer is connected to the editor.

The user approved a controlled CPU/parallelism investigation. Test-only two/three-worker
probe uses independent native instances, shared compiled code and fixed aggregate
memory reservations. This is not a production worker-pool decision: the approved
retention route still requires browser memory/overlap and throughput qualification.
The three-worker experiment allows 768 MiB estimated / 1 GiB sampled aggregate
process memory. Its 4000-part run approached that measured cap, so production
limits are not increased by this result.
The subsequent retained-design probe exceeded the 1 GiB cap while generating a
replacement with 4000 previous parts and independent CPU preview buffers retained.
This lower-bound fixture has no renderer/GPU allocations. A fixed three-worker
production policy remains blocked; see the plan's retention-gate evidence.
An approved follow-up used three workers initially and two for replacement. Both
4000-part jobs completed while retaining the previous design, but the replacement
took 113.5 s and reached about 996 MiB sampled aggregate memory. This single
synthetic result does not establish repeatability or room for renderer/export
allocations; the application worker policy remains unchanged.
The final four-worker retention experiment exceeded its separately approved
1.2 GB sampled cap during replacement. Worker-count investigation is closed;
the three-then-two policy remains the candidate for the existing integration
gates. No four-worker production pool is enabled.

The user subsequently approved a **2 GB (2,000,000,000-byte)** v2 memory cap. The
real 512-part job passed once at 19.4 s / 1.20 GB after batch-owned glyph reuse.
After native relief and clearance optimization, the maximum-dimension triangular
fixture completed once in 92.2 s / 1.13 GB. See the
[current qualification checkpoint](plans/wall-art-layouts.md#native-timing-optimization--initial-large-job-passes).
The later large request timed out before rendering at 1920 completed parts.
The user subsequently accepted this timing limitation and approved continuation
with measured-capacity reporting. The 4000-part count is a hard ceiling, not a
throughput promise. Timeout must preserve the accepted design and its export source.
Headless geometry keeps full native face topology through inset/loft, converts
surface UV contours into assembly XY, and validates meshes from the final engraved
solid. Mesh refinement has four bounded attempts below the maximum chord tolerance
to satisfy native/mesh volume agreement on nonplanar ruled sides. Convex polygon
half-planes reject impossible glyph placements before native cutter work and can
certify containment with a two-CAD-tolerance clearance margin. Other placements
require native containment and boundary distance. Straight-edge
bases use one three-section ruled loft. Their base/top convex envelopes can prove
solid separation; curved or unproven pairs require native distance checks. Small
all-family checks and one large initial run do not establish accepted/candidate/UI overlap.
The user-approved measured-capacity continuation permits editor integration after
the remaining geometry/export correctness and fixture-review checks.

The implementation must reconcile the owning specs and validate the proposed
curved, nonconvex and large-tier fixtures before this section becomes an accepted
implementation description. No dependency or kernel upgrade is planned.

## Responsiveness and printability

Bound file size, CAD operation/part count, triangle count, and parameter
combinations before generation. Run the WASM kernel off the UI thread, lazy-load
its assets, and measure initial download/initialization and peak memory. Use
transferable mesh arrays and request IDs to reject stale results. Keep only the
latest queued request; a synchronous kernel call may require terminating and
reinitializing the worker to enforce a timeout. A worker does not remove budgets.

Use CAD solid construction for the first blade pattern with explicit thickness
and clearance. Check kernel operation results and solid validity, then validate
the derived meshes independently. Three.js is the renderer, not the CAD kernel.
Do not build a custom general-purpose kernel or depend on runtime Blender.

Before the first slice is complete, add application typechecking/build and
determinism, validation, mesh, and export-round-trip tests to `npm run check`.
Add a browser smoke flow for keyboard parameter editing, invalid import recovery,
and actual STEP/STL/3MF downloads. CI should install the required browser explicitly.
Re-import STEP in a CAD reader to verify solids, dimensions, and curved surfaces;
check STL and 3MF dimensions, components, and transforms in a mesh reader/slicer.
Physical printing is separate from these checks.

## Export verification during implementation

Prior project experience establishes browser CAD/export feasibility; a separate
prototype is not required. During generator implementation, test a small curved
solid and a two-part example using the pinned Replicad/OpenCascade WASM build.
Check browser initialization, preview tessellation, and all three exports.
Round-trip and independently
inspect them: STEP must retain curved CAD faces rather than a shell of triangle
faces; STL/3MF must meet the stated approximation tolerance and preserve size.
Check multi-part placement and 3MF package validity in a target slicer. Record
download size, initialization time, memory, and any required hosting headers.
These are implementation acceptance checks, not completed evidence or optional formats.

OpenSCAD can run headlessly in a browser through its WASM port and produce STL
and other mesh formats, including 3MF where built in. Its documented native
export path does not support STEP. It is therefore not the chosen primary kernel
for this application's three-format requirement. Supporting user-provided SCAD
scripts would be a separate feature, not a prerequisite for parametric controls.

Review licenses of the pinned WASM distribution and its dependencies before
shipping. Replicad is MIT; OCCT uses LGPL 2.1 with an additional exception, so
notices/source and applicable redistribution requirements still matter. OpenSCAD
is GPL; integrating/distributing its browser engine needs separate compatibility
review with this project's restrictive license. Our LICENSE does not replace
third-party licenses. Server-side isolation is an alternative if browser
performance or integration licensing makes the chosen approach unsuitable.

## Hosting and later features

`vite build` produces `dist/`. Serve it via an ordinary static web server such as
Caddy or Nginx, with HTTPS and route fallback if client-side routes are introduced.
`vite preview` is for local testing, not production hosting. Select the server,
domain, and deployment mechanism when deployment is requested.

An ad-supported public site does not inherently require a backend. Keep ads out
of the editing controls, prevent layout shifts, and decide consent/privacy needs
when an ad provider is chosen. If search traffic matters at launch, serve useful
indexable landing/tool-description pages; a 3D canvas is not a content strategy.
Evaluate prerendering for those pages without moving geometry onto a server.

Accounts, paid entitlements, shared designs, or server rendering may later justify
an API and database. Keep payment secrets and entitlement enforcement server-side.
Choose that backend around an actual feature instead of adding Next.js, a database,
authentication, containers, and deployment infrastructure before they are needed.

## References checked

- Vite static deployment: https://vite.dev/guide/static-deploy.html
- Fiber installation: https://r3f.docs.pmnd.rs/getting-started/installation
- Fiber performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- Three STL exporter: https://threejs.org/docs/#STLExporter
- Replicad: https://github.com/sgenoud/replicad
- OpenSCAD WASM: https://github.com/openscad/openscad-wasm
- OpenSCAD STEP proposal: https://github.com/openscad/openscad/wiki/Project:-Add-support-for-exporting-models-in-STEP-format
- OCCT licensing: https://dev.opencascade.org/resources/licensing
