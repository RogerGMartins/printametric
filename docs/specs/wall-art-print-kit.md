# Wall art 08 — print preparation and portable kit

Status: **DRAFT for user review; not approved implementation.**
Depends on [07](wall-art-frame.md) for frame-inclusive kits; decorative-only kits
do not need an enabled frame. Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-KIT`. Kit manifest version1; printer profile version1.

## Problem and flow

Set printer dimensions from Design, inspect fit/counts, open Print layout, review
colour-grouped plates, choose model format and documents, explicitly Prepare kit,
then download a complete ZIP. Assembly links every numbered part to its plate and
map. Visiting a view must not serialize files. A maker must never receive a
“print-ready” kit that contains a required part outside the usable printer volume.

Confirmed: required portable formats, stable IDs and configurable bed. Proposed:
packing rules, document/ZIP behavior and limits below. Full suite coverage includes
these features even though they are not part of the first slice. Excluded: G-code,
automatic hardware printing, optimal nesting and automatic decorative-part splitting.
Vendor-specific projects and direct slicer handoff belong to phase10.

## Printer parameters

| Parameter | Type | Default | Range / step / unit | Meaning |
| --- | --- | --- | --- | --- |
| profile | enum | custom | custom, generic180, generic256, generic340x320, generic350x320 | Convenience dimensions, not verified manufacturer profiles |
| bedWidth, bedDepth | number each | 256 | 80–1000 /1 /mm | Nominal rectangular XY bed |
| buildHeight | number | 256 | 20–1000 /1 /mm | Maximum printed Z |
| margin | number | 5 | 0–50 /0.5 /mm | Shared edge reservation |
| perEdgeMargins | boolean | false | true/false | Enables four stored values |
| left/right/front/back | number each | 5 | 0–50 /0.5 /mm | Independent margins, retained when inactive |
| partClearance | number | 2 | 0.5–20 /0.5 /mm | Full projected separation, not generated brim |
| rotations | enum | quarter-turns | fixed, quarter-turns | Z rotations {0} or {0,90,180,270}; no tilt |
| keepouts | polygon array | empty | 0–32 rings;3–128 vertices each;2048 total | Prohibited zones through all Z |

Generic actions set XY to180×180,256×256,340×320 or350×320 mm. They preserve height,
margins and keepouts, and require “Confirm actual printer limits” before first kit
preparation. Invalid retained keepouts reject a size change atomically, not silently
clip. Numeric XY edits select Custom. No preset implies a manufacturer's usable bed.

Bed origin is front-left `(0,0,0)`, +X right,+Y back,+Z up. Usable width/depth subtract
the appropriate margins and must be positive. Keepout rings are finite, simple,
counterclockwise polygons inside the nominal bed. Holes, self-intersections and
overlapping rings reject in profilev1. Apply C4 safety allowance at fit boundaries.
Margins reserve space; they do not model a gantry or generate extrusion geometry.

## Arrangement contract

Use the whole accepted solid, including leaning tops, bosses and connectors.
Default print orientation puts the decorative flat base on Z=0. Frame tiles put
their wall side on Z=0. Alternative orientations require an explicit qualified
contract; no guessed auto-tilt, mirror or scale.

Compute full-solid XY projected bounds and Z range for each allowed rotation.
Reject negative Z or height above buildHeight. Pack conservative enclosing footprints,
then verify transformed canonical projections. Base contours alone are insufficient.
Maintain partClearance between full projections and avoid margins and keepouts.

Proposed deterministic order: separate colour IDs, frame separate; sort descending
projected bounding-box area, longest side, then partId. Use first fitting plate;
candidate order Y ascending, X ascending, then rotation order. Candidates derive
from usable origin, placed edges plus clearance and keepout bounding edges. Freeze
test vectors with packer version1. Budgets:20,000 candidates/part,200 plates and
2,000,000 total candidate checks. Complexity overflow rejects the arrangement, not
individual parts. This is conservative deterministic packing, not optimal nesting.

Every required part occurs once. Frame tiles already reflect the usable-bed contract.
A decorative part that fits no allowed rotation is oversized: show its ID, actual
XYZ bounds and failed constraint. Offer changed bed/design/settings, never automatic
scaling, splitting or omission. Any failed required part or unqualified required
frame blocks print-ready kit. A valid assembled CAD export remains separately
available and labelled not print-ready.

Arrangement identity includes geometry/material revision, frame version, profile
digest/version and packer version. Colour/frame/bed/clearance edits mark it stale.
Show previous plate count as previous, not current. Cancel/out-of-order jobs follow
C3. Manual plate dragging is excluded from version1, not confused with Plan handles.

## Output parameters and budgets

| Parameter | Type / default | Range / step / policy |
| --- | --- | --- |
| modelFormat | enum / STL | STEP, STL, standard3MF; one per prepare action |
| includeModels | boolean / true | At least models or documents selected |
| includeDocuments | boolean / true | Overview, maps and checklist in one PDF |
| paper | enum / A4 | A4=210×297 mm; Letter=215.9×279.4 mm |
| paperOrientation | enum / portrait | portrait/landscape |
| paperMargin | number /10 mm | 5–25 /1 mm; separate from printer margin |
| mapOverlap | number /10 mm | 5–20 /1 mm |
| documentLocale | enum / en | en; reviewed additional languages in phase11 |
| includeEditableProject | boolean / true | False explicitly marks omitted project in manifest |
| includeFrame | boolean / true when enabled | Explicit selection, never viewport visibility |
| Archive limits | fixed | 256 MiB ZIP,512 MiB expanded,10,000 entries,200 plates,256 PDF pages |

Manifest is mandatory. Documents that list plate positions require a current valid
arrangement, even with models deselected. Project files include normalized assets.
Do not serialize any unselected model format.

Output selections define the required part set for this job. Omitting an enabled
frame is explicit: exclude frame plates/files/map pages, record the omission in the
manifest and label the result decorative-only, not a complete mounting kit. An
omitted frame's physical qualification does not block a decorative-only job. Preserve
the editable source design, including its frame, when the project file is selected.
Omitting that file records a non-editable-kit notice without discarding the design.
With neither models nor documents selected, reject Prepare even if the editable
project toggle is on; the separate project export remains available.

Prepare captures accepted model/geometry/material revision, frame/profile/packer
versions, arrangement, locale and document options. One immutable snapshot owns
the job. Later edits never retarget it; pin geometry until completion/cancel. Cache
keys include the whole snapshot. A completed earlier kit can be downloaded with
its source revision clearly shown, not presented as current. Duplicate submission
is disabled while active.

Use safe portable filenames and paths. Suggested roles:

```text
manifest.json
project.json                        if selected
models/colour-1/plate-001.<format>  one file per colour plate
models/frame/plate-001.<format>     separate frame plates
documents/assembly.pdf             if selected
```

STEP retains native named solids in print placement. STL uses the shared meshes,
print transforms baked once, numeric millimeters and no colour claim. Standard3MF
uses separate part objects and explicit millimeter units/transforms in one file
per physical plate. Material metadata needs reader compatibility checks. Several
physical plates in one generic build are not a portable multi-plate project.

Manifest contains version, snapshot digest, generator/packer/profile versions, units,
part ID/number/role/colour/quantity, assembly and print transforms, plate ID, bounds,
volume, file path/byte count/content digest, engraving or map-only status, exclusions,
support/shortening warnings, frame qualification and estimate assumptions. Each
reference resolves; each selected required part occurs exactly once. Digests detect
corruption, not authenticity. No local paths, credentials or account IDs.

## Assembly documents

Include overview, labelled colour quantities, frame section map when selected,
tiled full-scale placement map, orientation/seam guide, plate checklist and warnings.
On-screen Assembly consumes the same map data, not a screenshot of3D. Part selection
links map and plate; a keyboard-accessible ID list provides equivalent lookup.

PDF uses explicit72/25.4 points per mm. Tile inside paperMargin using mapOverlap,
sheet row/column IDs, registration marks, +Y arrow and a100 mm scale-check line.
Require positive printable extent and positive page advance after overlap. Use
actual artwork/frame bounds, including whole-cell overflow. Print “Print at100%;
disable fit to page” on every full-scale page. Above256 pages, fail before PDF
creation and offer the existing **Download print sheet PDF** action as an explicit
fallback, never silent scaling. It contains overview and plate checklist, requires
a valid arrangement, and serializes no full-scale tiled map. Apply the same page
limit to this smaller document; if it also exceeds the limit, report that failure
instead of claiming the fallback succeeded.

Numbers match engraving/manifest. Small unengraved parts get map-only IDs with
contour/orientation lookup. Legends use ≥8 pt text; move crowded labels to keyed
callouts instead of shrinking indefinitely. IDs/labels remain readable in monochrome.
Selectable text and logical reading order are required. Accessible PDF tagging is
a writer-selection gate, not an assumed capability; provide a complete accessible
HTML map/checklist and disclose any verified PDF limitation before download.

Weight uses phase05's solid-volume estimate, decorative/frame separate, with density
and excluded infill/support/waste assumptions in PDF and manifest. It is not sliced
consumption. All quantities/dimensions refer to the same captured revision.

## States and resource policy

In addition to ZIP, provide explicit **Download print sheet PDF** (overview and
plate checklist) and **Download tiled map PDF** (full-scale placement pages).
Each action captures the same complete revision/locale/paper contract, serializes
only the requested document, and has its own failure/retry/download state. Neither
requires compiling an unrequested model format or creating a ZIP first.

**Change printer** returns focus to printer settings and preserves the model while
invalidating arrangement. **Stop preparation** cancels fit/model/document preparation.
**Stop ZIP** cancels the archive stage. Both use the same explicit cancellation
contract but are distinct visible actions in the applicable stage; the wrong stage's
action is unavailable with a clear status. Completed individual documents can remain
available for their captured revision, but a stopped ZIP is never offered as complete.

Show stale/unavailable arrangement, checking fit, ready to prepare, preparing stages
(validation/packing/models/documents/archive), cancelled, failed and ready to download.
Show stage/counts, not fabricated percentages. Cancel releases staged bytes, URLs
and pins. Failed archive creation never exposes a partial ZIP as complete. Retry
uses the same snapshot unless the user explicitly selects current design.

Qualification proposal on C4 environment:100 parts/10 plates/20 PDF pages warm
p95≤30 s; largest admitted kit≤180 s, combined worker/packaging peak≤768 MiB.
Timeout180 s; cancel acknowledgment≤200 ms. Measure5 cold/20 warm runs including
serialization. Rationale: bound local waiting and memory on a16 GiB desktop.
These are unmeasured targets. Failure means reduce advertised limits or revise the
approved budget, not coarsen meshes or silently omit outputs.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-KIT-AC-1 | Bed/margins/keepouts validate real usable space | Profiles: asymmetric/zero usable area, polygon edges, malformed/33 keepouts |
| WA-KIT-AC-2 | Full leaning geometry fits XYZ with correct clearance/grouping/order | Pack fixtures for rotations, overhang beyond base and build-height boundaries |
| WA-KIT-AC-3 | Oversized/blocked/over-budget IDs block complete kit | Small bed, keepout conflict,200/201 plates, candidate overflow; retain previous state |
| WA-KIT-AC-4 | Three formats preserve plate transforms, native solids and mm scale | Independent CAD/mesh/slicer import,100 mm reference, frame/asymmetric parts |
| WA-KIT-AC-5 | Archive and manifest have one-to-one selected parts, explicit omissions, safe paths and valid digests | Archive/schema tests,malicious title,missing/duplicate parts and corruption; all16 model/document/project/frame inclusion combinations with an enabled frame, rejecting the four neither-model-nor-document cases; assert exact file roles,omission labels and serializer calls |
| WA-KIT-AC-6 | Maps/engraving/PDF agree and full-scale pages measure correctly; page overflow offers the specified bounded fallback | PDF dimensions/page structure;100 mm measure,seam fixture,monochrome/manual print review; tiled-map overflow→explicit print-sheet action→bounded download with no map serializer, plus a still-over-limit print-sheet failure |
| WA-KIT-AC-7 | Only explicit preparation serializes; edits/cancel/failure cannot retarget or publish partial files | Export spies, edit during prepare, PDF/ZIP failures and cancellation journeys |
| WA-KIT-AC-8 | Colour/frame/profile/locale invalidate exact caches and counts | Snapshot mutation and cache-hit/miss matrix |
| WA-KIT-AC-9 | Preparation/download/lookup work by keyboard at320 px and real200% zoom | Full Gridline Design/Print layout/Assembly browser journey |
| WA-KIT-AC-10 | Largest admitted workload obeys budgets or reports a limit | Environment-recorded timing/memory and entry/byte/page boundaries |
| WA-KIT-AC-11 | Separate print-sheet/tiled-map downloads, Change printer, Stop preparation and Stop ZIP obey their stage and snapshot contracts | Five distinct keyboard actions; no-unrequested-serializer spies, stage-specific cancel/failure/retry and stale-document cases |

## Documentation impact and decisions

### Stories and required implementation tests

QA owns `tests/wall-art-print-kit.test.mjs` and
`tests/browser/wall-art-print-kit.spec.ts`. Automated archive, PDF structure and
independent CAD/mesh import assertions must run through `npm run check`.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-KIT-ST-1 — Prepare every required part for the bed | WA-KIT-AC-1/2/3/8/10 | Node: N custom/generic/asymmetric beds and all colour groups; B margins/height/rotations/keepouts/200 plates/candidate budgets; I oversized/full-volume collision blocks kit with IDs; E cancelled/failed arrangement retains previous revision and marks counts stale. Environment qualification is recorded separately from CI timing. |
| WA-KIT-ST-2 — Download matching models and maps | WA-KIT-AC-4/5/6 | Node/browser: N each format,ZIP manifest,project and both PDF roles; all16 inclusion combinations assert exact files/omissions/serializer calls, including models-only,documents-only,omitted project/frame; B A4/Letter,portrait/landscape,paper margins/overlap,256 pages and bytes; I neither models nor documents,missing/duplicate parts/unsafe paths/page overflow reject; E overflow→explicit bounded print-sheet fallback never calls map serializer; writer/archive or oversized fallback publishes no complete kit. Independent readers automated; actual slicer,100% print-dialog,monochrome/PDF accessibility checks manual. |
| WA-KIT-ST-3 — Control all preparation actions | WA-KIT-AC-7/9/11 | Browser: N Prepare/download ZIP,separate print-sheet/tiled-map PDF,Change printer,part lookup; B stage boundaries and320 px/real zoom; I stale/invalid arrangement cannot prepare; E Stop preparation/Stop ZIP/retry/edit-during-job release resources and keep snapshot labels. Assert no unrequested serializer. AT/touch evidence additional. |

Product/roadmap/website definition: approve complete kit/document scope and correct
spec links. Architecture: packer, snapshots, manifest, transforms and PDF support;
no vendor dependency in portable export. README: printer confirmation, ZIP contents,
fit,100% paper printing and estimates. Development: independent reader/slicer setup,
archive/PDF/packing fixtures and resource checks. Root LICENSE unchanged; writer
dependency notices reviewed separately. Open: actual writer/accessibility support,
packing vectors, budget qualification and frame physical profile. No server needed.

## Implementation steps and handoff

Freeze profiles/manifest, verify headless fit/packing, then plate exports, maps/PDF/ZIP
and UI. Geometry owns AC-1–5/8/10, frontend AC-7/9, QA all criteria with independent
inspection for AC-4/6. Exit requires real downloadable kits for each format selection,
not a mocked preparation flow or screenshot-only fit evidence.
