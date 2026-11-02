# Wall art 04 — movement fields and plan editing

Status: **DRAFT for user review; proposed expansion.**
Depends on [03](wall-art-shape-surface.md). Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-MOVE`. Proposed schema/generator: `4/4`.

## Problem and flow

Let a maker direct the relief with a small set of understandable influences rather
than edit every part. Open Plan in Design, add/select a point, adjust its type,
position and strength, inspect base-to-top directions and canonical results, then
return to 3D. The same edits must be possible without dragging or using the canvas.

Included: zero to eight points, selection/add/clone/remove, one-action undo, three
field types, explicit field composition, directional jitter and visible supported-tip
adjustment. Excluded: freehand vector painting, arbitrary scripts and mechanical
guarantees about overhangs. All defaults and formulas are Printametric proposals.

## Parameters

The point list defaults to empty. Add creates a swirl at `(0,0)` unless a plan click
supplies a position. Assign a new stable opaque point ID, ASCII 1–64 characters,
unique within the design. IDs persist through edits; clone always has a new ID.

| Point parameter | Type | Default | Range / step / unit | Applicability |
| --- | --- | --- | --- | --- |
| type | enum | swirl | swirl, magnet, flow | All |
| x, y | number each | 0 | ±width/2, ±height/2 respectively / 1 / mm | Center in assembly XY |
| strength | number | 1 | -10–10 / 0.1 / ratio | Negative reverses the complete vector; zero neutral |
| lean | number | 1 | 0–3 / 0.05 / ratio | 0 upright; 1 top anchor reaches base boundary at saturated strength |
| radius | number | 0.33×min(width,height) | 20–2000 / 5 / mm | Swirl/magnet core region |
| fade | number | 0.17×min(width,height) | 50–2000 / 5 / mm | Swirl/magnet outer transition width |
| opening | number | -0.85 | -1–1 / 0.05 / ratio | Swirl: negative outward, zero tangent, positive inward |
| direction | number | 0 | 0–360 / 5 / degrees | Flow: 0 right, 90 up, 360≡0 |
| bandwidth | number | 0 | 0–max(width,height) / 10 / mm | Flow: 0 whole panel; otherwise full band width |

Derived defaults clamp only **at point creation** to their ranges: at 500 mm,
radius=165 and fade=85; at 80 mm, fade=50. Store exact created values. UI step is
an increment, so creation need not round to multiples of 5. Drag and numeric entry
use one formatting policy (up to 2 decimals in mm); label and field always agree.

| Global parameter | Type | Default | Range / step / unit | Meaning |
| --- | --- | --- | --- | --- |
| directionalJitter | number | 0 | 0–1 / 0.01 / ratio | Seeded angular perturbation of a nonzero field |
| calmRing | boolean | false | true/false | Smoothly suppress swirl center and add a raised annular contribution |
| sharpenStrongTips | boolean | false | true/false | Reduce top ratio in strong fields within material minima |
| shortenUnsupportedTips | boolean | true | true/false | Enable declared displacement reduction before validity checks |
| maximumLeanAngle | number | 30 | 0–60 / 1 / degrees from vertical | Applies only when shortening enabled |

Unlike a simplified toggle, enable and angle have independent explicit meanings.
Disable shortening retains the angle but does not apply it. Angle zero with it
enabled forces upright tops; it does not mean disabled. There is no implied
printer-support guarantee at any angle.

## Original field composition contract

At each base anchor P and point center C, let D=P−C, r=|D|. At r=0 the point's
radial/tangent vector is zero; do not normalize a zero vector. Else outward unit
R=D/r and counterclockwise tangent T=(-Ry,Rx). Let smoothstep(t)=t²(3−2t) for
clamped t∈[0,1]. Radial influence weight w=1 for r≤radius and
`1-smoothstep((r-radius)/fade)` outside, reaching 0 at radius+fade.

- Swirl vector is `w*((1-|opening|)*T-opening*R)`. The vector intentionally has
  reduced magnitude between pure radial and tangent modes; do not renormalize it.
- Magnet vector is `-w*R`; positive attracts, negative repels.
- Flow direction U=(cos(direction),sin(direction)). For bandwidth=0 weight is 1.
  Else use perpendicular distance q to the centerline through C parallel to U,
  weight `1-smoothstep(2*q/bandwidth)`; outside half-bandwidth it is 0.

Multiply each vector by strength×lean. Sum in stable point-ID order with a fixed
numeric summation method. The result is independent of list display order. Competing
equal/opposite points cancel. Saturate the sum magnitude to 3 (preserve direction).
Apply seeded per-part angular jitter bounded by ±30°×directionalJitter; zero vector
stays zero. No movement points or zero strengths mean jitter has no effect.

Let L be the distance from base anchor to its boundary along the final direction.
Requested top-anchor displacement is `L*min(3,|sum|)` in that direction. Therefore
an isolated unit-strength/unit-lean point at full pure-vector weight reaches the
base boundary; mixed opening or faded fields may not. With lean>1 it can overhang.
The relief's local height and top shape remain from phase 03.

When calmRing is enabled, each swirl suppresses its own vector by
smoothstep(r/(0.25*radius)). Add a normalized height contribution
`0.15*max(0,1-|r-0.5*radius|/(0.25*radius))`, multiplied by min(1,|strength|).
Use the maximum contribution across swirls, not an unbounded sum. Add to phase 03's
normalized H and clamp at 1 **as part of this declared rule** before multiplying
depth. No swirl/zero strength/depth=0 produces no ring height change. This is a
proposed visible modifier, not a hidden minimum-height increase.

With sharpenStrongTips, effective topRatio is
`topRatio*(1-0.5*min(1,|sum|))`, limited upward as needed to preserve the 1.2 mm
minimum width. Report requested/effective ratio and limiting IDs. If even the
unsharpened shape cannot satisfy minima, reject. No ideal singular tips.

## Adjustment, collision and print contract

If shortening is enabled, cap displacement to
`reliefHeightAtAnchor*tan(maximumLeanAngle)`. This explicitly shortens lateral reach,
not surface height or the number of parts. Report adjusted count and each part's
requested/effective displacement and angle. Canonical solids, plan arrows, preview,
all exports and manifest use the same effective values. A warning cannot be replaced
by an export-time repair. The checkbox name/help must explain this operation.

After that cap, construct native solids and check C4 minimum separation against
neighbors, self-intersection, thickness and bounds. Use conservative broad-phase
bounds then exact/qualified narrow-phase checks. Irreparable collision rejects the
candidate, identifying both part IDs. Do not repeatedly shrink parts until a layout
appears valid. When shortening is disabled, still reject invalid geometry; report
potential unsupported overhang separately from CAD validity. Support requirements
depend on material/orientation/slicing and remain an estimate.

Panel resize scales point x by newWidth/oldWidth and y by newHeight/oldHeight;
radius, fade and nonzero bandwidth scale by min-dimension ratio. A value exceeding
its new range rejects the combined resize with a clear recovery action; do not
silently clamp saved point geometry. Numeric point edits outside the nominal panel
are invalid even for whole-cell outer boundaries. Resize is one history action.

## Plan interaction and accessibility

Plan is a view mode within Design, not another project or shell route. It draws
accepted base contours, IDs/colours and actual base-to-top direction arrows. Show
pending overlay handles separately from accepted contours while generating.
Empty-space click adds a point at the transformed assembly coordinate only in an
explicit “Add point” mode; Escape cancels this mode. Selection/panning never adds.

Selected point exposes center handle, radius ring and outer fade ring for applicable
types. Center drag changes x/y, inner ring changes radius, outer ring changes fade
as outerDistance−radius; each preserves other values. Commit on pointer release,
one undo entry; Escape/pointer cancellation restores the pre-drag candidate. Preview
drag updates may coalesce, never bypass validation. Clamp the pointer preview to
the legal handle interval and show that bound; numeric invalid text remains an error.

Point list supports Select, Add, Clone and Remove as ordinary labelled buttons.
At eight, Add/Clone are disabled with “8 of 8 points”; keyboard users can read why.
Clone starts at the same position with a new ID and selected copy, not a hidden
offset. Removing the last point is valid. Immediate Undo restores one whole action
before the full phase 06 history arrives. Type changes retain and validate inactive
fields. Numeric x/y/radius/fade are the complete alternative to handles.

At 320 px, Plan uses the full-width preview area; the existing bottom settings panel
remains scrollable and does not resize the canvas. The mode switch and point list
remain reachable. Touch gestures begin only on the plan/handles, never capture
scrolling of controls, and have cancellation. Provide a non-canvas part/point list.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-MOVE-AC-1 | Zero/eight points work; ninth, duplicate ID and invalid numbers reject before CAD | Boundary validators and browser add/clone/remove/undo journey |
| WA-MOVE-AC-2 | Sign, opening, center singularity, radius/fade and flow band follow the formulas | Vector fixtures at center/radius/outer edge, opening -1/0/1, strength -10/0/10 |
| WA-MOVE-AC-3 | Composition is list-order independent; cancellation, jitter and lean semantics are stable | Permuted-point fixtures, equal-opposite pairs, lean 0/1/3, seeds 1/9999 |
| WA-MOVE-AC-4 | Calm ring/tip shaping use declared bounds and no-effect conditions | Height/ratio comparison fixtures; zero depth/no swirl/minimum-width diagnostics |
| WA-MOVE-AC-5 | Enabled+angle 0/30/60 produce explicit shared adjustments; disabled retains angle only | Native CAD/mesh comparison, per-part diagnostics and all-format reimports |
| WA-MOVE-AC-6 | Colliding or self-intersecting solids are rejected with IDs; no export repairs occur | Adversarial adjacent overhang fixtures, C4 clearance threshold and exporter sentinels |
| WA-MOVE-AC-7 | Center/radius/fade drags are independent, numerically reproducible and each undo once | Pointer and numeric parity: center (85,-60), radius 85, fade 150; cancel and exact label checks |
| WA-MOVE-AC-8 | Resize scales the entire point state or rejects it atomically; previous state survives | Wide/narrow/80/2000 panel fixtures, out-of-range fade/bandwidth, undo |
| WA-MOVE-AC-9 | Plan editing has full keyboard/320 px/zoom access without stealing form scroll | Browser, physical touch and screen-reader journeys; record unverified platforms honestly |
| WA-MOVE-AC-10 | Eight competing fields at the advertised part tier meet C4 or reject safely | Worst-case timing/memory, cancellation and repeated worker/GPU disposal checks |

## Documentation impact and open decisions

### Stories and required implementation tests

QA owns `tests/wall-art-movement.test.mjs` and
`tests/browser/wall-art-movement.spec.ts`. Each linked criterion and N/B/I/E test
must run through the shared gate; actual touch/slicer evidence is additional.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-MOVE-ST-1 — Compose all influence types | WA-MOVE-AC-1/2/3/4/8 | Node: N each type and opposite-pair cancellation; B0/8 points,all field endpoints,flow bandwidth0 and resize80/2000; I9 points/duplicate ID/nonfinite/resize overflow reject; E stale field result cannot commit. Browser Add/Clone/type change confirms retained inactive values and limit feedback. |
| WA-MOVE-ST-2 — Keep moved tips valid and explicit | WA-MOVE-AC-5/6/10 | Node: N requested/effective shortening metadata matches all exports; B enabled angle0/30/60,disabled retained angle,clearance threshold; I collision/self-intersection blocks; E timeout/failed narrow-phase retains prior model and frees resources. Manual physical-support claims remain unverified without authorized evidence. |
| WA-MOVE-ST-3 — Edit plan by pointer or keyboard | WA-MOVE-AC-7/9 and point-action AC-1 | Browser: N center/radius/fade drag versus equal numeric inputs, both Remove actions; B8 disables Add/Clone,zero removes selection; I out-of-range numeric draft never mutates point; E pointer cancellation/Escape/failed generation restores pregesture state. Assert one undo and equal displayed precision;320 px/zoom, manual touch/AT. |

Product/roadmap: approve movement as expansion. Architecture: document field and
canonical-adjustment metadata, not a new renderer geometry path. README: plan
editing, angle meaning and physical-support limitations. Development: vector,
collision, drag and resource fixtures. No dependency/setup/LICENSE change is assumed.
Exact native loft behavior and reliable clearance checks must be resolved in this
phase's reviewed technical plan. Approval of formulas and fixture appearance is
still needed; visual inspection alone cannot close CAD validity criteria.

## Implementation steps and handoff

Freeze field fixtures and version migration, verify headless deformation and
clearance, then integrate plan controls and round trips. Geometry owns AC-2–6/8/10;
frontend owns AC-1/7–9 and stable point UI IDs. QA tests both against the same accepted
revision/adjustment records. Exit requires all field types and cancellation/error
paths, not only draggable handles or an attractive preview.
