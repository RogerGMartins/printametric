# Wall art 02 — outlines, cell layouts and identification

Status: **Implemented and locally verified on 2026-11-03. The user approved the visual fixtures and accepted measured capacity under the 120-second / 2 GB limits. See the plan's integrated checkpoint for acceptance evidence and remaining physical/assistive verification limits.**
Depends on [01](wall-art-core.md). Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-LAYOUT`. Model schema/generator pair: `2/2`.

## Approved decisions — 2026-11-02

The user approved the [technical plan](../plans/wall-art-layouts.md) after choosing
all four outlines and five layouts, the 4000-part qualification target, retained
X-only taper, physical numbering with an orientation mark, and exact v1 reproduction
with explicit upgrade. This approval does not establish measured capacity.

- Keep exact model/generator pairs 1/1 and 2/2 and the existing six-key format-1
  envelope, 1 MiB UTF-8 file limit and depth 16. Mixed or unknown pairs fail.
- New v2 designs use engraving depth 1 mm and an enabled orientation mark. Explicit
  v1 upgrade copies numeric fields/seed with rectangle/square/straight boundary,
  engraving depth 0, numeral ratio 0.34 and mark disabled. Generate and preview
  before confirmation; failure/cancel preserves v1 and the original file bytes.
- The mark is an original recessed 4×5 mm arrow with a 0.8 mm shaft, pointing to
  assembly +Y. It is not an edge notch. Use a 0.8 mm gap from the number block.
- The user approved the twenty-family contour sheet, original digits and underside
  orientation marks on 2026-11-03. The plan records the reproducible review fixture.
- Original seven-segment digits use a 6×10 unit cell, 1.6-unit bars and a 1-unit
  spacing. The 0.8 mm minimum stroke requires height ≥5 mm for this glyph set.
  Fit on a 0.05 mm decrement lattice; a failed combined fit leaves both cuts absent
  and reports map-only identification. Depth zero intentionally disables both cuts.
- The approved upper gate is 4000 retained parts, 100,000 contour units,
  2,000,000 total triangles (100,000 per part), 200,000 CAD operations,
   **2 GB (2,000,000,000 bytes)** estimated aggregate memory and measured peak,
   and 120 seconds. The user approved this memory revision after the real
   512-part probe failed the previous cap. Qualification samples the whole dedicated
   Chromium process group plus controller, not only a worker heap.
  The 512-part point is an internal checkpoint. The user subsequently accepted the
  measured timing limitation and approved continued implementation; see the
  [capacity continuation](../plans/wall-art-layouts.md#measured-capacity-continuation--approved).
  4000 is a hard ceiling, not a throughput guarantee. Timeout must retain the prior
  valid design; never accept a partially generated model or silently reduce its size.
- The user subsequently approved the
  [capacity revision](../plans/wall-art-layouts.md#capacity-revision--approved):
  private compressed native snapshots, one bounded CAD batch at a time, and up to
  2 GiB temporary disk-backed output during explicit large exports. Previous-valid
  native export sources must survive failure/cancel. This is a feasibility contract,
   not measured release support. The approved concurrency candidate is three
   initial workers and two during replacement; actual capacity is reported from
   completed measurements, with large-tier repeatability explicitly unqualified.

The plan owns lattice formulas, keyed random vectors, component tie-breaking and
the remaining native offset/nonconvex-span fixture gates. Build owns the listed
implementation and regression files for this phase; no delegation is requested.

## Problem and user flow

A maker needs a panel that fits a chosen space and a repeatable arrangement of
separate pieces. Choose dimensions or a convenience size, choose an outline/layout,
adjust pitch and gap, inspect actual counts and clipped edges, and export the same
canonical model. All earlier format and invalid-input gates remain mandatory.

Included: four built-in outlines, five cell families, exact clipping, deterministic
small-fragment handling, physical numbering and dimensions up to 2000 mm. Excluded:
imported SVG, movement, new surface families and frame geometry. Large dimension
support is approved scope requiring C4 qualification, not a verified capability.

## Parameters

Phase 01 fields remain unless replaced here. Units/steps follow C3.

| Parameter | Type | Default | Range / step / unit | Semantics |
| --- | --- | --- | --- | --- |
| width, height | number each | 500 | 80–2000 / 10 / mm | Independent bounding rectangle |
| outline | enum | rectangle | rectangle, ellipse, hexagon, arch | Built-in contour |
| layout | enum | square | irregular, hexagonal, square, triangular, radial | Partition before gaps |
| pitch | number | 50 | 50–200 / 1 / mm | Advanced characteristic pitch |
| gap | number | 2.5 | 2.5–6 / 0.1 / mm | Base contour separation |
| straightBoundary | boolean | true | true/false | Clip hexagonal/triangular outer cells when true |
| baseThickness | number | 10 | 10–40 / 0.2 / mm | Per-part plinth; retained from 01 |
| engravingDepth | number | 1 | 0–3 / 0.05 / mm | Recessed map number on base underside; 0 disables |
| numeralRatio | number | 0.34 | 0.1–0.6 / 0.01 / ratio | Requested glyph height / minimum base span |
| orientationMark | boolean | true | true/false | Recessed assembly +Y arrow; inactive and retained when engraving depth is 0 |
| seed | integer | 1 | 1–9999 / 1 / none | Irregular layout seed; other layouts unaffected |

Convenience actions set width/height to 300×300, 500×500, 800×600 or 1000×1000 mm.
They change no other field and form one undoable action once phase 06 is available.
They are not an independent size mode. All manual dimensions remain possible.

### Outline contract

Use the centered rectangle as the nominal boundary, not necessarily material bounds.
Rectangle uses its four corners. Ellipse is `x²/(w/2)²+y²/(h/2)²=1`. Hexagon vertices,
counterclockwise, are `(w/2,0),(w/4,h/2),(-w/4,h/2),(-w/2,0),(-w/4,-h/2),(w/4,-h/2)`.
The arch has a flat bottom at `-h/2`, vertical sides up to `y=0`, and an upper half
ellipse centered at `(0,0)` with radii `w/2,h/2`. These affine outlines fill their
bounding rectangles even when width and height differ. They are not constrained
to regular aspect ratios. Curves use native CAD curves, tessellated under C4.

### Original proposed layout contract

- **Square:** phase 01's exact equal partition. Rows and columns determine keys.
- **Hexagonal:** point-up regular hexagons with opposite-side distance pitch,
  centered lattice anchored at the panel origin. Axial integer coordinates identify
  cells. No seed offset or random lattice rotation.
- **Triangular:** equilateral triangles with edge pitch in a centered lattice;
  integer row/column plus up/down parity identify cells.
- **Irregular:** one seeded site per square lattice tile of edge pitch; each site's
  X/Y offset is within ±0.3 pitch from its tile center. Construct the nearest-site
  partition (Voronoi cells), including a one-pitch guard region beyond the outline.
  Equal-distance ties use site keys. Freeze random test vectors with generator 2.
- **Radial:** a central cell plus concentric rings. First radius pitch/2; each ring
  thickness pitch. Ring sector count is `max(3, round(2π*midRadius/pitch))` and starts
  at angle 0 on +X. Native circular arcs bound sectors. Key is ring index/sector;
  central key is separate. Guard rings cover the bounding rectangle before clipping.

Clip cells against the outline, then inset by gap/2 to make printable bases. For
hexagonal/triangular rectangle only, straightBoundary=false instead keeps complete
cells whose centroids lie inside the nominal rectangle. Their material can exceed
the nominal rectangle; show actual bounds and “Whole-cell edge exceeds nominal
size”. Other outlines always clip and show the toggle as inactive with explanation.
Retain its value. Never exceed the built-in outline when it is not a rectangle.
Square/irregular/radial ignore this toggle with an explicit no-effect explanation.

**Interaction distinction:** an interaction-observed radial layout retained a native
disk when outline selection changed; that does not verify outline clipping. The
Printametric contract deliberately proposes an improvement: radial cells are clipped
to all four selected outlines like other layouts. Verify this independently in the
full4-outline×5-layout matrix. Do not cite interaction evidence as implementation
proof of this proposed behavior.

### Fragments and numbering

Clipping can create disconnected regions. Give each component a deterministic
suffix sorted by centroid Y descending, X ascending, area descending. After inset,
remove only components with area <4 mm² or minimum material span <1.2 mm; classify
them as excluded fragments, not printed parts. The canonical result records their
parent cell IDs, reason, area and count. Preview/plan show their location and the
visible count. An explicit one-time acknowledgment per changed exclusion set is
required before exporting. No other silent fragment dropping or merging.

If all components disappear, fail the candidate. If a retained component cannot
support the shape/top-width contract, fail rather than quietly drop it. Count all
retained components against C4, not just source cells. Preserve deterministic holes
and island identities when phase 09 extends this rule.

Map numbers are C1's contiguous order. Engrave on the underside inside the footprint,
readable when the part is turned over about local X; map shows the upright assembly
number and a back-view note. Use original or redistribution-permitted outline glyphs,
not system-dependent font metrics. Requested numeral size must fit with 1.2 mm
edge clearance, ≥0.8 mm stroke width and ≥1.2 mm residual floor. Reduce glyph height
only to the glyph-specific minimum (5 mm for the approved bars, above the general
3 mm floor); otherwise leave the part unengraved, identify
it as “Map-only ID” and include a distinct contour/orientation lookup. Never omit
the part. The approved recessed arrow uses the same edge/floor limits. Exact glyph
and mark fixtures must pass review before editor integration.

## UI, states and errors

Dimensions and outline appear in the common portion of the bottom settings group.
Pitch, numbering and boundary policy are advanced controls in that same group,
not a replacement inspector. Numeric fields expose their effects on actual bounds,
part counts and fragment warnings. A 2D outline preview uses exactly the generated
contours, not a separately rounded approximation. Frame phases reuse these contours.

Errors distinguish parameter range, contour collapse, unsupported feature size,
budget limit, and CAD failure. Large but valid individual dimensions can fail the
part/memory budget; tell the user to increase pitch or reduce size. Retain the prior
accepted geometry and entered candidate under C3. No automatic reduction to a
smaller size. 2000 mm is not hidden behind a misleading successful preview.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-LAYOUT-AC-1 | Four outlines match the stated independent width/height bounds and orientation | Analytical tests at 80×2000, 2000×80, square defaults; native curved round trips |
| WA-LAYOUT-AC-2 | Every layout covers its eligible region before gaps and has repeatable cell keys | Fixture tests for five families, seeds 1/9999; no overlapping base interiors |
| WA-LAYOUT-AC-3 | Straight/whole-cell boundaries act only in their stated combinations and actual overflow is reported; radial obeys each selected outline under our proposed contract | Full4×5 outline/layout matrix, both toggle values, radial corner/arch clipping assertions; browser no-effect descriptions |
| WA-LAYOUT-AC-4 | Fragment exclusions use exact thresholds, retain diagnostics and cannot silently lose a part | 3.99/4/4.01 mm² and span boundary fixtures; disconnected clips; all-removed failure |
| WA-LAYOUT-AC-5 | IDs persist for pure height/colour edits; topology changes regenerate a matching contiguous number map | Parameter comparison tests and exported metadata/engraving inspection |
| WA-LAYOUT-AC-6 | Engraving matches map numbers, respects floor/strokes, and reports map-only IDs | Small-part, maximum depth/ratio and depth=0 fixtures; CAD/mesh and monochrome map checks |
| WA-LAYOUT-AC-7 | 80/2000 range and exact budget limits are validated before CAD; excess retains prior valid design | UI/import tests including 2000.01, part tier+1 and contour collapse |
| WA-LAYOUT-AC-8 | All formats preserve clipped native solids and actual assembly bounds within C4 | STEP/STL/3MF independent inspection of every family, including curved radial/ellipse edges |
| WA-LAYOUT-AC-9 | Size shortcuts, advanced controls and fragment recovery work by keyboard at narrow width | Desktop/320 px/real 200% zoom, both themes, focus and warning acknowledgment tests |

## Documentation impact and decisions

### Stories and required implementation tests

Build owns `tests/wall-art-layouts.test.mjs` and
`tests/browser/wall-art-layouts.spec.ts`; all linked criteria must pass in the
shared gate under the suite's completion contract.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-LAYOUT-ST-1 — Choose size/outline/layout | WA-LAYOUT-AC-1/2/3/7 | Node: N full4×5 matrix including radial clipping; B80×2000,2000×80,seed1/9999 and both boundary modes; I invalid enum/2000.01/part-limit+1 rejects before CAD; E clipping failure retains previous result. Browser: each size shortcut and every enum is independently selected and reported. |
| WA-LAYOUT-ST-2 — Identify every retained part | WA-LAYOUT-AC-4/5/6/8 | Node: N IDs/engraving/map and all-format round trips; B area3.99/4/4.01,span1.2,engraving0/3 and ratio0.1/0.6; I collapsed/inadequate-floor candidates reject without hidden omissions; E glyph/offset failure preserves prior model. Manual slicer/engraving readability supplements automated geometry. |
| WA-LAYOUT-ST-3 — Understand edge and numbering effects | WA-LAYOUT-AC-9 plus user-visible AC-3/4/6 | Browser: N keyboard all groups; B320 px/zoom and whole-cell overflow; I invalid advanced entry remains visible with panel closed; E failed generation/acknowledgment dismissal cannot enable stale export. Visual/AT/touch evidence remains separate. |

`docs/product.md`/`docs/mvp-roadmap.md`: approve expanded shapes/ranges and identify
qualified tiers. `docs/architecture.md`: record layout keys, exclusions and number
metadata; no new architecture layer required. `README.md`: document nominal versus
actual dimensions and map-only IDs. `docs/development.md`: layout/fragment/engraving
fixtures and qualification commands. No setup or LICENSE change beyond the already
reviewed geometry runtime. The approved original glyphs need fixture review rather
than a font license. Pending: remaining native geometry, integrated recovery and
fixture review; 4000-piece throughput is an accepted unqualified limitation. PRNG
vectors are frozen in the approved plan and executable tests. These gate this phase,
not 01.

## Implementation steps and handoff

Approve contour/layout fixtures and schema migration, verify headless partitions,
then engraved solids and three exports, then integrate controls. Frontend consumes
nominal/actual bounds and fragment diagnostics (AC-3/4/7/9). Geometry owns layout,
IDs and engraving (AC-1–8). QA cross-checks exact thresholds, every outline/layout,
and exported numbers. Exit requires accepted default and boundary fixtures within
the advertised tier; a large parameter range alone is not completion evidence.
