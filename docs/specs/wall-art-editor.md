# Wall art 05 — integrated editor, colours and original presets

Status: **DRAFT for user review; functional integration, not a Gridline redesign.**
Depends on [04](wall-art-movement.md). Authority: [suite](wall-art.md).
Acceptance prefix: `WA-EDIT`. Proposed model schema/generator: `5/4`.

## Problem and user journey

A maker needs to understand how size, layout, shape, surface, movement and colour
combine without losing the model or the recovery path. Start with a valid design,
try a starter, edit the relevant section, inspect Plan/3D and statistics, then save
or export. This phase completes editor behavior; phase 06 supplies the full library
and durable history, and phase 08 supplies print-ready kits.

Confirmed: preserve the blue Gridline header, full-width preview, one bottom
Workspace settings disclosure, existing theme/grid/tips and Help/About patterns.
Proposed: functional groups, colour rules, catalogue, room scene and preview tools.
Existing foundation does not implement wireframe; this phase proposes it as a
preview-only tool rather than claiming an existing working control.

## Functional layout

```text
Gridline header: Design | Print layout | Assembly | theme | Help | About
Design heading   [3D / Plan] [Fit] [View controls]   revision / pending status
┌──────────────────── full-width preview ─────────────────────────────────┐
│ accepted model, selected part/point, or honest unavailable/error state   │
│ [room view]                     visible errors and recovery actions     │
└────────────────────────────────────────────────────────────────────────┘
▸ Workspace settings  ·  Dimensions / Parts / Plates status
  Project / Starters / Size / Layout / Shape / Surface / Movement / Colour
  Mounting when available / Build plate / Display / numeric summaries
```

The panel overlays rather than resizes the canvas. Groups use responsive columns,
then one column at narrow width. Use section selection or in-panel disclosure for
advanced fields without introducing a second outer drawer or fixed side rail.
This is a proposed refinement of the foundation's no-nested-Advanced rule; the
reviewed UI plan must resolve the exact native control pattern. Errors remain
outside collapsible content with Review actions that open and focus their fields.
Build-plate dimensions remain reachable from Design from the start; until phase 08
they may be editable preferences but must say fit/plate counts are unavailable.

## Colour parameter contract

| Parameter | Type | Default | Range / step / unit | Semantics |
| --- | --- | --- | --- | --- |
| bandCount | integer | 3 | 1–8 / 1 / count | Active palette slots |
| assignment | enum | height | height, gradient, random | Per-part colour-group rule |
| gradientAngle | number | 0 | 0–360 / 5 / degrees | 0 left-to-right, 90 bottom-to-top; 360≡0 |
| colours | array of 8 slots | first 3: #245A81, #D9A45B, #E5E0D5; remaining #808080 | Exactly 8 canonical #RRGGBB strings | Inactive slots retained, not exported as used material |
| frameColour | hex string | #808080 | #RRGGBB | Independent material group; active when frame exists |
| colourSeed | integer | 1 | 1–9999 / 1 / none | Independent saved random-assignment seed |
| selectedBand | integer, UI only | 1 | 1–bandCount / 1 / index | Editing selection, not geometry |

Slots have stable IDs `colour-1`…`colour-8`; frame uses `frame-colour`. User labels
are optional strings, default “Colour n”, trimmed 1–40 Unicode characters, no markup.
Colour IDs are not RGB values: duplicate swatches remain distinct groups unless
the user explicitly merges them in a later feature. No merge is included here.

Height assignment uses each part's normalized surface mean H before colour edits,
including the declared calm-ring modifier, not lighting or absolute base thickness.
Map t∈[0,1] to `min(bandCount-1,floor(t*bandCount))+1`. Depth zero uses the retained
normalized field, so colour patterns can remain while geometric relief is flat.
Gradient projects part anchor onto U=(cos(angle),sin(angle)), normalizes using the
nominal rectangle's min/max corner projections, then uses the same band rule.
Random uses a stable hash of colourSeed and partId to choose an unbiased integer
band. Planning freezes hash/test vectors; list order must not change assignments.

Select a swatch to edit hex or choose an original palette group. Reverse swaps
only active slot colours/labels, not IDs or geometry. Palette randomize picks and
records a new colourSeed and a complete active palette from an approved original
fixture set; assignment randomization changes seed only. Present these as distinct
actions. A lower bandCount retains inactive colours but removes them from used
counts/files. Show both configured and actually used counts, including unused
active slots. Frame colour is never part of bandCount.

Colour edits change an accepted presentation/material revision atomically without
rerunning CAD when geometry is unchanged. They invalidate colour grouping, packing
and kit snapshots, not canonical solid ownership. Part colours and exports use
the same captured revision. STL has no colours; supply group labels through files
or manifest. 3MF material metadata needs compatible-reader verification.

## Original preset and random-design contract

Provide six starter shortcuts and an expandable catalogue of23 original presets
in three groups. The count is a coverage requirement, not permission to reuse any
external names, definitions or values. Author original names, values and palette combinations. Categories
describe Movement, Shape and Surface, not third-party branded styles.

Required fixture coverage (some presets may cover more than one row):

| Family | Required coverage |
| --- | --- |
| Movement | one swirl, multiple spiral-like directions, inward/outward magnet, two competing centers, calm center/ring, radial burst |
| Shape | slanted prisms, safely overhanging blades, pyramid-like truncated tips, frustums, stepped wave, blended narrow tops, concave flanks |
| Surface/colour | dunes, smooth tops, annular highs, sharp bands, seeded random colours, spiral height, seeded hills, directional gradient |

The proposed original catalogue below assigns every entry an independent fixture.
Recipes describe intended behavior; exact valid numeric definitions must be frozen
and approved during planning, then tested individually. Do not replace23 fixtures
with six screenshots or count aliases as additional presets.

| ID | Original working title | Required distinct recipe coverage |
| --- | --- | --- |
| M1 | Turning field | Single swirl |
| M2 | Swept arms | Several directed arms composed from fields |
| M3 | Gathering field | Inward magnet |
| M4 | Opening field | Outward magnet |
| M5 | Paired currents | Two competing centers |
| M6 | Quiet center | Swirl with calm center and raised ring |
| M7 | Ray field | Radial outward movement |
| M8 | Inward fins | Broad blades directed toward the center, visually distinct from the narrow attracting forms in M3 |
| S1 | Inclined blocks | Leaning full-width prisms |
| S2 | Layered blades | Overlapping-looking but separated blade silhouettes |
| S3 | Small summits | Pyramid-like truncated tops |
| S4 | Broad summits | Upright frustums |
| S5 | Terrace wave | Flat tiered wave |
| S6 | Blended spires | Narrow blended tops |
| S7 | Curved flanks | Visible concave sides |
| F1 | Uneven dunes | Seeded smooth dunes |
| F2 | Continuous tide | Continuous smooth wave tops |
| F3 | Annular rise | Depressed center with raised ring |
| F4 | Broken ridges | Seeded sharp bent bands |
| F5 | Scattered tones | Seeded random band colours |
| F6 | Winding relief | Spiral height field with explicit arm count |
| F7 | Soft hills | Seeded random smooth heights |
| F8 | Directional tones | Directional colour gradient over a dome |

The six home starters reference M1,M3,S1,S4,F1,F5, not duplicated definitions.
Each has its own keyboard activation and resulting-preset assertion. Every catalogue
entry has its own generation, round-trip, parameter and expected-appearance fixture.

Every fixture has a stable preset ID/version, original title ≤60 characters,
description ≤160, full model definition, rights/provenance record and a verified
valid default result within the advertised tier. No preset is exempt from checks.
“Pyramid-like” still respects minimum tip width. Overlapping-looking silhouettes
must not contain intersecting solids.

Apply preset replaces layout/shape/surface/movement/palette and seed but preserves
current dimensions, frame settings, printer preferences and project identity/title.
Normalize preset point coordinates to the current panel size; validate the complete
candidate before commit. If incompatible, explain and offer explicit “Use preset
size” as a separate candidate; never silently replace dimensions. A new preset
baseline snapshot includes the actual accepted adapted values for all resettable
sections. Reset Section uses that saved baseline; with no preset it uses factory
defaults. Palette is included. See phase 06 history/baseline storage contract.

New creates a separate unsaved project with factory dimensions and no frame,
preserving printer preferences and theme. Random design chooses an explicit seed
and an original validated recipe, not unconstrained arbitrary values; it preserves
dimensions/frame/printer and replaces the same sections as a preset. Name it as a
new random baseline; list changes before commit when destructive. Each apply/reset/
random action is one undoable transaction. Failure leaves current design/baseline
unchanged. No surprise action silently saves over a library record.

## Preview-only parameter contract

| Control | Type/default | Bounds / step | Behavior |
| --- | --- | --- | --- |
| mode | enum, 3D | 3D/Plan | Plan is phase 04; no route/geometry change |
| cameraPreset | enum, isometric | isometric/front/side | Front looks along -Z with +Y up; side from +X; iso sees front/top/right |
| lightAzimuth | number, 120° | 0–360 / 5° | Presentation light only |
| lighting | enum, inspection | inspection/presentation | Inspection avoids colour/shadow concealing boundaries |
| componentView | enum, assembled | assembled/exploded/frame-only | Frame-only available only with generated frame |
| showFrame | boolean, true | true/false | Visibility only; does not omit frame from requested exports |
| wireframe | boolean, false | true/false | Overlay accepted mesh edges, not a different mesh |
| explodeDistance | number, 20 mm | 0–100 / 5 mm | Display offset along +Z by component group |
| roomView | boolean, false | true/false | Preview-only presentation mode |

Orbit/pan/zoom with pointer/touch plus labelled keyboard buttons for yaw/pitch
(15°), pan (10% of current view span), zoom (factor 1.2) and Fit. Keep pitch away
from a singular pole and clamp camera distance to 0.1–20 times assembly diagonal;
Fit includes actual overhang/frame bounds. No global arrow shortcuts in text fields.
Selection works through a parallel ID list. Fit resets camera, not the design.

Room view uses a simple original 3000×2400 mm wall and optional original 600×750 mm
reference object, with labelled dimensions. Panel is shown at actual mm scale,
centered at 1500 mm above floor unless a preview-only numeric height (0–2400 mm,
step10) is set. Reject placement that extends beyond the room wall or say it does
not fit; never silently scale the art. No external photos/assets or camera uploads.
Room mode hides editing controls, retains Exit and Edit panel, dimensions and preview warning,
and restores prior camera, panel state and opener focus on exit. Back exits room
before leaving Design; route-extension review with phase 06 is required. Escape
also exits. Do not serialize room state in editable model or print kit.

## Statistics and application states

Show accepted part count, active/used colours, nominal/actual dimensions, overall
Z depth, triangle count and separate decorative/frame volume. Weight estimate is
`volume(mm³)/1000*density(g/cm³)` for solid material: density number default1.24,
range0.5–3, step0.01 g/cm³. Label “Solid-material estimate; excludes infill changes,
supports, brim, purge and waste”. Do not claim sliced consumption or validated
accuracy. Frame weight stays separate; unknown density yields unavailable, not zero.
Reports use the same assumptions. Density changes do not rebuild CAD.

States: initializing, generating, accepted, invalid draft, generation failed,
cancelled, export preparing/failed/ready, WebGL unavailable/lost and worker unavailable.
Keep last valid model visibly stale when appropriate; never show pending counts
as current. WebGL context loss frees/rebuilds preview resources but does not discard
the worker design. Error and cancellation paths follow C3. Tips off never hides
constraints/no-effect notices, warnings or recovery.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-EDIT-AC-1 | Gridline keeps one outer drawer, stable full-width canvas and reachable functional groups | Both-theme screenshots/geometry assertions at 320/390/768/1280/1920 and short height |
| WA-EDIT-AC-2 | Every band count1–8, each band selector, height/gradient/random, reverse and unused slots follow exact rules | Eight count cases,every selectable slot,assignment fixtures,angle0/90/360,duplicate colours,invalid hex/count/seed tests |
| WA-EDIT-AC-3 | Colour changes do not invoke CAD/export serialization; snapshots retain correct IDs/materials | Worker/export spies; colour edit during generation/export; manifest comparisons |
| WA-EDIT-AC-4 | All23 original presets and six starter shortcuts cover required families, preserve declared values and set correct reset baselines | Parameterized23 generation/round-trip/UI cases plus six starter actions; apply/failure/Use preset size/undo journeys |
| WA-EDIT-AC-5 | New/random actions do not overwrite another project and record reproducible seeds | Action-state tests and reload through phase 06; no-global-random sentinel |
| WA-EDIT-AC-6 | Camera/component/light/wireframe changes affect no geometry or file content | Numeric digest comparison and all-format exports before/after preview changes |
| WA-EDIT-AC-7 | Room view preserves actual scale and restores focus/camera/panel on Exit/Escape/Back | Dimension checks, out-of-wall case and browser history/keyboard journey |
| WA-EDIT-AC-8 | Counts, bounds and estimates use the accepted revision with visible assumptions | Analytical volume fixtures, frame separate, pending/failure/unknown density tests |
| WA-EDIT-AC-9 | Full editing works by keyboard, at 320 px and genuine 200% zoom with visible independent errors | Browser journeys, contrast/forced-colours checks, screen-reader and touch evidence |
| WA-EDIT-AC-10 | WebGL loss/unavailability and CAD failure preserve editable/exportable state appropriately | Context-loss fixture, worker-error fixture, resource counters and recovery actions |

## Documentation impact and decisions

### Stories and required implementation tests

QA owns `tests/wall-art-editor.test.mjs` and
`tests/browser/wall-art-editor.spec.ts`. Every original preset is a separate runnable
parameterized case, not one representative visual fixture. Use the suite's shared
gate and completion contract.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-EDIT-ST-1 — Edit all colours and original presets | WA-EDIT-AC-2/3/4/5 | Node: N three colour modes,every band count1–8 and each of23 preset definitions round-trip; B1/8 bands,all active/inactive slots,six starter aliases; I bad hex/count/seed or incompatible preset rejects atomically; E palette/preset failure preserves baseline and prior document. Browser every count and band selector,23 preset activations+six starters,reverse/random/reset; no CAD for colour-only edits. Review each visual fixture,including distinct M3/M8 inward forms,not just starters. |
| WA-EDIT-ST-2 — Inspect the model without changing it | WA-EDIT-AC-6/7/8 | Node/browser: N iso/front/side,orbit/pan,explicit zoom+/−,Fit,assembled/exploded/frame-only,light/wireframe,room Exit/Edit panel; B light0/360,estimate density limits,room boundary; I bad preview values do not dirty/export; E room Back/context failure restores camera/focus. Assert export geometry digest unchanged. Original room scale/appearance reviewed manually. |
| WA-EDIT-ST-3 — Operate the full Gridline editor | WA-EDIT-AC-1/9/10 | Browser: N keyboard complete design journey; B320 px,short height,real200% zoom,both themes; I closed-group errors stay reachable; E WebGL loss/CAD failure retains accepted state and resources recover. Automated contrast/focus plus manual AT,touch and owner visual signoff. |

`docs/specs/website-foundation.md`: replace only unavailable statements for shipped
features; explicitly review in-panel advanced-group refinement. `docs/architecture.md`:
material revision versus geometry revision and room/navigation state boundaries.
Product/roadmap: approve original presets, room view and colour scope. README:
editing/preview/estimate usage. Development: screenshot matrix, context-loss and
no-serialization tests. No new setup dependency is assumed; palette/room/glyph
rights need records, root LICENSE unchanged. Open: exact control disclosure pattern,
catalogue fixture approval, room-history integration and colour hash test vectors.

## Implementation steps and handoff

Approve functional integration within Gridline, then colour/preset pure contracts,
preview controls and full error/accessibility journeys. Frontend owns AC-1–10 UI
and preview state. Geometry supplies authoritative samples/volumes and guarantees
AC-3/6 metadata-only edits. QA tests fixtures and real browser interactions against
C1–C4. Exit requires reviewed screenshots and disclosed AT/touch gaps; a catalogue
of thumbnails alone does not demonstrate valid exported geometry.
