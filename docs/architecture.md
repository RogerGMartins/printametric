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
Use current Node 24 LTS for development and CI. The existing OpenCode SDK is
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

- `src/geometry/`: validation, CAD generators, worker lifecycle, tessellation, solid/mesh checks.
- `src/export/`: STEP/STL/3MF adapters and serialization checks.
- `src/editor/`: React forms and preview components; no printable algorithms.
- `tests/`: headless geometry tests and browser journeys.

These are boundaries, not a request to create empty folders or a plugin framework.
Follow the website-first [MVP roadmap](mvp-roadmap.md), including a simple tool
catalogue. The first generator is wall art.
React state is sufficient initially; a global state library needs a concrete use.

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
