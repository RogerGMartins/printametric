# Website foundation

The selected **Gridline** application replaces the previous visual proposals.
The user approved its [implementation plan](../plans/gridline-application.md) on
2026-10-31. That plan records implementation and verification evidence. Earlier
[T6 results](../plans/website-foundation.md#t6-checkpoint--2026-10-31) remain historical
evidence for the previous UI, not Gridline visual acceptance.

Product and stack: [product](../product.md), [architecture](../architecture.md),
[roadmap](../mvp-roadmap.md), [website direction](website-definition.md).

## Goal and scope

Open `/` directly into one wall-art workspace. Working features are Design, Print
layout, Assembly, display preferences, theme actions, and Help/About. No standalone
study, comparison page, or selectable legacy UI remains maintained.

The preview has view-specific empty explanations. Dimensions, Parts, and Plates
each say `Not available` in every view. Wall-art settings appear in Design;
Build-plate settings appear in Design and Print layout. These are explanations,
not disabled actions. They remain available in Workspace settings with tips off.

Geometry, model parameters, presets, camera interaction, plate rules, arrangement,
assembly guidance, save/load/autosave, undo/redo/reset, and downloads are deferred.
No file picker, fake model/counts, loading animation, CAD/rendering dependency, or
design-storage access belongs to this milestone. Mounting and document kits are
unapproved proposals. Accounts, services, marketing/catalogue pages, deployment,
offline installation, and custom pathname routes are outside scope. Narrow access
is required; a dedicated phone editing workflow is deferred.

## Behavior contracts

### Navigation — N1

`/` or an empty hash opens Design. Ordinary links use `#design`, `#print-layout`,
and `#assembly`, with `aria-current="page"` on the current link. Support direct
entry, refresh, Back, Forward, and modified clicks. Active-view activation adds no
history entry. Unknown/malformed hashes recover to Design with history replacement
and `This view is not available. Showing Design.` Never echo the input. Clear the
notice on the next valid navigation.

Keep session preferences across view changes. Set the title to `<View> · Printametric`.
Focus the view heading after link navigation or history traversal, never on initial
entry. Navigation closes a dialog and focuses the new heading. Dialogs do not alter
history. Skip to workspace focuses main without changing the hash.

### UI state — P1

| Field | Allowed values | Default / lifetime |
| --- | --- | --- |
| `view` | `design`, `print-layout`, `assembly` | `design`; derived from N1 |
| `themePreference` | `system`, `light`, `dark` | `system`; persisted under P2 |
| `showWorkspaceTips` | Boolean | `true`; page session |
| `previewBackground` | `plain`, `grid` | `plain`; page session |
| `settingsOpen` | Boolean | `false`; page session |
| `supportPanel` | `none`, `help`, `about` | `none`; page session |

Reject invalid updates at the state boundary. Retain the previous valid value and
show an associated field error. Closing settings preserves values and errors.
Opening/closing state survives navigation and resets on reload. Tips never hide
labels, restrictions, errors, or storage notices. All display settings work in all views.

### Theme storage — P2

Use `printametric.foundation.theme.v1` with the exact string `system`, `light`, or
`dark`. Read once on initialization, without JSON parsing. Missing data uses System.
Reject other strings, including values longer than 16 characters, with a notice;
retain the stored bytes until an explicit selection succeeds. Catch read/write
failures: the app stays usable and the chosen theme still applies in memory.
A successful explicit selection clears the storage notice. Never clear unrelated
keys, access saved designs, or claim that a design was saved. No cross-tab sync;
the last successful write determines the next reload.

System follows live OS changes; explicit Light/Dark ignores them. Use Light if the
system preference cannot be read. Apply the theme to the workspace, native controls,
and dialogs. Initialization and OS changes never write storage.

## UI design

### Direction and layout — V1 / L1

Use the approved blue Gridline composition:

```text
Printametric | Wall art   Design  Print layout  Assembly   [sun/moon] Help About
──────────────────────────── cobalt header ──────────────────────────────────
Design                                          Preview · No generated model
│                                                                           │
│                           No model yet                                    │
│               Model generation is not available in this version.           │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
▸ Workspace settings
```

The preview fills the width and available height below the header. One native
bottom disclosure overlays it; opening settings does not resize the preview canvas.
No max-width frame, side inspector, or reserved right gutter. The empty explanation
remains reachable above the open panel, with scrolling when height is constrained.

The panel contains display fields, unavailable tool sections, and a definition list
of summaries. Use auto-fit columns without empty reserved tracks; use one column
on narrow screens. Panel content scrolls independently, bounded by available
workspace height; its summary remains reachable. Header content wraps in DOM order.
Allow document scrolling when the header plus usable workspace exceed the viewport.
No horizontal scrolling at 320 px or genuine 200% browser zoom.

### Visual tokens — V2

Use local Segoe UI/system sans-serif typography and original decorative SVGs; no
font download, third-party branding, illustration, decorative shadow, or animation.

| Token | Light | Dark |
| --- | --- | --- |
| Header / text | `#153ac7` / `#ffffff` | same |
| Surface | `#ffffff` | `#232d39` |
| Preview | `#f3f6fc` | `#1b242e` |
| Text | `#14213b` | `#f1f4f8` |
| Secondary text | `#53617b` | `#b7c3d0` |
| Decorative divider | `#b9c7e1` | `#536375` |
| Control boundary | `#647493` | `#8d9db2` |
| Accent / focus | `#153ac7` | `#a8c0ff` |
| Selected surface | `#e4ebff` | `#39434f` |
| Error | `#a12222` | `#ffb4ab` |

Body base is 15 px/1.5; section labels are 13–14 px, metadata 11–12 px. The empty
heading is 36 px/1.15, 28 px narrow. Use compact 4–28 px spacing and 4–5 px control
radii, with a pill-shaped theme control. Actions have at least 44 px hit areas.
Use 3 px visible focus outlines; the header uses `#ffbd98` for focus. Keep selected
and focused states distinct. Current links use fill, weight, and underline.

Measure normal text at ≥4.5:1, large text at ≥3:1, meaningful boundaries/focus at
≥3:1. Decorative dividers need not identify controls. Native glyphs and a system
outline on the selected theme icon preserve meaning in forced colors.

### Controls and content — F1 / C1

| Element | Exact label / copy |
| --- | --- |
| Theme button | `Switch to dark theme` / `Switch to light theme` |
| Visible theme mode | `Light · System`, `Dark · System`, `Light · Manual`, `Dark · Manual` |
| Restore OS following | `Use system` |
| Native disclosure | `Workspace settings` |
| Checkbox | `Show workspace tips` |
| Optional tip | “Change the display here. Open Help for workspace guidance.” |
| Radio fieldset | `Preview background`: `Plain`, `Grid`; “Changes the display only.” |
| Grid caption, even with tips off | `Decorative grid — not to scale.` |
| Wall-art settings | Phase-01 blade controls and explicit JSON/model downloads; presets remain later work |
| Build-plate settings | “Plate configuration is not available yet.” |
| Availability in settings | Design reports generated bounds and parts; plate count and later workflows remain unavailable |

| View | Empty heading | Body |
| --- | --- | --- |
| Design | Preparing your blade pattern | Generate the fixed starter, then show the validated model or a visible failure/recovery state. |
| Print layout | No print layout yet | Part arrangement and fit checks are not available in this version. |
| Assembly | No assembly guidance yet | Assembly guidance is not available in this version. |

Phase 01 supersedes Design's original empty state on 2026-11-02. Its accepted model
metadata includes part count and millimeters; pending and failed states are explicit.
Other views retain `Preview · No generated model`. Grid is decorative CSS,
without axes, ticks, plate outlines, objects, or millimeter labels. Empty text uses
an opaque preview-colored surface. Do not add actions that cannot work.

The theme control is one native action button with two decorative sun/moon SVGs.
Click, Enter, or Space selects the opposite effective scheme as an explicit override
and keeps focus on the button. Its description includes visible mode and any error.
`Use system` appears only for an override; it writes `system`, resumes OS following,
hides itself, and restores focus to the toggle. Announce mode changes politely.
Retry writes the current preference without toggling. Both actions use P1/P2.

Tips uses a labelled native checkbox. Plain/Grid are labelled native radios with
arrow-key selection and visible focus; no hidden replacement inputs. The only
workspace disclosure is native `details`/`summary`; no nested Advanced panel.

### Keyboard and dialogs — H1

Tab order: Skip to workspace, view links, theme toggle, Use system when present,
Help, About, recovery actions when present, Design camera actions, settings summary,
then open settings.
Brand is plain text. View heading is the main heading. Preview text is not normally
a tab stop; overflowing scroll regions must remain keyboard reachable. Use native
keys without global shortcuts or custom arrow routing. Labels, descriptions, and
errors remain associated with their controls.

Use one labelled native modal at a time. Focus its heading, keep Tab/Shift+Tab inside,
and make the background inert. Escape or `Close Help` / `Close About` restores the
opener unless navigation requires heading focus. Backdrop clicks do not close it.
Maximum width 640 px, minimum viewport margins 12 px, bounded internal scrolling.

Help explains the working blade controls, JSON save/load and assembled STEP/STL/3MF
downloads, plus Workspace views, Display settings, Keyboard and Theme storage.
Views are not required steps. Only theme persists automatically. Arrangement,
assembly guidance, presets and mounting remain unavailable. About also links to
same-site third-party license/source notices; its exact root-license text is unchanged.

About starts “Printametric is a personal-use source-available project, not open
source.” Explain private noncommercial individual use, including private self-hosting;
organizational use, public hosting, commercial use, and selling generated models need
separate written permission. The owner retains commercial-hosting rights. LICENSE
is authoritative. Bundle its exact full text in a `Read full license` disclosure,
preserving line breaks and wrapping long lines. No nested modal or external service.

### Error states

| Trigger | Recovery |
| --- | --- |
| Unknown hash | N1 notice and Design recovery |
| Invalid stored theme | “The stored theme preference is invalid. Using System. Change the theme to replace it.” |
| Theme read failure | “The theme preference could not be read. Using System for this visit.” |
| Theme write failure | Retain applied mode and old bytes; independent `Retry theme storage` action |
| Rejected preference | “This setting could not be applied. The previous value is unchanged.” |
| Closed settings with field error | Keep error outside; `Review Preview background` / `Review Show workspace tips` opens settings and focuses the selected radio / checkbox |

Errors use literal `Error` headings and `aria-invalid`, not color alone. The visible
notice area has bounded scrolling above the panel, outside collapsible content.
Keep the header and panel summary reachable. Notices announce politely without
stealing focus or timed dismissal. Opening settings does not clear errors; a valid
field edit clears only that field. Exercise rejected inputs in a test fixture,
not production debug controls. There is no loading/export state in this milestone.

## Acceptance and verification

IDs retain their original meanings. Evidence lives in the implementation plan.

| ID | Required outcome and evidence |
| --- | --- |
| AC-1 | Root package/lockfile; dev and static production `/` open the same Gridline app. |
| AC-2 | Links, hashes, reload, Back/Forward, no duplicate active-view history. |
| AC-3 | Unknown/malformed/markup-like hashes recover without injection or loops. |
| AC-4 | Approved Gridline composition: full-width preview, stable canvas bounds, one overlay panel, no empty columns. Review both-theme screenshots at 320/390/768/959/960/1280/1920/2560 px, 640×400, and genuine 200% zoom. |
| AC-5 | Tips/background/disclosure work in all views, survive navigation, reset on reload, and preserve availability. |
| AC-6 | Invalid types/enums preserve state; independent field errors and keyboard recovery remain reachable with settings closed. |
| AC-7 | Toggle selects opposite effective scheme; Enter/Space, both OS schemes, manual overrides, live OS following, fallback, and Use system focus restoration work. |
| AC-8 | Exact P2 key/values; no bootstrap/OS writes. Test missing/empty/unknown/oversized/16–17-character/denied storage, retained mode/bytes, and independent Retry. |
| AC-9 | Full keyboard journey, skip, links, native controls, visible focus, names, expanded/current states, and heading focus. |
| AC-10 | Modal focus trap, Escape/Close, opener restoration, navigation dismissal, long content at 320 px/zoom. |
| AC-11 | Both themes meet V2 contrast; selected/focused state is not color-only. Measure colors and inspect forced colors/screenshots. |
| AC-12 | Honest C1 states in all views with tips on/off and Plain/Grid; no fake models/counts/actions/loading. |
| AC-13 | No geometry/export, model downloads, or saved-design mutations. Inspect production modules/network and use storage/download sentinels. |
| AC-14 | Help/About scope, formats, storage copy, license summary; keyboard-open exact full repository LICENSE. |
| AC-15 | `npm run check`: scaffold, both typechecks, build, Node regressions, production/development browser tests. |

Use current Node 24 LTS. Record OS/browser versions, viewport, theme, and evidence
under ignored `artifacts/`. Smoke-test a second browser engine. Report screen-reader
and physical-device gaps honestly. Keep fixtures outside production.

## Documentation impact and remaining decisions

Architecture owns component/data-flow boundaries. README and development docs own
application setup, keyboard/storage debugging, and check commands. The roadmap and
foundation/Gridline plans record verified progress and historical T6 results. Retire
active study links and run commands; keep historical evidence and Impeccable tooling.

No product-scope or license change is required. Gridline direction and implementation
were approved. Geometry, mounting, document kits, plate rules, and design persistence
need later contracts; this foundation does not complete the broader website definition.
