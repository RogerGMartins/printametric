# Wall art 03 — shape and surface relief

Status: **Product decisions D1–D18 and UI decisions SHAPE-UI-D1/D2 recorded. Technical contracts and actual-CAD visual review remain pending. No technical-plan or implementation approval.**
Depends on [02](wall-art-layouts.md). Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-SHAPE`. Proposed schema/generator: `3/3`.

## Guided decision review — 2026-11-03

Collaboration mode for this review: **Guided questions**. Follow the suite's
[active decision review](wall-art.md#active-decision-review). The decisions below
resolve only their stated scope. The product-decision round is complete. The later
[UI review](#ui-review-decisions--2026-11-03) resolves hierarchy and specified
control ranges/increments. Technical contracts, curvature numbers and actual-CAD
visual results still require review; no technical plan or implementation is approved.

### Confirmed product decisions

| Decision | User answer and scope | Contract impact |
| --- | --- | --- |
| SHAPE-D1 — Taper direction | Both X and Y; no taper-mode selector. | Uniformly scale the top footprint, rather than retain X-only blade taper. Explain this visible upgrade change. |
| SHAPE-D2 — Fresh appearance | Stepped wave. | Fresh `family=wave`, `stepBlend=1`; one horizontal top per piece. |
| SHAPE-D3 — Proportions | Keep circles. | Equal physical scale on both axes; crop rather than stretch the field. |
| SHAPE-D4 — Rotation | Actual counterclockwise angle viewed from the front. | Rotate about the panel center, independent of aspect ratio; symmetric fields may look unchanged. |
| SHAPE-D5 — Uniform resizing | Pattern grows with the panel. | Scale wavelength with both dimensions; do not scale heights or layout pitch. |
| SHAPE-D6 — Reference dimension | Shorter nominal side: `L=min(width,height)`. | Use phase-02 nominal dimensions, not material bounds or whole-cell overflow. |
| SHAPE-D7 — Top controls | Keep blend and advanced Planar tops. | Intermediate blend allowed; planar tops are flat but may slope, inactive when fully stepped. Narrow tops can make effects subtle. |
| SHAPE-D8 — Plinth | Optional per-part base, enabled initially. | Not shared backing. Too-thin removal fails and retains the prior valid design; no hidden floor or height increase. |
| SHAPE-D9 — Identification fallback | Keep a valid bare piece as Map-only ID when cuts alone fail the floor. | Omit number/arrow cuts; preserve number/orientation lookup and the 1.2 mm residual-floor rule. Invalid bare pieces still fail. |
| SHAPE-D10 — Starter sides | Inward-curved: narrow faster near the base, rise more steeply near the top. | Exact starter silhouette remains subject to visual review. Numeric curvature and construction are not approved by this choice. |
| SHAPE-D11 — V2 upgrade appearance | Minimal additional changes; retain heights, straight profiles, layout, dimensions, seed and identification. | Zero added surface amplitude; preserve plinth. Two-axis taper still changes shape. |
| SHAPE-D12 — V1 upgrade route | Direct v1→v3, one generated preview and one confirmation. | No intermediate v2 acceptance. Preserve original bytes/design/native export source on failure/cancel; retain exact v1/v2 compatibility. |
| SHAPE-D13 — Seeds | Independently editable and persisted layout/surface seeds. | Surface edits cannot rearrange cells. Layout edits preserve the field at fixed XY but can change sampled part heights. |
| SHAPE-D14 — Fresh heights | Minimum relief20 mm and amplitude30 mm. | With inherited 10 mm plinth, possible top heights are30–60 mm; actual extrema come from CAD. Separate from migration. |
| SHAPE-D15 — Wave spacing | Fresh density2: two cycles per L. | Two broad repeats across the default500 mm square; exact field profile still requires review. |
| SHAPE-D16 — Fresh top size | `topRatio=0.12`. | A47.5×47.5 mm base gives a5.7×5.7 mm top; printability checks still apply to every footprint. |
| SHAPE-D17 — Family inventory | All seven observable roles in the field table below. | Exact appearance and mathematical formulas remain unqualified. Random is a smooth spatial field, not per-piece random heights. |
| SHAPE-D18 — Final settings package | **A — Accepted as presented.** Top ratio10–100%; planar initially off; minimum relief0–120 mm; amplitude0–200 mm; adjustable sides from straight to strongly inward-curved; density0.2–12, initially2; rotation/phase initially0; spiral arms1–16, initially5; surface seed1–9999, initially1 including upgrades. | Ring ignores rotation/phase; Dome ignores density/rotation/phase. Surface seed affects Dunes/Ridges/Random. Higher density means tighter features, not an equal literal band count across families. Upgrade preserves numeric top ratio/layout seed, initializes new controls from agreed defaults, and retains zero amplitude/straight sides. Invalid combinations retain the accepted design; ranges promise no throughput. **Not presented or approved:** numeric curvature1–4/default2.2, UI increments, rotation/phase ranges, numerical formulas or exact starter silhouette. |

D18's “Not presented or approved” statement records that product package only.
The later [SHAPE-UI-D2](#ui-review-decisions--2026-11-03) approves the specified UI
increments and rotation/phase ranges. Curvature numbers, formulas, endpoint
equivalence and the exact starter silhouette remain unapproved.

The existing compatibility rule remains authoritative: opening a generator-1 or
generator-2 file does not reinterpret its parameters using these new semantics.
Retain exact old-version behavior and original imported bytes. An upgrade requires
a separate generated preview and explicit confirmation. SHAPE-D11 fixes the v2
upgrade's visible behavior; SHAPE-D12 selects a direct v1→v3 preview with one
confirmation. Complete encoding and identity correspondence still need review.
Failed or cancelled candidates preserve the previous accepted design and export source.

Reuse the [approved phase-02 limits](wall-art-layouts.md#approved-decisions--2026-11-02):
120 seconds per generation or selected export, literal 2 GB (2,000,000,000 bytes)
aggregate memory, and 4000 retained parts as a hard ceiling. The completed 512-part
case measures phase-02 geometry, not phase-03 curved-surface performance. Do not
raise limits, claim guaranteed throughput, or require the previously waived
4000-part timing target merely because this draft refers to C4 qualification.
Phase 03 still needs its own measured correctness, retention and export evidence.

### Review checkpoint and remaining gates

- **Product:** no unanswered core product choice remains from this guided round.
  D1–D18 apply only within their stated scopes. Reopen a choice if qualification
  requires a visible behavior, range or scope change; do not invent that change.
- **Visual/UI review:** UI-D1/D2 approve the drawer hierarchy and specified control
  ranges/increments. Actual-CAD starter and seven-family fixtures remain pending,
  including curvature range 1–4, increment 0.1 and default 2.2. Verify the detailed
  UI, accessibility and states after implementation; incumbent screenshots and
  conceptual illustrations do not qualify phase 03.
- **Technical planning:** freeze field formulas, random vectors, bounded sampling,
  constrained planes, nonconvex taper/clearance checks, CAD approximation and exact
  saved-version/key/ID contracts. Preserve the old layout arrangement in upgrades.
- **Verification:** qualify actual generation/replacement/export and failure
  retention under the inherited budgets. The phase-02 512-part result does not
  qualify phase 03. Keep large-count throughput unpromised.

The [technical implementation plan](../plans/wall-art-shape-surface.md) is now
prepared and awaiting user review. It proposes bounded P0–P2 native-CAD work,
followed by an explicit visual/contract approval stop before production integration.
The technical proposals and curvature remain provisional. Publishing these documents
does not approve the plan or authorize implementation.

## Problem, flow and scope

Create relief that is visually varied but remains editable native CAD. Choose a
surface family, adjust height and shape, inspect the accepted solid and warnings,
and export without a second geometry path. The surface controls heights; the
shape controls each part's cross-section and top. Movement is a later independent
field. Imported image relief belongs to phase 09.

**Confirmed included families (SHAPE-D17):** Wave, Dunes, Ring, Dome, Spiral,
Ridges and Random, with the observable roles in the field table below. All seven
belong to this phase's end-to-end generation, preview, saved-design and export
scope. The approved inventory is not a claim that their CAD construction or exact
appearance has been qualified. Imported relief images, movement, colour tools and
print-bed packing remain with their existing later phases.

All formulas here are original **Printametric proposals**, not an existing algorithm
contract. Implementation planning must freeze sample fixtures and native-CAD
construction tolerances before approval. Do not accept a mesh-only implementation.

## Parameters

Confirmed product values below follow D1–D18; the specified UI ranges/increments
follow [SHAPE-UI-D2](#ui-review-decisions--2026-11-03). Inherited layout/base/identification
fields retain the phase-02 contract, including their existing increments. Increments
are not manual-entry quantization rules (C3). Curvature range/default/increment,
field formulas and rotation/phase endpoint equivalence remain proposed. A valid
individual value can still fail joint geometry or generation limits; never clamp
or reduce a design silently.

Layout/numbering and the existing seed's layout role persist. SHAPE-D13 adds a
separately saved surface seed; it does not repurpose the old seed or change v1/v2
files. C2 determinism and independent random streams still apply. `minimumRelief`
replaces `reliefHeight` through explicit migration; `topRatio` changes from X-only taper to the
homothetic top contract below, so this is a generator version change, not a rename.

| Parameter | Type | Default | Range / step / unit | Meaning |
| --- | --- | --- | --- | --- |
| topRatio | number | 0.12 | 0.1–1 confirmed / 0.01 UI-D2 / ratio | Uniform top footprint scale; UI shows 10–100% with 1 percentage-point increments; upgrades preserve the source numeric ratio |
| stepBlend | number | 1 | 0–1 / 0.01 UI-D2 / ratio | Stepped-to-continuous control: 1 horizontal cell-flat tiers; 0 follows the surface across each top; intermediate blend; UI shows 0–100% with 1 percentage-point increments |
| planarTops | boolean | false (confirmed) | true/false | Advanced flat, potentially sloping top; inactive at fully stepped. Fit algorithm remains proposed |
| minimumRelief | number | 20 | 0–120 confirmed / 1 UI-D2 / mm | Relief above plinth before surface contribution; migration retains source relief height |
| concavity | number | 2.2 (proposed) | 1–4 proposed / 0.1 proposed / exponent (proposed encoding) | Adjustable straight-to-strongly-inward-curved sides confirmed. Numeric scale, exponent formula and exact starter curve still require review |
| plinthEnabled | boolean | true | true/false | Confirmed enabled for fresh designs; optional baseThickness plinth under each separate piece, not a shared backing; removal must preserve valid thickness |
| family | enum | wave | wave, dunes, ring, dome, spiral, ridges, random | Seven-family inventory/observable character confirmed by SHAPE-D17; fresh wave confirmed by SHAPE-D2; formulas remain proposals |
| depth | number | 30 | 0–200 confirmed / 1 UI-D2 / mm | Surface amplitude; upgrades use0, not this fresh default |
| density | number | 2 (confirmed) | 0.2–12 confirmed / 0.1 UI-D2 / family-specific frequency | Higher means tighter features; wave cycles per L, not equal literal band counts across families. Dome inactive; exact formulas remain proposed |
| rotation | number | 0 (confirmed) | 0–360 UI-D2 / 1 UI-D2 / degrees | Actual counterclockwise rotation viewed from front; Ring/Dome inactive. 360≡0 remains proposed endpoint equivalence, not approved by UI-D2 |
| phase | number | 0 (confirmed) | 0–1 UI-D2 / 0.01 UI-D2 / cycle | Field progression; Ring/Dome inactive. Periodic-family 1≡0 remains proposed with the numerical contract, not approved by UI-D2 |
| spiralArms | integer | 5 (confirmed) | 1–16 confirmed / 1 UI-D2 / count | Active only for Spiral |
| seed (Layout seed) | integer | 1 (inherited) | 1–9999 / 1 / none (inherited) | Existing irregular-layout seed; other layouts ignore it. Exact old-version meaning retained; v3 serialization location remains to freeze |
| surfaceSeed (proposed key; Surface seed) | integer | 1 (confirmed, including upgrades) | 1–9999 confirmed / 1 UI-D2 / none | Independent saved seed for Dunes/Ridges/Random; exact saved key and stream derivation remain technical work |

Inactive values are validated and retained, not applied. The layout seed affects
only irregular cell placement, independent of the selected surface family. In the
confirmed applicability rules, the surface seed affects only dunes/ridges/random;
wave, ring, dome and spiral ignore it. Dome ignores density/phase/rotation; ring
ignores rotation/phase. Depth=0 makes surface controls, including surface seed, height-inactive;
it does not disable the layout seed's effect on irregular cells. Blend=1 makes
planarTops inactive. Narrow tops often make stepBlend differences
weak, especially topRatio<0.4; explain this, do not disable a meaningful control.

### Independent seed contract — SHAPE-D13

Each seed is a distinct saved value, not two labels for one shared control. Surface
random phases/directions come only from the surface seed and the versioned relief
stream. Irregular site positions come only from the layout seed and the existing
layout inputs. Neither stream consumes the other's random draws. Preserve the
approved v2 layout arrangement during upgrade, including its keyed random behavior;
adding a new generator version or relief stream must not reseed those sites.

With dimensions and other field controls fixed, changing the layout seed leaves
the field value at every fixed assembly XY location unchanged. New cell footprints
can sample different locations/areas and therefore have different heights and IDs.
Do not promise unchanged per-piece heights or geometry after a layout change.

With layout inputs fixed, changing the surface seed leaves layout sites, retained
base footprints, layout exclusions and topology-derived part identity unchanged.
It can change top heights, shaped solids, engraving feasibility or overall validity.
An invalid surface candidate fails under C3; it must not move cells, drop parts or
rewrite either seed to obtain a successful result. Changing any non-seed layout
parameter likewise does not overwrite the saved surface seed; panel resizing can
still change field scale under SHAPE-D5/D6.

The new surface seed is validated even when inactive and survives family switches
and JSON round trips. A changed layout seed must not overwrite it, or vice versa.
Both remain explicit and deterministic; no time-based/GPU/global-random fallback.
The relief stream's derivation and test vectors remain technical work. D18 fixes
surface seed1 as the fresh and migration default, with integer range1–9999.

## Normalized field contract

**Confirmed spatial behavior (SHAPE-D3/D4):** evaluate in centered assembly XY,
with one common physical scale for both axes. Crop the field at the panel boundary;
do not stretch it independently to the panel width and height. A circular field
therefore remains circular before cropping, including on wide or tall panels.
Positive rotation rotates the field counterclockwise by the actual entered angle
when viewed from the front. Rotate the field, not the panel outline or cell layout.
Cropping can change the visible portion but must not distort the underlying field.

**Confirmed uniform resizing (SHAPE-D5):** when width and height both grow by a
factor `k`, the field's horizontal scale grows by the same factor. With unchanged
field controls, corresponding positions `(x,y)` and `(k*x,k*y)` have the same
normalized field value. Doubling both dimensions doubles the wavelength rather
than adding repetitions to the normalized composition. This is a field contract,
not a promise of identical cell samples or part counts: layout pitch is not scaled
by this decision. It also does not authorize scaling relief heights or amplitude.

**Confirmed reference dimension (SHAPE-D6):** use `L=min(width,height)` in mm.
`width` and `height` are the existing nominal bounding-rectangle parameters from
the [phase-02 outline contract](wall-art-layouts.md#outline-contract). They are not
the actual bounds after clipping, gaps, exclusions or whole-cell overflow.
Changing outline or boundary mode without changing these dimensions must not
rescale the field. Phase 02 still determines retained footprints: cropping here
does not add a new clipping rule for whole-cell edges. Evaluate the same field
over those retained footprints, including any permitted overflow.

At unchanged field controls, increasing only the longer side leaves `L` and
physical pattern spacing unchanged. Changing the shorter side changes the common
scale until it reaches the other side; further growth then leaves `L` fixed at
that other dimension. Both axes always use the same scale, so rings remain circular.
For example, 400×400→800×400 keeps `L=400`; 800×400→800×600 changes `L` to 600.
Neither case authorizes automatic changes to height parameters or layout pitch.

Use `(u,v)=(x/L,y/L)` and inverse rotation by the entered angle to obtain `(a,b)`.
This coordinate contract expresses the confirmed scale and rotation behavior;
it does not approve a numerical surface-construction algorithm. The old
`(x/width,y/height)` rule is superseded and must not be used on nonsquare panels.

The remaining mathematical definitions are proposals: `r=2*sqrt(a²+b²)`,
`theta=atan2(b,a)` (0 at the origin), `d=density`, `p=phase`, and `s(t)=sin(2πt)`.
Clamp field results to [0,1] only at the stated formula boundary, never to conceal
nonfinite values. All formula fixtures must use the confirmed shorter-side scale.
SHAPE-D15 confirms the fresh wave's density2 as two cycles per L. Its default
500 mm square therefore has a 250 mm field repeat distance along the wave
direction. This is an underlying-field target; averaging onto stepped pieces can
soften the visible highs/lows. D18 confirms range0.2–12 and tighter features at
higher density across applicable families, without a shared literal band count.
UI-D2 confirms the 0.1 density increment. Exact frequency mappings and formulas
remain proposals.

The right column states the confirmed SHAPE-D17 character, supplemented by the
already-approved wave starter spacing. The formula column is still proposed;
inventory approval does not approve its exact profile, coefficients or numerical
evaluation. Review original visual fixtures for each family before final signoff.

| Family | Proposed normalized field F | Confirmed observable character |
| --- | --- | --- |
| wave | `(1+s(d*a+p))/2` | Regular smooth parallel rises and falls; the confirmed starter has two cycles per L |
| dunes | `(1 + (s(d*a+p+q1)+0.5*s(0.7*d*b-p+q2)+0.25*s(0.6*d*(a+b)+q3))/1.75)/2` | Unequal smooth undulations |
| ring | `(1-cos(2π*d*r))/2` | Circular bands around a low center |
| dome | `max(0,1-r²)` | One central circular mound, cropped by the selected outline |
| spiral | `(1+cos(spiralArms*theta-2π*d*r+2π*p))/2`, blended to 0.5 within r<0.02 | Winding arms around the center |
| ridges | `1-abs(2*fract(d*a+0.2*s(d*b+q1)+p)-1)` | Bent bands with sharper peaks than Wave |
| random | `0.5 + sum(k=1..6, Ak*sin(2π*(fxk*a+fyk*b+p+qk)))/(2*sum Ak)` | Reproducible smooth scattered hills, not unrelated random heights assigned per piece |

Proposed formula details: q values are seeded phases in [0,1). Random uses
`Ak=1/k` and seeded frequency directions of magnitude `d*(0.5+k/6)`. These details,
the spiral center treatment and the precise ridge profile are not approved by
SHAPE-D17. Random must still be one smooth spatial field: any cell-height variation
comes from sampling that field under the reviewed top contract, not independent
random draws per piece.

`fract` is value minus floor, including negative inputs. q values and directions
come from the versioned relief substream keyed by the surface seed, never the layout
seed. Its derivation/test vectors are not yet frozen. Ring phase is confirmed inactive; do not
shift it silently and lose the depressed center. Random phase repeats at 1 while
its spatial edges need not tile. Dunes phase repeats because its phase coefficients
are integers (±1/0). No family promises seamless tiling at the panel outline.
Normalize analytically as above, not by sampled min/max, so adding a clipped cell
does not rescale the heights of every other part. Nonfinite evaluation rejects.

## From field to solid

For each base footprint choose its area centroid if interior; otherwise the
deterministic maximum-inscribed-circle center with lexicographic tie break. That
anchor must be stable in exported metadata. Phase 02 already includes nonconvex
radial annular sectors; do not assume every built-in footprint is convex. Reuse its
qualified containment/neck checks. Phase 09 extends qualification to imported concave
and hole-containing cells. Phase 02 retains X-only taper; homothetic taper stays here.

**Confirmed top behavior (SHAPE-D7):** fully stepped produces one horizontal top
per piece, with heights varying across the panel. Fully continuous follows the
selected surface across each top; intermediate settings blend these appearances.
When Planar tops is enabled away from fully stepped, each top becomes one flat
face that may slope. At fully stepped, toggling Planar tops does not change geometry.
Narrow top footprints can make the differences subtle; this does not remove either
control or imply that continuous tops always show visible curvature.

**Proposed numerical construction, not approved by SHAPE-D7:** define each cell's
scalar mean `M` by area-weighted deterministic quadrature over
its base footprint, with error ≤0.001 normalized units. At a top location, normalized
height is `H=stepBlend*M+(1-stepBlend)*F(x,y)`. If planarTops is true and blend<1,
use an area-weighted least-squares plane fit to H, then constrain that plane over
the full top domain to [0,1]. If a valid constrained fit cannot be found, reject,
not silently curve it. Freeze quadrature/refinement and plane-fit fixture tolerances
with this generator version. Vertex-only averaging is not equivalent to area mean.

Top Z is `(plinthEnabled ? baseThickness : 0) + minimumRelief + depth*H`.
The quoted “overall depth” is the actual maximum-minus-minimum Z of all canonical
solids, not necessarily base+minimum+depth if F never reaches 1 in retained cells.

**Confirmed fresh heights (SHAPE-D14):** start with 20 mm minimum relief and up
to 30 mm surface contribution. With the inherited 10 mm plinth, this gives a
**30–60 mm possible top-height envelope**, not a claim that the actual starter
contains a 30 mm piece and a 60 mm piece. Stepped sampling can keep all tops inside
those limits. Show actual accepted CAD bounds and export that geometry; do not
stretch sampled heights to force the envelope endpoints. These editable starting
values still require visual review in the complete starter. D18 separately confirms
the height ranges; later UI-D2 approves 1 mm increments, not numerical construction.
Neither decision overrides the
zero-amplitude, source-height upgrade contract in SHAPE-D11.

**Confirmed starter composition (SHAPE-D15/16):** combine those heights with the
two-repeat wave and 12% two-axis tops. For the inherited 500×500 mm square layout
with pitch50 and gap2.5, the square bases are 47.5×47.5 mm and their top footprints
are 5.7×5.7 mm. This small top can make blend/planar differences subtle, as already
described. Validate actual tapered solids and review the complete starter; neither
the approved ratio nor repeat count waives printability or CAD/export checks.
Do not replace an imported design's ratio with 0.12: SHAPE-D11's minimal-change
upgrade mapping, completed by D18's source-ratio preservation, is distinct from the fresh default.

**Confirmed starter side appearance (SHAPE-D10):** the fresh stepped-wave design
starts with inward-curved sides, narrowing faster near the base and rising more
steeply near the top. Review the actual silhouette before freezing its curvature.
D18 confirms the adjustable straight-to-strongly-inward-curved control, but neither
decision approves the proposed numeric scale/default/exponent or exact silhouette.

The top footprint is a uniform homothety by topRatio about the anchor. For flank
parameter t from 0 at relief base to 1 at top, proposed footprint scale is
`topRatio+(1-topRatio)*(1-t)^concavity`; interpolate Z to the local top. With
concavity=1 and flat tops this gives ruled straight sides. Larger exponents give
a narrowing lower flank then a steeper rise. Use native trimmed/spline CAD faces
with C4 approximation bounds; section sampling is not permission for faceted STEP.
Minimum material/tip thickness and self-intersection checks remain authoritative.
Retain C4 minima: 1.2 mm material/top width, 0.8 mm assembled free clearance with
the 0.01 mm safety allowance, CAD tolerance0.001 mm and controlled tessellation.
Each retained decorative piece is a separate validated positive-volume solid.
Assembly uses centered XY with +Z away from the wall; exports retain millimeter
assembly placement. Individual print orientation and bed packing are not added
here. Preview-only offsets must never enter canonical geometry or exports.

**Confirmed plinth behavior (SHAPE-D8):** new phase-03 designs include a separate
plinth under each piece. Users may disable it; doing so does not join the pieces,
add a hidden floor or silently raise the relief. Phase 02's base-thickness contract
is unchanged when the plinth is enabled. If a candidate without a plinth fails
the existing material minima, report the affected parts and retain the previous
accepted design and export source under C3. Do not drop a thin part to accept the
rest. This fresh-design default does not determine upgrade settings.

Depth=0 keeps layout/colour/movement eligibility but removes surface amplitude.
With zero relief everywhere and plinth enabled, generate only the plinth and
report shape controls inactive. With plinth disabled, minimumRelief=depth=0 is
invalid. A top touching Z=0 anywhere without a sufficient continuous 1.2 mm solid
thickness is invalid. Do not manufacture a hidden floor or silently raise heights.

**Confirmed identification fallback (SHAPE-D9):** engraving must retain the
approved **1.2 mm residual floor**, including without a plinth. Extend phase 02's
[identification contract](wall-art-layouts.md#fragments-and-numbering): if the
unengraved no-plinth piece is valid but the identification cuts would violate that
floor, keep the piece without the number or orientation cuts. Report **Map-only ID**
with the floor reason; retain its part ID, map number and contour/orientation lookup
in the numbered plan. Do not thicken the piece, raise its top, silently reduce the
requested engraving depth or omit the piece. Successful fallback geometry must
pass all canonical CAD/mesh checks before acceptance and export.

If the bare piece itself fails material minima or other validity checks, reject
the candidate under C3; map-only identification cannot make invalid geometry
acceptable. Phase 02's existing glyph-fit, edge-clearance, stroke and combined-mark
rules remain unchanged. A kernel or validation error is not proof of a floor-only
fit failure and must not silently invoke this fallback. Movement later shifts tops
but uses this same canonical construction.

## UI and failure states

### UI review decisions — 2026-11-03

This section records the design-only review. It does not approve implementation,
field formulas, native solids or a complete starter silhouette. D1–D18 remain
unchanged. The later UI answers below resolve only their stated scope. UI-D2
supersedes the earlier proposed status of the specified UI increments and
rotation/phase ranges throughout this spec. It does not approve numerical field
construction, endpoint equivalence or curvature values.

| Decision | User answer and scope |
| --- | --- |
| SHAPE-UI-D1 — Hierarchy | **Use this order:** Surface → Shape → Layout and identification → Files/export → Display. Preserve Gridline, its full-width preview and one outer bottom drawer. Common controls stay visible; advanced Shape/Surface controls use native disclosures. No new workflow screen or side inspector. |
| SHAPE-UI-D2 — UI values and increments | **Use UI package:** rotation 0–360° with 1° increments; phase 0–1 cycle with 0.01 increments; minimum relief/amplitude 1 mm increments; top size/blend 1 percentage-point increments; density 0.1; seeds/arms integer increments. Typed finite in-range decimals remain allowed except integer fields. This approves UI ranges/increments, not endpoint/formula equivalence or native construction. |
| Curvature disposition, included in UI-D2 | Keep range 1–4, increment 0.1 and starter 2.2 **provisional until actual CAD review**. The conceptual diagram does not approve an exponent encoding, exact starter silhouette, printability or the seven final family fixtures. |

### Direction and evidence

**Mode: Operate.** Help a maker choose relief, tune the pieces, inspect the accepted
model and explicitly export it. Preserve the incumbent blue Gridline header,
system typography, light/dark tokens, native controls, 44 px action targets and
visible 3 px focus rings from [website foundation](website-foundation.md#ui-design).
Do not add decorative cards, gradients, motion, a family gallery, a new colour
system, or phase-05 room/preset/lighting tools. The relief is the visual focus.

The actual generator-2 application was inspected in Chromium at 1440×1000 and
320×800. It does not render phase 03. Observations that inform this design:

- The neutral solid and quiet background make part boundaries legible. Keep the
  canonical mesh preview, not a coloured height map standing in for accepted CAD.
- The outer drawer overlays the model. Its focused summary is conspicuous and
  its internal scrolling works; preserve canvas size and camera while editing.
- Display controls occupy the first desktop drawer screen, pushing model controls
  below the fold. UI-D1 puts the appearance task first, without redesigning the shell.
- At 320 px the header wraps and settings become one column. The document width
  remained 320 px. The camera toolbar scrolls locally, not the page. Avoid adding
  another preview toolbar row; use the existing 3D/Numbered plan and camera actions.
- Enter on an invalid width and keyboard activation of Review model settings
  opened the drawer and focused `wall-art-width`, including at 320 px. Reuse this
  recovery pattern. Improve phase-03 wording: an error must not say only
  “Model ready” while the shown geometry belongs to the previous valid design.

Local review evidence is under ignored `artifacts/shape-surface-design/`:
`incumbent-desktop-closed.png`, `incumbent-desktop-open.png`,
`incumbent-320-dark-fields.png`, and `incumbent-320-dark-error.png`.
`visual-review.html` and `conceptual-families-and-profiles.png` provide an original
**conceptual illustration**, not application UI, printable CAD or verified preview.
The seven continuous field illustrations use the draft formulas; seeded families
use explicitly illustrative phases/directions, not a qualified surface-seed stream.
They show regular Wave, unequal Dunes, low-center circular Ring, one Dome, winding
Spiral, sharper bent Ridges and smooth Random. The matched 2D flank sections show
that 2.2 narrows the lower flank substantially, while 4 makes more of the upper
piece appear thin. Review 2.2 first in actual CAD; do not freeze it from this sheet.
The illustrations do not prove stepped sampling, arbitrary-footprint taper,
native-surface continuity, printability or exports. They are review aids, not new
production assets or a second geometry generator.

### Layout and hierarchy

```text
Printametric | Wall art   Design  Print layout  Assembly   theme  Help  About
Design                                     Preview · accepted parts · mm
┌────────────────── full-width, fixed-size preview ────────────────────┐
│ Model status / previous-valid notice       Existing camera controls  │
│ Error + Review action (outside drawer)          [3D] [Numbered plan]  │
│                      accepted canonical model                       │
└─────────────────────────────────────────────────────────────────────┘
▾ Workspace settings
  Surface                         Shape
  Surface family [Wave       v]   Minimum relief (mm) [20]
  Surface amplitude (mm) [30]     Top size (%) [12]
  Pattern density [2]             Side curvature [2.2*]
  ▸ Advanced surface              Top blend (%) [100]
                                  Continuous 0 ─────────── Stepped 100
                                  [x] Include per-part plinth
                                  Plinth thickness (mm) [10]
                                  ▸ Advanced shape: Planar tops
  Layout and identification — inherited controls + Layout seed
  Files and export — Revert / Load / Save / STEP / STL / 3MF
  Display — existing tips/background controls and accepted summaries
```

`*` Curvature is a provisional design value, not an approved numeric default.
The wireframe shows fresh defaults only; upgrades do not receive fresh amplitude
or curved sides. On wide screens, Surface and Shape can share one row of auto-fit
columns; later groups follow in DOM order without empty reserved tracks. At narrow
width they stack in the same order. Keep existing file/format actions rather than
introducing a wizard, a new route or an export modal. The status remains visible
with settings closed. Actual bounds and part count always name the accepted model.

The native outer `Workspace settings` disclosure retains its session lifetime.
Use one level of native Advanced disclosure inside each relevant group; no further
nested accordions. This is the phase-03 refinement of the foundation's historical
no-nested-Advanced rule, consistent with the incumbent phase-02 advanced layout
disclosure. It does not approve phase-05 catalogue or section-navigation proposals.

### Labels, controls and applicability

| Group / label | Control and displayed unit | Required explanation / applicability |
| --- | --- | --- |
| Surface / **Surface family** | Native select: Wave, Dunes, Ring, Dome, Spiral, Ridges, Random | One short family-character sentence from the confirmed field table; do not label choices as presets or imply equal band counts. |
| Surface / **Surface amplitude (mm)** | Numeric entry; range 0–200, increment 1 mm | “Height variation above the minimum relief.” Zero removes the surface contribution, not the cell layout. |
| Surface / **Pattern density** | Numeric entry with paired range; 0.2–12, increment 0.1; unitless | “Higher values make tighter features.” For Wave: “Cycles per shorter nominal panel side.” For Dome: “No effect for Dome.” |
| Advanced surface / **Surface rotation (°)** | Numeric entry; 0–360, increment 1° | “Counterclockwise, viewed from the front. Rotates the surface, not the layout.” Ring/Dome: no effect. Endpoint equivalence remains numerical-contract work. |
| Advanced surface / **Surface phase (cycle)** | Numeric entry; 0–1, increment 0.01 | “Moves the pattern through its cycle.” Ring/Dome: no effect. Do not promise seamless panel edges. |
| Advanced surface / **Spiral arms** | Integer numeric entry; 1–16, increment 1 | “Used only by Spiral.” Keep the stored count when selecting another family. |
| Advanced surface / **Surface seed** | Integer numeric entry; 1–9999, increment 1; no physical unit | “Repeats Dunes, Ridges and Random. Does not rearrange cells.” Other families: no effect. |
| Shape / **Minimum relief (mm)** | Numeric entry; 0–120, increment 1 mm | “Height above each plinth before surface variation.” When plinth is off, measure from the wall-facing base plane. |
| Shape / **Top size (%)** | Numeric entry and paired range; 10–100%, increment 1 percentage point | “Width and height of the top relative to its base.” Display 12% for stored ratio 0.12; do not call this top area or X-only width. |
| Shape / **Side curvature** | Numeric entry and paired range; proposed 1–4, increment 0.1 | Endpoint captions “Straight” and “Strongly inward-curved”. Numeric scale/default remain provisional; do not label a dimensionless value in mm. |
| Shape / **Top blend (%)** | Numeric entry and paired range; 0–100%, increment 1 percentage point | Endpoints “Continuous 0” and “Stepped 100”. Stored blend is 0–1. “Stepped gives one horizontal top per piece. Continuous follows the surface across each top.” |
| Shape / **Include per-part plinth** | Native checkbox | “A separate base under each piece, not a shared backing.” Turning it off requests a validated candidate; do not secretly add a base or raise heights. |
| Shape / **Plinth thickness (mm)** | Existing base-thickness control/range/increment | Show retained value when plinth is off, with “No effect while the plinth is off.” Do not change inherited base-thickness validation. |
| Advanced shape / **Planar tops** | Native checkbox | “One flat face per top; it may slope.” At 100% stepped: “No effect: stepped tops are already horizontal. Your choice is retained.” |
| Layout and identification / **Layout seed** | Existing integer numeric entry and inherited range | Keep in Advanced layout and identification. “Repeats irregular cell placement. Does not change the surface field at a fixed location; different cells can sample different heights.” No effect only for non-irregular layouts, not because surface amplitude is zero. |

Do not remove controls on family switches. Applicability changes their associated
help, not their stored values or DOM position. Advanced surface contains rotation,
phase, arms and surface seed in that order, including currently inactive values.
Keep no-effect controls editable for the next applicable configuration; they remain
validated and keyboard reachable. The same rule covers retained plinth thickness
and Planar tops. Disable only for a real operation constraint, with visible reason,
not simply to hide an inactive value. This avoids focus loss when family/height
changes and permits correcting invalid retained data.

Conditional help is always visible, even with tips off:

- At amplitude 0: “Surface settings are retained; they do not change height while
  amplitude is 0.” Do not apply this notice to Layout seed. With nonzero minimum
  relief, taper/curvature can still change the pieces.
- At minimum relief 0 and amplitude 0 with plinth on: “Plinths only. Relief shape
  settings have no effect.” With plinth off, show a blocking zero-thickness error.
- Below 40% top size: “Narrow tops can make blend and Planar tops differences
  subtle.” This is not a disabled state and does not invalidate a permitted value.
- Use the confirmed shorter nominal side for field scale. Explain “The pattern
  grows when both panel dimensions grow; heights and cell pitch do not.” Keep
  nominal dimensions separate from accepted whole-cell overflow dimensions.

### Editing and accessible operation

Keep draft text, submitted candidate and accepted parameters separate. Empty or
partially typed input is not zero. Enter or leaving a numeric field submits the
complete valid draft, matching the incumbent interaction. Checkbox/select actions
submit the same complete draft, never a mix of new values and silently substituted
accepted values. Coalesce range movement; commit a pointer gesture on release and
keyboard range changes as completed input, not one CAD job per animation frame.
An invalid edit stays visible until correction or **Revert to accepted design**.

Numeric entry is authoritative. Paired ranges read/write the same draft value and
show the same number/unit; they do not own independent settings. UI-D2 increments
apply to deliberate increment actions, not file loading or manual-entry rounding.
Do not snap an off-increment valid typed number merely to display a slider. If a
native range cannot represent that exact value, its position is approximate and
must not write a normalized value back; preserve the exact numeric value and its
accessible description. While the numeric draft is invalid, explain why the range
cannot be applied rather than silently showing it as the accepted new value.

Preserve native Tab/Shift+Tab order, select keys, checkbox Space and disclosure
Enter/Space. No global arrows that steal number-field or camera input. Range Arrow,
Home and End actions have numeric alternatives. Every control has a persistent
label, associated units/help/error and visible focus. Use `aria-invalid` for errors,
not for no-effect notices. Focus stays on the edited control during generation and
announcements. A recovery action opens the outer and relevant Advanced disclosure,
scrolls the target into view, then focuses it without clearing the error. General
CAD errors focus the relevant group heading when no single field is responsible.

At 320 px and genuine 200% browser zoom: stack groups and numeric/range rows; wrap
labels, units, help, file names, IDs and action buttons; preserve 44 px targets.
The panel scrolls within at most half the workspace height, with its summary always
reachable. Allow document scrolling at short heights. Never add whole-page
horizontal scrolling; the inherited camera toolbar can retain its local scroll
with focus revealing off-screen buttons. No hover-only instructions, tiny slider
thumb as the only input, pointer-only part picking, focus hidden by the drawer, or
colour-only statuses. Test both themes and forced colours; preserve foundation
contrast requirements. Screen-reader and physical-touch testing remain separate.

### Status, recovery, upgrade and export

Use short literal status text in the existing visible notice area, outside the
drawer. Announce important changes politely once; do not speak every progress tick
or move focus on asynchronous completion. Show measured progress only when supplied
by the shared geometry contract. Never show a percentage from elapsed time.

| State | Visible behavior and available action |
| --- | --- |
| Starting / no accepted model | “Preparing the stepped-wave design” and actual engine/generation stage. No invented model, bounds, part count or printable height-map placeholder. On failure: Retry generation, Review model settings and the existing explicitly labelled ungenerated-parameter save path where valid. Model export is unavailable. |
| Valid numeric draft / pending candidate | “Generating [family] — previous valid design shown.” Retain accepted model, bounds and IDs. Show candidate settings in the form, not candidate counts as accepted summaries. Disable new model exports and explain why; Cancel generation returns to accepted state. |
| Accepted | “Model ready” with accepted family/version, actual assembly width × height × depth in mm and part count. The 30–60 mm starter envelope is explanatory, never a fabricated actual bound. Preview/plan/save/model export refer to this same accepted revision. |
| Invalid draft | Show field name, range or joint constraint and correction. Label preview “Previous valid design”; new model exports stay unavailable. Review and Revert remain reachable with settings closed. Do not coerce empty text, clamp values or clear unrelated errors. |
| Rejected geometry / timeout / cancellation | Preserve accepted geometry/export source; state failure reason and affected IDs when supplied. Top collapse, impossible planar fit, collision and material failure are blocking errors, not Map-only ID. Offer Review, Revert or Retry as appropriate; budget errors can suggest lower complexity but never silently reduce it. Keep 120 seconds / 2 GB / 4000 hard ceiling wording, without throughput claims. |
| Accepted Map-only ID | “Map-only ID — this valid part is too thin for the requested underside cuts; number and arrow were omitted.” Show count and **Review map-only parts**. Open Numbered plan with affected part number, stable ID, reason and enlarged contour/+Y orientation. Keep Part number / Previous part / Next part keyboard lookup. Do not imply that a map label is physically engraved. No new acknowledgment gate for this warning; inherited excluded-fragment consent remains separate. |
| Invalid bare part | “Part [number] is too thin without its plinth. Previous valid design retained.” Review plinth/height controls or Revert; do not offer map-only as a way to accept invalid material. Distinguish invalid candidate IDs from accepted-plan IDs rather than selecting an unrelated old part. |
| Old v1/v2 design | Keep original controls and version label; do not expose v3 controls as live edits to old geometry. Offer **Preview upgrade to generator 3**. Opening JSON alone never upgrades it. |
| Upgrade pending / ready | Original remains accepted. Label a generated candidate **Upgrade preview — not accepted** and its bounds separately. Explain preserved source heights/layout/ratio/seed, zero added amplitude and straight sides; top taper now changes both axes. V1 additionally explains the direct route and no added physical marks. One generated candidate and one **Confirm upgrade** action; **Cancel upgrade** restores the original view. Do not export/save the candidate as accepted before confirmation. Disable new model export while previewing; cancel to export the original. Existing in-flight exports keep their captured source. |
| Upgrade failed / cancelled | Restore original preview, bytes and native export source. Explain a taper/fit/budget failure without replacing it with the fresh starter. Confirmation alone accepts the new unsaved v3 revision. Do not promise identical cross-version IDs; consume the reviewed correspondence. |
| Import / save | Loading reads and validates before replacing anything. Rejected JSON retains prior design and source bytes, with a visible file error. **Save design JSON** saves the accepted definition; drafts/pending candidates are not silently serialized as accepted designs. Preserve the separate existing ungenerated-parameter recovery label. No autosave or account service. |
| Export preparing | Keep **Export STEP**, **Export STL**, **Export 3MF** under **Export assembled model**. Copy: “Millimeters. Separate parts in assembly positions; no build-plate packing.” Only an explicit format action starts work. “Preparing [format] from the captured design” and Cancel export; prevent duplicate exports. Later edits never retarget it. |
| Export failed / storage denied | Show format and safe reason; retain accepted model. Retry is an explicit new export action, not automatic background packaging. No partial download presented as success; expose cleanup/release failures separately. |
| Download ready / leased file | Keep the existing temporary-file explanation and **Release downloaded file** action after the download finishes. Do not claim that model parameters or a browser project were saved. Release does not delete the accepted model. |
| WebGL unavailable / lost | Explain that 3D preview is unavailable. Keep accepted numeric summaries, Numbered plan when available, settings and files usable. Render failure alone does not invalidate CAD; export readiness comes from the canonical source, not canvas availability. |

### Acceptance traceability and design handoff

| Acceptance IDs | UI responsibility / next verification |
| --- | --- |
| WA-SHAPE-AC-1/2 | Seven text-labelled families, family-specific help, shorter-side scaling and actual-rotation explanation. Review native front/isometric fixtures at square/wide/tall sizes; conceptual sheet is not acceptance evidence. |
| WA-SHAPE-AC-3/4/7 | Common Top blend and advanced Planar tops, percent conversion, narrow-top help and distinct inactive notices. Compare 0/50/100% blend on broad and narrow tops; review complete starter and straight/curved actual solids before freezing curvature. |
| WA-SHAPE-AC-5/7 | Per-part plinth, explicit too-thin rejection, Map-only ID warning/lookup and floor reason. Browser tests need real valid fallback and invalid-bare fixtures, not mocked status text alone. |
| WA-SHAPE-AC-6/8 | Canonical preview, actual bounds/units, explicit captured-format export and safe retention/failure. Geometry/export tests own validity and capacity; UI screenshots cannot prove either. |
| WA-SHAPE-AC-7/11 | Keyboard-edit both seeds, conditional help, advanced recovery, 320 px/both themes/actual 200% zoom, range/numeric parity and independent error lifetime. |
| WA-SHAPE-AC-9/10/11 | Old-version label and one-step direct upgrade confirmation, retained original on failure, separate accepted/candidate bounds, both seeds in saved definitions. Use versioned browser round trips and race tests after contract freeze. |

Frontend consumes the shared validated definition, accepted/candidate revision IDs,
canonical tessellation, actual bounds, part identity/contours/orientation, per-part
identification status/reason, progress and structured errors. Build/geometry must
provide any missing metadata; frontend must not infer validity, fabricate warning
reasons, regenerate a field or construct printable solids. Required contract
requests: explicit Map-only floor reasons, affected candidate IDs versus accepted
lookup IDs, and upgrade correspondence/preview ownership. This section does not
change shared types, dependencies, saved keys or geometry contracts.

**Design handoff:** UI-D1/D2 are recorded; curvature and actual-CAD visual approval
remain open. Preserve the React/TypeScript/Vite and React Three Fiber stack. No app
code, production assets, new tests, dependencies or technical plan are added by this
review. Implementation still requires the separate reviewed plan. The future UI
must be checked against the above IDs; incumbent checks establish only the visual
and interaction baseline, not phase-03 completion.

Baseline verification on Windows / Node 26.12.1:

- `npm run check` passed: scaffold validation, both typechecks, production build,
  87 Node tests and 70 production/development Chromium browser tests. Existing
  build warnings include the native dependency's `node:module` externalization
  and large bundle; browser warnings include deprecated `THREE.Clock`. The
  intentional missing-WebGL test logged its expected renderer error and passed.
- Reviewed the desktop and 320 px captures listed above. Exercised native Enter
  disclosure activation, invalid width, keyboard Review recovery and Revert in
  the incumbent app. This does not test new phase-03 controls.
- `node artifacts/shape-surface-design/check-zoom.mjs` passed using real
  `chrome.tabs.setZoom(2)` in Chromium 156.0.8078.4. CSS viewport changed from
  1427×907 to 713×453; device pixel ratio changed from 1.75 to 3.5. The document
  width was 706 px, with no horizontal overflow; keyboard error recovery focused
  `wall-art-width`. Reviewed light/dark viewport captures
  `incumbent-real-200-light.png` and `incumbent-real-200-dark-error.png`;
  measurements are in `zoom-evidence.json`. The first local harness assertion
  incorrectly required document width to equal viewport width despite a vertical
  scrollbar; it was corrected to check for overflow before the passing run.
- `git diff --check` passed. No phase-03 browser/native/export tests can run yet:
  this phase is not implemented. No new contrast measurement, screen-reader,
  physical-touch, physical-print or phase-03 performance claim is made.

## Compatibility, upgrade and saved designs

### Confirmed v2 upgrade behavior — SHAPE-D11

The current phase-02 builder (`geometry/relief-v2.ts`) uses equal-height flat tops
and ruled side profiles with X-only taper; it has no adjustable side curvature.
Curved footprint boundaries can still give curved CAD faces. Here, retaining
"straight sides" means a straight base-to-top taper profile, not converting every
face to a plane or replacing curved contours with polygons.

| Existing v2 behavior | Required upgrade candidate behavior |
| --- | --- |
| Per-piece plinth of `baseThickness`, relief of `reliefHeight` | Preserve both numeric height settings and the enabled plinth. With the draft field names, `minimumRelief=reliefHeight`, `plinthEnabled=true`, and unchanged `baseThickness`. |
| Equal-height flat tops with no surface amplitude | No added height variation: `depth=0`. Top Z remains `baseThickness+reliefHeight`; zero old relief remains plinth-only. Do not apply the fresh wave amplitude. |
| Straight side profiles | Straight side profiles, not the inward-curved fresh starter. Under the proposed curve formula this would encode `concavity=1`; that encoding is a proposal until the formula is frozen. |
| Layout, dimensions, pitch, gap, boundary policy, seed and identification | Copy existing settings and layout arrangement; preserve the old seed as layout seed. Do not apply fresh identification defaults or reseed cells. Initialize the separate surface seed to1 under D18. |
| X-only top taper | Preserve numeric `topRatio` under D18, but use the approved two-axis taper. Anchor/construction behavior still needs technical review. Explain changed top geometry rather than promise identical old geometry. |

D18 confirms initialization of new controls from agreed defaults:
`family=wave`, `stepBlend=1`, `planarTops=false`, `density=2`, `rotation=0`,
`phase=0`, `spiralArms=5`, and `surfaceSeed=1`. These values remain validated and
saved even when inactive. Preserve the source layout seed, top ratio and height
settings; use `depth=0`, an enabled plinth and straight side profiles instead of
the fresh starter's amplitude and curvature. The numeric encoding of straight
curvature remains technical work (proposed `concavity=1`). New surface seed1 is
independent of the source seed, not a copy of it; it takes effect when a seeded
surface is selected with nonzero amplitude. No inactive-field product default
remains undecided; exact saved keys/version encoding still require review.

Generate and validate the complete candidate before offering confirmation. Some
valid old designs can fail the new top-width or containment checks after two-axis
taper. Report that failure and retain the old design; do not enlarge tops, alter
heights, remove parts or replace it with the fresh starter. Cancellation, timeout,
late results and export activity must not commit an unconfirmed upgrade. Only
confirmation accepts a new unsaved revision; preserve original imported bytes.
Part-ID encoding may change with generator version under C1; preserve a coherent
numbered plan and identification rather than promise byte-identical cross-version
IDs. The exact ID correspondence remains technical work.

### Confirmed direct v1 upgrade — SHAPE-D12

Opening a v1 file still generates v1. Only an explicit upgrade action requests the
v3 candidate. Show one generated preview and one confirmation for v1→v3; explain
the combined changes, including the new top footprint and identification lookup.
Do not require accepting, saving or confirming an intermediate v2 design.

Reuse the prior [v1 upgrade decisions](wall-art-layouts.md#approved-decisions--2026-11-02)
for behavior absent from a v1 file: rectangle/square/straight boundary, no physical
identification cuts, and retained numeric fields/seed. The existing transformation
uses `engravingDepth=0`, `numeralRatio=0.34` and `orientationMark=false`; these are
prior compatibility decisions, not new fresh-design defaults. Apply SHAPE-D11's
minimal-change appearance to the shared v1 heights and straight side profiles:
retain the plinth, add no surface variation, and disclose the two-axis taper change.
This preserves the intent of the existing no-cut upgrade rather than silently
turning a direct upgrade into a new starter design.

The original v1 definition, imported bytes and accepted native export source remain
retained until the complete v3 candidate validates and the user confirms it. Failed
generation, timeout, cancellation or stale completion must leave that original
accepted state intact, not a provisional v2 replacement. Confirmation alone accepts
the new unsaved v3 revision; original imported bytes remain preserved under C2.
Budget the retained original and candidate together; never discard the original
to make the combined preview fit.

Internal reuse of the existing v1→v2 parameter transformation followed by a v2→v3
transformation is a technical option, not an approved algorithm or a requirement
to generate intermediate v2 CAD. Preserve the exact v1 and v2 load/generation
paths. SHAPE-D12 does not remove v2 compatibility. Remaining v1-specific technical
work includes source-to-v3 ID correspondence and the complete direct-migration
encoding, including inactive values absent from v1. Neither is permission to add
physical marks or require an intermediate accepted revision.

### Saved-file contract still to freeze

Keep exact old-version generation and loading, rather than interpreting v1/v2 as
v3. Opening old JSON never invokes migration automatically. V3 JSON must reproduce
its accepted parameters, geometry and identity within C2 tolerances. All fields,
including inactive ones, pass C3 validation before expensive work. Failed imports
retain the prior accepted design, original source bytes and native export source.

**Proposed encoding:** retain the existing format-1 six-key envelope, use exact
model/generator pair 3/3, keep the parameter-only 1 MiB UTF-8 file limit and depth-16
limit, and exclude private native snapshots and meshes. These reuse the v2 envelope
without adding assets, but the complete v3 key set and version table still require
technical review. Reject unknown/mixed versions, unknown keys, wrong types,
nonfinite/out-of-range values and exceeded budgets. Do not accept future versions
or silently fill missing fields. The explicit direct v1→v3 route is confirmed by
SHAPE-D12; it is not automatic reinterpretation when opening an old file.

Both independent seed values are required in the v3 saved definition, even when
inactive. A proposed encoding keeps envelope `seed` for the layout seed and adds
`surfaceSeed` to parameters; final key names/placement remain technical work.
The six-key-envelope proposal must not omit, merge or infer away the surface seed.
V1/v2 files retain their original schemas and meaning; only explicit migration
supplies the new field. Missing v3 seed data is invalid, not a silent default.

## Acceptance and verification

UI-D2 fixes the rotation/phase range boundaries and specified UI increments used
below. Tests of equality at rotation 0/360 or phase 0/1 remain proposed until the
numerical contract is reviewed; accepting both input endpoints does not approve
their equivalence. Curvature fixtures remain provisional under the UI checkpoint.

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-SHAPE-AC-1 | All seven families generate finite [0,1] fields with the D17 character and D18 control applicability. Higher density gives tighter features where active, not equal literal band counts. Random is a smooth reproducible spatial field. | Review separate field/actual-CAD fixtures for every family. Check low-center rings, cropped central dome, winding arms, sharper bent ridges and smooth Random. Dense analytic tests use reviewed formulas at confirmed density0.2/12, surface seed1/9999 and every arm count1–16; add just-outside/invalid cases. Phase0/1 are approved UI-D2 range boundaries; their field equivalence remains proposed pending numerical-contract review. Compare low/high density on fixed dimensions; Dome is unchanged. Every family also needs AC-6/10 exports and saved-design checks; coarse cell sampling is not proof of field correctness. |
| WA-SHAPE-AC-2 | Fields use equal physical scale in X/Y with L=min(nominal width,nominal height); ring and dome contours are circular before panel cropping. Positive rotation turns the field by the actual entered angle counterclockwise from the front on every aspect ratio. Uniform panel resizing scales field wavelength proportionally; longer-side-only growth keeps spacing unchanged. Actual material bounds do not rescale the field. Rotation/phase equivalence and inactive controls follow the contract. | Analytic field tests on square, wide and tall panels, including 80×2000 and 2000×80 mm: compare equal-radius samples and the uncut dome boundary; compare asymmetric field samples before/after rigid 30°/90° rotation within both crops. Layout/outline coordinates do not rotate. Uniform resize fixtures: 500×500→1000×1000,400×200→800×400,80×80→2000×2000 preserve corresponding field values. One-axis fixtures: 400×400→800×400 keeps L=400; 800×400→800×600 scales L by 1.5; 800×799→800×800→800×801 gives L=799,800,800. Repeat with axes exchanged. At fixed nominal dimensions, outline changes and hexagonal/triangular whole-cell overflow keep L and field values at shared physical positions unchanged. Keep field controls, height parameters and pitch unchanged; identical cell means/counts are not required. Include 0/360,0/1 and dome/ring/seed no-effect tests. Reviewed visual fixtures supplement field tests because coarse cells can obscure circles. |
| WA-SHAPE-AC-3 | Fully stepped gives one horizontal top per piece; fully continuous follows the selected surface; intermediate settings blend them. Optional planar tops each have one flat face that may slope, and toggling the option at fully stepped leaves geometry unchanged. Area means and constrained fits remain proposed numerical requirements pending technical review. | Unequal clipped-cell and nonconstant-surface fixtures at blend 0/0.5/1, each with planar tops on/off; assert horizontal stepped faces, continuous surface agreement, planar-face residuals and fully stepped no-effect equality. Include a sloping planar fixture, not only horizontal tops. Analytic wave-mean and fit checks must use the eventual reviewed numerical contract. |
| WA-SHAPE-AC-4 | Taper/curvature preserve minima and native surfaces. The fresh stepped wave uses the confirmed defaults: inward-curved sides, minimum relief20 mm, amplitude30 mm, density2, topRatio0.12, planar off, rotation/phase0, arms5 and surface seed1. Actual top heights lie within the 30–60 mm envelope with the inherited10 mm plinth. | Check defaults including inactive ones, two cycles over500 mm/250 mm repeat distance, 47.5×47.5 mm bases and 5.7×5.7 mm tops. Compare actual CAD bounds and AC-6 reimports; never force sampled extrema or fabricate a60 mm summary. Review complete starter silhouette and store reviewed parameters. Test confirmed boundaries ratio0.1/1,minimum0/120,depth0/200 plus just-outside/type/nonfinite inputs. Curvature1/4/default2.2 remain proposed numerical fixtures; they are not product approvals. |
| WA-SHAPE-AC-5 | Fresh designs enable the per-part plinth; valid no-plinth candidates can be accepted. Depth zero preserves layout. Engraving-only residual-floor failure on a valid no-plinth piece produces Map-only ID with no physical marks and preserved identity/plan lookup. Bare-piece invalidity rejects and retains the previous accepted revision/export source. Neither path adds hidden floors, changes heights or drops parts. | Fresh-default and valid plinth on/off assertions; zero-amplitude and bare-material thresholds; engraving fixtures just below/at/above the approved 1.2 mm residual-floor threshold under existing tolerances. Check omitted number/arrow cuts, unchanged requested engraving depth and bare geometry, retained IDs/counts and visible lookup. Compare fallback preview and all three exports to the same accepted unengraved solid. Invalid bare-piece imports/removal and injected CAD failures retain accepted parameters, digest and export source rather than trigger fallback. |
| WA-SHAPE-AC-6 | All formats share accepted shape, actual depth, IDs and units | Curved/cell-flat/planar fixtures independently imported in CAD reader and slicer |
| WA-SHAPE-AC-7 | Both top controls are reachable by keyboard at 320 px; Planar tops is advanced and explains its fully stepped no-effect state. Narrow-top help distinguishes subtle effects from inactive controls. Numeric controls share accepted values. Map-only warnings distinguish omitted physical marks from invalid bare geometry and preserve accessible lookup. | Browser blend-endpoint/intermediate journeys and keyboard access to advanced Planar tops; fully stepped no-effect notice, family switching, narrow-top help, no-plinth Map-only ID number/orientation lookup and blocking thin-part recovery in both themes at 320 px and actual 200% zoom. Verify against AC-3/5 geometry rather than only control labels. |
| WA-SHAPE-AC-8 | Generation, retained-design replacement and each selected export respect the120-second/literal2 GB limits,4000-part ceiling and C4 mesh/operation limits, or fail safely with the prior valid design/export source intact. No advertised range guarantees throughput or permits coarser hidden tessellation. | Measure default and worst-complexity attempts on the documented C4 desktop profile, recording actual CPU/RAM/browser/kernel/build, cold/warm results and aggregate retained/candidate/renderer/export memory. Include maximum-density curved/nonconvex inputs, limit/limit+1 sentinels, watchdog/cancel and resource disposal. Record failed ceiling attempts honestly; do not reinstate waived512/4000 throughput targets or infer support from partial progress. Any future performance claim needs its stated environment and measured rationale. |
| WA-SHAPE-AC-9 | V2→v3 and direct v1→v3 preview minimal-change geometry and require confirmation. Direct v1 uses one preview/confirmation with no intermediate acceptance. Preserve source numeric top ratio/layout seed/heights, zero amplitude and straight profiles; initialize new controls from D18 defaults, including surface seed1. | V1/v2 fixtures with zero/nonzero/maximum relief, nondefault ratio0.37/layout seed5000, irregular cells, curved outlines and engraving on/off. Assert numeric preservation, unchanged layout, new defaults and numbered-plan correspondence; disclose two-axis taper. V1 adds no marks. Trace revisions to exclude intermediate commits/extra confirmation. Confirm/cancel/new-taper failure/timeout/stale result/budget failure/export overlap must preserve original bytes and accepted native export-source usability on failure. |
| WA-SHAPE-AC-10 | V3 save/load reproduces the accepted definition and geometry within C2 tolerances, including confirmed upgrades from v1 or v2. Old files still use their original generators; direct upgrade availability never auto-migrates them. Invalid or over-budget imports never replace valid data. | Actual browser JSON save/load for fresh v3, confirmed direct v1→v3 and v2→v3 designs; headless repeat fixtures for all seven families and inactive fields once encoding is frozen. Reload original v1/v2 files to verify unchanged versions and geometry. Test size/depth limits and limit+1, malformed UTF-8/JSON, unknown/mixed versions/keys, missing fields, numeric strings/nonfinite public inputs, range and budget violations. Sentinels prove pre-CAD rejection where validation can determine failure; generation-failure fixtures retain prior parameters, identity, source bytes and export source. |
| WA-SHAPE-AC-11 | Layout/surface seeds are independently editable, saved and reproducible. Surface seed affects only Dunes/Ridges/Random, never layout arrangement. Layout-seed edits preserve the underlying field at fixed XY, not necessarily sampled cell heights. Failure retains the prior accepted seeds/design. | Vary each seed independently across irregular/regular layouts and all seven families. Check repeatability, fixed-XY field equality for layout edits, and unchanged sites/footprints/exclusions/IDs for surface edits. Include depth0, inactive fields and unequal seeds in JSON round trips. Both seeds test integer endpoints1/9999,0/10000, fractions, wrong types and nonfinite values before CAD. Fresh and migrated surface seed is1, independently of the old layout seed. An invalid surface must fail without moving/dropping cells or rewriting seeds. Keyboard-edit both labels at320 px. |

## Documentation impact and unresolved decisions

The ST-1 field and ST-2 solid tests below share the confirmed starter fixture in
AC-4, including its wave spacing and top dimensions. Numeric default approval is
not completion of that fixture's visual or native-geometry qualification.

### Stories and required implementation tests

QA owns `tests/wall-art-shape-surface.test.mjs` and
`tests/browser/wall-art-shape-surface.spec.ts`. Complete all linked criteria and
N/B/I/E tests in `npm run check`, plus the stated manual evidence.

All numeric fields need default/min/max, just-outside, wrong-type and nonfinite
cases. UI-D2 approves rotation/phase range boundaries and the specified increments;
test them without quantizing valid manual decimals. Endpoint-equivalence assertions
still require the reviewed numerical contract. Curvature range/default/increment
remain provisional until actual-CAD review; do not treat those draft test values as
approved. Test every confirmed enum and conditional branch. No phase-03 tests were
implemented or executed. Existing application checks and visual/keyboard baseline
evidence are recorded in the UI handoff above, not as phase-03 acceptance passes.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-SHAPE-ST-1 — Select and tune every field | WA-SHAPE-AC-1/2/3/11 | Node: N all seven families/every arm count1–16, circular contours, actual rotation, shorter-side scaling, seed-stream independence and fixed-XY field versus per-cell sample distinctions; B AC-2 resizing fixtures, unchanged scale under outline/overflow changes, 80×2000/2000×80, density0.2/12,phase0/1,rotation0/360,arms1/16,blend0/0.5/1 and approved seed endpoints; I nonfinite/unknown family or invalid inactive seed rejects; E failed field/plane evaluation or invalid surface-seed candidate preserves accepted seeds/design. Resize cases keep field controls/heights/pitch unchanged; cell means/counts need not match. Browser exercises every family/arm count and each independent seed control/no-effect state. Reviewed visual fixtures supplement analytic checks. |
| WA-SHAPE-ST-2 — Produce valid shaped CAD | WA-SHAPE-AC-4/5/6/8 | Node: N native curved/planar/flat solids and three reimports, fresh plinth-enabled default, valid plinth on/off parts and no-plinth floor-only map fallback retaining bare geometry/IDs/counts across exports; B ratio0.1/1,concavity1/4,height0/120,depth0/200, bare-material thresholds and AC-5 residual-floor boundaries; I zero-volume or too-thin bare candidate blocks without hidden geometry or part loss; E kernel/tessellation budget/timeout retains accepted digest and export source, never masquerading as map-only fallback. Measure C4 worst cases; actual slicer inspection remains additional. |
| WA-SHAPE-ST-3 — Explain and recover conditional controls | WA-SHAPE-AC-7 | Browser: N keyboard slider/input parity, stepped-to-continuous settings, advanced Planar tops access and no-plinth Map-only ID warning with number/orientation lookup; B fully stepped no-effect notice with either planar value, narrow-top subtle-effect help and all inactive combinations; I invalid retained inactive value rejects import and invalid bare geometry blocks rather than offering map-only success; E generation failure opens relevant control without losing previous values.320 px/real zoom automated; AT/visual review separately recorded. |
| WA-SHAPE-ST-4 — Upgrade deliberately and reproduce saved designs | WA-SHAPE-AC-9/10/11 | Node: N exact v1/v2 dispatch, both minimal-change upgrade routes, preserved source ratio/layout seed/arrangement, new surface seed1 and agreed inactive defaults; round-trip unequal seeds even while inactive; B zero/maximum old relief, retained-original budgets and frozen file limits; I unknown/mixed version, missing/invalid seed, malformed/oversized/inactive-invalid imports and new-taper failures preserve data; E cancel/timeout/stale result/export overlap cannot commit unconfirmed/intermediate designs. Browser: actual JSON transfers and keyboard preview/confirm/cancel at320 px in both themes; direct v1 has one confirmation and no added cuts. Verify original bytes/export source after failure. |

### Required documentation changes at implementation

Only this owning spec changed during this review. Build assigns and applies the
following shared-document updates through the separately reviewed technical plan.
Link here for product decisions rather than duplicating the decision ledger.

| Path | Required change / no-change decision |
| --- | --- |
| `docs/specs/wall-art.md` | Reconcile phase-02 status and waived throughput gates; link D1–D18, extend C2/option coverage for two independent saved seeds, and map AC-1–11/ST-1–4. Preserve original version behavior and historical evidence. |
| `docs/product.md`, `docs/mvp-roadmap.md` | Record approved seven-family/shape scope and starter; do not mark implemented until verified. Retain later-phase exclusions and measured-capacity wording. |
| `docs/architecture.md` | Record reviewed v3 keys/version table, both seeds, native-surface result metadata and retained-original/candidate ownership. Keep existing stack, module direction, units, explicit exports and atomic failure policy. Exact encoding/IDs and bounded construction remain planning work. |
| `README.md`, usage/help | Explain shorter-side scaling/cropping, actual rotation, independent seeds, confirmed inactive controls, blend/planar/curvature controls and optional plinth/map-only recovery. Show starter values and actual bounds rather than assumed extrema. Distinguish fresh defaults from both minimal-change upgrades; direct v1 uses one preview/confirmation and adds no physical cuts. |
| `docs/development.md` | Add field/CAD visual fixtures for all families, default/range checks, seed independence, zero-height/floor boundaries, native exports, v3 round trips, migration races and capacity reproduction with actual results/environment. Label older v1-only/capacity investigations as historical, not current behavior. |
| Setup, dependencies, `LICENSE` | No change required by this spec. No new assets, runtime dependency, service or deployment target is selected. Any later proposal needs its own review. |

Unresolved before implementation: proposed curvature range/default/increment and
exact starter silhouette; actual-CAD fixtures for all seven families; exact
field/sampling/native surface methods and tolerances; rotation/phase endpoint
equivalence; relief random vectors; saved-key/version/ID encoding and the technical
verification matrix. UI hierarchy and specified control ranges/increments are
resolved by UI-D1/D2; the detailed UI still needs implementation verification.
These are bounded review/engineering tasks, not permission to reopen or silently
alter D1–D18 or UI-D1/D2.
Physical-print, assistive-technology and performance claims require their own
evidence. No such evidence was produced by this documentation-only review.

## Implementation steps and handoff

This is a handoff sequence, not an approved technical plan:

1. Use UI-D1/D2 and the UI handoff; freeze the labelled technical contracts and
   schedule actual-CAD visual review in a separate implementation plan. Keep the
   curvature and final-silhouette gates explicit. Seek approval before coding.
2. Establish validation, versioned fields/seeds and a small headless native-solid
   path, then qualify shape/identification and all three export formats.
3. Integrate Gridline controls, explicit migrations, saved files and atomic failure
   recovery. Retain accepted native sources throughout candidates/exports.
4. Verify all acceptance IDs and measured limits. Report pass/fail/unverified,
   including visual, assistive and physical gaps; do not infer capacity from ranges.

| Handoff | Shared contracts and acceptance ownership |
| --- | --- |
| Frontend | AC-7, AC-9/10 file/confirmation flows, AC-11 seed controls; consume accepted CAD metadata, C3 errors and confirmed parameter rules. Never construct printable geometry. |
| Geometry | AC-1–6/8/11 and AC-9/10 validation/migration/round trips; own deterministic fields, native solids, shared tessellation, budgets and exact saved contracts. Preserve nominal layout and original export sources. |
| QA | All AC-1–11 and ST-1–4 using the same contracts; independent CAD/mesh readers, invalid/boundary fixtures, real browser/keyboard/zoom journeys and measured retention/export evidence. Screenshots do not prove CAD validity. |

Exit requires all seven families and explicit, honest qualification of what is
advertised, not guaranteed4000-part throughput or only a successful default wave.
