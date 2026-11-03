# Wall art 01 — canonical generator and first exports

Status: **Implemented and locally verified — 2026-11-02.** See the
[implementation checkpoint](../plans/wall-art-core.md#implementation-checkpoint--2026-11-02)
for acceptance evidence and remaining manual/platform limits.
Authority: [suite C1–C4](wall-art.md). Acceptance prefix: `WA-CORE`.

The approved [phase-02 compatibility contract](wall-art-layouts.md#approved-decisions--2026-11-02)
keeps generator 1 and its file bytes reproducible. Opening an old file does not
upgrade it; an explicit, previewed upgrade creates an unsaved generator-2 design
without adding engraving or changing the numeric geometry parameters.

## Problem, flow and scope

A maker needs one useful repeatable model before a large editor catalogue. This
slice opens a valid rectangular array of upright tapered blades, permits precise
size/height edits, and downloads native STEP, binary STL or standard 3MF. It also
exports/imports a small editable JSON file. No library or account is needed.

Flow: open Design → generate default → inspect dimensions/part count → edit a
number → wait for accepted preview → choose format → Export → inspect file in a
reader. Failed input leaves the prior design intact. Print layout and Assembly
retain honest unavailable content until their owning phases arrive.

Confirmed: architectural pipeline, required formats, numerical contracts, UI details
and the simple initial pattern chosen below. Included: headless validation/generation, curved verification
coupon, two-part fixture, worker cancellation and minimal accessible integration.
Excluded: alternate layouts/outlines, surface families, movement, colour bands,
frame, packing, kit files, autosave/library, room scene and physical load claims.

### Initial example decision — 2026-11-02

The user chose a simple starting example rather than bringing surface-pattern work
forward. Phase 01 starts with the rectangular array of equal-height upright tapered
blades described here. It is editable through the same parameters that generate
the preview and exports. It is a fixed starting design, not a randomized New action
or a separate preview-only model. More examples and richer patterns can follow in
their owning phases; the phase 05 preset catalogue is not a phase 01 dependency.

The user approved the [technical plan](../plans/wall-art-core.md) on 2026-11-02,
including defaults, ranges, minima, budgets, qualification profile and dependency/
reader choices. Compatibility, provenance and measured qualification remain
implementation verification gates. Build owns the plan's code and test paths.

Generator 1 makes no random draws. Seeds 1, 5000 and 9999 produce the same geometry
and stable IDs; saved definitions and parameter digests retain the seed. Stable
IDs are `wa-g1-r<row>-c<column>` (zero-based, +Y to −Y then −X to +X);
`mapNumber` is one-based row-major order.

## Model schema 1 / generator 1

These are the complete editable geometry parameters for this slice. Other values
are fixed generator constants, not hidden advanced fields. UI steps do not restrict
manual precision, per C3.

| Parameter | Type | Default | Range / step / unit | Meaning |
| --- | --- | --- | --- | --- |
| width, height | number each | 500 | 80–500 / 10 / mm | Nominal panel extent |
| pitch | number | 50 | 50–200 / 1 / mm | Target cell spacing |
| gap | number | 2.5 | 2.5–6 / 0.1 / mm | Nominal free separation at base |
| baseThickness | number | 10 | 10–40 / 0.2 / mm | Per-piece plinth thickness |
| reliefHeight | number | 20 | 0–120 / 1 / mm | Height above the plinth |
| topRatio | number | 0.12 | 0.1–1 / 0.01 / ratio | Top width / base width in local X |
| seed | integer | 1 | 1–9999 / 1 / none | Explicit reproducibility field; no visual effect in this regular first pattern |

Fixed values: rectangle, regular square-derived cells, no movement, flat top,
straight sides, plinth enabled, one neutral material, no engraving. The seed's
no-effect notice is visible; a reserved seed must not imply randomness exists.

### Approved construction

Set column count `max(1, round(width/pitch))`, row count similarly; `.5` rounds up.
Cells divide the exact panel rectangle evenly. Thus pitch is characteristic, not
a guarantee of exact edge length. Each base rectangle is the cell inset by gap/2
on all four sides. The nominal panel includes the outside half-gap; the actual
solid bounds are reported separately. For each cell, extrude a plinth and fuse an
upright relief whose top is centered and scaled in X by topRatio, unchanged in Y.
This produces a blade/frustum with a flat top, not an infinitely sharp knife edge.

If reliefHeight=0, produce the plinth alone and report that topRatio has no effect.
Require base/top width ≥1.2 mm, base length ≥1.2 mm, positive volume, and C4 minimum
clearance. Do not clamp topRatio upward secretly. Reject a failed joint constraint
with cell IDs. Count rows×columns before construction; above 128 is invalid. The
declared dimension/pitch ranges reach at most100 parts. Test the128-part defensive
guard with an isolated estimator fixture and early rejection with a lowered
test-only cap; do not invent an unreachable129-part user parameter combination.

Local bases at Z=0; plinth top at baseThickness; top at their sum. Assembly IDs
use row/column keys. A two-part fixture checks nonzero assembly transforms. A small
separate curved verification fixture, not a new user pattern, uses a cylinder with
an analytic curved face to prove native curved STEP preservation.

## Saved file and output contracts

Editable JSON envelope 1 has exactly `format: "printametric-wall-art"`,
`formatVersion: 1`, `modelSchemaVersion: 1`, `generatorVersion: 1`, `seed` and
`parameters`. Parameters contains the seven non-seed fields in the table above.
It excludes meshes, camera, timestamps required for geometry, and kernel handles.
Maximum 1 MiB before decoding; strict UTF-8 JSON object; maximum nesting 16.
Unknown fields/versions, truncated JSON, arrays in place of objects, and unsupported
optional features are errors. No migration is implied in this slice. File loading
stages validation and generation before atomically changing the accepted design.

Canonical output follows C1. Each piece is one positive-volume solid, not a shared
backing joining all pieces. Preview uses the accepted solid's C4 tessellation.
Export default format is STL; allowed enum STEP/STL/3MF, unit mm, selection all
parts in assembly coordinates. The UI explicitly says this is an assembled model,
not an arranged print plate. Later phase 08 adds print-ready positioning.

- STEP contains named solids/part identifiers and millimeter units. A tessellated
  shell wrapped as STEP is not accepted.
- Binary STL contains the validated tessellation with assembly transforms baked
  exactly once. Coordinates are mm; UI/file naming warns STL lacks unit metadata.
  Separate disconnected components are permitted, open surfaces are not.
- Standard 3MF contains millimeter units, separate part objects, build transforms,
  and stable ID metadata where supported. No vendor printer/project extension.
- Filenames use a safe fixed prefix, revision suffix, format extension, and `mm`
  for STL. Do not derive paths from unsanitized user text.

Export captures the accepted revision and selected format once. No exporter runs
on edit, navigation, preview fit, or JSON validation. Progress has preparing,
serializing, ready, cancelled and failed states. Failure retains source geometry;
retry is explicit. A new format requires another user action. Download bytes and
URLs are released after use; pinned CAD handles release after the job ends.

## Minimal Gridline integration

Add one tool group to the existing bottom panel, with labelled numeric inputs,
unit text and concise descriptions. Do not replace the full-width preview or add
a side inspector. Show actual nominal dimensions, actual bounds and part count;
plate count remains unavailable. Preserve theme, tips, grid and Help/About behavior.

On first load, show “Generating default design”, not fabricated geometry. With no
WebGL, retain fields, numeric summaries and headless export if generation succeeds;
state that visual preview is unavailable. Worker initialization failure disables
geometry exports, permits saving parameters with an explicit ungenerated label,
and offers Retry. Do not confuse that draft file with an accepted valid design.

Enter/blur commits a numeric candidate. Empty, partial minus signs and out-of-range
text stay local drafts. Pending edits disable model export; Revert restores valid
values. Error recovery opens the existing panel and focuses the offending field.
Export selector/action, file input and cancel work by keyboard at 320 px and genuine
200% zoom. Focus stays on the edited control when a generation completes.

## Acceptance and test plan

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-CORE-AC-1 | Default 500×500, pitch 50 produces 100 independently identified blades with 30 mm total depth | Headless counts, bounds and positive-volume assertions; browser first visit |
| WA-CORE-AC-2 | 80/500 dimensions, pitch 50/200, ratio 0.1/1 and height 0/120 obey defined construction | Boundary matrix, analytical dimensions, flat-plinth no-effect notice |
| WA-CORE-AC-3 | Invalid types, NaN/infinity at program boundary, strings, over-budget count and insufficient top width fail before CAD | Validator tests and kernel-call sentinel; previous result retained |
| WA-CORE-AC-4 | Preview/STL/3MF share triangles and transforms; STEP has native solids including a curved face | Independent reimport of one-part, two-part and curved fixtures; compare C4 bounds/tolerances |
| WA-CORE-AC-5 | All three files import at mm scale; no preview helpers enter files | CAD reader plus slicer inspection; 100 mm calibration dimension and part counts |
| WA-CORE-AC-6 | Edits create no model bytes; each explicit export uses its captured revision and only selected serializer | Export-call spies, edit-during-export browser journey and downloaded metadata |
| WA-CORE-AC-7 | Cancel/out-of-order completion/worker failure retain the prior accepted design and release resources | Controlled worker fixtures; repeated generation/disposal counters |
| WA-CORE-AC-8 | JSON round trip reproduces geometry; malformed/1 MiB+1/newer-version file changes neither design nor previous bytes | File import boundary tests and actual browser file upload/download |
| WA-CORE-AC-9 | Numeric editing, import, format choice, cancel and recovery are keyboard accessible in Gridline | Browser journey at desktop/320 px, both themes and actual 200% zoom; screenshot review |
| WA-CORE-AC-10 | C4 first-slice tier passes measured default/worst supported cases or fails visibly at the guard | Cold/warm timing and memory evidence on C4 environment; timeout and no-WebGL tests |

## Documentation impact and unresolved decisions

### Stories and required implementation tests

All rows use the suite's mandatory story completion contract. The approved plan
assigns implementation of the Node and browser tests to build.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-CORE-ST-1 — Generate a valid blade panel | WA-CORE-AC-1/2/3/10 | Node: N default100 solids/30 mm depth; B min/max dimensions,ratio,height0 and isolated128-part estimator guard; I nonfinite input or test-only reduced budget never calls CAD,synthetic too-thin construction rejects; E timeout/cancel retains accepted digest. Browser: default/pending/status. Performance evidence uses C4 environment, not ordinary CI timing alone. |
| WA-CORE-ST-2 — Download reproducible files | WA-CORE-AC-4/5/6/8 | Node: N independent three-format reimport and JSON round trip; B curved/two-part transforms and1 MiB source; I unsupported/truncated/oversized JSON leaves state; E serializer failure/edit-during-export preserves captured revision. Browser: actual downloads and no export calls on edits. Manual target slicer inspection remains additional. |
| WA-CORE-ST-3 — Edit and recover accessibly | WA-CORE-AC-7/9 | Browser: N keyboard edit/import/export; B320 px/real200% zoom and empty numeric draft; I rejected field opens/focuses recovery without state loss; E worker crash/no-WebGL/out-of-order result retains valid design and disposes resources. AT/physical touch and visual review are manual evidence. |

`docs/architecture.md`: record actual canonical/worker/version and selected format
reader contracts without changing approved stack. `docs/product.md` and
`docs/mvp-roadmap.md`: approve this limited first pattern and mark only verified
capabilities complete. `README.md`: add first design/file workflow and assembled
export warning. `docs/development.md`: actual worker setup, round-trip and failure
debugging. Foundation spec: availability expectations change only for Design.
No LICENSE change. Generator 1 has no PRNG. Budgets and reader choices are approved;
kernel provenance and reader/qualification evidence are recorded in the checkpoint.

## Implementation steps and handoff

First approve schema and geometric fixtures. Then establish headless validation,
canonical solids, shared mesh and three round trips. Connect the minimal editor
and repeat real downloads. This describes exits, not file-level task scheduling.
Geometry owns C1–C4 and AC-1–8/10. Frontend owns accepted-state integration and
AC-6–9. QA verifies the entire table with independent readers and retained evidence.
Exit requires all ten criteria, the shared check, and honest unresolved platform
gaps; expansion cannot substitute for missing native STEP or invalid-import checks.
