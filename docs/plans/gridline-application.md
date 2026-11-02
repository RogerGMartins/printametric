# Gridline — single application UI

Status: **Implemented and verified; ready for user review.** User explicitly approved this plan
with “approve” on 2026-10-31. The user selected Gridline and requested:
“apply it. and remove the other ui versions, i want to continue with just one”.
G1–G4 are implemented as one vertical slice. The checkpoint below records the actual
application migration and cleanup; publication requires a separate request.

## Outcome and sources of truth

The application at `/` becomes the selected blue Gridline workspace: cobalt header
with navigation, edge-to-edge preview below it, one initially collapsed **Workspace
settings** panel along the bottom, and sun/moon theme action. No direction selector,
comparison iframe, legacy layout switch, or separate prototype remains runnable.

Historical visual references inspected and then retired: `artifacts/impeccable-trial/gridline-layout.mjs`,
`gridline-layout.css`, Gridline tokens/SVGs in `build-previews.mjs`, and the selected
study screenshots. Use their composition, not the multi-direction generator or
prototype event wiring. Behavior comes from the current application and
[foundation N1/P1/P2/H1 contracts](../specs/website-foundation.md), with the explicit
changes below. The older Quiet studio section is superseded, not an implementation
target. Existing [T6 evidence](website-foundation.md#t6-checkpoint--2026-10-31) covers
the previous UI and must not be presented as Gridline verification.

No new dependencies, geometry, export, saved-design format, or product scope.
Preserve the six pending T6 documentation changes and the installed Impeccable tools.

## Technical decisions

### Layout and visual system

- Replace the original stylesheet's layout/tokens rather than layering a second
  theme implementation over it. Keep one `src/styles.css` with Light/Dark tokens.
  Preserve Gridline cobalt `#153ac7` header in both themes; Light surface/stage/text
  start at `#ffffff` / `#f3f6fc` / `#14213b`, Dark at `#232d39` / `#1b242e` / `#f1f4f8`.
  Use the study's system typography, compact proportions, native controls and SVGs.
  Separate decorative dividers from ≥3:1 control boundaries and focus colors;
  verify normal text ≥4.5:1. Contrast corrections must retain the selected palette.
- App owns header, view links, active-view heading, theme actions, and shell notices.
  Shared Workspace owns the full-size preview and one native settings `details`.
  Preview fills the main area below the responsive header; opening the panel overlays
  the canvas without changing its bounds. No page max-width, side rail, or right gutter.
- Put tips, background radios, unavailable tool sections, and real-unavailability
  summaries in the panel's responsive auto-fit grid. No empty columns when view-specific
  groups disappear. Keep Dimensions/Parts/Plates available in every view, rather than
  copying the prototype's accidental coupling of summaries to Design-only content.
- Panel content has bounded vertical scrolling; its summary remains reachable.
  Size the panel against available workspace height, not only viewport height.
  Header wraps at narrow widths. For extreme height/zoom where header and minimum
  usable workspace cannot fit, permit document scrolling rather than clipping controls.
  No horizontal scrolling at 320 px or genuine 200% zoom. Native dialogs retain their
  own bounded scrolling and ≥12 px viewport margins.
- Keep view-specific empty messages and decorative-grid warning visible on the canvas.
  Move the foundation availability statement into the panel, accessible in all views;
  do not add fake preview geometry, dimensions, loading states, or unavailable actions.

### State, errors, and focus

- Rename the session-only `advancedOpen` field to `settingsOpen` in shared types,
  state/defaults/validators, fixture, and tests. Default false, retained across view
  changes, reset on reload. It has never been persisted, so no storage migration or
  compatibility alias is needed. Remove the nested Advanced disclosure entirely.
- Shared Workspace receives explicit shell-provided title/heading-ref and notice
  slots as needed; it imports no app/tool modules. Tool content stays in
  `src/tools/wall-art/content.ts`; shell status copy stays in `src/app/content.ts`.
  WorkspaceDisplay renders controlled tips/radios and their labels. Workspace owns
  the disclosure and recovery refs because it controls whether those fields are visible.
- Field errors and recovery actions remain **outside** the collapsible content in a
  visible, politely announced notice area. It stays reachable when the drawer is closed
  or the viewport is short; it must not cover the header or drawer summary.
  Review Preview background opens the panel and focuses the selected radio; add an
  equivalent tips recovery action if its invalid field is hidden. Opening alone never
  clears errors. Valid edits clear only that field; closing preserves values/errors.
  Keep theme/navigation notices and Retry independent of the drawer.
- Maintain ordinary hash links, modified-click behavior, active-link idempotence,
  Back/Forward, title updates, skip-to-main, and post-navigation heading focus.
  Use DOM order matching the header: brand, view links, theme actions, Help/About;
  the initial skip link precedes it. Main is followed by the panel summary and, when
  expanded, settings. Responsive wrapping must not use a conflicting visual order.
  Existing modal focus/inertness/restoration and navigation dismissal remain intact.

### Theme actions

- One native button with decorative sun/moon SVGs, accessible name **Switch to dark
  theme** or **Switch to light theme**, visible effective mode and System/Manual source.
  Activate by click/Enter/Space to select the opposite effective scheme explicitly.
- **Use system** appears only for an override; writes `system`, resumes OS following,
  and returns focus to the toggle. It is a separate action, not a third toggle state.
  Keep the exact `printametric.foundation.theme.v1` key and three string values.
- Route both actions through current validated `changePreference` and storage adapter.
  No writes during bootstrap/OS updates. A failed write retains the applied scheme,
  prior bytes, and Retry action; Retry resubmits the current preference without toggling.
  Theme errors describe the toggle. Keep System default, live OS changes, and Light
  fallback. Update Help to describe the actual controls and remembered preference.

## Ordered work — one implementation handoff

| Step | Depends on | Owned paths / work | Completion check |
| --- | --- | --- | --- |
| G1: Align contracts | Approval | Replace superseded visual sections of `docs/specs/website-foundation.md` with selected Gridline and decisions above; update `src/shared/workspace/types.ts`, `src/app/state.ts`, fixture and state/bootstrap tests for `settingsOpen`. | P1 validation/defaults retained; no stale field alias, persisted-key change, or contradictory active visual requirement. AC-5/6/8. |
| G2: Migrate actual app | G1 | `src/app/App.tsx`, optional focused `ThemeControl.tsx`, `content.ts`, `src/shared/workspace/Workspace.tsx`, `WorkspaceDisplay.tsx`, `src/styles.css`; adjust tool content only where needed for typed group placement. Keep SupportDialog behavior; adapt styling only. | `/` matches selected Gridline in both themes; single drawer, full-window preview, retained navigation/settings, visible errors, correct theme actions. AC-1–14. |
| G3: Update and verify regressions | G2 | `tests/browser/{workspace-journey,support-journey}.mjs`, `foundation.spec.ts`, `development.spec.ts`, test-only error fixture; reuse existing probes and T6 techniques. | Update assertions to real toggle/drawer behavior, preserving all prior failure/history/modal checks. Verify requirements below; `npm run check` passes. AC-1–15. |
| G4: Retire studies and document | G3 | Delete inventoried study sources below, remove `.gitignore` trial exceptions; update README, development, architecture, roadmap, foundation plan/spec and this plan with verified status. | Only `/` is documented as the UI; no study generator/selector or obsolete executable study remains. Historical evidence is labelled historical. Rebuild, rerun gate, inspect clean scoped diff and actual final application URL. |

No separate review gates between G1–G4. Implement and verify the entire slice before
handoff. Any new product/architecture decision beyond this plan requires renewed review.

## Verification requirements

- Reuse the 21 Node / 22 browser regression baseline; adapt selectors and behavior
  assertions, not just delete old checks. Add meaningful checks for toggle/System
  focus, failure/retry, drawer persistence and collapsed-field recovery.
- Geometry-of-layout checks: canvas meets both window edges and bottom of header;
  drawer open/closed leaves canvas bounds unchanged in normal layouts; no reserved
  settings columns across Design/Print layout/Assembly. Exactly one workspace
  disclosure (About's license disclosure remains separate).
- Review screenshots in both themes at 320, 390, 768, 959, 960, 1280, 1920 and 2560 px;
  short 640×400 and genuine Chromium 200% browser zoom. Test focus outlines, contrast,
  forced colors, errors with the drawer closed/open, and reachable scrolling.
- Chromium shared gate and Firefox navigation/dialog smoke. Preserve exact full
  LICENSE, storage/download sentinels, StrictMode cleanup and production dependency
  checks. Screen-reader/physical-device verification stays unverified unless performed.
- Application imports must not reference `artifacts/`. Dev and fresh production `/`
  must show the same Gridline composition. Check retired study paths cannot display
  old versions (SPA fallback to the single app is acceptable). No stale dist/dev-server
  link in the handoff. Evidence belongs under ignored `artifacts/gridline-application/`.

## Cleanup inventory and boundaries

Inventory taken on `fd144c6` with pending T6 docs; recheck before deleting. Migrate the
selected styling/SVGs and relevant layout assertions before removing their sources.

| Location | Action during G4 |
| --- | --- |
| Tracked `artifacts/impeccable-trial/`: `README.md`, `build-previews.mjs`, `content.js`, `gridline-layout.css`, `gridline-layout.mjs`, `index.html`, `preview.js`, `verify-gridline.cjs` | Delete all eight after migration. One actual app replaces all four directions and the standalone selected prototype. |
| Ignored files in the same directory: `contour.html`, `gallery.html`, `gridline.html`, `conventional.html`, `options.json`, `verify.cjs` | Remove obsolete runnable studies, direction payload, and study runner explicitly. Do not blanket-delete the directory. |
| Ignored `artifacts/foundation-redesign/`: `index.html`, `study.css`, `study.js`, `README.md`, `app-checks.js`, `review-checks.js` | Remove the superseded Quiet studio runnable study and its study-specific instructions/runners. |
| Existing PNG/WebP screenshots, detector JSON, `artifacts/t6/`, other task evidence/PR bodies | Retain historical verification evidence; remove active navigation/documentation links to old studies. Evidence is not a second maintained UI. |
| `.opencode/skills/impeccable/`, command, ignored engine/runtime; root LICENSE | Preserve tooling and licensing. No reinstall or broad runtime deletion. |
| `.gitignore` trial allowlist | Remove the eight-file exceptions; return all artifact outputs to ignored status. |

Preserve prior checkpoint results as history. Remove obsolete **active** prototype
run commands/links from README/development, and replace the stale visual spec rather
than keeping several current alternatives. Architecture owns the resulting shared
layout/focus contracts; docs must link to that source instead of duplicating it.

## Review decision

No unresolved product questions. Recorded approval covers the `settingsOpen` rename, one
drawer with visible collapsed-error recovery, persistent theme toggle, single-app
layout migration, and inventoried study cleanup. Commit/PR/deployment are separate
requests. Implementation now stops for user review of the working application.

Planning verification: Node 24.22.2 `npm run check` passed scaffold validation,
both typechecks, production build, 21 Node tests and 22 Chromium tests (46.3 s).
These verify the unchanged baseline, not the proposed Gridline implementation.

## Implementation checkpoint — 2026-10-31

G1–G4 complete: the real `/` uses Gridline; `settingsOpen` replaces the old session
field; theme actions retain the exact storage contract; the single settings drawer
owns both display fields and their recovery focus. Help/About preserve native modal
behavior and exact LICENSE text. No application dependency was added.

Changed implementation: `src/app/{App,ThemeControl}.tsx`, `content.ts`, `state.ts`,
`src/shared/workspace/{Workspace,WorkspaceDisplay}.tsx`, `types.ts`, and `src/styles.css`.
Updated Node assertions and production/development browser journeys; added
`tests/browser/theme-actions.mjs` and 16 Gridline/theme keyboard regression cases.
The baseline 22 browser cases remain. The existing error fixture needs no field
rename because it used default disclosure state; its journey now tests both recoveries.

Removed all eight tracked study files and all twelve inventoried ignored study
files. Removed the `.gitignore` trial allowlist. Preserved historical captures,
detector output, T6 evidence, installed Impeccable tools/licenses, and root LICENSE.
Updated the foundation spec, shared architecture, README, development instructions,
roadmap, and foundation plan. Product scope and geometry plans need no change.

### Acceptance evidence

Windows, Node 24.22.2, Chromium 156.0.8078.4, Firefox 157.0. Local evidence is in
ignored `artifacts/gridline-application/`; CI uses only tracked tests.

| IDs | Result | Evidence |
| --- | --- | --- |
| AC-1 | Pass | Dev `/` and rebuilt production `/` show the same cobalt header and one settings disclosure. Old study URLs fall back to this app; no iframe or old version remains. |
| AC-2/3 | Pass | Shared journeys retain direct routes, active-link idempotence, malformed-hash recovery, Back/Forward, and heading focus. |
| AC-4 | Implementation checked; user review pending | Both-theme closed/open captures at 320/390/768/959/960/1280/1920/2560 px and 640×400 reviewed. Document-coordinate assertions confirm unchanged canvas bounds and full width. Settings have no reserved empty columns. |
| AC-5/6 | Pass | Node state boundaries; browser checks retain open/closed settings across views, reset on reload, and independently recover tips/background errors by keyboard. Error regions remain above the drawer at desktop, 320 px, and short height. |
| AC-7/8 | Pass | Both OS schemes, Enter/Space, Use system focus, live OS changes, exact persisted values, denied/corrupt storage, retained bytes, and independent Retry. |
| AC-9/10 | Pass for tested keyboard/browser behavior | Chromium and Firefox navigation/dialog journeys; genuine Chromium 200% zoom; exact license scrolling, focus trap/restoration, and navigation dismissal. |
| AC-11 | Pass | Rendered minimum text contrast 5.77:1 Light / 5.57:1 Dark; minimum tested boundary/focus contrast 3.95:1 / 3.64:1. Error text 7.59:1 / 8.21:1. Both-theme forced colors and focus captures reviewed. |
| AC-12/13 | Pass | All view/tips/background combinations retain honest empty states and all summaries. Storage/download sentinels unchanged; included production graph has 27 modules and excludes tooling, tests, artifacts, CAD, and rendering packages. |
| AC-14 | Pass | Updated Help matches the real drawer/toggle; both-theme dialog journeys compare full text with repository LICENSE. |
| AC-15 | Pass | Final post-cleanup `npm run check` under Node 24.22.2 passed scaffold checks, both typechecks, build, 21 Node tests and 38 Chromium tests (2.6 min browser run). `git diff --check` also passed. |

Evidence files: `results.json`, `entry-results.json`, `contrast.json`, `modules.json`,
`matrix-{light,dark}-{closed,open}.png`, individual full-size Chromium/Firefox
captures, `forced-colors-*.png`, `errors-*.png`, `audit-*.png`, and `zoom-200-*.png`.
Genuine zoom used the isolated T6 extension: `getZoom` returned 2; viewport changed
1256×801 to 628×400; DPR changed 1 to 2. Keyboard/support journeys passed in both
themes. Short-height document scrolling is intentional; full-page resizing is not
used as zoom evidence.

The long-running preview on 4373 stalled Firefox asset delivery. The same build
loaded through a fresh strict-port preview on 4473 and passed Firefox journeys.
No application workaround was needed. The current handoff uses that fresh server.
Verified application URL: `http://127.0.0.1:4473/`. The development root at
`http://127.0.0.1:5173/` also shows Gridline. Final build: 27 modules,
8.16 kB CSS and 239.91 kB JavaScript (2.46 / 75.20 kB gzip).

Remaining gaps: user review of implemented visuals, screen-reader behavior, and
physical-touch testing. No commit, push, PR, deployment, or next task was performed.
