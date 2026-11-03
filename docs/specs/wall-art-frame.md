# Wall art 07 — pocketed mounting frame

Status: **DRAFT for user review; mounting is a proposed scope expansion.**
Depends on [06](wall-art-projects.md), uses the bed contract in
[08](wall-art-print-kit.md). Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-FRAME`. Proposed model schema/generator: `6/5`.

## Problem, flow and scope

A maker needs a backing that locates the decorative pieces, fits a printer and
has a clear assembly map. Enable Frame, inspect its pocket clearances and actual
size, choose a validated attachment/hardware profile, inspect tiling against the
usable bed, and export the frame with the same part IDs as the artwork.

Included: native pocketed backing, minimum ribs/webs, optional lightweight openings,
extra border, corner treatment, explicit screw/boss dimensions, deterministic tiles,
frame map, separate weight and a fit coupon. Excluded: universal wall-load claims,
automatic hardware printing, an invented universal screw, automatic adhesive choice,
board/template attachment and untested snap fits. Numerical choices are proposals.

**Blocking before this phase's implementation approval:** choose decorative-part
retention, tile-to-tile restraint and wall attachment. The default proposal is a
clearance locating pocket, not a friction lock. It requires a reviewed retention
method. A dry pocket preview is not a finished mounting system. Resolve these
decisions in the technical plan; do not silently fill them with generic guarantees.

## Parameter contract

| Parameter | Type | Default | Range / step / unit | Semantics |
| --- | --- | --- | --- | --- |
| frameEnabled | boolean | false | true/false | Adds frame solids; does not change decorative layout |
| pocketClearance | number | 0.25 | 0.1–0.6 / 0.05 / mm per side | Offset outward from each decorative base |
| ribHeight | number | 3 | 1–8 / 0.5 / mm | Pocket-locating wall above the seat |
| plateThickness | number | 3.8 | 1.2–5 / 0.2 / mm | Backing thickness below the seat |
| extraBorderWidth | number | 0 | 0–30 / 0.5 / mm | Additional outward border beyond fixed structural rim |
| extraBorderHeight | number | 0 | 0–30 / 0.5 / mm | Additional frontward perimeter height |
| cornerRadius | number | 0 | 0–30 / 0.5 / mm | Round convex external polygon corners where feasible |
| lightweightPockets | boolean | true | true/false | Remove defined backing openings; never remove required webs |
| screwHoles | boolean | true | true/false | Requests holes from a complete approved hardware profile |
| hardwareProfileId | nullable string | null | Registered versioned ID, 1–64 ASCII characters | Null blocks screw-enabled acceptance, not decorative generation |
| retentionProfileId | nullable string | null | Registered versioned ID, 1–64 ASCII characters | Required for print-ready frame status |

Frame-disabled documents retain and validate fields but produce no frame. When
enabled with missing profiles, show “Frame setup incomplete” and keep the previous
accepted decorative design. A clearly labelled nonexportable dimension diagram can
explain the setup. Do not accept a printable frame with omitted requested holes.
Users can explicitly disable screw holes to inspect/export a mechanically unqualified
frame model, but a print-ready kit still requires a qualified retention contract.

### Structural and coordinate contract

Decorative bases remain at assembly Z=0. The frame seat is Z=0; the plate occupies
`[-plateThickness,0]`; pocket ribs extend from 0 to ribHeight. Perimeter top is
ribHeight+extraBorderHeight. Decorative and frame contact at the seat is intentional;
their interiors must not overlap. It is the documented exception to C4 free-part
clearance. Assembly export can include touching seating surfaces as separate solids,
not an accidental fused model.

Each pocket is the decorative base contour offset outward by pocketClearance.
Use the actual accepted base contour, including whole-cell edges and clipped shapes,
not a second layout calculation. Adjacent equal-height ribs have nominal thickness
`gap-2*pocketClearance`: 2.5−2×0.25=2.0 mm; at clearance0.6 it is1.3 mm.
Require ≥1.2 mm actual minimum, including curved corners and offset intersections.
Reject an invalid offset, merged pockets, thin ligament or erased pocket. Do not
silently lower clearance. Require ribHeight≤baseThickness−1.2 when a plinth is
enabled; no-plinth seating needs a separately qualified retention profile.

Proposed fixed structural rim is 10 mm outside the occupied layout boundary;
extraBorderWidth adds to it. This is not part of nominal artwork dimensions.
Rectangle/ellipse/hexagon/arch frames follow their accepted outline. Whole-cell edges
use the union boundary of retained cell regions. Round only external convex corners,
not pocket corners, with radius≤half each adjacent available edge and ≤half the
minimum overall frame dimension. A too-large requested radius rejects; no hidden
effective radius. Smooth elliptical boundaries ignore cornerRadius with a notice.
Report frame width/height including rim, border and any approved connector extent.

Lightweight openings are interior cutouts under pockets. Proposed remaining seat
ledge width is 2.0 mm, webs ≥2.0 mm, backing thickness ≥1.2 mm. No opening below a
screw boss, registration feature or specified adhesive pad. If an individual pocket
cannot support a valid opening, keep that pocket solid and report its ID/reason.
This is a declared canonical rule, visible in preview/manifest, not export repair.
If the complete frame cannot maintain continuous required load paths, reject.

### Explicit hardware profile proposal

No physical profile is approved by this draft. A custom profile must contain:

| Hardware field | Type / illustrative draft default | Allowed range / step / unit |
| --- | --- | --- |
| shankDiameter | number / 3.0 | 2–6 / 0.1 / mm |
| throughDiameter | number / 3.4 | 2.2–7 / 0.1 / mm; greater than shank |
| headDiameter | number / 6.4 | 4–12 / 0.1 / mm; greater than through diameter |
| headSeat | enum / countersink | countersink or counterbore |
| countersinkAngle | number / 90 | 60–120 / 1 / degrees; countersink only |
| headDepth | number / 1.5 | 0.5–5 / 0.1 / mm; actual measured axial head requirement |
| remainingSeatMaterial | number / 2.3 | 1.2–4 / 0.1 / mm |
| holeEdgeLigament | number / 1.2 | 1.2–5 / 0.1 / mm |
| requestedHoleCount | integer / 4 | 2–16 / 1 / holes |

For a countersink, geometric cone depth is
`(headDiameter-throughDiameter)/(2*tan(countersinkAngle/2))`.
Require it to agree with the stated seat depth within 0.1 mm or reject the profile.
Counterbore uses headDepth directly. Required local thickness is seat depth plus
remainingSeatMaterial. The illustrative 1.5+2.3=3.8 mm profile needs a 2.6 mm raised
boss when the plate is1.2 mm. Show that protrusion and actual bounds. A raised boss
must not intersect a decorative piece, wall plane or neighbor. If it cannot fit,
reject or ask for a thicker plate; never omit the head seat silently.

Select hole centers in exposed perimeter material, evenly by boundary arc length,
then use a bounded deterministic candidate search to preserve edge ligaments and
avoid seams. The reviewed plan freezes candidate spacing/order/count (proposal:
2 mm arc increments, maximum2048 candidates). If all requested holes cannot fit,
fail with locations/reasons. Specify required screw length, wall substrate/anchor,
installation direction and permitted loads in the **approved physical profile**;
the geometric dimensions above cannot establish these. Do not advertise them as
universal hardware instructions.

## Tiling and output contract

Use phase 08's usable-bed polygon and build-height limit, not nominal bed dimensions.
Default generic256 with 5 mm margins gives246×246 mm usable space. Initial rectangular
division uses `ceil(actualWidth/usableWidth)` columns and analogous rows; equal
divisions give balanced tiles. A 520 mm frame therefore starts at3×3 tiles, not a
claim that one particular tile count is optimal.

Clip the frame solid by this partition. Require every result to be one connected,
valid solid with stable ID `frame-r<row>-c<column>` plus component suffix only when
explicitly supported. No tiny disconnected plate slivers. If a seam would cross a
hole, boss or required registration/retention zone, search a fixed bounded set of
partition adjustments. Proposal: at most2 extra rows/columns and seam shifts of
±5% of tile span, at most81 whole-grid candidates; final exact search order must be
frozen in the versioned fixture. Every candidate must still fit the usable bed.
If no valid division exists, report the conflicting feature IDs and block kit export.

Do not shrink the frame to fit. Tile IDs/maps depend on accepted frame+bed revision;
changing bed settings invalidates tiles and related documents. Exterior art IDs do
not change solely because frame tiling changes. Frame parts have independent print
transforms with their flat wall side on Z=0; assembly transforms preserve the seat
at Z=0. Mark wall side, top direction, seam neighbors and map number in metadata
and physically where engraving minima permit. Map-only rules apply to small tiles.

Registration and seam restraint are **not solved by a butt cut**. The selected
retention profile must define joints or an external restraint, tolerance, prohibited
seam zones and how each tile is held to the wall. Until approved, export can be
labelled CAD evaluation only; a frame-inclusive print-ready kit is blocked. This
is an explicit unresolved mounting decision, not permission to add untested joints.

Provide a small coupon containing two adjacent representative pockets, one typical
rib, the selected hardware seat and the approved seam feature. It uses the same
generator/profile, not hand-adjusted geometry. Coupon export is explicit and does
not start a print. Physical fit tests must record printer/material/layer conditions,
measured clearances, insertion/removal behavior and any failure before physical
fit/retention claims are enabled.

## States, validation and acceptance

Frame-only and show-frame controls use accepted canonical tiles. Show decorative
and frame counts/weight separately. Setup incomplete, invalid frame, tiling pending,
CAD qualified and physical fit unverified are distinct labels. Failed frame candidates
preserve prior accepted artwork/frame and old saved bytes. Visible errors identify
clearance, hardware, seam or budget rather than “Something went wrong”.

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-FRAME-AC-1 | Pockets derive from exact base contours and stated per-side clearance without moved artwork | Analytical offset fixtures, all built-in outlines and accepted layout IDs |
| WA-FRAME-AC-2 | Rib/plate/ledge/web minima reject illegal joints; lightweight exceptions are visible | Clearance0.1/0.25/0.6, plate1.2/5, rib1/8, offset-collapse and narrow-web fixtures |
| WA-FRAME-AC-3 | Border/corner changes produce reported actual dimensions and no silent radius clamp | Zero/max border and radius, curved/no-effect and impossible-radius tests |
| WA-FRAME-AC-4 | Hardware profiles validate measured geometry and show required bosses/protrusion | Illustrative 3.8/1.2 plate cases, cone mismatch, missing profile and hole-placement failure |
| WA-FRAME-AC-5 | Tiles fit the usable bed, preserve IDs/transforms and never cut prohibited features | Generic180/256/asymmetric beds, hole-seam conflict, 256/257 tile budget tests |
| WA-FRAME-AC-6 | Unsupported retention/seams cannot produce a print-ready frame kit | Missing/unqualified profile fixtures; CAD-evaluation label and blocked kit journey |
| WA-FRAME-AC-7 | STEP/STL/3MF preserve separate frame solids, seating positions and millimeter scale | Independent reader/slicer inspection in assembly and print orientations |
| WA-FRAME-AC-8 | Coupon matches canonical geometry; physical claims require separate recorded evidence | Digital dimension checks; authorized physical coupon report, otherwise unverified |
| WA-FRAME-AC-9 | Frame controls/errors/inspection are accessible and preserve valid state on failure | Keyboard/320 px/real200% zoom, invalid file and cancelled tiling journeys |
| WA-FRAME-AC-10 | Worst accepted frame and tile search respect C4 and deterministic search bounds | Operation/memory/timing counters, repeatability and cancel/timeout tests |

## Documentation impact and unresolved decisions

### Stories and required implementation tests

QA owns `tests/wall-art-frame.test.mjs` and
`tests/browser/wall-art-frame.spec.ts`. All linked criteria and N/B/I/E tests run
in `npm run check`. Physical evidence is separately required for physical claims.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-FRAME-ST-1 — Generate a truthful pocketed backing | WA-FRAME-AC-1/2/3/4 | Node: N shared contours,clearance0.25,solid/lightweight and explicit hardware seats; B every frame range endpoint including plate1.2/rib8/border30; I thin rib,collapsed offset,invalid corner/hardware rejects; E kernel/hole placement failure preserves previous solids. Browser shows exact boss protrusion and retained inactive settings. |
| WA-FRAME-ST-2 — Tile and qualify frame outputs | WA-FRAME-AC-5/6/7/8/10 | Node: N valid tiles/coupon and three-format round trips; B180/256/asymmetric beds,256 tile limit,seam-search bound; I forbidden seam/oversized/unqualified retention blocks kit; E timeout/cancel disposes candidates and retains prior frame. Actual authorized coupon/retention and target slicer checks are manual; no fixture implies wall-load proof. |
| WA-FRAME-ST-3 — Inspect and correct mounting setup | WA-FRAME-AC-9 plus visible AC-4/6 | Browser: N frame toggle,colour/visibility/frame-only and numeric corrections; B320 px/real200% zoom; I missing profile/no-plinth setup reports specific recovery; E cancelled/failed tiling keeps valid artwork and old saved bytes. AT/touch and hardware instructions need human review. |

Product/roadmap and website definition must approve printed-frame versus alternative
mounting scope. Architecture must record intentional seating contacts, frame/bed
revision dependency and qualification status. README needs actual hardware/retention
instructions and warnings only after validation. Development needs coupon, seam,
offset and hardware fixtures and physical-test record format. No server setup or
root LICENSE change. Blocking decisions: retention, seams, hardware profile and
physical validation procedure; exact bounded tiling/hole search belongs in the
reviewed technical plan. These do not block phases01–06.

## Implementation steps and handoff

Resolve mounting/profile contracts, verify headless offsets and hardware seats,
then deterministic tiling and three exports, then controls/maps and coupon evidence.
This is part of feature implementation, not a separate CAD prototype milestone.
Geometry owns AC-1–8/10; frontend exposes qualification and AC-9; QA checks digital
contracts and separately reports physical evidence. Exit cannot be called a ready
mounting system while retention, seam restraint or physical-fit claims remain open.
