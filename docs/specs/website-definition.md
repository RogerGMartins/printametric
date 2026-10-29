# Website definition

Status: proposed definition, awaiting owner approval; no application implemented.
Feature: `website-definition`. Date: 2026-10-29.

## Problem and outcome

Visitors need to understand what Printametric does, find its first tool, and
understand the path from customization to a printable download. The repository
currently defines the technology and product direction, but not the website's
page responsibilities or experience.

This milestone defines that experience. The smallest subsequent runnable slice
is Home → Tools → Wall-art page, with useful Guide/About content and an honest
editor placeholder. Actual generation follows in the roadmap's later milestones.
Approval of this document is not evidence that those journeys work in a browser.

## Evidence and requirement provenance

- **Confirmed project requirements:** `../product.md` requires a self-hosted
  browser-tool site, wall art first, a simple catalogue, local design files, and
  eventual STEP/binary STL/standard 3MF downloads. `../architecture.md` selects
  client-side React/TypeScript/Vite, plain CSS/native controls, independent CAD
  geometry, and explicit on-demand export. `../mvp-roadmap.md` puts website
  definition before foundation, generator, editor, print preparation, and launch.
- **Verified repository state:** inspected root `AGENTS.md`, the above documents,
  `../development.md`, `.opencode/agents/specifier.md`, `package.json`,
  `scripts/run-check.mjs`, and `tests/scaffold.test.mjs`. The package declares
  development tooling, not application dependencies; current checks cover the
  scaffold and tooling typecheck/tests. No existing feature specs or application
  implementation were found in the inspected repository tree.
- **External reference claims:** none adopted. No reference website was supplied
  or tested. No competitor behavior, screenshots, assets, or branding are evidence
  for this definition.
- **Proposed defaults:** audience, copy, routes, layout, and visual choices below
  are our design choices, not previously approved requirements or shipped behavior.

## Audience and primary flow (proposed defaults)

Primary audience: personal-use makers who have access to an FDM printer and a
slicer, but should not need CAD expertise. Secondary audience: people evaluating
the tools or running the site locally. English only initially.

1. Open Home; read a short explanation of configurable printable models and see
   wall art as the first tool. Primary link: **Explore tools**.
2. Open Tools; find one Wall art entry, its purpose, and its availability.
3. Open the Wall-art page. In the foundation slice, see **Editor coming soon**,
   a description of the planned workflow, and a Guide link—not fake controls.
4. Once the editor milestone passes its own acceptance checks, this same page
   provides parameters → preview → local save/load → explicit format/download.
5. Guide explains the applicable workflow and limitations; About explains the
   project and personal-use source-available status. Users can return to Tools
   from either page without browser-history dependence.

No sign-in, payment, upload to a service, or printer connection is part of this
journey. Future functionality must be labelled as planned until implemented.

## Scope and site contract (C-1)

Proposed route paths identify pages; they do not mandate a router dependency.
Foundation must choose a routing mechanism that supports direct links and refresh.

| Page / proposed path | Responsibility | Required action/content |
| --- | --- | --- |
| Home `/` | Explain the product, emphasize wall art | Brief value statement, Explore tools link, short customize/preview/download explanation labelled as planned while unavailable |
| Tools `/tools` | Simple catalogue, not a marketplace | One Wall art entry with visible Coming soon status and View tool link |
| Wall art `/tools/wall-art` | Stable destination for the first tool | Description, availability, Guide link; later the editor occupies this page |
| Guide `/guide` | Explain use without promising printer compatibility | Current availability; planned parameters/preview/local JSON/download workflow; millimeter units; slicer review and printer-fit caveat |
| About `/about` | Explain purpose and rights accurately | Self-hosted/personal-use direction; source-available, not OSI open source; link to the repository LICENSE without paraphrasing new permissions |
| Unknown route | Recover from broken links | Page not found message and Home/Tools links; no automatic redirect hiding the error |

Shared shell: text Printametric home link, Home/Tools/Guide/About navigation,
skip-to-main link, one main region, one page-level heading, and footer with About,
Guide, source/license links. Identify the current navigation destination; on
Wall art mark Tools as its section. Use descriptive page titles.

Do not add search, filtering, categories, a CMS, an empty second tool, account
menus, ad slots, testimonials, invented print results, or a plugin registry.
One catalogue entry needs none of these. No deployment configuration or hosting
provider selection belongs to this milestone.

## Visual and responsive direction (C-2, proposed default)

Use an original, restrained workshop/tool aesthetic: light neutral background,
dark text, one accessible accent, system fonts, plain CSS, and native controls.
Prioritize readable descriptions and clear actions over decorative 3D. Do not
require a logo asset, remote fonts, stock imagery, or an animated hero. A future
illustration must be original and labelled illustrative if not a generated model.

Desktop wireframe:

```text
[Printametric]                    [Home Tools Guide About]
[Skip link when focused]
[Page heading + concise explanation]
[Home: primary action / short workflow]
[Tools: Wall art entry + availability + View tool]
[Footer: Guide / About / source and license]

Future Wall-art editor main region:
[Heading + status]
[Parameters and errors] [Preview + view controls + accepted-design status]
[Local Save / Load]     [Format selector / Download + export status]
```

Narrow-screen wireframe: header and navigation wrap into visible rows (no
hamburger required); content becomes one column. Future editor order is heading,
status, parameters/errors, preview/view controls, save/load, format/download.
The DOM and keyboard order follow that reading order. Avoid fixed overlays and
sticky actions that can obscure errors or focused controls. Parameter sections
may later collapse only with keyboard-operable labelled controls.

Proposed layout test boundaries: 320 CSS px width, 390 CSS px width, and
1280 × 800 desktop; also 200% browser zoom on desktop. These are usability cases,
not performance benchmarks. At these sizes there must be no page-level horizontal
scroll or clipped navigation, text, error messages, or actions. Text contrast
must meet WCAG AA; focus indicators remain visible. All essential actions use
links/buttons/labelled controls, not pointer-only interactions or a canvas.

On client-side page changes, update the title and move focus to the new main
heading; preserve native browser Back/Forward behavior. No-JavaScript users must
receive an explanation rather than a blank screen. The foundation placeholder
does not depend on WebGL.

## Input, state, and output contracts

### Website parameters (C-3)

There are no user-editable generator parameters or saved designs in this feature.
Do not invent dimensions or print tolerances to populate a mock editor.

| Input/value | Type | Default / permitted values | Invalid/boundary behavior |
| --- | --- | --- | --- |
| Page location | URL pathname | `/`; the five exact paths in C-1 | Normalize a single trailing slash; unknown paths show Not found; query values never become model parameters |
| Query/fragment | URL strings | Empty; no supported design serialization | Ignore for application state; never parse as JSON, execute, or render as HTML |
| Tool ID | Static string literal | `wall-art` only | Unknown tool routes show Not found, not a fabricated catalogue entry |
| Availability | Static literal | `coming-soon` in foundation; `available` only after editor acceptance | Coming-soon entries link to the description, not a disabled/dead control |
| Catalogue text | Repository-authored plain text | Nonempty title, summary, status, destination | Render as text; a missing destination or duplicate ID fails the implementation test/build gate |

Cross-field rule: `wall-art` maps only to `/tools/wall-art`; catalogue status and
page status must agree. No availability toggle is exposed to visitors. This is a
fixed entry, not a requirement for a configurable metadata framework.

Outputs are navigable pages and explanatory content only. No model file, part,
design JSON, geometry generation, export serializer, CAD worker, or download is
produced. No persistent user state, cookies, telemetry, external media, or design
network requests are needed. Ignore unsupported file drops; provide no import
target or file picker. Do not intercept unrelated native browser behavior.

### Future editor boundary (C-4; inherited requirements, not this milestone's implementation)

- Valid parameter edits refresh canonical geometry and its preview, not files.
  Export starts only on explicit action for one selected format, capturing the
  accepted generation and format. Pending/invalid/stale designs cannot export.
- Distinguish initial loading, generating/pending, valid, invalid draft,
  generation failed, exporting, export failed, and WebGL unavailable. Errors are
  visible and accessible; unavailable functionality is not presented as working.
- Failed JSON imports—including malformed, oversized, unknown-version, nonfinite,
  out-of-range, and over-budget inputs—must preserve the previous valid parameters,
  accepted geometry, and preview. Draft/error state is separate from accepted state.
  Parsing/validation precedes expensive generation; no silent coercion or migration.
- Printable units are millimeters. STL coordinates retain that scale; STEP/3MF
  specify units. Standard 3MF is not a slicer project or sliced toolpath. Do not
  describe export as proof of printability or printer fit.
- The future wall-art spec must define axes/origin, every parameter's
  type/default/range and cross-field constraints, explicit seed and schema/generator
  versions, determinism tolerance, budgets/timeouts, minimum thickness/clearance,
  tessellation tolerance, errors, and canonical solid/mesh/part outputs. The print
  preparation spec must distinguish assembly coordinates from individual print
  orientations/transforms and define plate-fit rules.

Those values are deliberately unresolved here: this is not a generator. No
generation worst case or export-scale success can be certified by this document.
Future parameter and geometry contracts block generator work, not website foundation.

## Acceptance criteria

IDs remain stable. Definition review checks this specification; browser and code
checks below become obligations for foundation implementation, not claims of
current completion. C-4 implementation checks belong to later feature specs.

| ID | Observable outcome | Verification method |
| --- | --- | --- |
| AC-1 | Audience, Home emphasis, five-page map, phased availability, and exclusions are explicitly approved or amended by the owner | Record owner approval in the implementation handoff; do not infer it from file creation |
| AC-2 | A new visitor can explain the product and follow Home → Tools → Wall art → Guide, with no account and no dead-end action | Browser journey on desktop; inspect copy and link targets against C-1 |
| AC-3 | Each C-1 page opens directly, survives refresh, and works with Back/Forward; unknown routes show recovery links | Browser route table tests, including `/tools/no-such-tool`, trailing slash, and query/fragment cases from C-3 |
| AC-4 | One catalogue entry and its destination consistently say Coming soon; no working-editor or download claim is made | Text/assertion test and screenshot review of Home, Tools, Wall art, Guide |
| AC-5 | Every navigation/action is keyboard reachable with visible focus; skip link works; route focus/title identify the destination | Keyboard-only journey using Tab/Shift+Tab/Enter, accessibility-tree inspection, and Back/Forward check |
| AC-6 | Navigation, content, footer, and placeholder remain readable and operable at all C-2 widths and zoom; no horizontal overflow | Browser viewport/zoom checks and reviewed desktop/narrow screenshots; contrast check |
| AC-7 | Unknown or hostile URL values cannot inject content or create model state; missing/duplicate catalogue metadata is caught | Negative tests for unknown tool, HTML-like encoded query text, and invalid static-entry fixtures against C-3 |
| AC-8 | Foundation pages work without WebGL and make no geometry/export calls, downloads, or tracking requests; JS disabled shows a useful explanation | Browser network/download observation, WebGL-disabled and JS-disabled runs; inspect application dependency boundary |
| AC-9 | About/footer accurately identify source-available personal use and link to the actual license; no copied assets or unproven print claims appear | Content/link review against repository LICENSE and original asset inventory |
| AC-10 | Future editor wireframes identify parameter, preview, local-file and explicit-export regions in desktop/narrow reading order; no geometry values are invented | Definition/frontend review against C-2 and C-4; later editor spec owns interactive acceptance |
| AC-11 | Foundation implementation builds and its navigation/invalid-route regression checks run through the shared gate | Run `npm run check` after foundation adds app typecheck/build and browser checks; record actual output |

## Edge cases and test plan

- Normal: review all five pages and the primary flow; ensure Guide is useful while
  the editor is unavailable. Validate internal and source/license links.
- Boundary: longest visible navigation/content at 320 px and 200% zoom; refresh a
  nested URL; repeated Back/Forward; unavailable WebGL; disabled JavaScript.
- Invalid: unknown paths/tool IDs, unsupported query data, HTML-like text,
  duplicate/missing catalogue data. No generated design exists to overwrite in
  foundation; C-4 supplies the later invalid-import preservation requirement.
- Use one route-table regression check plus a browser smoke journey where
  practical; avoid building a test framework solely for static metadata. QA records
  browser/OS/version, viewports, results per AC, and screenshot paths. Keep generated
  evidence in `artifacts/` unless intentionally committing small fixtures.
- No numerical latency or memory target is claimed for this definition. Foundation
  should record build size and representative page-load behavior before proposing
  budgets with named hardware/browser/network conditions and rationale. CAD
  initialization, peak memory, worst-case generation, and export round trips are
  later milestone checks, not waived requirements.
- Existing scaffold checks cannot prove these UI criteria. No browser, geometry,
  export, slicer, or physical-print verification has occurred as part of writing
  this specification.

## Assumptions and unresolved decisions

**Reasonable defaults, not blockers:** English; maker-first audience; Home emphasizes
wall art; five pages; light/system-font styling; always-visible wrapping navigation;
one coming-soon entry; no backend, analytics, remote assets, or user persistence.
Foundation may use native navigation or a small routing solution without changing
C-1's observable behavior. Final copy and accent color can be chosen in UI design.

**Approval gate:** Does the owner approve C-1/C-2 and the coming-soon foundation
journey as the website baseline? This is the only definition completion blocker;
the proposed defaults make further exploration possible without inventing approval.

**Deferred, not foundation blockers:** mounting, parameter ranges/tolerances,
generation budgets, plate arrangement/splitting, host/domain, monetization, and
commercial legal review remain with their respective roadmap milestones. Do not
silently resolve these through marketing copy or placeholder controls.

## Implementation sequence and handoffs

1. Owner reviews AC-1 and approves/amends C-1/C-2. Frontend performs the UI design
   pass in this spec if requested, preserving contract/acceptance IDs.
2. Build creates the website-foundation spec from C-1–C-3, then installs only the
   dependencies needed for that runnable slice using the root lockfile. No CAD or
   rendering dependency is needed to draw a coming-soon page.
3. Implement shared shell, pages, route recovery, responsive styles, and honest
   availability; add application build/typecheck and regression coverage to the
   existing gate. Do not implement a fake editor or preempt later geometry contracts.
4. Verify AC-2–AC-9 and AC-11; review AC-10 before the editor design starts. Report
   failures/unverified cases rather than treating placeholder navigation as MVP done.

Handoff ownership (assign only when the caller requests implementation/delegation):

- **Frontend:** C-1–C-3 and C-4 layout/state boundaries; AC-2–AC-10. Own page/shell
  UI and accessible navigation. Return screenshots, keyboard/narrow-screen evidence,
  files changed, and any requested contract amendments.
- **Geometry:** no implementation assignment for this milestone. C-4 is the future
  boundary; supply the missing generator contracts in `wall-art.md` before generator
  work. Do not turn AC-10 into a mesh or export acceptance claim.
- **QA:** AC-2–AC-11 verification against the same contracts; separate spec review
  from browser evidence. Include normal/boundary/invalid cases and environment.
- **Build/caller:** owns approval tracking, dependency/shared-contract changes,
  integration and AC-11. Handoffs list acceptance IDs, changed files, contract
  changes, commands/results/artifact paths, blockers, and unverified behavior.
