# Wall art 03 — shape and surface relief

Status: **DRAFT for user review; proposed expansion.**
Depends on [02](wall-art-layouts.md). Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-SHAPE`. Proposed schema/generator: `3/3`.

## Problem, flow and scope

Create relief that is visually varied but remains editable native CAD. Choose a
surface family, adjust height and shape, inspect the accepted solid and warnings,
and export without a second geometry path. The surface controls heights; the
shape controls each part's cross-section and top. Movement is a later independent
field. Imported image relief belongs to phase 09.

All formulas here are original **Printametric proposals**, not an existing algorithm
contract. Implementation planning must freeze sample fixtures and native-CAD
construction tolerances before approval. Do not accept a mesh-only implementation.

## Parameters

Layout/numbering and C2 seed persist. `minimumRelief` replaces phase 01 reliefHeight
through an explicit migration; `topRatio` changes from X-only blade taper to the
homothetic top contract below, so this is a generator version change, not a rename.

| Parameter | Type | Default | Range / step / unit | Meaning |
| --- | --- | --- | --- | --- |
| topRatio | number | 0.12 | 0.1–1 / 0.01 / ratio | Uniform top footprint scale about its interior anchor |
| stepBlend | number | 1 | 0–1 / 0.01 / ratio | 1 cell-flat tiers; 0 continuous sampled top |
| planarTops | boolean | false | true/false | When blend<1, replace each curved top with one fitted plane |
| minimumRelief | number | 20 | 0–120 / 1 / mm | Relief height above plinth before surface contribution |
| concavity | number | 2.2 | 1–4 / 0.1 / exponent | 1 straight flank; larger values curve the flank |
| plinthEnabled | boolean | true | true/false | Include baseThickness as a per-part plinth |
| family | enum | wave | wave, dunes, ring, dome, spiral, ridges, random | Normalized height field |
| depth | number | 30 | 0–200 / 1 / mm | Surface amplitude |
| density | number | 2 | 0.2–12 / 0.1 / cycles | Spatial frequency; inactive for dome |
| rotation | number | 0 | 0–360 / 1 / degrees | Field rotation about panel center; 360≡0 |
| phase | number | 0 | 0–1 / 0.01 / cycle | Field progression; 1≡0 for periodic families |
| spiralArms | integer | 5 | 1–16 / 1 / count | Active only for spiral |
| seed | integer | 1 | 1–9999 / 1 / none | Stochastic field stream; not time-varying noise |

Inactive values are validated and retained, not applied. State their no-effect
conditions: dome ignores density/phase/rotation; ring ignores rotation; seed changes
only dunes/ridges/random here; depth=0 makes all family controls height-inactive;
blend=1 makes planarTops inactive. Narrow tops often make stepBlend differences
weak, especially topRatio<0.4; explain this, do not disable a meaningful control.

## Normalized field contract

Evaluate in assembly XY. Let `(u,v)=(x/width,y/height)` and rotate these normalized
coordinates by **minus** rotation to get `(a,b)`. Thus positive rotation rotates
the visible pattern counterclockwise. Independent normalization deliberately
stretches patterns with panel aspect ratio. Let `r=2*sqrt(a²+b²)`, `theta=atan2(b,a)`
(0 at the origin), `d=density`, `p=phase`, and `s(t)=sin(2πt)`. Clamp field results
to [0,1] only at the stated formula boundary, never to conceal nonfinite values.

| Family | Proposed normalized field F | Observable character |
| --- | --- | --- |
| wave | `(1+s(d*a+p))/2` | Parallel smooth ridges; density is cycles across normalized width |
| dunes | `(1 + (s(d*a+p+q1)+0.5*s(0.7*d*b-p+q2)+0.25*s(0.6*d*(a+b)+q3))/1.75)/2` | Unequal smooth undulations; q1–q3 are seeded phases in [0,1) |
| ring | `(1-cos(2π*d*r))/2` | Depressed center and concentric annular highs; phase inactive to preserve center |
| dome | `max(0,1-r²)` | Central high point, zero at normalized radius≥1 |
| spiral | `(1+cos(spiralArms*theta-2π*d*r+2π*p))/2`, blended to 0.5 within r<0.02 | Exactly stated angular arm count, smooth central singularity treatment |
| ridges | `1-abs(2*fract(d*a+0.2*s(d*b+q1)+p)-1)` | Seeded bent triangular-profile bands, sharper than wave |
| random | `0.5 + sum(k=1..6, Ak*sin(2π*(fxk*a+fyk*b+p+qk)))/(2*sum Ak)` | Smooth seeded hills, with Ak=1/k, seeded frequency directions of magnitude d*(0.5+k/6) |

`fract` is value minus floor, including negative inputs. q values and directions
come from the frozen relief substream. Ring phase is explicitly inactive; do not
shift it silently and lose the depressed center. Random phase repeats at 1 while
its spatial edges need not tile. Dunes phase repeats because its phase coefficients
are integers (±1/0). No family promises seamless tiling at the panel outline.
Normalize analytically as above, not by sampled min/max, so adding a clipped cell
does not rescale the heights of every other part. Nonfinite evaluation rejects.

## From field to solid

For each base footprint choose its area centroid if interior; otherwise the
deterministic maximum-inscribed-circle center with lexicographic tie break. That
anchor must be stable in exported metadata. Phase 02's convex built-ins simplify
this; phase 09 must qualify concave/hole-containing cells separately.

Define each cell's scalar mean `M` by area-weighted deterministic quadrature over
its base footprint, with error ≤0.001 normalized units. At a top location, normalized
height is `H=stepBlend*M+(1-stepBlend)*F(x,y)`. If planarTops is true and blend<1,
use an area-weighted least-squares plane fit to H, then constrain that plane over
the full top domain to [0,1]. If a valid constrained fit cannot be found, reject,
not silently curve it. Freeze quadrature/refinement and plane-fit fixture tolerances
with this generator version. Vertex-only averaging is not equivalent to area mean.

Top Z is `(plinthEnabled ? baseThickness : 0) + minimumRelief + depth*H`.
The quoted “overall depth” is the actual maximum-minus-minimum Z of all canonical
solids, not necessarily base+minimum+depth if F never reaches 1 in retained cells.

The top footprint is a uniform homothety by topRatio about the anchor. For flank
parameter t from 0 at relief base to 1 at top, proposed footprint scale is
`topRatio+(1-topRatio)*(1-t)^concavity`; interpolate Z to the local top. With
concavity=1 and flat tops this gives ruled straight sides. Larger exponents give
a narrowing lower flank then a steeper rise. Use native trimmed/spline CAD faces
with C4 approximation bounds; section sampling is not permission for faceted STEP.
Minimum material/tip thickness and self-intersection checks remain authoritative.

Depth=0 keeps layout/colour/movement eligibility but removes surface amplitude.
With zero relief everywhere and plinth enabled, generate only the plinth and
report shape controls inactive. With plinth disabled, minimumRelief=depth=0 is
invalid. A top touching Z=0 anywhere without a sufficient continuous 1.2 mm solid
thickness is invalid. Do not manufacture a hidden floor or silently raise heights.
Engraving must leave the same floor even without a plinth; unnumberable rules from
02 apply. Movement later shifts tops but uses this same canonical construction.

## UI and failure states

Separate Shape from Surface in the single Gridline settings area. Surface common
controls: family, depth, density. Shape common controls: minimum height, top ratio.
Advanced fields remain discoverable with contextual help and retained inactive
values. Numeric entry and sliders share the same accepted value and formatting.
Do not round labels differently from fields. A normalizer may display precision
without changing saved values; C3 controls validation.

During generation show the candidate family and pending label, not an unvalidated
height map as printable geometry. On top collapse, impossible constrained plane,
bad solid, collision or exceeded budget, retain C3 accepted state and link errors
to the parameter and affected IDs. Surface colour previews must not bypass CAD
validation to make an invalid model appear accepted.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-SHAPE-AC-1 | All seven fields return finite [0,1] heights and stated shapes | Dense analytic sample fixtures at density0.2/12,phase0/1,seed1/9999 and every spiral arm count1–16; reviewed original visual fixtures; coarse cell sampling may hide arms but cannot change the field's angular frequency |
| WA-SHAPE-AC-2 | Rotation/phase equivalence and inactive controls follow the contract | 0/360 and 0/1 comparisons; dome/ring/seed no-effect tests; rectangular aspect-ratio samples |
| WA-SHAPE-AC-3 | Flat tiers use area means; continuous and planar tops obey blend and plane rules | Unequal clipped-cell fixtures, blend 0/0.5/1; analytic wave means and plane residual checks |
| WA-SHAPE-AC-4 | Taper and concavity preserve minima and native curved surfaces without hidden floors | Ratio 0.1/1, concavity 1/4, minimum 0/120 and depth 0/200 CAD/mesh tests |
| WA-SHAPE-AC-5 | Depth zero preserves layout; degenerate no-plinth designs reject and retain prior revision | Zero-amplitude and thickness threshold fixtures; invalid import/browser recovery |
| WA-SHAPE-AC-6 | All formats share accepted shape, actual depth, IDs and units | Curved/cell-flat/planar fixtures independently imported in CAD reader and slicer |
| WA-SHAPE-AC-7 | Inactive/weak-effect notices, sliders and inputs work at 320 px and by keyboard | Browser family-switch and error-recovery journeys, both themes, actual 200% zoom |
| WA-SHAPE-AC-8 | Worst supported high-density curved design respects C4 and cancels safely | Measured qualification matrix; tessellation budget boundary/timeout and resource disposal |

## Documentation impact and unresolved decisions

### Stories and required implementation tests

QA owns `tests/wall-art-shape-surface.test.mjs` and
`tests/browser/wall-art-shape-surface.spec.ts`. Complete all linked criteria and
N/B/I/E tests in `npm run check`, plus the stated manual evidence.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-SHAPE-ST-1 — Select and tune every field | WA-SHAPE-AC-1/2/3 | Node: N analytic samples for all seven families and every arm count1–16; B density0.2/12,phase0/1,rotation0/360,arms1/16 and blend0/0.5/1; I nonfinite/unknown family rejects; E failed plane/quadrature evaluation preserves result. Browser independently exercises every family,arm count and conditional field. Reviewed visual fixtures supplement analytic checks. |
| WA-SHAPE-ST-2 — Produce valid shaped CAD | WA-SHAPE-AC-4/5/6/8 | Node: N native curved/planar/flat solids and three reimports; B ratio0.1/1,concavity1/4,height0/120,depth0/200; I zero-volume/thin/no-plinth candidate blocks; E kernel/tessellation budget/timeout retains accepted digest. Measure C4 worst cases; actual slicer inspection remains additional. |
| WA-SHAPE-ST-3 — Explain and recover conditional controls | WA-SHAPE-AC-7 | Browser: N keyboard slider/input parity; B narrow top weak-effect and all inactive combinations; I invalid retained inactive value rejects import; E generation failure opens relevant control without losing previous values.320 px/real zoom automated; AT/visual review separately recorded. |

`docs/product.md`/`docs/mvp-roadmap.md`: approve additional families and new shape
semantics. `docs/architecture.md`: link frozen field/quadrature/native-surface
contracts; no stack change. `README.md`: shape/surface examples and no-effect help.
`docs/development.md`: field fixtures and curved-face round trips. No setup or
LICENSE change unless new permitted assets are selected. Before this phase's plan
approval, freeze PRNG vectors, quadrature, constrained fit and CAD construction;
prove maximum-density native faces fit C4. Do not call those decisions completed.

## Implementation steps and handoff

Approve mathematical fixtures, then headless fields and shape solids, then repeat
all formats, then expose controls. Geometry owns AC-1–6/8 and reports actual depth,
field samples and diagnostics. Frontend owns AC-7 and C3 state transitions. QA
checks analytical fixtures separately from screenshots; a pleasing image is not
proof of valid CAD. Exit needs all families, zero/maximum cases and explicit
qualification of the advertised tier, not only a successful default wave.
