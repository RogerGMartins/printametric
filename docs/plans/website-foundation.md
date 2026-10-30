# Website foundation — implementation plan

Status: T1–T3 merged; T4 implemented and checked, preparing its requested PR.
True 200% browser zoom and cross-browser/screen-reader checks remain unverified.
The selected Gridline visual study supersedes the earlier Quiet studio proposal;
application implementation still requires a reviewed implementation-plan update.
Earlier T3 checks below cover the original UI, not the revised visual/theme-control
criteria. Publishing T4 does not implement the redesign. Trial source is retained
under `artifacts/impeccable-trial/`; generated mockups and screenshots remain ignored.
User approval recorded on 2026-10-30: start implementation, one task at a time,
with a review and separate pull-request opportunity after each task. Stop after
each task's checks; wait for the user's request before publishing or starting
the next task. The user explicitly requested T4 on 2026-10-30; implement support
dialogs in the current UI, then stop for review. The user has now requested its
separate PR. Gridline application implementation and T5 remain pending.
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
