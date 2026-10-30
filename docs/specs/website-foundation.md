# Website foundation

Status: specified and UI-designed; implementation and runtime verification pending.
Technical tasks: [implementation plan](../plans/website-foundation.md).
Product and stack: [product](../product.md), [architecture](../architecture.md),
[roadmap](../mvp-roadmap.md), and [confirmed website direction](website-definition.md).

## Goal and scope

Open directly into a useful wall-art workspace: navigate views, change display
preferences, and read Help/About. The owner confirmed this scope and visual direction.

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

### Layout — L1

```text
Printametric                         Theme [System]  Help  About
Design | Print layout | Assembly
---------------------------------------------------------------
Design                           [notices, when needed]
Workspace display                Preview
[x] Show workspace tips          +-----------------------------+
> Advanced — Plain background    |        No model yet         |
Wall-art settings                | Model generation is not     |
  Not available yet              | available in this version.  |
Build-plate settings             +-----------------------------+
  Not available yet              Dimensions / Parts / Plates:
                                 each Not available
---------------------------------------------------------------
Foundation workspace — no printable design, design saving, or downloads.
```

Desktop: controls left, larger preview right. Below 960 CSS px: heading/notices,
preview/summaries, then controls in one scrolling column. Keep preview before
controls in document order at all sizes; use CSS desktop placement without duplicate
controls or responsive remounting. Header actions and navigation wrap at narrow widths.

- Fluid workspace, maximum 1440 px; desktop controls 320 px (within 280–360 px),
  gap 24 px. Preview minimum height about 360 px desktop, 240 px below 960 px;
  allow text growth. No fixed workspace height or nested settings scrolling.
- At 1280×800, preview is wider than controls and its message needs no scrolling.
  At 768×1024, preview and the start of basic controls are visible without scrolling
  in the default, no-notice state. Notices/enlarged text may increase page height.
- At 320 px and desktop 200% zoom, no clipped essentials or horizontal page scroll.
  No sticky header/footer overlays. Keep labels visible, not icon-only menus.

### Visual tokens

Neutral workshop surfaces and restrained teal accents. Text identity, local system
sans-serif fonts, sentence case. No gradients, illustrations, heavy shadows, external
assets, skeletons, or continuous animation.

| Token | Light | Dark |
| --- | --- | --- |
| Page | `#F4F6F6` | `#111817` |
| Surface | `#FFFFFF` | `#1B2523` |
| Preview | `#EDF2F1` | `#15201E` |
| Text | `#182B28` | `#EDF5F2` |
| Secondary text | `#4B625D` | `#B0C4BE` |
| Control boundary | `#647B75` | `#78968D` |
| Accent / focus | `#086C61` | `#66D8C1` |
| Selected surface | `#DDEFEA` | `#243F37` |
| Error text | `#A12222` | `#FFB4AB` |

Body/forms 16 px/1.5; view heading 24 px/1.25; section headings 18 px/1.4;
secondary labels at least 14 px/1.5. Spacing: 4/8/12/16/24/32 px. Page padding:
24 px desktop, 16 px below 960 px, 12 px at 320 px. Corner radius 8 px.
Focus outline 3 px with 3 px offset, unclipped. Target 44 px action rows/click areas;
minimum 24×24 px with separation. Do not enlarge checkbox glyphs.

Unavailable text uses Secondary text at full opacity. Active navigation has an
underline as well as color. Notices use Surface, a Control boundary border, and
a heading. Use text on surfaces, not white on the dark-theme accent. Verify rendered
contrast: normal text 4.5:1, large text 3:1, meaningful boundaries/focus 3:1.

### Controls and content — F1 / C1

| Element | Exact label / copy |
| --- | --- |
| Header select | `Theme`: `System`, `Light`, `Dark` |
| Checkbox | `Show workspace tips` |
| Optional tip | “Change the display here. Open Help for workspace guidance.” |
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

Summaries are a definition list. Grid is subtle CSS without axes, ticks, dimensions,
plate outlines, or objects; empty-state text sits on an opaque surface. No measurement
controls or `mm` labels here. Future physical controls use explicit millimeter labels
and ranges from the geometry contract.

### Keyboard and dialogs — H1

Use one header, `Workspace views` navigation, main workspace, and non-sticky footer.
Brand is plain text. View heading is the main heading. Tab order: focus-visible
`Skip to workspace`, Theme, Help, About, view links, working settings. Skip moves
focus to main; preview text is not a tab stop. Use native link, checkbox, disclosure,
select, and radio keyboard behavior; no custom arrow routing or global shortcuts.
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
| Invalid stored theme | “The stored theme preference is invalid. Using System. Choose a theme to replace it.” |
| Theme read failure | “The theme preference could not be read. Using System for this visit.” |
| Theme write failure | “Theme applied for this visit, but it could not be remembered. Choose a theme again to retry.” |
| Rejected preference update | “This setting could not be applied. The previous value is unchanged.” |
| Error inside closed Advanced | Error stays outside; `Review Preview background` opens it and focuses the selected radio. Opening alone does not clear the error. |

New notices/errors use polite live status without stealing focus or timed dismissal.
Associate theme notices with Theme and field errors with their controls; use an
`Error` heading and `aria-invalid` where relevant. Field errors clear only after a
valid operation on that field. Keep previous valid state and stored bytes on failure.
Exercise collapsed-error recovery through a test fixture, not a public debug control.

## Acceptance and verification

IDs retain their original meanings. Design decisions above implement AC-1–AC-14;
AC-15 is the integration gate. No criterion is runtime-verified by this document.

| ID | Required outcome and evidence |
| --- | --- |
| AC-1 | Local app and static production build use the root package/lockfile; `/` opens Design. Smoke-test dev and served production output. |
| AC-2 | Links, direct hashes, refresh, Back/Forward work; active links add no duplicate history. Automated navigation journey. |
| AC-3 | Unknown/malformed/markup-like hashes recover without injection or history loops. Test notice, DOM, and history. |
| AC-4 | Prominent preview and reachable content under L1. Review 1280×800, 768×1024, 390×844, 320×800, desktop 200% zoom, and 959/960 px screenshots. |
| AC-5 | Tips/background/disclosure work, survive view changes, reset on reload, and preserve availability messages. Test all views and retained Advanced summary. |
| AC-6 | Invalid types/enums preserve valid state; field errors remain reachable when collapsed. Unit tests plus accessible recovery fixture. |
| AC-7 | System/Light/Dark apply to all views/dialogs; only System follows OS changes. Browser scheme emulation and unavailable-system fallback. |
| AC-8 | Theme persists; missing, empty, unknown, oversized, and denied storage behave under P2. Test 16/17-character invalid values, failed writes after a valid selection, stored-byte preservation, and recovery. |
| AC-9 | Full keyboard journey: skip, links, native forms/disclosures, dialogs, visible focus, names, current/expanded states, and heading focus. |
| AC-10 | Modal focus trap, Escape/Close, opener restoration, and history changes work. Test both dialogs, Tab/Shift+Tab wrap, and long content at 320 px/zoom. |
| AC-11 | Both themes meet stated contrast ratios, including native controls/focus; state is not color-only. Measure rendered colors and review screenshots/focus. |
| AC-12 | Honest C1 states in every view with tips on/off and Plain/Grid. No fake model/counts, saving/export actions, success claims, or loading animation. |
| AC-13 | No geometry/export work, model downloads, or saved-design mutations. Inspect production dependencies/network; use a storage sentinel and download listener across interactions/reload. |
| AC-14 | Review Help/About scope, planned formats, storage explanation, and license summary; keyboard-open full license and compare with repository LICENSE. |
| AC-15 | `npm run check` retains scaffold/tooling checks and runs app typechecking, build, preference/navigation regressions, and browser smoke tests. Record results and CI browser setup. |

Use current Node 24 LTS. Record OS/runtime/browser versions, viewport, and theme
with evidence. Smoke-test a second browser engine. Review desktop/tablet/narrow and
dialog screenshots in both themes; store generated evidence in `artifacts/`. Keep
test-only fixtures out of production. Report pass/fail/unverified per AC in the
handoff; no extra report file required. Build fixes failures before handoff.

## Documentation impact

| Document | Required change |
| --- | --- |
| `docs/architecture.md` | Review the proposed foundation module boundaries with the technical plan; reconcile them with implementation. |
| `README.md`, `docs/development.md` | Add verified application setup, build, and test commands during implementation. |
| `docs/mvp-roadmap.md` | Record foundation progress from acceptance evidence; keep later generator/editor work pending. |

No product-scope or license change is required. Build owns these updates through
the implementation plan; runtime completion remains unverified.

## Remaining decisions

No blocker for this milestone. Display defaults remain proposals; implementation
must verify rendered contrast and browser behavior. Geometry, mounting, document
kits, plate rules, and design persistence need later contracts. Follow the shared
architecture for future draft/accepted state, validation, worker, preview, and export
boundaries; this foundation does not mark the broader website-definition complete.
