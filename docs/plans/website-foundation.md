# Website foundation — implementation plan

Status: T1 merged; T2 implemented and verified; stopped for user review and a PR opportunity.
User approval recorded on 2026-10-30: start implementation, one task at a time,
with a review and separate pull-request opportunity after each task. Stop after
each task's checks; wait for the user's request before publishing or starting
the next task. The user explicitly requested T2 on 2026-10-30; stop again after T2.
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
| T3 — Workspace and navigation | T2 | Connect App to adapters; add `src/shared/workspace/Workspace.tsx` and `WorkspaceDisplay.tsx`, `src/tools/wall-art/content.ts`, `src/app/content.ts`, and `src/styles.css`. App passes tool content to common UI. Build header, links, notices, three empty views, summaries, native settings, and responsive theme tokens. | Navigation/history/focus, retained session settings, reload defaults, and responsive order work in browser journeys. Shared modules have no app/tool imports. AC-2–9/11/12. |
| T4 — Support dialogs | T3 | Add `src/app/SupportDialog.tsx`; connect Help/About, exact content, and unchanged LICENSE as bundled text. Implement dialog focus, close restoration, and navigation while open. | Keyboard-only Help/About and full-license access work at narrow widths and zoom. AC-9/10/14. |
| T5 — Regression integration | T3, T4 | Add `playwright.config.ts`, `tests/browser/foundation.spec.ts`, and a non-production fixture under `tests/fixtures/`. Add scripts to run unit tests explicitly without Node discovering Playwright files; extend `scripts/run-check.mjs` and the existing CI workflow with app checks and browser installation. | Shared gate retains existing checks and runs the build, unit regressions, and production browser suite. Dev-only fixture also exercises collapsed-error recovery. AC-1–3/5–10/12–15. |
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
