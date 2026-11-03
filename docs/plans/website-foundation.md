# Website foundation — implementation plan

Status: T1–T5 merged (T5 in PR #15); T6 verification is recorded below as history.
The later [Gridline — single application UI](gridline-application.md) plan was approved
on 2026-10-31 and owns the implemented replacement, fresh evidence, and study cleanup.
Earlier checkpoints and authorization limits below describe their original task
boundaries. They are not current application instructions. Historical screenshots
remain under `artifacts/`; runnable studies have been retired.
User approval recorded on 2026-10-30: start implementation, one task at a time,
with a review and separate pull-request opportunity after each task. Stop after
each task's checks; wait for the user's request before publishing or starting
the next task. The user explicitly requested T4 on 2026-10-30; implement support
dialogs in the current UI, then stop for review. PRs #13 and #14 are now merged.
The user subsequently requested implementation of the next task, authorizing T5
regression integration only. After the implementation handoff, the user requested
a PR for T5. After merging #15, the user requested updating main and implementing
the next task, authorizing T6 verification and documentation. Stop for review after
T6; that request did not authorize publishing or Gridline implementation. The later
explicit approval is recorded in the Gridline plan.
Scope/acceptance: [spec](../specs/website-foundation.md).
Module boundaries: [architecture](../architecture.md#website-foundation).
Build owns integration and performs these tasks directly unless delegation is requested.

## Technical decisions

- One client-side React/TypeScript app, Vite, plain CSS, native controls/dialogs.
  Install compatible stable runtime/build packages and Playwright at implementation;
  retain one root lockfile and keep the OpenCode SDK outside the browser graph.
- Follow the [code practices](../architecture.md#code-practices-for-the-foundation):
  one-way module dependencies, strict application types, pure state transitions,
  controlled settings, and cleaned-up browser effects. Bootstrap reads initial
  browser preferences once before rendering App; root StrictMode remains enabled.
- App owns session state. Pure TypeScript functions validate preference updates and
  resolve hashes; browser adapters own history, storage, and system-theme effects.
  React state is sufficient; no routing or global-state library is needed for three views.
- Separate `app/` shell coordination, `tools/wall-art/` tool content, and
  `shared/workspace/` common UI/types. App passes tool content to shared UI; shared
  code imports neither tools nor app. Add future tool algorithms inside their tool.
  Keep this a direct composition, with no tool registry or plugin framework.
- Preference updates accept `unknown` at their validation boundary. Return either
  an accepted typed value or a field error; an invalid update cannot replace valid state.
  Keep field errors separate from navigation and storage notices, with spec-defined
  clearing rules. No validation or browser side effects inside presentation components.
- Navigation resolves `{ view, replaceHash?, notice? }`; one controller handles
  link activation and history events, including idempotent active links. Initial
  resolution does not focus; later navigation closes a dialog and focuses the heading.
- Theme adapter returns preference plus read status. Explicit selection validates,
  applies in memory, then attempts storage; failure keeps the selected theme and
  previous stored bytes. Apply the effective scheme at the document root. Subscribe
  to OS changes only as needed and clean up listeners on unmount.
- Unit-test pure `.ts` modules with Node's existing runner (erasable TypeScript;
  typecheck separately). Use Playwright for actual browser behavior and production
  smoke tests. A test-only page exercises rejected updates/collapsed field errors;
  exclude it from production entry points and output.

## Ordered tasks

Each task includes its relevant checks. T6 completes cross-cutting verification.

| Task | Depends on | Work and files | Done when |
| --- | --- | --- | --- |
| T1 — Runnable shell | — | Add `index.html`, `src/main.tsx`, `src/app/App.tsx`, `vite.config.ts`, and `tsconfig.app.json`; update root package/lockfile. Use the official React plugin, root StrictMode, and strict browser types separate from Node/tooling types. Add dev/build/preview/app-typecheck scripts while retaining tooling typechecks. | Dev and served static build open the shell; app typecheck passes; browser entry graph excludes development tooling. AC-1 groundwork. |
| T2 — State and adapters | T1 | Add `src/app/state.ts`, `navigation.ts`, `theme.ts`, `src/shared/workspace/types.ts`, and `tests/foundation-state.test.mjs`. Implement P1 validation, N1 hash resolution, and injectable P2 storage/system adapters. | Tests cover allowed/invalid values, missing/corrupt/denied storage, retained state/bytes, and recovery. AC-2/3/6/7/8 logic. |
| T3 — Workspace and navigation | T2 | Connect App to adapters through one-time bootstrap; add shared Workspace/WorkspaceDisplay, tool/app content, and CSS. Build header, links, notices, empty views, summaries, settings, and responsive themes. Add bootstrap regressions, reusable browser journeys, and the error fixture needed to verify recovery. | Navigation/history/focus, retained session settings, reload defaults, and responsive order work in browser journeys. Shared modules have no app/tool imports. AC-2–9/11/12. |
| T4 — Support dialogs | T3 | Add `src/app/SupportDialog.tsx`; connect Help/About, exact content, and unchanged LICENSE as bundled text. Implement dialog focus, close restoration, and navigation while open. Add reusable `tests/browser/support-journey.mjs` for T5's runner. | Keyboard-only Help/About and full-license access work at narrow widths and zoom. AC-9/10/14. |
| T5 — Regression integration | T3, T4 | Add `playwright.config.ts` and `tests/browser/foundation.spec.ts`; reuse the T3 journey helpers/error fixture. Add scripts to run unit tests explicitly without Node discovering Playwright files; extend `scripts/run-check.mjs` and the existing CI workflow with app checks and browser installation. | Shared gate retains existing checks and runs the build, unit regressions, and production browser suite. Dev-only fixture also exercises collapsed-error recovery. AC-1–3/5–10/12–15. |
| T6 — Visual and compatibility check | T5 | Review screenshots/contrast and focus at spec sizes, 959/960 px, and 200% zoom in both themes. Smoke-test a second browser engine. Inspect production network/dependencies and download/storage sentinels. Put evidence in `artifacts/`. | `npm run check` passes; AC-1–15 have pass/fail/unverified evidence, environment details, and remaining gaps in the handoff. |

## Integration checks

- Documentation tasks: T1 updates `README.md` with verified dev/build commands;
  T5 updates `docs/development.md` with application/browser checks, setup, and
  verified debugging steps: browser source breakpoints, targeted test execution,
  Playwright failure evidence, and storage-error reproduction using the fixture. T6
  reconciles `docs/architecture.md` with implemented boundaries and updates
  `docs/mvp-roadmap.md` from acceptance evidence. Check that each documented command
  works and that pending features remain marked pending before handoff.
- Configure Playwright to start/stop served production output for the main suite;
  use a separate dev-server fixture path for internal invalid-input recovery.
  Do not expose test controls through application routes or include them in `dist/`.
- Simulate storage exceptions before app initialization, system scheme changes,
  malformed hashes, history during dialogs, and keyboard-only operation. Verify
  actual focus and visible error recovery, not just component presence.
- In T2/T3, use typed actions and pure transitions to keep state/error changes
  together; keep browser writes outside those transitions. In T5, exercise the
  StrictMode development build for duplicate history/writes and listener cleanup.
  Review module imports and Hooks usage against the architecture before T6 closes.
- Each task documents module purpose and non-obvious behavior in comments. T6
  reviews readable names, direct control flow, useful error context, and current
  technical docs/diagrams; remove unnecessary abstraction rather than explaining it
  with more prose. No production debug UI or logging of full user designs.
- Inspect current CI before editing it. Install the browser used by the gate
  explicitly; keep model API keys and MCP services out of checks. Browser tests
  must leave existing scaffold/tooling tests running and fail the gate on regressions.
- After T6, report implemented ACs, changed files, commands/results, evidence paths,
  and limitations. No application work or acceptance is complete merely because
  this plan exists.

## T1 checkpoint — 2026-10-30

- Installed React/React DOM 19.3.1, Vite 8.3.5, React plugin 6.1.2, and React
  types 19.3.0 using the root lockfile. Added the minimal Design shell, StrictMode,
  separate app/tooling typechecks, and dev/build/preview scripts.
- Added app typechecking/build to the shared gate now so the T1 PR receives CI
  coverage. T5 still owns automated browser integration. Updated README, development
  setup/debug steps, architecture status, and the roadmap's setup item.
- Windows; Node 24.22.2 (default machine Node is 26); Chromium 156.0.8078.76.
  Clean `npm ci`, `npm run build`, and `npm run check` passed: scaffold validation,
  both typechecks, production build, and 2 existing tests. `git diff --check` passed.
- AC-1: dev and served production `/` open Design. Inspected the actual production
  module graph: app, React/React DOM/scheduler, and bundler helpers only; no SDK.
  Keyboard skip-to-main and the JavaScript-disabled notice passed. Dev source maps
  and a startup breakpoint worked; StrictMode rendered twice as expected.
- Reviewed plain-shell screenshots at 1280×800 and 320×800, with visible native
  focus and no horizontal overflow: `artifacts/t1-{5173,4173}-{desktop,narrow}.png`.
  Final browser run had no console/page errors. The designed styling is T3 work.
- AC-15 is partial; the other full acceptance criteria remain unverified. Second
  browser/theme/layout journeys belong to later tasks. Remote CI has not run.
  No commit, push, PR, or T2 work at this checkpoint.

## T2 checkpoint — 2026-10-30

- Added pure defaults, field validation, and state/error transitions; shared display
  and content types; injectable hash/history and theme storage/media adapters.
  Bootstrap and subscriptions stay explicit, without import-time browser access.
  App integration, visible settings, heading focus, and styling remain T3.
- Regression coverage includes every P1 value/type boundary, independent error
  clearing, collapsed-error retention, hash recovery, history writes/cleanup,
  missing/invalid/16- and 17-character/oversized storage, denied access, retained
  state/bytes, retry recovery, OS fallback, and subscription cleanup/remounts.
- Windows, Node 24.22.2: `npm run check` passed (both typechecks, production build,
  scaffold checks, 18 tests: 16 foundation plus 2 existing). The focused foundation
  suite and storage-only command in development docs passed. `git diff --check`
  passed. No dependencies or existing UI entry points changed.
- Chromium 156.0.8078.76, isolated dev-page contexts: actual Back/Forward, active-link
  history counts, invalid-hash replacement, notice recovery, and unsubscribe passed.
  Actual localStorage preservation/reload and OS Light-to-Dark emulation/root scheme
  application/cleanup passed; an unrelated storage sentinel remained unchanged.
  These direct adapter checks produced no page errors and added no runtime fixture.
- AC-2/3/6/7/8 **logic verified**; complete UI acceptance remains pending. AC-15
  includes these regressions automatically through the existing Node test discovery;
  browser-suite integration remains T5. No new screenshot needed: UI is unchanged.
  README reports T2 status; architecture/development docs describe contracts and checks;
  roadmap items requiring the full UI remain unchecked. No product/spec change.
- Stop here: T3 has not started. No commit, push, PR, or remote CI for T2 yet.

## T3 checkpoint — 2026-10-30

- Connected one-time bootstrap, pure reducer, hash/history, theme persistence/OS
  subscriptions, and post-navigation focus. Added shared workspace/settings UI,
  wall-art content, responsive tokens, honest empty states, and visible errors.
  Shared modules import no app/tool code. No dependencies added.
- Help/About remain visibly unavailable for T4. Added Retry theme storage for a
  same-value retry. Brought the planned dev-only error fixture forward from T5
  to verify T3 recovery; T5 still owns the Playwright runner and CI integration.
- Windows, Node 24.22.2, Chromium 156.0.8078.76: `npm run check` passes both
  typechecks, production build, scaffold validation, and 21 tests. The focused
  bootstrap command passes 3 tests. Browser helper functions in
  `tests/browser/workspace-journey.mjs` passed against dev and production; the
  error fixture passed keyboard recovery and independent-error clearing.
- AC-1/2/3/5/6/8/12: T3 journeys passed initial/direct/refresh navigation,
  Back/Forward, active-link history, focus, invalid-hash recovery, retained settings,
  reload defaults, corrupt/16/17/oversized/denied storage, and retry preservation.
  StrictMode reads theme once and writes only on actions. All 24 view/theme/tips/
  background combinations preserve honest content. OS switching/fallback passed.
- AC-4/7/9/11: workspace checks pass; dialogs, true desktop 200% zoom, and final
  cross-browser coverage remain T4/T6. Reviewed both-theme desktop/narrow/focus
  and error screenshots, plus tablet/breakpoint layouts. No horizontal overflow
  at 320/390/768/959/960/1280 px. Tablet basic controls and desktop preview copy are
  above the fold. Sampled text contrast minimum is 5.29:1 Light / 6.60:1 Dark;
  select borders exceed 4.5:1. Evidence: `artifacts/t3-{light,dark}-*.png`.
- AC-13: production graph excludes fixtures/SDK/Node tools; requests are HTML/JS/CSS
  only. No downloads occurred; a saved-design sentinel stayed unchanged. AC-15
  remains partial: browser journeys are not yet part of `npm run check`. AC-10/14
  remain T4. Verified documented source breakpoints and storage-failure reproduction.
- Updated README, architecture, development debugging instructions, and roadmap.
  Stop for user review/PR: no T4, commit, push, PR, deployment, or remote CI yet.

## T4 checkpoint — 2026-10-30

- Added Help/About actions and one native SupportDialog with heading focus, inert
  background, explicit Tab wrapping, Escape/Close restoration, and navigation
  dismissal. The full unchanged LICENSE is bundled as text inside About's disclosure.
  Help describes current behavior, unavailable features, storage, and planned formats.
  Current styling/theme select remain; no compact redesign or dependencies added.
- Regression helper `tests/browser/support-journey.mjs` passed on dev and served
  production, both themes, including 320 px production. It compares the full license
  string, tests keyboard opening/scrolling/closing, both tab directions, backdrop
  handling, opener restoration, Back/Forward, and malformed-route heading focus.
  Fixed a reproduced Shift+Tab escape after clicking the backdrop and covered it.
- Existing workspace journeys passed on dev/production; the dev rejected-update
  fixture still passes. OS changes while a dialog is open preserve focus. Denied
  storage notices survive opening/closing; dialogs cause zero storage writes and
  no downloads. An unrelated storage sentinel stays unchanged. Reload closes dialogs.
  Production requests contain only HTML/JS/CSS, with no separate license request.
- Windows, Node 24.22.2, Chromium 156.0.8078.76. `npm run check` passed scaffold
  validation, both typechecks, production build, and 21 Node tests. The new browser
  helper was run separately through browser tooling; T5 still owns CI integration.
  Browser checks had no page errors. `git diff --check` passed.
- Reviewed both-theme dialog, license, and keyboard-focus screenshots at desktop,
  tablet, and 320 px. Both dialogs fit 1280×800, 768×1024, 320×800, and 640×400 with
  12 px minimum margins and no horizontal overflow. Local evidence:
  `artifacts/t4-{light,dark}-{help,about}-{1280,768,320,640,keyboard}.png` (keyboard
  captures use Dark). Automated Ctrl+plus left the viewport/scale unchanged, so
  true 200% browser zoom is unverified; 640×400 tests only demonstrate reflow.
- AC-14 passed. AC-9/10 dialog behavior passed in Chromium; full zoom, second-engine,
  and screen-reader evidence remains pending. AC-15 stays partial until T5. These
  checks do not establish proposed redesign acceptance. README, architecture,
  development/debugging docs, and roadmap now describe the implemented support UI.
- The original checkpoint stopped for user review. The user subsequently requested
  a separate T4 PR after merging the Gridline study in #13. Reverification on that
  merged base passed `npm run check` (21 tests, both typechecks, build) and the
  support journey on dev and served production, Light/Dark, at 1280×800 and 320×800.
  No browser page errors occurred. Reviewed fresh `artifacts/t4-pr-*.png` captures.
  The same true-zoom, second-engine, and screen-reader limitations remain. T5,
  Gridline application implementation, merge, and deployment are outside this PR.

## Impeccable visual trial — 2026-10-30

- User authorized installation and immediate visual exploration, and asked the
  assistant to choose references. Installed tooling is documented in
  [development.md](../development.md#impeccable-design-tooling).
- Local studies under `artifacts/impeccable-trial/`: Contour uses a slate shell
  and left inspector; Gallery uses warm neutral surfaces and a right inspector;
  Gridline uses cobalt navigation and a full-width preview above a settings dock.
  A conventional editor provides a comparison. Gridline was selected in the
  subsequent refinement below, superseding the earlier Quiet studio proposal.
- The interactive wrapper passed Chromium checks for all four studies in both
  themes at 1440, 768, and 320 px: no horizontal overflow or outer-page scrollbar.
  At 320 px, keyboard theme toggle/System reset, view changes, retained background,
  tips, modal focus/escape/restoration, and exact license content passed. No page
  errors occurred. Screenshots: `artifacts/impeccable-trial/final-*.png`.
- Reviewed desktop, narrow, and dark screenshots. Corrected Contour navigation
  contrast, phone action wrapping, and nested wrapper scrolling. Static Impeccable
  scans of all four generated HTML sketches returned no findings after replacing
  a tinted shadow. This is not a complete accessibility or browser acceptance audit.
- Node 24.22.2 `npm run check` passed scaffold validation, both typechecks, build,
  and all 21 tests. The first run exceeded the tool's two-minute limit; the retry
  completed successfully. `git diff --check` passed. Engine binaries, runtime
  state, and generated trial artifacts are ignored. Application dependencies are unchanged.
- T4 source remains preserved. Application redesign requires visual selection and
  implementation-plan review. Prototype preferences are not persisted; prototype
  navigation is not the application's history adapter. T5 remains pending.

### Gridline refinement

- User selected Gridline and requested collapsible bottom menus and a preview
  spanning the whole window below the header. The revised local study combines
  view navigation with the header and removes the canvas frame and page gutters.
- The initial revision used four native disclosures along the bottom, expanding
  over the canvas without resizing it. On phones, one menu opened at a time.
  Model availability and dimension/part/plate summaries remain in Wall-art settings;
  the foundation notice is in Display settings. No generation/export is implied.
- The initial `verify-gridline.cjs` checked canvas bounds,
  keyboard expand/collapse, retained background on navigation, one open phone
  panel, and Help focus restoration. Passed in Chromium at 1440×900, 768×1024,
  320×800, and 640×400, both themes. Reviewed `gridline-revised-*.png` captures.
- Static detector reports two padding warnings from inherited workspace/navigation
  border rules. The rendered selected layout overrides those borders; the canvas
  is intentionally edge-to-edge. These are not treated as accessibility evidence.
- The user then requested one collapse control for the whole bottom panel and
  removal of an empty right column. The final study uses one native Workspace
  settings disclosure. Its responsive content grid fills available tracks and
  removes inherited explicit column placement when view-specific groups hide.
- The final browser regression passed in both themes at widths 320, 640, 768, 960,
  1440, 1920, and 2560 px, including a 400 px-high window. It checks the canvas and
  iframe right edges, one collapse control, no empty settings column across all
  three views, retained background selection, and Help focus restoration. Reviewed
  `gridline-final-*.png` screenshots. The full reported white strip was not
  reproduced before the change; final right-edge coverage is verified.
- Retain the prototype source and regression function for the requested PR;
  generated HTML and screenshots stay ignored. Prototype Help/About no longer
  depends on uncommitted T4 source, so this work can be reviewed separately.
- This records the selected visual direction, not approval to replace the
  application. T4 source and its review boundary remain preserved. The user
  explicitly authorized a PR for this completed design-trial work.

## T5 checkpoint — 2026-10-31

- User authorized the next ordered task after merging T4. Added Playwright Test
  1.64.1 with Chromium 156.0.8078.4, one root lockfile, and separate production/dev
  projects. Playwright owns strict-port servers at 4273/5273 and fresh contexts;
  no dependency on MCP or the developer's running preview. Two workers, no retries.
- `npm run check` retains scaffold validation, both typechecks, build, and all
  21 Node regressions, then runs 22 browser tests. Node discovery explicitly selects
  `tests/*.test.mjs`. TypeScript checks the config/specs and their browser probes;
  existing JavaScript helpers remain runtime-tested. CI installs Chromium and OS
  libraries on Linux/Windows and retains failure reports/traces/screenshots.
- Reused T3/T4 journeys for navigation/history, focus, settings/reload, malformed
  hashes, native controls, dialog containment/restoration, and exact LICENSE text.
  Added production storage boundary/failure/retry and system-theme checks, both-theme
  desktop/320 px dialogs, all 24 view/theme/tips/background combinations, and
  JavaScript-disabled startup. Browser page errors and downloads fail each test.
- Dev checks exercise collapsed-error recovery, one bootstrap theme read, zero
  initial storage writes, one history entry per new view, and no active-link entry.
  Instrumented native subscriptions verify StrictMode setup/cleanup and zero remaining
  app listeners after the fixture's test-only unmount. No application UI changes.
- Windows, Node 24.22.2: browser installation, `npm test` (21), typecheck, and final
  `npm run check` passed. Final browser suite: **22 passed in 29.4 s**. Both documented
  targeted commands (`failed write`, `collapsed rejected input`) passed separately.
  The initial run exposed a test assertion issue: Playwright's text matcher excludes
  `noscript`. Direct DOM text plus visibility now checks the actual notice. That
  failure correctly failed the gate and produced screenshots, a trace, and report.
- AC-1/2/3/5/6/9/10/12/14 and existing P2 behavior now have repeatable Chromium
  regressions; AC-15 local integration passes. Revised visual/theme-toggle criteria
  are not implemented or accepted by these tests. AC-13 gets download sentinels,
  storage sentinels, output-path and production-request checks; the final dependency
  audit remains T6. True 200% zoom, second-engine and screen-reader checks remain
  unverified. The report is `playwright-report/index.html`; failure evidence uses
  `test-results/`. Remote Linux/Windows CI has not run for this uncommitted task.
- Updated README, development setup/debugging, architecture test boundaries, roadmap
  progress, and the spec's stale status banner. Product scope and geometry contracts
  need no change. Gridline stays a separate study. The implementation stopped for
  review; the user subsequently requested publication of this T5 scope as a PR.
  T6 and application redesign implementation remain outside that request.

## T6 checkpoint — 2026-10-31

The user authorized this task after merging #15 and updating main to `fd144c6`.
Verification covers the current T3/T4 application, not the selected Gridline study.
No runtime defect requiring a code change was reproduced. Application source,
dependencies, tests, and CI configuration are unchanged by T6.

### Environment and evidence

- Windows; Node 24.22.2; Playwright 1.64.1; Chromium 156.0.8078.4 and Firefox 157.0.
  Installed Firefox with `npx playwright install firefox`; no package change.
- `npm run check` passed scaffold validation, both typechecks, production build,
  21 Node tests, and 22 Chromium tests (34.4 s browser suite). Merged PR #15's
  Linux/Windows push and PR checks also passed; that is evidence for the merged
  T5 code, not a remote run of this documentation change.
- Production screenshots and bounding-box checks covered Light/Dark at 1280×800,
  768×1024, 390×844, 320×800, 959×900, and 960×900 in Chromium. Firefox covered
  1280×800 and 320×800 in both themes. No horizontal page/dialog overflow; layout
  changes at 960 px and preview precedes controls below it. Reviewed representative
  workspace, keyboard-focus, Help, and expanded-license screenshots across these sizes.
- Reused workspace and support journeys in both engines and themes: direct hashes,
  history, reload, native controls, modal wrapping/backdrop/Close/Escape, exact license,
  and navigation dismissal passed. No page errors or downloads. A storage sentinel
  seeded once survived the entire navigation/reload/dialog journey without reseeding.
- Genuine Chromium zoom used an isolated temporary profile and local test extension
  calling `chrome.tabs.setZoom(tabId, 2)`. `getZoom` returned 2; CSS viewport changed
  1256×801 → 628×400 and devicePixelRatio 1 → 2. Workspace keyboard/reload/history
  and both-theme support journeys passed. Dialogs retained ≥12 CSS px margins and
  no horizontal overflow; long license scrolling and Close remained reachable.
  This is browser page zoom, not CSS zoom or resized-viewport emulation. Captures use
  the compositor viewport: Playwright full-page capture altered capture sizing at
  page zoom and produced misleading cropped images, which were replaced.
- Measured visible text/background pairs on Grid workspace, Help, and expanded About:
  minimum 5.29:1 Light / 6.60:1 Dark. Tested boundary/accent combinations with page,
  surface, and selected backgrounds: minimum 3.80:1 / 3.56:1. Error text against
  surface: 7.59:1 / 9.26:1. Focus uses a visible 3 px outline. Forced-colors emulation
  retained native checkboxes/radios, selected-link underline, and keyboard radio focus.
  These sampled checks are not a complete accessibility certification.
- An in-memory Vite build exposed 26 included modules: application, React/React DOM,
  scheduler, LICENSE, CSS/HTML, and Vite/Rolldown helpers only. No SDK, Playwright,
  fixtures, geometry/rendering/export dependencies, or Node APIs entered the bundle.
  Browser requests were same-origin HTML/JS/CSS only, including opening full LICENSE.
  Production JS is 237.99 kB (74.68 kB gzip); CSS 5.23 kB (1.65 kB gzip).
- Reviewed imports and effects: shared workspace imports no app/tool modules; wall-art
  imports shared types only. Bootstrap remains outside rendering; storage writes are
  explicit actions; navigation/media effects and native dialogs have cleanup. No
  production debug controls/logging or architectural changes were needed.
- Impeccable static scan of `src/styles.css`, `src/app`, and `src/shared/workspace`
  returned `[]`. This supports the code review, not redesigned-UI acceptance.

Local evidence is ignored under `artifacts/t6/`: `results.json`, `contrast.json`,
`modules.json`, `detector.json`, `chromium-*.png`, `firefox-*.png`, `forced-colors-*.png`,
and `zoom-200-*.png`. Disposable `verify.mjs`, `audit.mjs`, and `zoom-extension/`
record reproduction details; they are not application or CI features.

### Acceptance disposition

Pass means verified within the stated desktop-browser scope. Fail for a proposed
visual requirement means not implemented, not a newly introduced regression.

| ID | Result | Evidence / remaining gap |
| --- | --- | --- |
| AC-1 | Pass | Local gate builds and serves production; dev and production journeys pass. |
| AC-2 | Pass | Direct hashes, reload, Back/Forward, active-link history and focus in Chromium/Firefox. |
| AC-3 | Pass | Malformed/markup-like route recovery in unit and browser journeys. |
| AC-4 | Fail — proposed visuals absent | Current responsive layout/zoom works; neither historical Quiet studio nor selected Gridline is implemented. |
| AC-5 | Pass | Tips/background/disclosure retain on navigation and reset on reload. |
| AC-6 | Pass | Invalid-value unit tests and dev collapsed-error recovery preserve accepted state. |
| AC-7 | Fail — proposed control absent | System/Light/Dark behavior passes; the app still has a select, not sun/moon and Use system. |
| AC-8 | Partial | Existing P2 storage, invalid/denied data and same-value retry pass; toggle/Use system actions remain unimplemented. |
| AC-9 | Pass for current controls | Keyboard journeys and focus pass, including zoom; screen-reader behavior unverified. |
| AC-10 | Pass | Both native dialogs, exact license, narrow layouts, history dismissal, genuine 200% zoom. |
| AC-11 | Partial | Current measured contrast and forced-colors checks pass; proposed V2 tokens/styled controls are absent. |
| AC-12 | Pass for current content | All 24 view/theme/tips/background combinations retain honest empty states; decorative revision treatment is absent. |
| AC-13 | Pass | Included-module audit, same-origin requests, zero downloads, unchanged storage sentinel. |
| AC-14 | Pass | Help/About content and complete repository LICENSE checked in both engines. |
| AC-15 | Pass | Shared gate includes all existing checks and production/dev browser regressions; merged T5 CI passed both OSes. |

Technical audit summary (heuristic, not certification): accessibility 3/4 (keyboard
and contrast verified; assistive technology untested), performance 3/4 (lean graph,
no animation/assets; device performance not profiled), theming 4/4 (current tokens
and OS behavior), responsiveness 3/4 (reflow/zoom verified; physical touch untested),
implementation integrity 3/4 (consistent native controls; visual replacement pending):
**16/20, good**. No verified P0/P1/P2 implementation defect. The visual-contract gaps
above require the separately reviewed Gridline plan, not incidental T6 styling edits.

T6's verification work is complete; the foundation's full visual acceptance is not.
Screen-reader testing and physical touch remain unverified. README, architecture,
development guidance, roadmap, and spec status now reflect this boundary. Product
scope and LICENSE need no change. Stop for user review; no publication or next task.
