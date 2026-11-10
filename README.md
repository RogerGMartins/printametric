# Printametric

A self-hostable website with browser-based parametric 3D model tools.
The wall-art tool creates modular panels with seven surface families, four outlines
and five cell layouts.

**Status:** One Gridline application: cobalt header, full-window preview, and a
single collapsed Workspace settings panel. Design, Print layout, and Assembly
navigation work, along with display settings and a sun/moon theme action. Use system
restores OS following; only the theme preference persists across reloads.
Design now has validated CAD generation, an interactive preview, local JSON
save/load, and selected STEP/STL/3MF exports. Print layout and Assembly remain
unavailable. Help/About include keyboard support, the exact license and CAD notices.
See the [shape/surface implementation plan](docs/plans/wall-art-shape-surface.md) for verification.

Open **Workspace settings** to edit Surface, Shape, Layout and identification. Enter or leave a field
to apply valid values. Revert discards drafts; invalid inputs retain the last valid
model. Save design JSON before reloading: designs are not saved automatically.
Exports contain separate parts in assembly positions, in millimeters, rather than
packed build plates.

New designs use generator 3: a 500 × 500 mm stepped Wave with 100 parts,
20 mm minimum relief, 30 mm amplitude, density 2, 12% top size, side curvature 2.2
and a 10 mm per-part plinth. Curvature is dimensionless: 1 gives straight sides;
4 gives stronger inward curvature. The summary reports actual generated bounds.

Top blend runs from continuous (0%) to fully stepped (100%). **Advanced shape**
contains Planar tops: flat tops that can slope, with no effect at 100% blend.
Surface spacing follows the shorter nominal panel side. Ring and Dome remain
circular before cropping; active rotation turns the field counterclockwise from
the front. Layout seed controls irregular cell placement. Surface seed controls
Dunes, Ridges and Random without moving cells. Inactive values remain editable
and saved; nearby help explains when they have no effect.

Choose an outline and cell layout, then open
**Advanced layout and identification** for pitch, gap, underside numbers and the
orientation mark. **Numbered plan** shows actual contours, excluded fragments and
an enlarged part lookup. Small parts that cannot fit the cuts keep a map-only ID.
Whole-cell boundaries can exceed nominal dimensions; the summary shows actual
assembly dimensions. Acknowledge a changed exclusion set before exporting.

Valid bare parts with insufficient engraving floor also keep a **Map-only ID**;
both physical marks are omitted. Review map-only parts opens their contour lookup.
Invalid bare material rejects the candidate and keeps the previous model.

Existing generator-1 and generator-2 JSON reproduce their original geometry and
bytes. Upgrade directly to generator 3: preview, then confirm or cancel. It keeps
the layout, top ratio, layout seed and heights, starts with zero surface amplitude
and straight sides, and changes taper to both axes. Generator-1 upgrades add no
underside marks. Failed loads,
cancelled generation and timeouts retain the accepted design.

Generation and each selected export have a 120-second limit and a 2 GB estimated
memory budget. The hard ceiling is 4,000 parts, not a guaranteed capacity. A real
512-part generator-2 case completed generation, replacement, preview and all exports;
this does not qualify generator-3 throughput. Complex designs can exceed native
work or mesh limits as well as time and memory. See the phase-03 plan for measurements.
Generator-2/3 exports use temporary browser storage and require a secure context
(HTTPS or localhost), sufficient quota and supported file APIs. After a download
finishes, select **Release downloaded file** before exporting again. Temporary
files are not saved projects; a later explicit export cleans abandoned files.

The standalone UI studies and comparison page are retired. Open `/` on the dev or
preview server below. See the [Gridline implementation checkpoint](docs/plans/gridline-application.md)
for current verification and remaining screen-reader/physical-device gaps. Earlier
[T6 evidence](docs/plans/website-foundation.md#t6-checkpoint--2026-10-31) describes the previous UI.

## Develop

Install a current Node.js 26 release (26.12.1 or newer), then run
from the repository root. `.node-version` selects major 26 for CI and compatible
version managers; `package.json` records the minimum supported version.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). To check
the app and serve its production output:

```sh
npm run test:browser:install
npm run check
npm run build
npm run preview
```

Preview normally uses `http://localhost:4173` and is for local verification,
not production hosting. `npm run build` typechecks the app and creates `dist/`.
Use `npm run typecheck:app` for browser types or `npm run typecheck` for Node/tooling
types. See [development notes](docs/development.md#application-checks-and-debugging).
Browser installation is needed after `npm ci` on a new machine or a Playwright
upgrade. The shared check runs Node regressions and Chromium journeys against
served production output and the development build.

For the agent workflow, install OpenCode and run `opencode` from this directory.
OpenCode reloads command files automatically. Models and credentials come from
your own OpenCode setup.

## OpenCode workflow

| Command | Purpose |
| --- | --- |
| `/spec <feature>` | Specifier writes bounded contracts and acceptance criteria |
| `/design <spec path>` | Frontend defines layout, accessible controls, and UI states |
| `/plan-implementation <spec path>` | Write the technical task plan; stop for your review and approval |
| `/implement <spec path or task>` | Execute the approved plan and verify the working slice |
| `/verify <spec path>` | QA checks acceptance criteria and reports evidence and gaps |
| `/review <scope>` | Review correctness, geometry, accessibility, and tests |
| `/ship <scope>` | Check release readiness; publish only when explicitly requested |
| `/pr [files or task; title/body guidance]` | Check, commit, push, and open a PR for the selected changes |

Use `/pr` after reviewing a completed task. For example:
`/pr T2; title: Add foundation state and browser adapters`.
You can supply explicit file paths and description notes instead. With no arguments,
it uses the completed task in the conversation. Invocation authorizes the commit,
push, and PR for that scope; `/ship` remains the broader readiness command.

Specialists: `@specifier` for feature contracts, `@frontend` for editor design and
implementation, `@geometry` for parametric geometry, `@qa` for verification and
requested regression tests, and `@reviewer` for independent review.
Skills: `parametric-models` and `delivery`. The `project_check` custom
tool runs the same checks as CI with a fixed command and no shell arguments.
Built-in build/plan agents handle ordinary work. See [AGENTS.md](AGENTS.md).

Commands are workflow entry points; agents are the roles executing them.
`build` is the implementation/integration agent; `plan` is for read-only exploration
and planning. `/spec`, `/design`, `/verify`, and `/review` invoke their specialists.
Specialists can be addressed directly without creating a command for each role.

Review the technical plan in `docs/plans/<feature>.md` after `/plan-implementation`.
Request changes or approve it and run `/implement`. Planning does not start coding.

## Project documents

- [MVP roadmap and checklist](docs/mvp-roadmap.md)
- [Editor capabilities and design findings](docs/editor-capability-findings.md)
- [Product direction](docs/product.md)
- [Application stack and architecture](docs/architecture.md)
- [Development workflow and tooling](docs/development.md)
- [Contributing](CONTRIBUTING.md)

Selected application stack: **React + TypeScript + Vite**, **Three.js + React
Three Fiber**, plain CSS, and **Replicad/OpenCascade.js WASM** for CAD geometry.
Required exports: **STEP, STL, and 3MF**, derived from the same CAD model.
Start client-side with versioned JSON design files and static self-hosting.
These dependencies are installed and pinned in the root lockfile. The CAD WASM
asset is served locally; no hosted geometry service is required. See
[third-party notices and CAD source provenance](THIRD_PARTY_NOTICES.md).

## CI and deployment

GitHub Actions runs `npm ci`, installs Playwright Chromium and its system dependencies,
and runs `npm run check` on Linux and Windows for pushes and pull requests. Checks
validate the scaffold's local conventions, parse YAML, typecheck tooling, browser
tests, and the app, build production output, and run Node and browser regressions.
Failed browser runs retain traces, screenshots, and an HTML report as CI artifacts.
Dependabot checks npm dependencies and GitHub Actions weekly.

For ChatGPT-connected PR reviews, use the official Codex GitHub integration.
Repository review guidance is in `AGENTS.md`; account connection and automatic
reviews must be enabled in Codex. See [setup instructions](docs/development.md#codex-pull-request-reviews).

The application is intended for owner-managed hosting with portable build
artifacts. Hosting, a domain, and deployment automation will be chosen when the
first runnable application exists. Potential revenue includes ads or paid
services on the owner's official hosted instance.

## License

Source-available under the custom [Printametric Personal Use License](LICENSE).
Individuals may run and privately modify it for personal, noncommercial use.
Company use, commercial derivatives, redistribution, and public third-party
hosting require separate written permission. This is **not open source** in the
OSI sense. The owner reserves commercial hosting rights. Contributions include
the rights grant described in the license; read it before submitting a PR.
