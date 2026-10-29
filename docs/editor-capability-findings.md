# Editor capabilities and design findings

Status: research input for product decisions, not an approved implementation spec.

This document records functional observations and original recommendations. It
contains no external implementation, assets, or source excerpts. Features listed
here are not automatically MVP commitments. Parameter limits and defaults require
our own geometry, performance, accessibility, and physical-fit validation.

## Evidence levels

- **Exercised:** a browser interaction was performed and its visible state changed.
- **Inspected:** a control, description, rendered image, or HTML structure was read.
- **Unverified:** operation or output could not be tested.
- **Proposed:** a requirement or improvement for our own implementation.

Browser inspection used a public trial. Export access was restricted. No restriction
was bypassed. A changing preview is not evidence of printable or valid geometry.

## Capability inventory

| Area | Capability | Evidence |
| --- | --- | --- |
| Entry | Default design, starter models, new project, local project list | Inspected; new project exercised |
| Size | Width/height, size presets, rectangular and curved outlines | Smaller size preset and oval outline exercised |
| Outline | Rectangle, oval, hexagon, arch; custom-outline input exists in HTML | Inspected; custom import not tested or confirmed available |
| Layout | Organic cells, hexagonal, square, triangular, and radial arrangements | Controls inspected |
| Piece form | Top width, stepped/blended tops, flat tops, minimum height, concavity, randomness, plinth | Controls and help inspected |
| Identification | Inter-piece gap, base thickness, engraved-number depth and size | Controls inspected; printed identifiers unverified |
| Surface | Wave, dunes, crater, dome, spiral, ridges, random height patterns | Controls inspected |
| Surface tuning | Relief depth, repetition density, spiral arms, rotation, phase, seed | Controls inspected |
| Direction | Rotational, attracting/repelling, and directional influences | Rotational point creation, cloning, and deletion exercised |
| Point editing | Plan view, draggable point, radius/fade rings, numeric position | Plan opened; drag and numeric adjustment not tested |
| Influence tuning | Strength, lean, direction, width, opening, radius, falloff, local height/top effects | Controls and help inspected |
| Geometry adjustment | Optional shortening of overhanging tips, angle control, adjustment feedback | Controls and demonstration feedback inspected; geometry validity unverified |
| Frame | Part pockets, automatic tiling, section map, section size/count and material estimate | Frame-only view and size-dependent section summary exercised |
| Frame tuning | Clearance per side, rib height, base thickness, border width/height/rounding, lightweight structure, screw holes | Controls inspected; joints and physical fit unverified |
| Colour | Band count, height/gradient/random assignment, gradient angle, swatches, band order, separate frame colour | Gradient assignment exercised; remaining controls inspected |
| Preview | Orbit, front/side/isometric/room controls, light direction, frame visibility, frame-only | Frame-only exercised and screenshot reviewed; other controls inspected |
| History | Undo, redo, reset | Controls inspected; history semantics unverified |
| Saving | Named local project, save status, project list, import control | Named project saved with visible local-save confirmation; reload recovery unverified |
| Sharing | Share action | Control inspected; sharing format/privacy unverified |
| Kit | Printer selection, per-colour model files, frame file, preparation/cancel actions, slicer handoff, ZIP | Export-dialog HTML inspected only; generation and handoff unverified |
| Documents | Print checklist, assembly map, full-scale colour map, multi-sheet map, editable project | Public descriptions/images and dialog content inspected; actual files unverified |

## Observed interactions

1. The entry page returned a non-success HTTP status but still contained an active
   public trial button. The rendered page, not the status alone, established access.
2. A new project opened editable geometry. Changing to a smaller panel and then
   an oval updated the outline summary and piece count.
3. Frame-only mode exposed the supporting lattice, screw locations, section
   boundaries, and section identifiers. Its side panel showed a separate 2D map.
4. Selecting gradient colour assignment updated the colour-section summary.
5. Creating a rotational influence opened a plan view and point-specific controls.
   Cloning and deleting changed the point list.
6. Saving a named project produced a saved-in-browser status. Persistence across
   reloads, corrupt-data handling, and storage failures were not tested.

Some immediate text captures still showed a building state or earlier statistics.
Only settled results should be used for dimensions, fit, plate counts, and export.

## HTML and form observations

The rendered interface uses native disclosure sections, numeric/range inputs,
radio-style choice groups, pressed-state buttons, status regions, a modal export
dialog, and canvas-based diagrams/previews. These are reusable interaction
patterns; our markup, styles, geometry, and code must be independently implemented.

Useful patterns:

- Collapsed sections summarize the current settings.
- Visual choices combine a short name with a shape or direction cue.
- Numeric fields support exact values alongside exploratory sliders.
- A plan view provides spatial editing while the form supplies precise controls.
- Frame settings include a 2D section diagram alongside the 3D result.
- Local-save and generation status stay visible.

Issues to avoid in our own implementation:

- Dense forms can hide important options below a long scroll area. Use common
  controls first, with advanced controls inside the relevant group.
- Several captured values displayed repeated units. Keep unit rendering in one
  shared field component.
- Sampled range inputs lacked associated native labels and direct `aria-label`
  attributes. This is not a complete accessibility audit; verify computed accessible
  names, relationships, and keyboard behaviour for every control we implement.
- Numeric fields and sliders showed different maximum values in one restricted
  mode. Apply a single validated parameter contract to every input path.
- Generation changes can temporarily leave older statistics visible. Clearly mark
  them pending and prevent stale exports.
- Do not adopt weight estimates without defining density and volume assumptions.
  Geometric mass is not the same as sliced filament consumption or print time.

## Print kit as a shared data model

The key product capability is a connected kit, not a collection of unrelated files.

```text
Accepted design revision
        |
        +-- Decorative parts -- stable IDs -- colour groups -- print plates
        |
        +-- Mounting sections -- section IDs -- hardware locations
        |
        +-- Assembly map -- full-scale layout -- tiled paper sheets
        |
        +-- Manifest -- file list -- print checklist -- editable design
```

Each output must identify the same design revision and part set. Model visibility
and exploded offsets must not change the kit. Explicit export selection is a
separate operation. Regenerating geometry must not leave maps or checklists attached
to an older arrangement.

### Mounting system

Proposed contract topics:

- Decorative-part attachment, removability, orientation, and fit clearance.
- Frame section boundaries constrained by usable plate size.
- Alignment and joining between frame sections.
- Mounting-hole locations, hardware assumptions, and wall offset.
- Separate identities for decorative pieces and frame sections.
- A small fit-test model before a full frame kit.
- Physical verification before claiming a secure connection or load capacity.

The attachment and joining mechanisms remain design decisions. Visual inspection
does not establish joint tolerances, insertion forces, or mounting performance.

### Colour and print arrangement

Proposed behaviour:

- Assign every decorative part to a colour group with a label and swatch.
- Pack colour groups separately when requested; show plate counts per group.
- Treat frame parts as an explicit group with their own material/colour choice.
- Keep plate edge margins separate from spacing and any reserved brim allowance.
- Support selecting a part or plate for replacement printing.
- Preserve part identity when changing views and generating documentation.

Generic model packages and slicer-specific projects are different outputs. The
existing STEP/STL/standard-3MF contract remains in force. Printer presets, embedded
process settings, multi-plate project metadata, and opening a desktop slicer need
their own compatibility spec if selected.

### Assembly documents

Proposed deliverables:

| Document | Required information |
| --- | --- |
| Overview map | Panel dimensions, orientation, part IDs, colour legend, frame sections |
| Full-scale map | Exact-size part positions, scale marker, design revision |
| Tiled paper map | A4/Letter options, printable margins, overlap, registration marks, sheet row/column IDs |
| Print checklist | File/plate IDs, colour, quantities, space to mark completion |
| Kit manifest | Revision, format versions, part/section IDs, output files, units |

Include monochrome-readable labels. Explain 100% paper-print scaling and provide
a measurable calibration mark. A paper template for bonding parts onto a board is
a possible alternative mounting workflow, pending a product decision.

## Recommended workspace direction

Keep one tool with three related views rather than mandatory sequential steps:

1. **Design:** presets, panel, pieces, surface/direction, palette, mounting options.
2. **Print layout:** plate settings, colour groups, placement, fit, replacement parts.
3. **Assembly:** part lookup, frame sections, numbered map, paper-sheet preview.

Keep plate settings and a concise part/plate summary reachable during design.
Use assembled and exploded inspection within the appropriate views. Selecting a
part should highlight its corresponding plate and map position.

Maintain the agreed desktop/tablet priority, local restoration, manual design
files, light/dark themes, and progressive disclosure. Add readable control sizes,
clear adjustment feedback, accessible help, undo/recovery, and neutral inspection
lighting alongside presentation lighting.

## Scope decisions before specification

- Decide whether both printed-frame and board/template mounting belong in MVP.
- Decide whether maps, tiled sheets, and the print checklist are required MVP outputs.
- Select the first layout, piece form, surface, and colour-assignment capabilities.
- Define stable numbering and revision behaviour when topology changes.
- Define the frame attachment/joint contract and physical test plan.
- Define exact paper-map and kit formats, including export selection behaviour.
- Keep advanced shape families, custom outlines, rich influence editing, and
  slicer-project integrations separate until their scope is explicitly accepted.

These findings do not approve a larger MVP automatically. Revise the roadmap and
feature specs after the scope decisions, keeping observations distinct from our
own acceptance criteria.
