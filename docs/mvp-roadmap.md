# MVP roadmap

Build the website foundation first, then the wall-art generator, editor, and
build-plate preparation workflow. Finish with a verified self-hosted release.

## Using this checklist

Work in milestone order. Create each spec when its milestone starts; the paths
below are planned files. Specs hold detailed scope, decisions, bounded contracts,
acceptance IDs, and checks. UI specs also cover layout, keyboard/mobile behaviour,
and error states. Mark items complete only after verification, recording evidence
and remaining gaps in the spec or implementation handoff.

## 1. Website definition

Planned spec: `docs/specs/website-definition.md`

- [x] Agree on the audience and primary journey: simple customization without CAD,
  opening directly into the tool with a default design and presets.
- [ ] Finalize workspace navigation and Help/About presentation; no separate
  homepage or catalogue is needed for the first tool.
- [ ] Define the visual direction and shared navigation, header, and footer.
- [ ] Define desktop/mobile wireframes and the overall editor layout.
- [ ] Record agreed MVP boundaries and acceptance criteria.
- [ ] Resolve the revised definition's proposed mounting-frame and document-kit
  scope, including whether board/template mounting is included.

Done when the website structure and experience are agreed and ready to build.

## 2. Website foundation

Planned spec: `docs/specs/website-foundation.md`

- [x] Set up the application with the selected stack and existing root lockfile.
  Verified in the [T1 checkpoint](plans/website-foundation.md#t1-checkpoint--2026-10-30).
- [ ] Implement responsive styling, shared layout, navigation, and routing.
- [ ] Build the tool-first workspace shell, light/dark themes, and supporting content.
- [ ] Build the wall-art page layout for subsequent editor integration.
- [ ] Verify keyboard navigation and mobile layouts, review screenshots, and
  include application build checks in `npm run check`.

Done when users can understand the product and navigate to the first tool.

## 3. Wall-art generator and exports

Planned spec: `docs/specs/wall-art.md`

- [ ] Define the first panel/pattern, backing and mounting, parameter ranges,
  clearances, tolerances, and generation budgets.
- [ ] Implement validated deterministic CAD generation with explicit seeds.
- [ ] Derive validated preview/export meshes from the same canonical CAD solids.
- [ ] Implement versioned saved-design serialization and validation.
- [ ] Implement STEP, binary STL, and standard 3MF export.
- [ ] Check invalid/boundary inputs, reproducibility, collisions, geometry
  validity, export round trips, and millimeter scale.

Done when supported designs produce reproducible valid geometry and exports.
No separate CAD/export feasibility prototype is required given prior project
experience; correctness checks remain part of this implementation.

## 4. Interactive editor

Planned spec: `docs/specs/wall-art-editor.md`

- [ ] Connect accessible parameter controls and interactive 3D preview.
- [ ] Implement worker-backed generation, stale-result handling, and visible
  loading, pending, validation, and failure states.
- [ ] Add local JSON save/load; failed imports preserve the previous valid design.
- [ ] Add automatic local saving/restoration with visible storage failures and recovery.
- [ ] Add progressive disclosure and assembled/exploded/component preview controls.
- [ ] Connect Design, Print layout, and Assembly views with consistent part IDs,
  form summaries, and undo/reset recovery.
- [ ] Add explicit format selection and export from the accepted design captured
  at click time; parameter edits must not serialize export files.
- [ ] Verify keyboard/mobile editing, preview, save/load, and actual downloads.

Done when the first generator is usable end to end through the website.

## 5. Build-plate configuration and print preparation

Planned spec: `docs/specs/print-preparation.md`

- [ ] Define plate width/depth, build-height limits, margins, and fit rules.
- [ ] Implement plate configuration, plate preview, and oversized-part feedback.
  Keep size and margins available from the start of editing, with current plate
  counts in the workspace. Support a shared margin and per-edge overrides.
- [ ] Define and implement supported multi-piece layouts, stable numbering,
  colour grouping, and assembly guidance, with multiple plates where needed.
- [ ] Specify and implement the approved mounting sections and assembly documents;
  candidates include full-scale/tiled maps, a print checklist, and kit manifest.
  Keep all selected outputs tied to one design revision.
- [ ] Distinguish assembly positions from print positions; verify exported
  placement, dimensions, and plate fit.
- [ ] Decide whether oversized panels are rejected or split; splitting requires
  specified joints and assembly rules, separate from arranging existing pieces.
- [ ] Inspect representative exports in a slicer and arrange a physical print
  trial before treating mounting and physical tolerances as proven.

Done when users can prepare supported designs for their printer and understand
their fit and assembly.

## 6. Verification and self-hosted launch

Planned spec: `docs/specs/mvp-launch.md`

- [ ] Verify the website-to-download workflow and all required acceptance IDs.
- [ ] Check representative browser/mobile performance and resource budgets.
- [ ] Complete geometry/export checks and slicer inspection; record limitations.
- [ ] Choose hosting target/domain and implement repeatable static deployment.
- [ ] Finish usage instructions, third-party notices, and launch license review.
- [ ] Run `npm run check`, record release evidence, and deploy when authorized.

Done when a new user can reach the hosted site and prepare/download a design
without developer assistance.

## After MVP

More patterns/outlines, a second generator, slicer-specific projects, and
monetization follow demonstrated demand. Accounts, cloud saves, billing, a
database, and a generalized plugin framework are outside this MVP.
