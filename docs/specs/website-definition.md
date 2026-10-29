# Website definition

Status: revised draft after guided discovery; detailed layout awaits review.
No application behaviour is implemented or verified by this document.

This revision incorporates [editor capability findings](../editor-capability-findings.md).
Confirmed owner choices remain separate from the proposed kit scope below.

## Goal and confirmed direction

Make model customization easy without CAD skills. The audience includes technical
makers who understand parametric models and newcomers who want to adjust a useful
design. Keep the entry point simple and the allowed choices clear.

Owner decisions from guided discovery:

- Open directly into the tool. A separate homepage and catalogue are not needed
  for one generator. More model types can live within the tool or a later catalogue.
- Start with a valid default design and offer a few presets inside the tool.
- Keep the model prominent. Use a clean, visually interesting interface with
  restrained colours. The parameter form and its usability are the main focus.
- Use progressive disclosure: show common settings first and reveal advanced
  options when needed.
- Make plate size available from the start. Use dimensions rather than printer
  presets. Provide one margin with optional per-edge adjustments.
- Support assembled, exploded, and build-plate views, with component inspection
  such as viewing the base separately where the generator has those parts.
- Provide light and dark themes.
- Save the design automatically and restore it on return.
- Prioritize desktop and tablet. Phone use is low priority.

The original five-page, catalogue-first proposal is superseded. This definition
sets the final MVP experience; foundation work alone does not provide a generator.

## Workspace and navigation

Proposed route: `/` opens the wall-art workspace. A small header provides the
Printametric identity, theme selection, Help, and About. Help/About can be panels
or pages; the foundation spec will choose a keyboard-accessible implementation.
Avoid a large marketing introduction or a separate mandatory setup flow.

Use three workspace views: **Design**, **Print layout**, and **Assembly**. These
are views of one saved design, not mandatory sequential steps. Design opens first.
Switching views preserves parameters, accepted geometry, and local-save state.
View navigation is separate from the camera and component-visibility controls.

```text
Printametric                             Help · About · Theme
Design | Print layout | Assembly
─────────────────────────────────────────────────────────────
Design controls                  Assembled | Exploded | Frame
                                 ┌───────────────────────────┐
Preset choices                   │                           │
                                 │     Large live preview    │
Size                             │                           │
  Common controls                │                 Parts ▾   │
  ▸ Advanced options             └───────────────────────────┘
Surface and direction            Dimensions · Parts · Plates
  Common controls                Plate size · Edit settings
  ▸ Advanced options
Palette / Mounting
  Common controls + advanced options
Build plate
  Width / depth / margin
  ▸ Per-edge margins
─────────────────────────────────────────────────────────────
Saved on this browser     Save file · Load · Start fresh · Download
```

The desktop layout keeps the form and preview visible together. The exact control
groups depend on the generator contract. This wireframe is a proposal, not a
request to invent parameters. Tablet layouts must preserve a useful preview while
editing. Narrow screens may stack sections; essential controls and errors must
remain accessible without clipped content. A phone-specific workflow is not required.

Print layout shows colour groups, frame sections, plate placement, and fit.
Assembly shows a numbered overview, component lookup, and paper-sheet preview.
Keep the plate settings and current part/plate summary reachable from Design.
Only expose supported capabilities; foundation placeholders must not suggest that
geometry, maps, or downloads already work.

## Form experience

- Show useful common controls first. Place advanced options within their relevant
  sections, rather than putting unrelated settings in one large advanced panel.
- Use labelled numeric fields with units for precise entry. Add sliders where
  they help exploration. Keep the displayed values synchronized.
- Show dependent controls only when applicable. The generator spec must define
  whether inactive values are retained and when they become effective again.
- Provide short inline explanations; longer help can be expanded. Do not rely
  on hover alone.
- Make errors visible even when the affected section is collapsed. Provide a
  keyboard path to the field. Preserve unfinished text separately from valid values.
- Refresh the preview after valid edits, with visible pending/failure states.
- Give collapsed sections a short summary of their active settings.
- Separate panel size/outline, piece layout/form, surface/direction, palette, and
  mounting. The first generator may expose only a subset. Do not add arbitrary
  geometry options merely to fill the layout.
- Numeric fields and sliders share one validated range, value, and unit display.
  Both require an accessible name. Render each unit once.
- If generation adjusts a requested shape to meet a supported constraint, report
  the adjustment and identify affected parts. Never silently repair an export or
  present the requested value as the resulting dimension.
- Provide undo/redo for accepted design edits. Define history limits and preset,
  reset, and import recovery in the editor spec; camera changes are separate.
- Proposed reset behaviour: presets and Start fresh reset design choices but
  preserve plate settings and theme. Offer a way to recover the previous design
  after a destructive replacement; define that interaction in the editor spec.

## Plate settings and preview

Plate width and depth use millimeters. One edge margin applies to all sides until
the user chooses per-edge controls: left, right, front, and back. Show the reserved
edges in the plate view and place parts only inside the usable area.

Define the usable width as width minus left and right margins, and usable depth
as depth minus front and back margins. Reject margins that leave no usable area.
The print-preparation spec owns numerical limits, defaults, build-height checks,
part spacing, rotation rules, and arrangement budgets. Margin is not a generated
brim; spacing between parts is a separate quantity.

Custom corner exclusions and printer profiles are deferred proposals, not MVP
requirements. Do not silently treat a corner exclusion as a full-edge reservation.

The default preview is assembled. Exploded view separates components for
inspection. Parts controls can isolate or hide available component groups.
Provide frame-only inspection when the mounting system is available. Use neutral
inspection lighting as well as presentation lighting, so shading does not hide
part boundaries. A visible part ID must be available without relying on colour.
These changes affect display only, never printable geometry or export selection.
Build-plate view shows actual print placement. Keep a compact plate/part summary
available while designing. Show pending or unavailable counts when arrangement
is not current; do not present a stale count as valid or imply optimal packing.

Plate settings are part of the same workspace, not a mandatory later Prepare
step. Implementation can remain staged, but final MVP integration must satisfy
this interaction model.

## Colour groups and mounting

Colour is a design parameter as well as a preview material. Each part has a colour
group ID, readable label, and swatch. The generator spec selects the initial colour
assignment rule and palette limits. Rich gradients, random assignment, and manual
painting are not all required by this definition.

Print layout groups decorative parts by colour and identifies frame parts
separately. Show current counts per group and the overall plate count. Changing a
palette or arrangement invalidates related summaries and documents until refreshed.
Do not claim minimum plate usage. Weight estimates, if added, must state their
material/volume assumptions and must not be presented as sliced consumption.

Proposed MVP mounting scope is a printed frame divided into build-plate-sized
sections, with a frame-only view and a 2D section map. The wall-art spec must settle
the decorative-part attachment, section joints, clearance, orientation, mounting
holes, and hardware assumptions before implementation. Include a small fit-test
model and physical verification before claiming mounting performance.

An alternative board-and-paper-template mounting method remains a scope decision.
Do not assume that the same attachment geometry works for both methods.

## Assembly kit and documents

Proposed MVP kit scope extends the existing assembly guidance to include:

- An overview with part IDs, colour labels, orientation, and frame-section IDs.
- A full-scale placement map.
- A tiled paper version with A4/Letter choice, printable margins, overlap,
  alignment marks, sheet row/column IDs, and a measurable scale-check mark.
- A print checklist listing files, colour groups, plates, and quantities.
- The editable versioned design and a manifest linking the kit contents.

Paper instructions must specify 100% scale. Colour labels and IDs must remain
readable in monochrome. Paper margins are separate from build-plate margins.
Exact document formats and page limits belong in the print-preparation spec.

All outputs use one captured design revision. A stable part ID links geometry,
colour group, plate placement, and map location. The generator spec defines when
topology changes require new IDs; the UI must not mix an old map with a new kit.
Selecting a part in Assembly should locate it on the map and its print plate,
with an equivalent keyboard-accessible part list.

Download offers the selected model format and, once the kit scope is approved,
explicit kit/document choices. Show contents before generation, progress, failures,
and cancellation where supported. Individual-part or plate re-export is a proposed
follow-up, not implied by hiding parts in the preview.

## Automatic local saving

Restore the last valid design on the same browser, without an account. Proposed
implementation contract:

- Persist versioned parameters and explicit seed, not meshes or WASM objects.
  Persist plate preferences and theme separately from design reset behaviour.
- Save accepted valid designs; incomplete edits and failed generation must not
  replace the last recoverable valid design.
- Validate restored data as strictly as imported files: versions, finite values,
  ranges, file/data size, and generation budgets before geometry work.
- If stored data is corrupt or unsupported, explain the failure and allow a valid
  default. Do not silently overwrite the stored design during failed restoration.
- If storage is unavailable or full, keep editing usable, show that automatic
  saving failed, and offer manual JSON save. Never show Saved after a failed write.
- Make the scope clear: saved on this browser, not cloud backup. Browser data
  removal can remove the saved design. Manual JSON save/load remains available.
- The editor spec defines storage mechanism, save timing, tab conflicts, and
  recovery/reset details with testable outcomes.

## Themes and accessibility

Provide light and dark themes with shared colour tokens. Proposed default: follow
the system preference until the user selects a theme, then remember that choice.
Check text, controls, focus rings, errors, and preview contrast in both themes.
Do not use colour alone to identify state or parts.

Use visible labels, keyboard-operable controls, logical focus order, and visible
focus. Collapsible sections expose their expanded state. Retain usable content
at zoom and narrow widths even though phones are not the primary target.

## Geometry and export boundaries

Follow `../architecture.md`: validated deterministic CAD solids supply preview
and STEP/STL/3MF exports. Only explicit Download starts file serialization for the
selected format, using the accepted generation captured at click time. Pending,
invalid, or stale results cannot export. Failed imports preserve the prior design.
Exploded offsets, hidden parts, grids, and themes are display-only state.

For a kit, capture the geometry generation, palette, arrangement, and document
settings together. Serialize only explicitly selected outputs. Interactive map
previews may refresh during editing, but PDF, archive, and model file creation
must wait for a download action. Retain the captured revision until completion or
explicit cancellation; later edits must not retarget that job.

Generator parameters, mounting, budgets, tolerances, part identities, and saved
versions belong in `wall-art.md`. Print layouts, splitting decisions, and plate
export semantics belong in `print-preparation.md`. Standard 3MF remains required;
slicer-specific multi-plate project metadata is not implied by this UI definition.

## Acceptance criteria

IDs retain their original numbering but their content now reflects guided discovery.
These are future implementation checks, not evidence of a working application.

| ID | Required outcome | Verification |
| --- | --- | --- |
| AC-1 | The implementation spec follows the confirmed tool-first direction and distinguishes remaining proposals | Owner review of revised definition and detailed layout |
| AC-2 | A first visit opens a valid default design; presets are available inside the tool | Browser first-visit and preset journeys |
| AC-3 | Workspace and Help/About navigation have no dead ends; routes, if used, support direct entry, refresh, history, and unknown-route recovery | Navigation checks for the selected route scheme |
| AC-4 | Common settings are easy to find; advanced and dependent controls reveal correctly without concealing errors | Normal and invalid form journeys |
| AC-5 | All essential actions work with a keyboard, with labels and visible focus | Keyboard-only editing, disclosure, view, save/load, and download checks |
| AC-6 | Form and preview are usable on desktop/tablet; narrow screens and zoom do not clip essential controls; both themes remain readable | Reviewed screenshots at proposed 1280×800, 768×1024, 390×844 and desktop 200% zoom; contrast checks |
| AC-7 | Imports and restored data cannot bypass validation or discard a previous valid design on failure | Malformed, oversized, unsupported-version, nonfinite, range, and budget tests |
| AC-8 | Automatic saving restores the last valid design and reports storage failures honestly | Reload, storage denial/quota failure, corrupt storage, and reset/recovery checks |
| AC-9 | Help/About describe local saving, available exports, and personal-use source-available terms accurately | Content and license-link review |
| AC-10 | Assembled/exploded/parts views do not alter exports; plate settings and current arrangement determine the displayed fit/count | View-switch, asymmetric-margin, fit, stale-result, and export checks |
| AC-11 | Applicable build, regression, and browser checks run through the shared gate | `npm run check` plus recorded screenshot/export evidence |
| AC-12 | Workspace views preserve the design; component selection links the part list, map, and plate | Keyboard view-switch and part-lookup journeys |
| AC-13 | Colour labels, IDs, group quantities, and arrangements agree for the accepted revision | Palette-change, regrouping, pending-state, and manifest checks |
| AC-14 | If printed-frame scope is approved, section map and frame-only view match generated section IDs and plate fit | Section/geometry checks, fit-test export, and separate physical-fit evidence |
| AC-15 | If document scope is approved, overview and tiled maps preserve scale, orientation, part IDs, and sheet registration | Independent document inspection, page-boundary cases, scale measurements, and monochrome review |
| AC-16 | A kit uses one captured revision; edits create no files; failed/cancelled generation cannot present a partial kit as complete | Export-call instrumentation, edit-during-download, cancellation, and failure tests |
| AC-17 | Undo/redo and reset recovery restore valid accepted parameters; sliders and numeric fields share constraints | History, preset/reset, boundary-input, and accessible-name checks |

## Implementation sequence

1. Review this revised definition and resolve layout proposals in the foundation
   spec. Build the workspace shell, form patterns, themes, and supporting content.
2. Implement generator validation, geometry, presets, and exports against the
   wall-art spec. Do not present shell placeholders as working generation.
3. Connect the editor, local restoration, manual files, and preview controls.
4. Integrate plate configuration, colour grouping, and arrangement into the same
   workspace. Implement the approved frame and assembly-document scope with its
   own contracts and checks.
5. Verify the acceptance criteria at the milestone that supplies each capability.

The roadmap remains staged by implementation dependency, not separate user steps.
No application code or runtime UX verification is part of this definition update.

## Research and remaining decisions

Source inspection of the owner's experimental `C:\develop\vase-builder` project
informed the proposal: `src/index.template.html` and `src/ux.js` contain starters,
grouped disclosures, numeric controls, and contextual help; `src/app.js` shows fit
and plate summaries and component views. `src/core.js:249–258` uses brim padding,
part gaps, and a conservative full-width reduction for its reserved corner.
This was source inspection, not browser verification or reused implementation.

- [OrcaSlicer printable space](https://www.orcaslicer.com/wiki/printer_settings/basic%20information/printer_basic_information_printable_space.html)
  distinguishes bed size and polygon exclusions. Per-edge margins are our simpler
  initial product choice, not a claim of equivalent exclusion support.
- [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  supports revealing less-used options separately from the common path.

Remaining proposals: precise layout and accent colours, Help/About presentation,
system-theme default, reset/recovery interaction, and persistence details. These
can be resolved in foundation/editor specs. Geometry ranges and packing/export
contracts must be resolved before their respective implementations.

Before marking this definition complete, approve or amend the proposed printed
frame and document-kit scope. Decide whether board/template mounting is included.
The proposed frame and document acceptance criteria apply only if that scope is
approved; record exclusions explicitly rather than silently skipping those checks.

Advanced outline imports, multiple grid/shape families, spatial influence editing,
image-driven patterns, room-photo previews, cloud projects, and slicer-specific
project handoff remain outside the initial commitment. Their observed availability
does not establish our requirements or provide an implementation contract.
