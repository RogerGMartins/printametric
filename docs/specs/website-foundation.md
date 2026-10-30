# Website foundation

Status: T1–T4 behavior is implemented and merged; T5 regression integration is
authorized. The Quiet studio UI proposal below is historical and superseded by
the selected Gridline study. It is not the implemented visual contract. Gridline
application work still requires a reviewed plan update; see the implementation plan
for current approvals and evidence. T5 tests the existing T3/T4 controls and behavior.
Technical tasks: [implementation plan](../plans/website-foundation.md).
Product and stack: [product](../product.md), [architecture](../architecture.md),
[roadmap](../mvp-roadmap.md), and [confirmed website direction](website-definition.md).

## Goal and scope

Open directly into a useful wall-art workspace: navigate views, change display
preferences, and read Help/About. The owner confirmed this scope, but rejected the
first T3 appearance. The replacement visual direction below requires review.

- Working: Design, Print layout, Assembly, themes, display settings, Help/About.
- Empty preview with view-specific explanations. Dimensions, Parts, and Plates
  each say `Not available`; never show fabricated values, objects, or loading progress.
- Visible unavailable sections: Wall-art settings in Design; Build-plate settings
  in Design and Print layout. Prefer explanatory text to disabled buttons.
- Deferred: geometry, model parameters, presets, camera interaction, plate rules,
  arrangement, assembly guidance, save/load/autosave, undo/redo/reset, and downloads.
  No model actions, file pickers, CAD/rendering dependencies, or design-storage access.
- Mounting and document kits remain unapproved proposals. Accounts, services,
  catalogue/marketing pages, deployment, offline installation, and custom pathname
  routes are outside this milestone. Narrow-screen access is required; a dedicated
  phone editing workflow is deferred.

Proposed defaults: tips on, Plain background, Advanced closed; retain these only
until reload. Theme starts with System and persists on explicit selection. These
defaults define UI preferences, not future generator parameters or a design schema.

## Behavior contracts

### Navigation — N1

`/` or an empty hash opens Design. Links use `#design`, `#print-layout`, and
`#assembly`. Support direct entry, refresh, Back, and Forward. Unknown/malformed
hashes show Design, replace the hash without adding history, and show a recovery
notice without echoing the input. Clear that notice on the next valid navigation.

Use ordinary links with `aria-current="page"`; selecting the active view adds no
history entry. Preserve all session preferences across view changes. Update the
document title to `<View> · Printametric`. Focus the new view heading after link
navigation or history traversal, but never steal focus at initial entry. A history
change closes an open dialog and focuses the new heading. Dialogs do not alter history.

### UI state — P1

| Field | Allowed values | Default / lifetime |
| --- | --- | --- |
| `view` | `design`, `print-layout`, `assembly` | `design`; derived from N1 |
| `themePreference` | `system`, `light`, `dark` | `system`; persisted under P2 |
| `showWorkspaceTips` | Boolean | `true`; page session |
| `previewBackground` | `plain`, `grid` | `plain`; page session |
| `advancedOpen` | Boolean | `false`; page session |
| `supportPanel` | `none`, `help`, `about` | `none`; page session |

Reject invalid updates at the state boundary, retain the previous valid value,
and show a field-associated error for rejected user operations. Test this boundary
without production debug controls. Closing Advanced preserves its value. Tips never
hide restrictions, labels, errors, or storage notices. Display settings work in all views.

### Theme storage — P2

Use `printametric.foundation.theme.v1` with the exact string `system`, `light`, or
`dark`. Read once on initialization; no JSON parsing. Missing data uses System.
Reject other strings, including values longer than 16 characters, with a notice;
preserve the stored bytes until an explicit selection succeeds. Catch read/write
failures: the page stays usable and a selected theme still applies in memory.
A successful explicit selection clears the storage notice. Never clear unrelated
keys, access saved designs, or claim that a design was saved. No cross-tab sync;
the last successful write determines the next reload.

System follows OS changes; explicit Light/Dark ignores them. If the system preference
cannot be read, use Light. Theme applies to the workspace, native controls, and dialogs.

## UI design

### Direction — V1: Quiet studio, compact edition (proposed)

Treat the workspace as a composed creative tool, not a collection of form cards.
Use graphite/porcelain surfaces, a restrained violet accent, precise typography,
and a joined inspector/preview frame. Both themes receive the same hierarchy and polish.
System remains the default; a dark review image is not a change to theme semantics.

The running T3 workspace, source, and first Quiet studio study were inspected before
this iteration. The first study improved hierarchy but retained excessive gaps,
oversized chrome, and a framework-like theme select. This revision replaces that
composition, not only its palette:

- A compact wordmark header ends in a sun/moon control, not a dropdown. Its current
  effective scheme and System/Manual source remain visible; `Use system` appears
  only after an override. Original inline SVG symbols need no asset dependency.
- A view toolbar aligns `Wall art workspace` over the inspector and ordinary view
  links over the preview. The smaller view heading and `Display settings only`
  scope line use one compact row, not a large title band.
- Inspector and preview share one frame with aligned 52 px headings. A single
  internal divider replaces the 24 px gap and two floating rounded cards. Working
  controls get stronger type; unavailable sections remain quiet, readable text.
- A 346 px desktop stage replaces the 418 px stage. A larger editorial empty
  heading, violet punctuation, and subtle stationary surface wash give it identity
  without illustrations, pretend geometry, axes, scene controls, or fake data.
- Native controls get compact, purpose-designed surfaces. Physical hit areas stay
  at least 44 px high. No component library or custom keyboard interaction model.
- The unavailable Help/About note moves to the footer, not a disabled toolbar
  control. T4's real support actions remain a later task.

Local-only review artifact (ignored, not included in the repository):
`artifacts/foundation-redesign/index.html`, served at
`http://127.0.0.1:5173/artifacts/foundation-redesign/index.html` while Vite is running.
This local HTML/CSS/JS study has small disposable review interactions, no
storage or app imports. `?theme=dark`, `?theme=light`, `?advanced=1`, and `?error=1`
select review variants; hashes select the three views. It is not runtime evidence
for the application. The footer's `Visual proposal · not the application` annotation
belongs only to the artifact. Generated screenshots are under the same directory.

### Layout — L1

```text
Printametric.                      Theme [sun | moon] Light · System
───────────────────────────────────────────────────────────────────
Wall art workspace       [ Design ]  Print layout  Assembly
───────────────────────────────────────────────────────────────────
Design                                        Display settings only
[navigation / theme notices, only when needed]
┌ Workspace display ────┬ Preview ───────────── No generated model ┐
│ [✓] Show workspace tips│                                       │
│ short optional tip    │      MODEL GENERATION UNAVAILABLE      │
│ Advanced          ˅   │               No model yet.            │
│ Plain background      │      Model generation is not           │
│───────────────────────│      available in this version.        │
│ Wall-art settings     │                                       │
│ unavailable explanation│                                      │
│───────────────────────├───────────────────────────────────────┤
│ Build-plate settings  │ Dimensions     Parts        Plates     │
│ unavailable explanation│ Not available Not available Not available│
└───────────────────────┴───────────────────────────────────────┘
Foundation workspace — no printable design, design saving, or downloads.
Help and About are not available yet.
```

Desktop: controls left, larger preview right. Below 960 CSS px: heading/notices,
preview/summaries, then controls in one scrolling column. Keep preview before
controls in document order at all sizes; use CSS desktop placement without duplicate
controls or responsive remounting. Header actions and navigation wrap at narrow widths.

- Fluid workspace, maximum 1500 px including padding; desktop inspector 276 px,
  no inter-panel gap. Header about 76 px tall; view toolbar about 62 px. View heading
  has 18 px above/below. No marketing hero or extra rail. Default desktop frame
  begins about 204 px from the top, rather than 270 px in the first proposal.
- Preview stage minimum height 346 px desktop, 240 px below 960 px, 220 px below
  600 px. These exclude its heading and summary strip; allow content to grow.
  No fixed workspace height or nested settings scrolling.
- At 1280×800, preview is wider than controls and its message needs no scrolling.
  At 768×1024, preview and the start of basic controls are visible without scrolling
  in the default, no-notice state. Notices/enlarged text may increase page height.
- At 320 px and desktop 200% zoom, no clipped essentials or horizontal page scroll.
  No sticky header/footer overlays. Keep labels visible, not icon-only menus.
- Below 600 px, brand and theme share a row when they fit; current mode and
  `Use system` stack beside the sun/moon control. Header wraps rather than clipping
  at 320 px or enlarged text. The visual `Theme` caption may hide, but the button's
  action name and visible current mode remain. View links form a full-width
  three-link row below the context label, with 44 px targets, not a hamburger.
  Summary cells become three
  label/value rows below 360 px. Inspector sections retain their own headings.

### Visual tokens — V2

Text identity in a local system sans-serif stack (`system-ui`, Apple system,
Segoe UI, sans-serif). No font downloads or third-party assets. A small violet
punctuation dot may follow the wordmark; it is decorative, not a status indicator.
No illustrations, heavy shadows, skeletons, or animation. One low-contrast radial
surface wash is allowed in Plain; it suggests no object, progress, or scene lighting.

| Token | Light | Dark |
| --- | --- | --- |
| Page | `#EEEDF0` | `#131217` |
| Surface | `#FBFAFC` | `#201E26` |
| Preview stage | `#F5F3F8` | `#18171D` |
| Inset / hover | `#E9E6EF` | `#302C39` |
| Text | `#26232E` | `#F1EDF6` |
| Secondary text | `#676170` | `#B1A9BE` |
| Decorative divider | `#D8D3DF` | `#3B3545` |
| Control boundary | `#82798E` | `#857B94` |
| Accent / focus | `#6142BE` | `#C2ACFF` |
| Selected surface | `#EAE3FC` | `#3C3056` |
| Plain surface wash, center to transparent | `#EAE4F380` | `#31253E40` |
| Error text | `#AA2945` | `#FFABC0` |
| Error surface | `#FFF0F3` | `#34212B` |

- Typography: body base 15 px/1.5; working labels and section headings 13–14 px,
  medium/semibold; view heading 25 px (23 px narrow); empty heading 38 px/1.15
  (32 px narrow), medium weight. Heading tracking about -0.04em. Empty body 14 px/1.65,
  13 px narrow. Secondary metadata 11–12 px, full opacity. Empty kicker is 11 px
  uppercase with 1 px tracking; no uppercase paragraphs. No downloadable fonts.
- Spacing: 4/8/12/16/20/24/28/32 px. Page padding 28 px desktop, 20 px tablet,
  14 px phone, 10 px at 320 px. Inspector horizontal padding 20 px (16 px phone);
  frame headers 12×20 px. Empty body maximum width 285 px inside a 400 px block.
- Radii: joined frame 12 px, segmented controls/notices 6 px; theme capsule 24 px.
  Quiet frame shadow: `0 8px 24px #00000008`. No shadow per field. Do not clip focus
  rings to achieve rounded panel corners.
- Separate decorative panel dividers from interactive boundaries. Only the latter
  must identify a control at 3:1. Secondary text remains full opacity. Active links
  have a filled selected surface, stronger type, and a short underline, not color alone.
- All action hit areas at least 44 px high; checkbox glyph 18 px inside a labelled
  44 px row. Focus is a 3 px accent outline, offset 4 px, never clipped. Selected
  controls remain distinguishable from focused controls.
- Measure rendered contrast: normal text 4.5:1, large text 3:1, meaningful control
  boundaries/focus 3:1. Do not use white text on the light-violet dark-theme accent.

### Controls and content — F1 / C1

| Element | Exact label / copy |
| --- | --- |
| Theme toggle | Sun/moon capsule; action name `Switch to dark theme` / `Switch to light theme` |
| Theme mode, always visible | `Light · System`, `Dark · System`, `Light · Manual`, or `Dark · Manual` |
| Restore default after override | `Use system` |
| Checkbox | `Show workspace tips` |
| Optional tip in T3 | “Change the display here. Help and About are not available yet.” |
| Optional tip after T4 | “Change the display here. Open Help for workspace guidance.” |
| Native disclosure | `Advanced — Plain background` / `Advanced — Grid background` |
| Radio fieldset inside Advanced | `Preview background`: `Plain`, `Grid`; “Changes the display only.” |
| Grid caption, even with tips off | `Decorative grid — not to scale.` |
| Wall-art settings | “Model editing and presets are not available yet.” |
| Build-plate settings | “Plate configuration is not available yet.” |
| Footer, all views | `Foundation workspace — no printable design, design saving, or downloads.` |

Every view has `Workspace display` and `Preview` headings. Empty-state copy:

| View | Heading | Body |
| --- | --- | --- |
| Design | No model yet | Model generation is not available in this version. |
| Print layout | No print layout yet | Part arrangement and fit checks are not available in this version. |
| Assembly | No assembly guidance yet | Assembly guidance is not available in this version. |

Preview header metadata says `No generated model` in every foundation view. A small
unboxed text kicker above the empty heading states `Model generation unavailable`,
`Part arrangement unavailable`, or `Assembly guidance unavailable` respectively.
It is not a button, progress indicator, or promise of an imminent release. Do not
add a call to action that cannot work. Keep the empty block centered; Grid requires
an opaque stage-colored text surface. The heading and explanatory body are the
focal point; avoid oversized decorative icons. Its accent full stop is decorative
and hidden from assistive technology, not a change to the C1 accessible heading.

Control treatment:
- Theme is one native button, visually a sun/moon switch, 88×44 px desktop (80×44
  narrow; 76×44 at 320 px). Both icons are decorative. The effective scheme's icon
  has a filled disc and accent ring. No dropdown, popup, three-way cycle, or separate
  click target per icon. Use action-button semantics, not `role=switch` with a changing
  name: `Switch to dark theme` / `Switch to light theme` describes the next action.
  `aria-describedby` references the visible current-mode status and any theme error.
  The optional title repeats the action; it is not the only accessible label.
- With no valid stored override, start in System and follow live OS changes. A
  click, Enter, or Space selects the **opposite effective scheme** as explicit
  `light`/`dark`, even when starting in System. Keep focus on the button. A discreet
  underlined `Use system` button appears only for explicit Light/Dark (including a
  restored override). It immediately resumes OS following, hides itself, and moves
  focus to the theme button. Announce the updated current mode politely.
- This changes presentation, not P1/P2. Integration submits `light`, `dark`, or
  `system` through the existing validated preference operation and persists the exact
  string under `printametric.foundation.theme.v1`. Returning to System writes
  `system`, not a new key or deletion. Initialization and OS changes never write.
  Failed writes retain in-memory mode, prior bytes, notice, and independent Retry;
  Retry submits the current preference without toggling it. No design storage access.
- Resting theme boundary is 1 px Control boundary; hover uses Inset without removing
  the current icon's ring. Focus adds the common 3 px outer outline; it never replaces
  the selection ring. `Use system` keeps its underline on hover/focus and a 44 px
  high hit area. Forced colors adds a system-color outline to the current icon.
- Tips stays a native checkbox, styled as an 18 px rounded square with a visible
  checkmark. The entire label row is clickable. Do not change it to an unlabeled switch.
- Advanced stays native `details`/`summary`. Display `Advanced` on the first line,
  `Plain background` / `Grid background` below it, and a small chevron on the right.
  Preserve the equivalent accessible name and expanded state. Use a divider, not
  another outlined card.
- Plain and Grid become two equal-width segmented choices within the native radio
  fieldset. Selected choice uses a 2 px accent border, fill, and semibold text;
  unselected choice uses a 1 px control border. Preserve native arrow-key selection,
  an actual focusable input, and a visible focus ring on its full label. Do not use
  `display:none` on inputs. No preview thumbnail that resembles geometry.
- Forced-colors mode restores native checkbox/radio glyphs and system focus/selection
  colors. No essential meaning depends on shadows, background fills, or hover.

Summaries remain a definition list, now integrated into the preview's lower strip.
Grid is subtle CSS without axes, ticks, dimensions,
plate outlines, or objects; empty-state text sits on an opaque surface. No measurement
controls or `mm` labels here. Future physical controls use explicit millimeter labels
and ranges from the geometry contract.

### Keyboard and dialogs — H1

Use one header, `Workspace views` navigation, main workspace, and non-sticky footer.
Brand is plain text. View heading is the main heading. Tab order: focus-visible
`Skip to workspace`, theme toggle, `Use system` when present, Help/About when T4
implements them, view links, working settings. Retry actions enter their document
position only while shown. Skip moves
focus to main; preview text is not a tab stop. Use native link, checkbox, disclosure,
button, and radio keyboard behavior; no custom arrow routing or global shortcuts.
Controls have visible labels, associated descriptions/errors, and visible focus.

One labelled modal at a time, preferably native dialog: focus its heading, keep
Tab/Shift+Tab inside, and make the background inert. Escape or visible `Close Help` /
`Close About` returns focus to the opener unless navigation requires heading focus.
Backdrop clicks do not close it. Maximum width 640 px, minimum viewport margins
12 px; bounded height with internal scrolling and reachable title/Close action.

Help sections: `Workspace views`, `Display settings`, `Keyboard`, `Theme storage`,
`Not available yet`. Explain that views are not required steps, only theme persists,
and editing, design save/load, arrangement, assembly guidance, and downloads are
unavailable. Include “Planned model formats: STEP, STL, and standard 3MF.”

About starts “Printametric is a personal-use source-available project, not open
source.” Explain personal, private, noncommercial individual use, including private
self-hosting; organizational use, public hosting, commercial use, and selling
generated models require separate written permission. The owner retains commercial-
hosting rights. The unchanged LICENSE is authoritative. Include its full same-site
text in a `Read full license` disclosure inside About; preserve line breaks and wrap
long lines. No nested modal, external page, research branding, links, or services.

### Error states

| Trigger | Message / recovery |
| --- | --- |
| Unknown hash | “This view is not available. Showing Design.” |
| Invalid stored theme | “The stored theme preference is invalid. Using System. Change the theme to replace it.” |
| Theme read failure | “The theme preference could not be read. Using System for this visit.” |
| Theme write failure | Keep the existing notice and the explicit `Retry theme storage` action. Do not require toggling to retry; retry the current preference, including System. |
| Rejected preference update | “This setting could not be applied. The previous value is unchanged.” |
| Error inside closed Advanced | Error stays outside; `Review Preview background` opens it and focuses the selected radio. Opening alone does not clear the error. |

New notices/errors use polite live status without stealing focus or timed dismissal.
Associate theme notices with the theme button and field errors with their controls; use an
`Error` heading and `aria-invalid` where relevant. Field errors clear only after a
valid operation on that field. Keep previous valid state and stored bytes on failure.
Exercise collapsed-error recovery through a test fixture, not a public debug control.

Notices sit between the view heading and workspace, not inside a transient toast.
Use a quiet surface, 6 px radius, readable heading, and 3 px leading accent border.
Field errors use Error text/surface and the literal `Error` heading, never color alone.
Recovery buttons use the same 44 px control treatment. Allow wrapping; do not truncate
messages or place them behind Advanced. Notices add height instead of covering content.

No loading or export state exists in this foundation: do not draw a spinner, progress
bar, skeleton, export control, or export-failure simulation. Future tool work must
retain separate draft/accepted state, visible validation, loading/stale-result labels,
and export failure/retry per its own contract. That future UI consumes the shared
geometry result and never invents a second generator. This revision does not add R3F
or geometry dependencies to an intentionally empty preview.

### Approval and implementation boundary

Approve the composition, palette in both themes, density, empty-state treatment,
and styled-native controls before implementation. Existing state, routing, storage,
focus recovery, tool copy ownership, and shared component boundaries remain intact.
App owns shell context; tool-specific words belong to the tool content layer, not
hard-coded shared layout. Any additional content props are for build to review in
the updated plan; this design task does not change contracts. Help/About remains
unavailable at T3; the H1 dialog behavior above still belongs to T4, not this revision.
No new product feature, dependency, or architectural change is proposed.

## Acceptance and verification

IDs retain their original meanings. Design decisions above implement AC-1–AC-14;
AC-15 is the integration gate. No criterion is runtime-verified by this document.

| ID | Required outcome and evidence |
| --- | --- |
| AC-1 | Local app and static production build use the root package/lockfile; `/` opens Design. Smoke-test dev and served production output. |
| AC-2 | Links, direct hashes, refresh, Back/Forward work; active links add no duplicate history. Automated navigation journey. |
| AC-3 | Unknown/malformed/markup-like hashes recover without injection or history loops. Test notice, DOM, and history. |
| AC-4 | Prominent preview and reachable content under revised L1/V1. Review the unified inspector, integrated preview frame, typography, and narrow layout at 1280×800, 768×1024, 390×844, 320×800, desktop 200% zoom, and 959/960 px. Obtain visual approval; a functional smoke test alone does not pass this criterion. |
| AC-5 | Tips/background/disclosure work, survive view changes, reset on reload, and preserve availability messages. Test all views and retained Advanced summary. |
| AC-6 | Invalid types/enums preserve valid state; field errors remain reachable when collapsed. Unit tests plus accessible recovery fixture. |
| AC-7 | Sun/moon button toggles the effective scheme to an explicit Light/Dark; current mode and next action are accessible. System is the default and only System follows OS changes. Use system restores following and returns focus to the toggle. Test both OS schemes, manual overrides, Enter/Space, OS changes, and unavailable-system fallback across views/dialogs. No theme select. |
| AC-8 | Theme persists with the unchanged P2 key and three exact string values; toggles write explicit Light/Dark, Use system writes System, OS changes do not write. Missing, empty, unknown, oversized, and denied storage behave under P2. Test 16/17-character invalid values, failed writes, retained mode/bytes, and Retry without a theme change. |
| AC-9 | Full keyboard journey: skip, links, native forms/disclosures, dialogs, visible focus, names, current/expanded states, and heading focus. |
| AC-10 | Modal focus trap, Escape/Close, opener restoration, and history changes work. Test both dialogs, Tab/Shift+Tab wrap, and long content at 320 px/zoom. |
| AC-11 | Both V2 themes meet stated contrast ratios, including styled native controls/focus; state is not color-only. Measure rendered colors, inspect forced-colors fallback, and review screenshots/focus. Low-contrast decorative dividers must not replace control boundaries. |
| AC-12 | Honest C1 states in every view with tips on/off and Plain/Grid. No fake model/counts, saving/export actions, success claims, or loading animation. |
| AC-13 | No geometry/export work, model downloads, or saved-design mutations. Inspect production dependencies/network; use a storage sentinel and download listener across interactions/reload. |
| AC-14 | Review Help/About scope, planned formats, storage explanation, and license summary; keyboard-open full license and compare with repository LICENSE. |
| AC-15 | `npm run check` retains scaffold/tooling checks and runs app typechecking, build, preference/navigation regressions, and browser smoke tests. Record results and CI browser setup. |

Use current Node 24 LTS. Record OS/runtime/browser versions, viewport, and theme
with evidence. Smoke-test a second browser engine. Review desktop/tablet/narrow and
dialog screenshots in both themes; store generated evidence in `artifacts/`. Keep
test-only fixtures out of production. Report pass/fail/unverified per AC in the
handoff; no extra report file required. Build fixes failures before handoff.

### Visual-revision acceptance mapping

These are design requirements, not new product features or claims of implemented ACs.

| Decision | Acceptance impact / required regression evidence |
| --- | --- |
| V1 hierarchy, L1 frame/inspector composition and responsive density | AC-4: re-review desktop/tablet/phone screenshots and zoom against the approved artifact. |
| V2 tokens, sun/moon action button, Use system, styled native checkbox/radio/disclosure | AC-7, AC-8, AC-9, AC-11: preserve P2 semantics, native keys, action names, visible mode, focus after return to System, selected/expanded states; check focus, contrast and forced colors. |
| View links keep underline, selected fill and ordinary link semantics | AC-2, AC-3, AC-9: preserve routing/history and heading focus; no tab-widget behavior. |
| F1 segmented background choices and two-line Advanced summary | AC-5, AC-6, AC-9: preserve values across views, native arrow selection, and collapsed-error recovery. |
| Notice styling and explicit Retry theme storage | AC-6, AC-8, AC-9: errors remain visible; focus and independent recovery do not regress. |
| C1 composed empty states, integrated real-unavailability summaries | AC-12, AC-13: all views, tips off/on, Plain/Grid; no invented numbers, geometry, save/export action or loading state. |
| T3 support note remains text; optional tip no longer sends users to unavailable Help | AC-12; AC-10/AC-14 remain T4, with no dialog implementation authorized here. |
| CSS/content presentation only; existing application boundaries retained | AC-1, AC-15: rerun the shared gate and existing browser journeys after implementation. |

## Documentation impact

| Document | Required change |
| --- | --- |
| `docs/architecture.md` | No new boundary or storage contract is needed for revision 2. During implementation, replace the select-specific Retry explanation with the sun/moon action and current-preference retry behavior. |
| `README.md`, `docs/development.md` | Add verified setup/check evidence during implementation; update keyboard/theme instructions for the toggle and Use system. Do not describe the mockup as the app. |
| `docs/mvp-roadmap.md` | Record foundation progress from acceptance evidence; keep later generator/editor work pending. |
| `docs/plans/website-foundation.md` | After visual approval, build records the bounded T3 presentation revision and screenshot/keyboard regression checks before implementation. Do not mark T4 complete. |

No product-scope or license change is required. Build owns these updates through
the implementation plan; runtime completion remains unverified.

## Remaining decisions

Visual approval of V1/V2 and the static mockup is now the blocking decision for
the T3 presentation revision. Keep existing display defaults and theme semantics.
After approval, update the implementation plan and obtain implementation approval.
Implementation must verify rendered contrast and browser behavior. Geometry, mounting, document
kits, plate rules, and design persistence need later contracts. Follow the shared
architecture for future draft/accepted state, validation, worker, preview, and export
boundaries; this foundation does not mark the broader website-definition complete.
