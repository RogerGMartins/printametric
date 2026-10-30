# Website foundation — implementation plan

Status: awaiting user review; no application code or runtime verification yet.
Review this plan before requesting implementation. Approval is not yet recorded.
Scope/acceptance: [spec](../specs/website-foundation.md).
Module boundaries: [architecture](../architecture.md#website-foundation).
Build owns integration and performs these tasks directly unless delegation is requested.

## Technical decisions

- One client-side React/TypeScript app, Vite, plain CSS, native controls/dialogs.
  Install compatible stable runtime/build packages and Playwright at implementation;
  retain one root lockfile and keep the OpenCode SDK outside the browser graph.
- App owns session state. Pure TypeScript functions validate preference updates and
  resolve hashes; browser adapters own history, storage, and system-theme effects.
  React state is sufficient; no routing or global-state library is needed for three views.
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
| T1 — Runnable shell | — | Add `index.html`, `src/main.tsx`, `src/app/App.tsx`, `vite.config.ts`, and `tsconfig.app.json`; update root package/lockfile. Add dev/build/preview/app-typecheck scripts while retaining tooling typechecks. | Dev and served static build open the shell; browser entry graph excludes development tooling. AC-1 groundwork. |
| T2 — State and adapters | T1 | Add `src/app/state.ts`, `navigation.ts`, `theme.ts`, and `tests/foundation-state.test.mjs`. Implement P1 validation, N1 hash resolution, and injectable P2 storage/system adapters. | Tests cover allowed/invalid values, missing/corrupt/denied storage, retained state/bytes, and recovery. AC-2/3/6/7/8 logic. |
| T3 — Workspace and navigation | T2 | Connect App to adapters; add `src/editor/Workspace.tsx`, `WorkspaceDisplay.tsx`, `src/app/content.ts`, and `src/styles.css`. Build header, links, notices, three empty views, summaries, native settings, and responsive theme tokens. | Navigation/history/focus, retained session settings, reload defaults, and responsive order work in browser journeys. AC-2–9/11/12. |
| T4 — Support dialogs | T3 | Add `src/app/SupportDialog.tsx`; connect Help/About, exact content, and unchanged LICENSE as bundled text. Implement dialog focus, close restoration, and navigation while open. | Keyboard-only Help/About and full-license access work at narrow widths and zoom. AC-9/10/14. |
| T5 — Regression integration | T3, T4 | Add `playwright.config.ts`, `tests/browser/foundation.spec.ts`, and a non-production fixture under `tests/fixtures/`. Add scripts to run unit tests explicitly without Node discovering Playwright files; extend `scripts/run-check.mjs` and the existing CI workflow with app checks and browser installation. | Shared gate retains existing checks and runs the build, unit regressions, and production browser suite. Dev-only fixture also exercises collapsed-error recovery. AC-1–3/5–10/12–15. |
| T6 — Visual and compatibility check | T5 | Review screenshots/contrast and focus at spec sizes, 959/960 px, and 200% zoom in both themes. Smoke-test a second browser engine. Inspect production network/dependencies and download/storage sentinels. Put evidence in `artifacts/`. | `npm run check` passes; AC-1–15 have pass/fail/unverified evidence, environment details, and remaining gaps in the handoff. |

## Integration checks

- Documentation tasks: T1 updates `README.md` with verified dev/build commands;
  T5 updates `docs/development.md` with application/browser checks and setup. T6
  reconciles `docs/architecture.md` with implemented boundaries and updates
  `docs/mvp-roadmap.md` from acceptance evidence. Check that each documented command
  works and that pending features remain marked pending before handoff.
- Configure Playwright to start/stop served production output for the main suite;
  use a separate dev-server fixture path for internal invalid-input recovery.
  Do not expose test controls through application routes or include them in `dist/`.
- Simulate storage exceptions before app initialization, system scheme changes,
  malformed hashes, history during dialogs, and keyboard-only operation. Verify
  actual focus and visible error recovery, not just component presence.
- Inspect current CI before editing it. Install the browser used by the gate
  explicitly; keep model API keys and MCP services out of checks. Browser tests
  must leave existing scaffold/tooling tests running and fail the gate on regressions.
- After T6, report implemented ACs, changed files, commands/results, evidence paths,
  and limitations. No application work or acceptance is complete merely because
  this plan exists.
