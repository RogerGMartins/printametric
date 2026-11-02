# Development workflow

## Dependency follow-up (2026-10-29)

The OpenCode SDK brings four high-severity npm audit findings
through its Zod and Effect/TOML dependencies (resource-exhaustion advisories).
There is no compatible SDK upgrade reported by npm audit; its proposed fix is
an old SDK downgrade. Do not use audit fix --force blindly. Track an upstream
SDK release with corrected dependencies. These packages support development
tools; they are excluded from the application bundle. There is no deployed app.
The SDK's transitive ini package requires Node 24.15 or newer within Node 24;
use current Node 24 LTS to avoid engine warnings. Local checks also passed on
the existing Node 24.6 installation, which emits that warning during install.

## Current stack

Installed tooling: Node.js 24, npm, TypeScript, Node's built-in test runner, and
YAML parsing for configuration checks. T1 installs React 19.3.1, Vite 8.3.5, and
the official React plugin 6.1.2. T5 adds Playwright Test 1.64.1 and its pinned Chromium.
The installed geometry stack uses Three.js 0.187.0 / React Three Fiber 9.8.2 for
preview, Replicad 1.2.0 / replicad-opencascadejs 1.1.0 for worker-owned native CAD,
and fflate 0.8.3 for standard 3MF packages. Independent STEP tests use occt-import-js
0.0.23; STL/3MF tests use Three's independent readers.
See [architecture.md](architecture.md) for boundaries and the export feasibility gate.
T1–T4 implement the shell, state/browser adapters, responsive workspace, navigation,
display controls, themes, and Help/About dialogs. Phase 01 adds the blade generator,
JSON files and assembled exports. Gridline is the single application UI; the
standalone studies are retired.
Keep one root npm lockfile; run installs from the root. The root dev dependencies
declare the official plugin SDK for typechecking. OpenCode may generate its own
.opencode/package.json and Bun lockfile matching its installed version; these
machine-managed files are ignored so startup cannot invalidate the npm lockfile.

### Application checks and debugging

- `npm run dev` starts Vite with source maps and React StrictMode checks.
- `npm run typecheck:app` checks browser code using `tsconfig.app.json`.
  `npm run typecheck` checks Node-only tools, Vite/Playwright configuration, and
  TypeScript browser tests using `tsconfig.json`. JavaScript journey helpers are
  imported with `allowJs`; they remain runtime-tested rather than JS-typechecked.
- `npm run build` checks app types and creates static output in `dist/`.
  `npm run preview` serves that output locally; rebuild after source changes.
- `npm run check` runs scaffold validation, both typechecks, the production build,
  Node tests, and Playwright production/development browser regressions. CI uses
  this same gate on Linux and Windows. First run `npm ci` and
  `npm run test:browser:install` to install Chromium and required OS libraries.
  Repeat browser installation after a Playwright upgrade. No MCP service or model
  credentials are needed for these tests.
- To debug startup, open the dev URL and the browser's Sources panel, find
  `src/main.tsx` or `src/app/App.tsx`, set a breakpoint, and reload. Check the
  browser console and Vite terminal for failures. StrictMode can render twice
  in development. Production output does not contain source maps or debug fixtures.

On a fresh page, tab order is Skip to workspace, view links, theme toggle,
Use system (when overridden), Help, About, and Workspace settings.
Activating Skip moves focus to main without changing the hash; the next Tab then
reaches the settings summary. View activation and Back/Forward focus the view heading.
Enter opens settings; its content scrolls independently. Native arrow keys change radios.
Enter/Space on the sun/moon button selects the opposite effective theme. Use system
restores OS following and returns focus to the toggle.
Settings survive view changes; reload resets them except the stored theme.
Disable JavaScript to check the startup notice.

For T2 logic checks with Node 24, run
`node --test tests/foundation-state.test.mjs`. To isolate storage failures, run
`node --test --test-name-pattern="theme storage" tests/foundation-state.test.mjs`.
The tests import erasable TypeScript directly; this does not typecheck it, so keep
running the shared gate. Storage doubles reproduce denied property/method access,
corrupt values, failed writes, and retries without changing browser data. Inspect
the failing assertion and its stack location to compare accepted state, returned
notice, and retained bytes. Navigation/media doubles also expose history writes
and subscription counts. No debug controls are added to the application.

T3 bootstrap checks: `node --test tests/foundation-bootstrap.test.mjs`. For UI error
recovery, run `npm run dev` and open `/tests/fixtures/workspace-errors.html` at its
local URL. This fixture starts with Grid retained after an invalid update, settings
closed, and independent tips/theme errors. Keyboard-activate Review Preview background:
Grid receives focus and its error remains. Choose Plain to clear only that error.
The fixture is app-typechecked but excluded from the production entry and `dist/`.

Set Sources breakpoints in `App.tsx` (`changePreference`, `applyNavigation`) and
`state.ts` (`transitionFoundation`) to inspect accepted values and separate notices.
For a storage write failure in an isolated dev tab, enter this in DevTools, select
a different Theme, then restore the method and activate Retry theme storage:

```js
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = () => { throw new Error('Test storage failure'); };
// After checking the visible warning and retained in-memory theme:
Storage.prototype.setItem = originalSetItem;
```

Reload also removes this temporary override. Use a separate browser profile for
these checks so existing preferences remain untouched. T3 browser assertions are
reusable functions in `tests/browser/workspace-journey.mjs`, accepting a Playwright
page and base URL. The Playwright production and development projects now run
these through `npm run check`. Manual screenshots/evidence belong in ignored `artifacts/`.

T4 browser assertions are in `tests/browser/support-journey.mjs`:
`verifySupportDialogs(page, baseURL, expectedLicense, theme)` accepts the repository
LICENSE text and an optional `light`/`dark` theme. Run against dev and served build
with a fresh browser context; the Playwright runner does this as part of `npm run check`.
The journey checks exact license text, modal focus, backdrop handling, keyboard
scrolling, Close/Escape restoration, and Back/Forward/malformed-route dismissal.

To diagnose dialog focus, open Help or About using Enter. In DevTools,
`document.querySelector('dialog')?.matches(':modal')` must be true; inspect
`document.activeElement` after Tab/Shift+Tab, Escape, and browser Back/Forward.
Use a breakpoint in `SupportDialog.tsx` at setup/cleanup or `keepTabInside` to
follow native DOM changes. After Close, the opener has focus and no dialog remains;
after navigation, the new view heading has focus. In About, keyboard-open Read full
license, use Ctrl+End to reach the bottom on Windows/Linux, then Tab to reach Close.
The license disclosure resets on reopening. Test at 320 px and in both themes.
T6 verified genuine Chromium 200% page zoom in both themes: an isolated test
extension used `chrome.tabs.setZoom`, `getZoom` returned 2, CSS viewport halved from
1256×801 to 628×400, and devicePixelRatio doubled from 1 to 2. Workspace and modal
keyboard journeys passed. Earlier 640×400 reflow evidence alone was not a zoom test.

### Browser regression runner

`playwright.config.ts` owns two Chromium projects and their server processes:

- `production`: serves the existing `dist/` on `127.0.0.1:4273`; runs navigation,
  settings, both-theme desktop/320 px dialogs and exact license, storage failures,
  live system theme, honest empty states, and the JavaScript-disabled notice.
- `development`: serves Vite on `127.0.0.1:5273`; runs the shared journeys plus
  collapsed-error recovery and StrictMode subscription/history/storage checks.
  The error fixture exports test-only unmount access to check listener cleanup.

Both servers use strict ports and are stopped by Playwright. Occupied test ports
fail startup instead of silently reusing a stale server. Normal dev/preview ports
5173/4173 remain separate. Each test receives a fresh browser context. The runner
uses two workers, no retries, failure screenshots/traces, and an HTML report.
CI uploads `playwright-report/` and `test-results/` on failure for seven days;
these paths are ignored locally. A failed journey fails the shared gate.

```sh
npm test
npm run build
npm run test:browser
npm run test:browser -- --project=production --grep "failed write"
npm run test:browser -- --project=development --grep "collapsed rejected input"
```

`npm test` explicitly selects `tests/*.test.mjs`, so Node does not discover
Playwright specs. `npm run test:browser` expects an up-to-date `dist/`; the full
`npm run check` always rebuilds it. To step through a browser test, append `--debug`
to a targeted command. Inspect the failed assertion and retained DOM snapshot in
`test-results/`; open `npx playwright show-report` or use
`npx playwright show-trace <path-to-trace.zip>` for actions, DOM, and network evidence.
Use `DEBUG=pw:webserver` in your shell environment to diagnose server startup.

The CI suite checks the Gridline application, native theme actions, stable canvas
bounds, drawer lifetime, and collapsed tips/background recovery in Chromium.
Historical T6 separately ran the shared workspace/support helpers in Firefox 157.0, both themes,
and checked desktop/320 px layouts. Install that optional engine with
`npx playwright install firefox`; use `firefox.launch()` from `@playwright/test`,
a fresh context, and the exported journey helpers against a served build. T6's
disposable local runner and evidence are in ignored `artifacts/t6/`.

For manual zoom reproduction, serve the production build, set browser page zoom
to 200%, and confirm the CSS viewport halves and devicePixelRatio doubles relative
to 100% on the same display. Check workspace keyboard controls and Help/About in
both themes, including scrolling the full license and restoring opener focus.
Do not substitute CSS zoom, pinch zoom, or changing the emulated viewport. At page
zoom, use a viewport capture rather than full-page screenshot resizing.

See the [T6 checkpoint](plans/website-foundation.md#t6-checkpoint--2026-10-31) for
measured contrast, bundle inspection, screenshot paths, and per-acceptance results.
Screen-reader and physical-touch behavior remain unverified. Current Gridline
verification and user-review status are in the [migration checkpoint](plans/gridline-application.md).

## Wall-art core usage and debugging

`npm ci` installs the pinned geometry dependencies. Vite serves the single-thread
CAD WASM as a same-origin asset; no CDN, credential or cross-origin isolation is
required. The asset is about 23 MB raw / 7.3 MB gzip; configure compression when a
hosting target is chosen. License/source material is in `public/licenses/` and
`THIRD_PARTY_NOTICES.md`. The explicit maintenance script
`node scripts/update-third-party-notices.mjs` refreshes those copies from pinned
packages/sources; it is not part of startup or the ordinary build.

Open Design, wait for Model ready, then open Workspace settings and scroll to Blade
pattern. Enter or blur commits a valid numeric draft. Revert restores accepted
parameters. Save design JSON and Load design JSON use versioned parameters; they do
not persist a browser project. Export STEP/STL/3MF captures one accepted revision.
Files use millimeters and assembly placement, not bed packing. STEP temporarily
rebuilds the CAD worker after download to release native export memory; the previous
preview stays visible. Seed is saved but has no geometric effect in generator 1.

Useful checks:

```sh
node --test tests/wall-art-core.test.mjs tests/wall-art-worker.test.mjs tests/wall-art-contracts.test.mjs
npm run check
node scripts/qualify-wall-art.mjs
npm run preview -- --host 127.0.0.1 --port 6473 --strictPort
node scripts/qualify-wall-art-browser.mjs
```

The last command is optional local evidence, after a build and with the preview
server running. It uses a headed Windows integrated-GPU Chromium profile, optional
Firefox, and the retained local `artifacts/t6/zoom-extension` for genuine page zoom.
It is not a portable CI prerequisite. Set `WALL_ART_URL` to use another preview URL.
Without the extension, reproduce 200% page zoom manually using the browser menu;
confirm CSS viewport and DPR changes as described above. Use headed captures when
checking an overlapping drawer: headless Chromium full-page screenshots can omit a
partially covered WebGL layer. Core browser regressions run in both CI projects.

For worker diagnosis, break in `geometry/worker.ts` at generation/export and in
`editor/worker-client.ts` at response acceptance, timeout and `retireSTEPWorker`.
Inspect epoch/revision, accepted digest and budget metadata; do not log complete
designs. The 30-second watchdog terminates blocked CAD and retains the last valid
client mesh. Retry restores native handles before export is enabled. Tests inject
controlled workers and a fake clock to reproduce stale completion, crash and timeout.
`tests/browser/wall-art-core.spec.ts` demonstrates WASM-request failure, explicit
Retry and missing-WebGL fallback without adding production debug controls.
Its camera regression checks the rendered silhouette after each zoom/rotate action,
two seed-only regenerations and a viewport resize, then checks a second activation.
`WallArtPreview.tsx` consumes each relative command sequence once; model and viewport
synchronization must not apply it again.

Format breakpoints are in `src/shared/export/`. Node tests reimport curved native
STEP through Replicad and independent occt-import-js, and STL through Three's reader.
Browser tests use the independent 3MF reader and check all 100 world-space placements.
For offline slicer checking, run OrcaSlicer with `--arrange 0 --export-stl <model.3mf>`
from an artifacts directory; its default command otherwise rearranges the assembly.
Actual evidence and platform limits are in the
[core checkpoint](plans/wall-art-core.md#implementation-checkpoint--2026-11-02).

## Impeccable design tooling

Impeccable is installed project-locally in `.opencode/skills/impeccable/` with an
OpenCode command at `.opencode/commands/impeccable.md`. The skill reports 4.8.0;
the downloaded engine reports v0.1.18. The command uses the current `skill` tool's
`id` argument and retains project approval gates. Automatic hooks are not enabled.
The upstream Apache license and third-party notices accompany the skill; the
application's root LICENSE is unchanged.

The installation used
`npm exec --yes --package=impeccable -- impeccable install --providers=opencode --scope=project --no-hooks --yes`.
The launcher can download its engine on first use. Downloaded binaries under
`scripts/bin/` and `.impeccable/` runtime state are ignored. This does not add an
application dependency. Review installer updates before replacing the local
command adaptation or license notices.

The approved Gridline composition now runs at `/` on the application server.
Contour, Gallery, Conventional, Quiet studio, the comparison wrapper, and the
standalone Gridline study are retired. Historical captures and detector output
remain ignored under `artifacts/`; they are evidence, not runnable UI alternatives.
Impeccable tools and licenses remain installed. `docs/product.md` is the product
source of truth; the [foundation spec](specs/website-foundation.md) records the
accepted Gridline visual contract. No separate DESIGN.md is maintained.

Gridline evidence is local under `artifacts/gridline-application/`: `verify.mjs`
runs the size matrix, Firefox journeys, forced colors, storage/download sentinels,
and genuine Chromium zoom using the retained T6 test extension. `audit.mjs` measures
rendered contrast and inspects the production module graph. Serve the current build
on port 4473 before running these local evidence scripts. The portable regressions
live in `tests/browser/` and run through `npm run check`; no artifact file is required
by CI. At constrained heights, document and panel scrolling are intentional. Compare
canvas bounds in document coordinates so scrolling is not mistaken for resizing.

## Lifecycle

| Stage | Entry point / owner | Required output |
| --- | --- | --- |
| Specify | `/spec wall-art` -> specifier | `docs/specs/wall-art.md`: bounded parameter and mesh contracts, acceptance IDs, exclusions, test plan |
| Design UI | `/design docs/specs/wall-art.md` -> frontend | UI section in that same spec: layout, controls, keyboard/mobile behavior, states |
| Plan implementation | `/plan-implementation docs/specs/wall-art.md` -> build | `docs/plans/<feature>.md`: technical decisions, ordered tasks, dependencies, files, and checks; stop for user review |
| Approve plan | User reviews the plan and requests changes or implementation | Explicit approval of the current plan before coding |
| Implement | `/implement docs/specs/wall-art.md` -> build | Execute the approved plan as a verified vertical slice |
| Verify | `/verify docs/specs/wall-art.md` -> qa | Per-acceptance-ID pass/fail/unverified evidence, browser/mesh checks where relevant |
| Review | `/review <diff or PR scope>` -> reviewer | Reproducible correctness findings; read-only |
| Deliver | `/ship <scope>` -> build | Readiness, actual checks, and remaining gaps; publish only when requested |
| Open PR | `/pr [files or task; title/body guidance]` -> build | Verify selected changes, commit on a feature branch, push, and return the PR URL |

Use these stages for meaningful features; small fixes need only relevant steps.
Do not make a separate spec, ceremony, or agent call for every edit. `/design`
is for UI changes; a geometry-only fix does not need a UI design pass.

After a task review, `/pr` authorizes commit, push, and PR creation for the selected
scope. Arguments can name files or the completed task and suggest a title/body;
without arguments, use the completed task in the conversation. Preserve unrelated
changes and review the exact staged diff. Reuse a matching open PR when applicable.
Report local checks and actual CI status separately. This does not authorize merge,
deployment, or the next task. `/ship` remains the general delivery-readiness command.

Keep each decision in one place: the spec states required behavior and acceptance;
`docs/architecture.md` owns shared module/data-flow decisions; the implementation
plan explains the technical work. Use concise task tables with dependencies, files,
contracts, and completion checks. Link to requirements instead of repeating them.
`/plan-implementation` writes the plan and stops with a short review summary. The
user reviews `docs/plans/<feature>.md` and approves it or requests changes. Planning
never continues into coding in the same invocation. A later explicit request to
implement the presented plan counts as approval; a plan file alone does not.
`/implement` requires that approval and stops if the plan or approval is missing.
Keep the plan current; material scope, architecture, or contract changes require
renewed review. Small fixes can use a reviewed inline plan. Read-only plan mode
can explore options; build records the document. Neither phase authorizes delegation.

Documentation follows the same handoff: the spec lists affected document paths,
required changes, and unresolved decisions; the technical plan assigns updates to
tasks. Build drafts shared architecture proposals during planning and applies the
approved decisions and verified setup/usage/status updates during implementation.
Check architecture, product/roadmap, README, and development docs as relevant; avoid
duplicating them in the spec. Record no change when none is needed. A milestone is
not complete while required documentation updates are unresolved.

Resolve blocking contract decisions before implementation. Build starts with
validation and a small headless geometry/export path, then connects the editor.
`npm run check` remains the shared local/CI gate; extend it with app build and
geometry/browser tests as those components are introduced. QA verifies the
implementation; reviewer independently inspects the diff. Build fixes failures
and reruns the affected checks. Neither AI review replaces CI.

### Delegation and handoffs

Invoking a specialist command requests that specialist, not a multi-agent fan-out.
For parallel work, explicitly request delegation from build, for example:
`/implement docs/specs/wall-art.md; delegate frontend and geometry after agreeing
the shared contract`. Build remains responsible for the integrated result.

Each assignment states the spec path, acceptance IDs, input/output contracts,
owned file paths, required checks, and dependencies on other work. Build owns
package manifests, lockfiles, and shared-contract edits during parallel work.
Geometry owns validation/generation/export; frontend owns the editor/preview;
QA owns requested test additions. Assign test paths explicitly to avoid overlap.
Start dependent work only after its contract is stable; a stub is not evidence
that integration works. Specialists return changes and blockers to build without
launching nested agents or overwriting another scope.

Handoff format: acceptance IDs covered; files changed; contract changes requested;
commands/results and artifact paths; blockers and unverified behavior. Verification
may be summarized in the task/PR; no separate report file is required by default.

## Available tools

### Agent responsibilities

- Built-in `plan`: explore requirements and technical options without editing.
- Built-in `build`: own implementation, shared contracts/dependencies, integration,
  fixes, and delivery; perform routine work directly.
- `specifier`: write feature contracts and testable acceptance criteria; edit only
  `docs/specs/`, not application code.
- `frontend`: editor UX, visual design, accessible controls, and browser behavior.
- `geometry`: deterministic generation, collision/printability checks, and export.
- `qa`: verify against acceptance criteria; add regression tests only when requested.
  `/verify` itself is verification-only and does not modify tests or application code.
- `reviewer`: independent, read-only correctness review.

Commands provide repeatable task prompts to these roles. `/spec` now invokes a
specifier with a limited document-editing scope; built-in plan remains read-only.
`/plan-implementation` uses build with a documentation-only task and a mandatory
review stop. `/implement` uses build to execute the user-approved plan.
Use specialists directly or delegate only when requested. Skills supply reusable
procedures; tools execute concrete operations.

### Local checks

project_check runs the same Node entry point as npm run check, without a shell, with
a two-minute timeout. Run npm ci first. CI uses no model API keys or MCP servers.
The validator checks repository conventions, not the complete upstream OpenCode
schema. Validate new config fields against https://opencode.ai/config.json and
current documentation before adding them.

Use existing filesystem/Git tools and gh for GitHub tasks. Existing user-level
MCP connections remain available; no project credentials or machine-specific
paths are configured. Use browser automation for UI work when available and
mesh/slicer tools for geometry verification when needed. Report unavailable
checks instead of claiming success. No custom plugin is needed at this stage.

## Definition of done

- Acceptance criteria have evidence, including invalid/boundary inputs.
- npm run check succeeds; new runtime features have runnable tests and build checks.
- UI changes include keyboard/error-state checks and a reviewed screenshot.
- Export changes include mesh validation and a slicer import when available.
- Changes are documented; no secrets or accidental generated artifacts are staged.
- Handoff states what changed, what ran, and remaining limitations.

## Hosting direction

Keep the first generator client-side where practical. Avoid a hosted-service
dependency for basic design/export. Add deployment configuration for the actual
target once chosen; do not assume a particular cloud provider. The official
host may monetize under the owner's retained rights in LICENSE.

## Codex pull request reviews

Use the official ChatGPT/Codex GitHub integration. It runs independently of
OpenCode's local reviewer and the deterministic GitHub Actions CI checks.
No OpenAI API key or custom Actions workflow is required for this route.

Account setup (not enabled by adding these files):

1. Sign in to ChatGPT/Codex and connect GitHub. Grant the integration access to
   RogerGMartins/printametric; select only this repository if that is the intended scope.
2. Open https://chatgpt.com/settings/code-review, select this repository, and
   enable Automatic review under Review code. Check personal Automatic review
   preferences and the Review trigger setting as well.
3. Confirm the account's review availability and usage limits before enabling
   automatic runs. This uses Codex account entitlement, not GitHub CI minutes alone.
4. On a representative PR, comment `@codex review`. Confirm a reaction and a
   completed review from the Codex connector. A configured toggle alone does not
   verify end-to-end operation.

Codex reads applicable `AGENTS.md` files, including the root Code Review Rules.
Those rules must be published with the repository changes to be available on
GitHub. Keep CI as a separate gate; AI reviews are advisory and can miss issues.

Setup verified on 2026-10-29 by reloading the repository's Codex settings:

- Repository connected; automatic code review enabled for all PRs, on every push.
- Exhaustive review off to avoid repeated review passes.
- Automatic security review enabled for all PRs whenever code review runs.
- Security reporting thresholds: High for automatic reviews, Medium for manual.

The repository-specific settings override personal review preferences. Settings
verification alone is not an end-to-end test: confirm a completed Codex review on
a representative PR and record its result there. Codex can use the review rules
once the branch containing AGENTS.md is published on GitHub.

Official documentation: https://developers.openai.com/codex/integrations/github
