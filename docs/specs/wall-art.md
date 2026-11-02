# Wall art — specification suite

Status: **DRAFT for user review. Not approved for implementation.**
Collaboration mode: freedom to draft. Date: 2026-11-02.

## Purpose and authority

Let a person create modular wall art, inspect its parts, retain an editable design,
and download correctly scaled models and assembly documents without CAD skills.
The complete journey is specified below. It is not all part of the first release.

**Confirmed requirements:** the client-side architecture, independent deterministic
millimeter geometry, explicit seeds and versions, canonical worker-owned CAD solids,
native STEP, binary STL, standard 3MF, shared tessellation, explicit exports, and
preservation of valid designs on failure. The approved Gridline composition stays.
See [product](../product.md), [architecture](../architecture.md), and
[foundation](website-foundation.md). Those shared documents remain authoritative.

**Verified baseline:** Gridline G1–G4 is implemented and tested. Its final visual
signoff, screen-reader checks, and physical-touch checks remain open. Existing
wall-art code supplies availability copy, not a generator. None of this suite's
functional acceptance criteria has implementation evidence yet.

**Printametric proposals:** all new ranges, algorithms, defaults, budgets, UI
integration, mounting details, and expansion features in this suite. They are
original proposed contracts, not claims of existing application behavior or
physical printability. Approval of this suite does not approve a technical plan.

When contracts conflict, stop and seek review. Do not silently change architecture.
This index owns shared state, units, validation, budgets, and the coverage ledger.
The user requires full option and interaction coverage, not a representative MVP
subset. Sequencing below defers implementation, not specification completeness.
The ledger records the reviewed inventory; the proposed contracts still need review.
Each phase owns its named parameters. Later phases extend rather than restate them.
Acceptance IDs are globally unique: `WA-<phase>-AC-<number>`.

## Sequence and complete coverage ledger

Read and plan one row at a time. The order is linear for review. Later retained
functionality can ship after the local core; only identified service/business
choices are conditional on separate owner decisions.

| Phase / specification | Included coverage | Feature exit / dependency | Scope status |
| --- | --- | --- | --- |
| 01 [Canonical generator](wall-art-core.md) | Rectangular blade array; validation; worker; IDs; minimal keyboard editor; JSON file; native STEP/STL/3MF; round trips | First useful accepted design and three verified downloads | Proposed bounded implementation of approved generator direction |
| 02 [Outlines and layouts](wall-art-layouts.md) | Full dimension range, convenience sizes, rectangle/ellipse/hexagon/arch, five layouts, pitch/gap, boundary fragments, numbering | Same three exports with deterministic clipped parts | Proposed expansion beyond first pattern |
| 03 [Shape and surface](wall-art-shape-surface.md) | Taper, tiers/blend, planar tops, concavity, plinth, seven relief families, density/phase/rotation/seed | Valid curved CAD and shared mesh for all families | Proposed expansion |
| 04 [Movement](wall-art-movement.md) | Eight influence points, three fields, composition, jitter, calm ring, tip shaping/shortening, editable plan | Collision-checked movement with numeric and pointer parity | Proposed expansion |
| 05 [Editor, colour and presets](wall-art-editor.md) | Gridline controls, palette/bands, original starters/catalogue, cameras, components, room scale, statistics, errors/accessibility | Complete interactive design journey | Core editor plus proposed rich controls |
| 06 [Projects and recovery](wall-art-projects.md) | Title, library, explicit save, existing-project autosave/Saved Undo, draft recovery, undo/redo/reset, import/export, backup/merge, complete sharing, separate curated gallery | Durable local work with atomic failure recovery | Local core plus fully retained later project features |
| 07 [Mounting frame](wall-art-frame.md) | Pocketed backing, clearances, ribs, lightweight webs, borders, screw feasibility, tiled frame, fit coupon | CAD-verified tiles; separate physical validation gate | Proposed mounting decision, not approved MVP scope |
| 08 [Print preparation and kit](wall-art-print-kit.md) | Generic/custom beds, margins/keepouts, full-volume packing, per-colour plates, standard formats, ZIP, maps, A4/Letter PDF, manifest/checklist | One revision produces a validated portable kit | Core preparation plus proposed document kit |
| 09 [Imported assets](wall-art-assets.md) | Concave SVG with holes; safe bounded parsing; PNG/JPEG relief/colour; embedded normalized assets | Portable deterministic asset designs with no missing-data fallback | Fully retained later functionality; not first release |
| 10 [Integrations](wall-art-integrations.md) | Complete material/printer catalogues, vendor projects, desktop slicer handoff, conditional hosted delivery | Each adapter has its own compatibility and privacy evidence | Fully retained later functionality; service choices need owner approval |
| 11 [Help and optional service experience](wall-art-support.md) | Contextual help, localization, rights/legal/privacy/contact, optional access codes/tiers/session expiry | Local help complete; hosted services separately approved | Help is core; localization and hosted services are later proposals |

Frame implementation needs the usable-bed contract in phase 08 for tile sizing;
phase 07 consumes that already specified contract without implementing kit packing.
Phase 08 then packs phase 07's outputs. There is no dependency on a working hosted
service, vendor adapter, SVG parser, or image decoder for phases 01–08.

Coverage retained but **excluded from this suite's implementation commitment**:
board-and-paper attachment as an alternative to the printed frame (owner decision),
cloud project synchronization, billing, advertisements, collaborative editing,
arbitrary CAD scripts, G-code, automatic printing, structural certification,
automatic optimal nesting, and a general plugin framework. Board/template placement
maps are not an attachment design. Hosting target and launch automation remain a
separate launch feature. Optional service contracts do not authorize these extras.

## Option-level coverage ledger

This ledger belongs to this index. It covers individual options, actions and
conditional states, not only section headings. Every enumerated enum value, preset
and catalogue entry needs its own runnable case, even where a row groups controls
that share a contract. The owning story table names test files, test layer, N/B/I/E
assertions and manual limitations. All required automated cases join `npm run check`
during implementation. The second specification-led walkthrough may identify gaps;
add them here rather than silently narrow the requested full coverage.

Story-prefix ownership: `WA-CORE` → [01](wall-art-core.md), `WA-LAYOUT` →
[02](wall-art-layouts.md), `WA-SHAPE` → [03](wall-art-shape-surface.md), `WA-MOVE` →
[04](wall-art-movement.md), `WA-EDIT` → [05](wall-art-editor.md), `WA-PROJECT` →
[06](wall-art-projects.md), `WA-FRAME` → [07](wall-art-frame.md), `WA-KIT` →
[08](wall-art-print-kit.md), `WA-ASSET` → [09](wall-art-assets.md),
`WA-INTEGRATE` → [10](wall-art-integrations.md), `WA-SUPPORT` →
[11](wall-art-support.md). A shorthand such as `WA-MOVE-AC-1/7/9` means the three
IDs with that same prefix, not a new ID containing slashes.

Evidence labels describe inventory confidence, **not Printametric implementation**:
**O** = interaction observed; **V** = visible action/state, result not verified;
**D** = client-declared, hidden/gated or execution unverified; **P** = Printametric
proposal or confirmed architectural requirement. No observed preview establishes
valid meshes, printable fit, native CAD or successful downloads. Gate states must
not be bypassed. Every Printametric value/formula remains a draft unless explicitly
identified as an existing shared architectural decision.

### Dimensions, layout and physical shape

| Option ID | Distinct options/actions and conditional coverage | Evidence / distinction | Owner story → acceptance |
| --- | --- | --- | --- |
| OPT-01 | Width numeric/slider; minimum80,default500,maximum2000; independent height | O≤1000 and80; D full2000; P exact Printametric contract | WA-LAYOUT-ST-1 → WA-LAYOUT-AC-1/7 |
| OPT-02 | Height numeric/slider; same range; narrow/wide aspect independently | O80; D full2000; P bounds contract | WA-LAYOUT-ST-1 → WA-LAYOUT-AC-1/7 |
| OPT-03 |300×300,500×500,800×600,1000×1000 shortcuts | O; P dimension-only replacement | WA-LAYOUT-ST-1 → WA-LAYOUT-AC-7/9 |
| OPT-04 | Rectangle,ellipse,hexagon,arch selectors | O; P exact mathematical outlines | WA-LAYOUT-ST-1 → WA-LAYOUT-AC-1/3 |
| OPT-05 | Irregular,hexagonal,square,triangular,radial layouts | O; P algorithms/IDs | WA-LAYOUT-ST-1 → WA-LAYOUT-AC-2/3 |
| OPT-06 | All4×5 outline/layout interactions | O radial ignores outline in observed interaction; P radial clipping is an explicit independent improvement | WA-LAYOUT-ST-1 → WA-LAYOUT-AC-3 |
| OPT-07 | Straight boundary on/off,hex/triangle applicability; other-layout no-effect | O; P whole-cell/outline policy | WA-LAYOUT-ST-1/3 → WA-LAYOUT-AC-3/9 |
| OPT-08 | Characteristic pitch advanced number | D hidden; P visible advanced control | WA-LAYOUT-ST-1 → WA-LAYOUT-AC-2/7 |
| OPT-09 | Gap; base thickness; each numeric and slider endpoint | D hidden controls/declared ranges; P visible advanced controls and minimum-material joint validation | WA-LAYOUT-ST-1/2 → WA-LAYOUT-AC-2/6/7 |
| OPT-10 | Engraving depth including0; numeral ratio; physical ID/map-only fallback | D advanced values; P deterministic glyph/minimum contract | WA-LAYOUT-ST-2 → WA-LAYOUT-AC-5/6/8 |
| OPT-11 | Tiny fragments,counts,stable IDs,map numbers and whole-cell actual bounds | P explicit safety/identity behavior | WA-LAYOUT-ST-2/3 → WA-LAYOUT-AC-3/4/5 |
| OPT-12 | Top-width ratio; full prism versus truncated narrow top | O; P homothetic top semantics | WA-SHAPE-ST-2 → WA-SHAPE-AC-4/5 |
| OPT-13 | Step blend0/1/intermediate; weak-effect notice below narrow-top ratio0.4 | O; P area-mean blending and help | WA-SHAPE-ST-1/3 → WA-SHAPE-AC-3/7 |
| OPT-14 | Planar tops toggle; inactive at blend1 | O; P constrained-plane contract | WA-SHAPE-ST-1/3 → WA-SHAPE-AC-3/7 |
| OPT-15 | Minimum relief0–120; concavity1–4; base/plinth enabled/disabled | O; P native-CAD/degenerated-solid policy | WA-SHAPE-ST-2 → WA-SHAPE-AC-4/5/6 |

### Surface, image and movement

| Option ID | Distinct options/actions and conditional coverage | Evidence / distinction | Owner story → acceptance |
| --- | --- | --- | --- |
| OPT-16 | Wave,dunes,ring/crater,dome,spiral,ridges,random relief | O; P original seven field formulas | WA-SHAPE-ST-1 → WA-SHAPE-AC-1/2 |
| OPT-17 | Depth0–200; density0.2–12; density inactive for dome | O; P flattening/no-effect rules | WA-SHAPE-ST-1/2/3 → WA-SHAPE-AC-1/2/5/7 |
| OPT-18 | Rotation0–360; phase0–1; seed1–9999 | O; P periodicity/substreams/inactive cases | WA-SHAPE-ST-1/3 → WA-SHAPE-AC-1/2/7 |
| OPT-19 | Spiral arms1–16,visible/applicable only for spiral | O; P native smooth-center contract | WA-SHAPE-ST-1 → WA-SHAPE-AC-1/2 |
| OPT-20 | SVG outline choose/import/accept/cancel/replace/remove; concavity/holes | D gated; P complete inert-parser contract | WA-ASSET-ST-1/3 → WA-ASSET-AC-1/2/3/7/8 |
| OPT-21 | Image relief enum and image colour enum/payload | D dormant/inaccessible; P complete later behavior | WA-ASSET-ST-2/3 → WA-ASSET-AC-4/5/6/7 |
| OPT-22 | PNG/JPEG fit,crop,rotation,flip,invert,embedded asset replacement/removal | P functional completion of declared image capability | WA-ASSET-ST-2/3 → WA-ASSET-AC-4/5/7/8 |
| OPT-23 | Point select,Add,Clone,editor Remove,Plan Remove selected point,Undo action | O; P explicit Add mode and shared action semantics | WA-MOVE-ST-1/3 → WA-MOVE-AC-1/7/9 |
| OPT-24 | Zero points; maximum8; Add/Clone disabled at8 | O; P no-effect/invalid ninth-input behavior | WA-MOVE-ST-1/3 → WA-MOVE-AC-1/3/9 |
| OPT-25 | Swirl,magnet attraction/repulsion,directional flow | O; P original field formulas | WA-MOVE-ST-1 → WA-MOVE-AC-2/3 |
| OPT-26 | Strength negative/zero/positive; lean0/1/>1; centered x/y | O; P saturation and resize semantics | WA-MOVE-ST-1 → WA-MOVE-AC-2/3/8 |
| OPT-27 | Swirl opening-1/0/+1; radius; fade independent | O; P explicit tangent/radial interpolation | WA-MOVE-ST-1/3 → WA-MOVE-AC-2/7 |
| OPT-28 | Flow direction0–360; bandwidth0 whole panel/nonzero band | O; D full declared upper range; P bounded band rule | WA-MOVE-ST-1 → WA-MOVE-AC-2/3 |
| OPT-29 | Directional jitter; calm center/raised ring; sharpen strong tips | O; P explicit original field/height/width adjustments | WA-MOVE-ST-1/2 → WA-MOVE-AC-3/4/5 |
| OPT-30 | Shorten unsupported tips toggle; conditional angle0–60,step1 | O angle accessible and60 exercised; P independent enabled+angle avoids ambiguous simple-mode semantics | WA-MOVE-ST-2 → WA-MOVE-AC-5/6 |
| OPT-31 | Plan click add; center drag; radius ring drag; outer fade ring drag | O independent interactions; P single formatting and explicit mode policy | WA-MOVE-ST-3 → WA-MOVE-AC-7/9 |
| OPT-32 | Plan contours,colours,base-to-top arrows; numeric/keyboard equivalents | O display/interaction,not mesh validity; P canonical arrows/contours | WA-MOVE-ST-3 → WA-MOVE-AC-7/9 |
| OPT-33 | Shortened-tip count,collision error,irreparable candidate recovery | P canonical diagnostic/export safety | WA-MOVE-ST-2 → WA-MOVE-AC-5/6/10 |

### Colour, complete catalogues and preview

| Option ID | Distinct options/actions and conditional coverage | Evidence / distinction | Owner story → acceptance |
| --- | --- | --- | --- |
| OPT-34 | Band count1–8; select each band; edit hex; active/retained/unused slots | O count/selection; P custom hex and stable slot identities | WA-EDIT-ST-1 → WA-EDIT-AC-2/3 |
| OPT-35 | Colour by height,directional gradient,seeded random | O; P normalized sample/seed contract | WA-EDIT-ST-1 → WA-EDIT-AC-2/3 |
| OPT-36 | Gradient angle0/90/360; reverse palette; random palette/random assignment | O; P independently named saved-seed actions | WA-EDIT-ST-1 → WA-EDIT-AC-2/3 |
| OPT-37 | Standard PLA group collapse/expand; all30 entries in band selector | O all30; P independently verified original dataset | WA-INTEGRATE-ST-1 → WA-INTEGRATE-AC-1/2 |
| OPT-38 | Matte PLA group collapse/expand; all25 entries in band selector | O all25; P independently verified original dataset | WA-INTEGRATE-ST-1 → WA-INTEGRATE-AC-1/2 |
| OPT-39 | Standard PLA all30 and Matte PLA all25 in independent frame selector | O all55; P independent binding and original dataset | WA-INTEGRATE-ST-1 → WA-INTEGRATE-AC-1/2 |
| OPT-40 | Frame colour/hex independent from band count/selection | O; P metadata-only revision | WA-EDIT-ST-1 / WA-INTEGRATE-ST-1 → WA-EDIT-AC-2/3,WA-INTEGRATE-AC-1/2 |
| OPT-41 | Complete23 presets in3 groups; every visual family individually retained | O all23 visually reviewed,not exported; P original M1–M8,S1–S7,F1–F8 definitions | WA-EDIT-ST-1 → WA-EDIT-AC-4 |
| OPT-42 | Six home starters; apply preset; preset-size confirmation; New; random design | O starters/apply/random; P replacement/baseline/identity policy | WA-EDIT-ST-1 → WA-EDIT-AC-4/5 |
| OPT-43 | Reset current section including palette; factory baseline when no preset; Reset All with preserved identity/printer/theme and one Undo | O section reset/D baseline semantics; P Reset All and stored adapted baseline | WA-PROJECT-ST-2 → WA-PROJECT-AC-5 |
| OPT-44 | Isometric/front/side; orbit/pan; explicit zoom+/−; Fit/reset camera | O; P keyboard controls and geometric bounds | WA-EDIT-ST-2 → WA-EDIT-AC-6 |
| OPT-45 | Light azimuth; inspection lighting; wireframe; decorative grid/tips/theme | O inventory; foundation implements theme/grid/tips,not wireframe; P preview-only additions | WA-EDIT-ST-2/3 → WA-EDIT-AC-1/6/9 |
| OPT-46 | Show frame; frame-only; assembled/exploded; selected-part list | O frame controls; P complete component inspection | WA-EDIT-ST-2 / WA-FRAME-ST-3 → WA-EDIT-AC-6,WA-FRAME-AC-9 |
| OPT-47 | Room view; Edit panel; Exit/Escape/Back; actual scale and focus/camera restoration | O room scene; P original assets and restoration contracts | WA-EDIT-ST-2 → WA-EDIT-AC-7 |
| OPT-48 | Pieces/used colours/overall depth/estimated material; separate frame estimate; triangle diagnostics | O displayed statistics,accuracy unverified; P quantitative assumptions | WA-EDIT-ST-2 → WA-EDIT-AC-8 |
| OPT-49 | Loading,stale,invalid,failed,cancelled,WebGL unavailable/context lost | P mandatory robustness and accessibility | WA-EDIT-ST-3 / WA-CORE-ST-3 → WA-EDIT-AC-9/10,WA-CORE-AC-7/9 |

### Mounting, print preparation and all download actions

| Option ID | Distinct options/actions and conditional coverage | Evidence / distinction | Owner story → acceptance |
| --- | --- | --- | --- |
| OPT-50 | Frame enable; pocket clearance; rib height; plate thickness | O UI/preview,physical fit unverified; P native pocket contract | WA-FRAME-ST-1 → WA-FRAME-AC-1/2/4 |
| OPT-51 | Extra border width; extra border height; corner radius | O; P rim/rounding/actual bounds | WA-FRAME-ST-1 → WA-FRAME-AC-3 |
| OPT-52 | Lightweight pockets on/off; screw holes on/off; thin-plate protrusion notice | O preview,hardware fit unverified; P explicit web/hardware profiles | WA-FRAME-ST-1 → WA-FRAME-AC-2/4 |
| OPT-53 | Frame tile grid,stable tile IDs,map/orientation,separate weight | O preview/D export; P deterministic fit/seam rules | WA-FRAME-ST-2 → WA-FRAME-AC-5/6/7/8 |
| OPT-54 | Printer/profile selection; Change printer; custom rectangular dimensions | D gated export/profile path; P generic-first verified profiles | WA-KIT-ST-1/3 / WA-INTEGRATE-ST-2 → WA-KIT-AC-1/11,WA-INTEGRATE-AC-3/4 |
| OPT-55 | Nine named profiles:one180sq,six256sq,one340×320,one350×320 | D client-declared,dimensions not authoritative; P independent official verification | WA-INTEGRATE-ST-2 → WA-INTEGRATE-AC-3/5 |
| OPT-56 | Width/depth/build height; shared/per-edge margins; keepouts; part spacing; rotations | P complete safe printer-volume contract | WA-KIT-ST-1 → WA-KIT-AC-1/2/3 |
| OPT-57 | Per-colour grouped plates/files; separate frame; no oversized-part omission | D export path unverified; P blocking safe fit | WA-KIT-ST-1/2 → WA-KIT-AC-2/3/4/5 |
| OPT-58 | Explicit Prepare; progress; Stop preparation; Retry | D; P immutable snapshot/cancel semantics | WA-KIT-ST-3 → WA-KIT-AC-7/9/11 |
| OPT-59 | Download ZIP; ZIP progress; Stop ZIP; retry/download-ready state; every model/document/project/frame inclusion combination | D download stages; P explicit inclusion contract,complete archive and no partial success | WA-KIT-ST-2/3 → WA-KIT-AC-5/7/10/11 |
| OPT-60 | Individually download print-sheet PDF and tiled-map PDF; map page-overflow recovery through explicit print-sheet action | D individual downloads; P distinct serializers and bounded fallback | WA-KIT-ST-2/3 → WA-KIT-AC-6/11 |
| OPT-61 | A4/Letter; overview/full-scale/tiled maps; frame map; print checklist | D; P exact scale/pages/monochrome accessibility | WA-KIT-ST-2 → WA-KIT-AC-6 |
| OPT-62 | Editable project in kit; manifest; IDs/colour/plate transforms; estimates/warnings | D; P complete original portable contracts | WA-KIT-ST-2 → WA-KIT-AC-5/6 |
| OPT-63 | Native STEP,binary STL,standard3MF; explicit format selection | P confirmed shared architecture; not verified by observed previews | WA-CORE-ST-2 / WA-KIT-ST-2 → WA-CORE-AC-4/5/6,WA-KIT-AC-4 |
| OPT-64 | Vendor multi-plate project with printer/filament assignments | D; P distinct adapter qualification,not standard3MF equivalence | WA-INTEGRATE-ST-2 → WA-INTEGRATE-AC-5 |
| OPT-65 | Open in desktop slicer; consent; preparing/sent/failure/retry/expiry; mobile ZIP fallback | D; P truthful protocol/permission/local fallback | WA-INTEGRATE-ST-3 → WA-INTEGRATE-AC-6/7/8 |
| OPT-66 | Optional temporary hosted file delivery,link renewal/deletion/auth | D delivery mechanism unverified; P separately approved service contract | WA-INTEGRATE-ST-3 → WA-INTEGRATE-AC-7/8 |

### Project lifecycle, help, languages and service actions

| Option ID | Distinct options/actions and conditional coverage | Evidence / distinction | Owner story → acceptance |
| --- | --- | --- | --- |
| OPT-67 | New/random starter; editable title; explicit Save/update; saved/dirty/unsaved states | O save/rename; P exact identity/state contract | WA-PROJECT-ST-1 / WA-EDIT-ST-1 → WA-PROJECT-AC-1,WA-EDIT-AC-5 |
| OPT-68 | Local library thumbnail/title/date/size/layout; most-recent ordering; empty state | O; P bounded local storage/thumbnail fallback | WA-PROJECT-ST-1 → WA-PROJECT-AC-1/2/4 |
| OPT-69 | Case/accent-insensitive all-word search; no results; Clear search | O search; P exact normalization | WA-PROJECT-ST-1 → WA-PROJECT-AC-2 |
| OPT-70 | Open; Duplicate; Rename; Return to open panel | O; P atomic project and focus contracts | WA-PROJECT-ST-1 / WA-SUPPORT-ST-1 → WA-PROJECT-AC-1/4,WA-SUPPORT-AC-2 |
| OPT-71 | Two-activation Delete confirmation; Undo deletion; Dismiss notice | O delete/restore/reload; P explicit dismiss/history semantics | WA-PROJECT-ST-1 / WA-SUPPORT-ST-1 → WA-PROJECT-AC-3,WA-SUPPORT-AC-2 |
| OPT-72 | Session recovery; dismiss recovery; reload; retry failed storage; cross-tab conflict | O reload; P recovery/concurrency/failure safety | WA-PROJECT-ST-1 / WA-SUPPORT-ST-1 → WA-PROJECT-AC-4/8,WA-SUPPORT-AC-2 |
| OPT-73 | Undo/Redo; coalesced gestures; section reset; redo branch; project isolation | O one-action undo/D broader semantics; P full bounded history | WA-PROJECT-ST-2 → WA-PROJECT-AC-5 |
| OPT-74 | Export/import editable project; unknown version/asset/budget rejection | D gated; P complete schema and atomic validation | WA-PROJECT-ST-3 → WA-PROJECT-AC-6 |
| OPT-75 | Bulk backup; bulk import/merge; duplicate ID/time conflicts; atomic cancellation | D gated; P strict complete batches | WA-PROJECT-ST-3 → WA-PROJECT-AC-7 |
| OPT-76 | Copy share URL; manual copy fallback; open as new; oversize file fallback | O copy action; P complete assets and safe route extension | WA-PROJECT-ST-3 → WA-PROJECT-AC-9 |
| OPT-77 | Expand every contextual help; no-effect/range/reset explanations | O all visible help; P schema-linked completeness | WA-SUPPORT-ST-1 → WA-SUPPORT-AC-1/7 |
| OPT-78 | English and Italian actions; language persistence; locale documents/numbers | D language actions declared/hidden; P complete translations and parsing | WA-SUPPORT-ST-2 → WA-SUPPORT-AC-3 |
| OPT-79 | Help/About; full license; Terms; Privacy; Contact; Support | O public legal/privacy and menu visibility; P independent reviewed content/destination | WA-SUPPORT-ST-2 → WA-SUPPORT-AC-4 |
| OPT-80 | Access-code entry/submit/show-hide/clear; Continue trial; current access/trial status | V entry/trial; D authorization result/policy; P owner-approved optional hosted behavior | WA-SUPPORT-ST-3 → WA-SUPPORT-AC-5 |
| OPT-81 | Account menu; Sign out; session expiry/re-entry; local design preservation | O trial sign-out/re-entry retains local library; D authenticated expiry; P explicit optional service contract | WA-SUPPORT-ST-3 → WA-SUPPORT-AC-5/6 |
| OPT-82 | Keyboard,narrow320px,real200% zoom,screen reader,touch,theme contrast | O narrow presentation only; P independently required Gridline integration,not copied layout | All frontend stories → WA-SUITE-AC-7 and each phase accessibility AC |
| OPT-83 | Existing saved-project autosave on Projects/pagehide; Saved Undo restores stored revision and marks editor dirty; unsaved/new never auto-enter library | O navigation/pagehide/Saved Undo; P explicit preference,transaction and safer draft preservation | WA-PROJECT-ST-4 → WA-PROJECT-AC-11 |
| OPT-84 | Separate empty/hidden curated community gallery; id/title/author/thumbnail/full design; eligibility; open as new unsaved; invalid-card isolation | D declared empty catalogue,not UI exercised; P original curated delivery | WA-PROJECT-ST-5 → WA-PROJECT-AC-12/10 |
| OPT-85 | Account identity email,edition,license/code-access status; failed identity links-only fallback; retry next open; Escape/outside/Tab dismissal | O trial dismissal/focus; D identity/retry execution unverified; P bounded safe menu/state behavior | WA-SUPPORT-ST-3 → WA-SUPPORT-AC-8 |

Catalogue-level expansion is mandatory: material cases enumerate standard01–30 and
matte01–25 for **each** selector (110 cases); printer cases enumerate all nine
verified profiles; preset cases enumerate M1–M8,S1–S7,F1–F8 plus all six shortcut
actions; layout interaction cases enumerate the full4×5 matrix and applicable
boundary toggles. These indices are test inventory keys, not copied product names.

## Common contract C1 — units, coordinates, and identity

- Lengths use millimeters; areas mm²; volumes mm³; angles degrees in UI/files.
  The panel lies in XY, centered at `(0,0)`. +X is right, +Y up, +Z toward the viewer
  and away from the wall. Rotation is counterclockwise looking toward the panel.
- Each decorative part has a local origin at its base footprint's area centroid,
  local XY parallel to panel XY, local base at Z=0. `assemblyTransform` places it
  in the panel. The optional frame lies behind it, defined in phase 07.
- Print coordinates are independent: +Z is build height, Z=0 is the plate. A
  `printTransform` is a rigid rotation/translation, never a scale. Exploded offsets,
  cameras, grid, lighting, room scene, selection and hidden parts are preview-only.
- A stable `partId` derives from generator version and layout cell key. A human
  `mapNumber` is a separate positive integer. Sorting follows row from +Y to -Y,
  then X ascending, then cell key for ties. Numbering is contiguous after clipping.
  Shape, palette, and movement changes retain IDs when cell topology is unchanged.
  Layout/outline/size changes may change IDs; never claim cross-topology identity.
- One result contains `revisionId`, generator/version, canonical parameter digest,
  units, parts, assembly bounds, diagnostics and budget usage. Each part includes
  ID/number, role, local bounds, assembly transform, footprint, volume, colour ID,
  validity status, tessellation and a worker-internal solid reference. Do not send
  kernel handles to the UI. Frame IDs occupy a separate namespace.

## Common contract C2 — versioning and deterministic data

Proposed version sequence: model schema/generator pairs `1/1` (01), `2/2` (02),
`3/3` (03), `4/4` (04), `5/4` (05 colour metadata), `6/5` (07 frame), `7/6` (09 assets).
Phases 06/08 add separately versioned project/kit envelopes, not a fictitious CAD
change. The version pair is exact, not a minimum supported version.

Only implemented pairs are accepted. Each extension must supply a tested, explicit
forward migration from its immediate predecessor or continue rejecting that pair.
Migration produces a new unsaved revision, previews changed defaults, and keeps
original bytes. No automatic downgrade, unknown-field passthrough, or silent
reinterpretation. Keep old generation behavior available when claiming old-file
reproducibility. Planning must freeze the actual supported-version table before
implementation; this sequence is a proposal, not shipped compatibility.

Use an explicit integer seed, default 1, range 1–9999. Independent named substreams
serve layout, relief, movement and colour so an extra colour draw cannot move cells.
Planning freezes the PRNG, stream derivation, ordering and test vectors with the
generator version. No current time, global random state, or GPU-dependent geometry.
Randomize chooses a new valid seed, saves it, and is undoable. Determinism means
matching part IDs/topology and dimensions within 0.01 mm, and volumes within 0.1%
across supported runtimes. Byte-identical STEP/ZIP output is not required; timestamps
and writer metadata may vary. Same-runtime repeated geometry must match canonical
numeric arrays after prescribed 0.001 mm comparison quantization.

## Common contract C3 — validation and accepted state

All public boundaries validate unknown data before CAD work: UI proposals, files,
storage, fragments, worker messages, migrations and adapter profiles. Reject wrong
types, nonfinite numbers, unknown enum/version/key, missing required values,
duplicate IDs, dangerous object keys, excessive nesting, and violated joint limits.
JSON numeric strings are not numbers. JSON nesting limit is 16. Unit conversion is
never guessed. A declared UI step is an increment, not a quantization rule; finite
in-range manually entered values are accepted unless the field is explicitly integer.

```text
draft text → validated candidate → bounded worker generation → validated result
    │                │                       │                       │
    └── field error ─┴── rejected candidate ──┴── failed/cancelled ────┤
                              previous accepted revision stays ←───┘
validated result → atomic accepted revision → explicit export snapshot → download
```

The diagram separates unfinished input from the accepted printable design. A new
candidate is not accepted until all required CAD/mesh checks pass. Show previous
geometry labelled “Previous valid design” during pending/error states. Disable
export of a stale or invalid current edit; offer explicit Revert to valid design.
Failed import also retains selection, undo history, active project and saved bytes.
Opening a failed file never replaces data with defaults. Missing storage permits
first-run defaults; corrupt storage does not authorize overwriting its bytes.

Only the newest queued candidate survives. Stale responses cannot commit. Cancel
returns to the prior accepted revision; terminate/recreate an unresponsive worker
when necessary. Explicit Export captures a complete accepted revision, format and
options; later edits do not retarget it. One export job at a time. Preserve pinned
objects until success/cancel/failure; dispose superseded kernel, mesh, GPU and URL
resources. Parameter/colour/camera edits create no serialized model/PDF/ZIP files.

Errors include code, affected field or part IDs, useful nonsecret context and an
action: correct values, revert, retry, reduce complexity, or save project file.
Never log entire designs/assets by default. Unknown worker failures get a safe
message and reproducible version/budget context, not raw kernel stacks in UI.

## Common contract C4 — geometry and generation budgets

All numbers below are **proposed qualification limits**, not benchmarks. Bounds
apply equally to imports. Larger individual parameter ranges do not guarantee that
every combination fits. Report which combined budget fails before expensive work.

| Budget | First slice | Expanded local core / assets |
| --- | --- | --- |
| Decorative parts | 128 | Hard ceiling 4000; qualification tiers 512 then 4000 |
| Frame tiles / total solids | none / 128 | 256 / 4256 |
| Input normalized contour vertices | 4096 | 100,000 across generated footprints; asset limits also apply |
| Tessellation | 100,000 triangles/part; 500,000 total | 100,000/part; 2,000,000 total |
| CAD operations counted before scheduling | 10,000 | 200,000 |
| Estimated geometry job memory | 256 MiB | 512 MiB; measured worker peak ceiling 768 MiB |
| Generation timeout | 30 s | 120 s |
| Project file bytes before parsing | 1 MiB | 16 MiB including embedded assets |
| Active CAD jobs | 1 plus latest queued candidate | same; export pins at most one extra accepted result |

The operation estimator and memory accounting must be calibrated against real
kernel allocation before a phase can advertise its tier. A supported 512-part
tier must reject 513 with a clear limit, not quietly run to the 4000 hard ceiling.
Raising a tier needs reviewed measurements, not a hidden configuration change.
Preflight checks estimates; runtime counters/timeout enforce actual bounds.

Qualification environment proposal: Windows 11 x64, 4 physical CPU cores,
16 GiB RAM, integrated graphics, current pinned Chromium, production build,
1280×800, no CPU throttling; record actual CPU/browser/kernel versions. Repeat
correctness on Linux CI and Firefox; record tablet/phone results separately.
Use 5 cold and 20 warm runs. Record median/p95, initialization/download sizes and
peak worker memory. First-slice 100-part warm generation target p95 ≤10 s;
512-part target ≤30 s; 4000-part target ≤120 s, under the stated ceilings. These
targets bound waiting and fit a typical local device; they are release gates to
measure, not promises. Input feedback and cancel acknowledgment target ≤200 ms
on this environment; worker termination may complete later. Do not claim mobile
performance from desktop results. Revise the advertised tier if qualification fails.

Proposed manufacturing minima: load-bearing printable material 1.2 mm, top/tip
width 1.2 mm, residual material below engraving 1.2 mm, assembled free clearance
between distinct decorative solids 0.8 mm. Frame-specific fits are intentional
exceptions with their own contract. CAD tolerance 0.001 mm; collision/clearance
checks include a 0.01 mm safety allowance. No ideal zero-width tips or zero-volume
parts. Closed, finite, consistently oriented manifold meshes with positive volume
and valid non-self-intersecting CAD solids are mandatory. Touching neighbors are
not a valid assembly. A printer/material profile can demand stricter minima.

Tessellation proposal: maximum linear chord deviation 0.05 mm, angular deviation
5°, no undocumented coarsening at budgets. Native CAD can be more exact than the
mesh. Reject an over-budget mesh or ask the user to change the design; do not
silently loosen tolerance. STEP retains analytic curved faces where constructed.

## Cross-suite verification and approval gates

### Mandatory story completion and test contract

Every phase's story table is normative. A story is complete only when all linked
acceptance IDs pass, its named automated normal/boundary/invalid/error tests are
implemented and run through `npm run check`, and listed manual evidence is recorded
or remains an explicit release blocker. Tests are future implementation work; this
documentation task adds no test or application code. A passing test suite is not
proof of bug-free behavior, physical safety or third-party compatibility everywhere.

In story tables, **N**=normal, **B**=boundary, **I**=invalid input, **E**=operational
error/recovery. Each entry states an observable assertion, not only a test topic.
QA owns the planned test files unless build explicitly reassigns ownership in a
reviewed plan. Geometry/frontend own the production contracts under test. Node
tests use `tests/wall-art-<phase>.test.mjs`; browser tests use
`tests/browser/wall-art-<phase>.spec.ts`. Ensure the shared check actually discovers
all new files; a test that exists but does not run does not complete a story.
Independent CAD/mesh reimport assertions belong in the automated gate. Actual
slicer GUI import, physical coupons, screen readers, touch and owner visual review
need additional recorded evidence. Fixtures must be original, bounded and kept out
of production. Each test name includes story/acceptance ID for traceability.

Implementation maintains a machine-checkable case inventory from the accepted field
schemas and this ledger. Each control/action, enum value, catalogue entry and stated
conditional branch maps to its story, acceptance IDs and runnable test names. Numeric
fields map to minimum/default/maximum, just-outside and nonfinite/type cases; finite
count selectors explicitly enumerated here test every value. CI rejects missing or
orphan mappings and skipped required cases. A grouped ledger row is not permission
to test only its first option. New controls require a ledger/case update in the same
change. Original analytic/CAD fixtures and reviewed local visual baselines are the
test oracles; CI must not depend on another service or its private implementation.

| Suite story | Completion criteria | Required tests / ownership |
| --- | --- | --- |
| WA-SUITE-ST-1 — One authoritative contract | WA-SUITE-AC-1–3 pass; every ledger item resolves to a story/AC and exact supported-version validator | QA `tests/wall-art-contracts.test.mjs`: N supported schemas round-trip; B all declared limit edges are enforced; I unknown version/field fails before CAD; E failed migration preserves original bytes. Document link/story mapping review complements tests. |
| WA-SUITE-ST-2 — Integrated qualified release | WA-SUITE-AC-4–7 pass for every advertised tier/platform, with gaps labelled | QA `tests/browser/wall-art-workflow.spec.ts` and `tests/wall-art-contracts.test.mjs`: N complete edit→save→kit; B maximum qualified design; I stale/invalid export blocked; E worker/storage/export cancellation preserves valid data. Manual reader/slicer, visual, AT and physical claims retain separate evidence. |

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-SUITE-AC-1 | Every capability in the ledger has an owning spec,phase,approval status and complete implementation test mapping | Document cross-review and schema/case-inventory check; missing/skipped option cases or orphan parameters fail the shared gate; no implied shipped features |
| WA-SUITE-AC-2 | Same supported definition reproduces IDs, transforms and geometry within C2 tolerances | Same-runtime repeat and Windows/Linux golden fixtures; min/default/max seeds |
| WA-SUITE-AC-3 | Invalid, oversized, unknown-version and over-budget inputs never enter CAD or replace valid data | Boundary tests at limit/limit+1; worker-call and storage-write sentinels |
| WA-SUITE-AC-4 | Stale, cancelled and failed jobs cannot change accepted state or export the wrong revision | Controlled out-of-order worker/export journeys and resource counters |
| WA-SUITE-AC-5 | All formats preserve scale, parts and placement; STEP remains native CAD | Independent CAD/mesh reimport plus slicer checks for one curved part and two-part assembly |
| WA-SUITE-AC-6 | The advertised tier meets C4 or is explicitly reduced before release | Recorded default/worst-case cold/warm runs, timeout/cancel and memory evidence |
| WA-SUITE-AC-7 | No shell redesign or inaccessible editor regression enters the feature | Gridline screenshot review, keyboard, 320 px, real 200% zoom, both themes and AT evidence |

Every implementation phase runs `npm run check`, adds meaningful regression coverage,
and reports acceptance IDs as pass/fail/unverified. Geometry phases require headless
checks and independent format inspection. UI phases require reviewed screenshots,
keyboard journeys and error recovery. Physical fit is separate evidence; do not
start a hardware print without authorization.

## Specification review checkpoint — 2026-11-02

This is requirements evidence, not implementation acceptance. The suite contains
12 documents,85 coverage groups,37 stories and112 acceptance criteria. A local
documentation audit resolves story/acceptance references, finds no orphan acceptance
criteria, checks N/B/I/E coverage for every story, and checks local links and source
identity exclusions. Future runnable test cases remain implementation work.

A second **specification-led Playwright CLI walkthrough** followed the written flows
for all accessible sections. It repeated the20 outline/layout combinations, seven
surface families, shape and movement controls, frame controls, all23 preset recipes,
six home starters, all eight band counts/selectors, and all55 material choices in
both selectors. It also exercised camera/room return,320 px layout, save/search/
duplicate/delete/Undo, section reset, sharing, existing-project Saved Undo and account
dismissal. Earlier isolated checks cover both plan rings and pagehide persistence.
Visual model captures were inspected; a rendered image is not mesh or fit evidence.

The walkthrough confirmed deliberate differences that must stay explicit: radial
outline clipping, the tip-angle convention, exact field formulas, safer complete
sharing/storage, and the existing Gridline layout are independent contracts. The
catalogue includes separate narrow attracting forms and broad inward-pointing blades.
An empty curated catalogue has no visible cards to exercise.

Independent read-only review identified and corrected portable outline/image aspect
preservation, Reset All test coverage, and page-overflow recovery. Output-inclusion
tests now enumerate all16 combinations. The review does not approve the outstanding
product, physical or algorithm decisions below.

Restricted imports/downloads, print-kit preparation, vendor handoff, dormant image
controls, language switching and authenticated account behavior were reviewed from
public declarations where available; execution remains unverified. No access gates
were bypassed. Native CAD, mesh validity, slicer compatibility, physical fit, screen
readers and physical touch cannot be inferred from these interaction checks.

The existing application gate passed: scaffold checks,both typechecks,production
build,21 Node tests and38 Chromium browser tests. These verify the foundation only;
none completes this suite's future functional acceptance criteria. No application,
runtime test or dependency changes accompany this draft.

## Decisions and gates still open

1. **Before phase 01 planning approval:** approve numerical defaults/minima, exact
   seed algorithm/test vectors, generation qualification environment and initial
   tier; review pinned CAD distribution license obligations and reader/export choices.
2. **Before each expansion:** approve the schema transition and original mathematical
   fixtures; resolve native CAD construction in the reviewed technical plan and
   verify it during feature implementation, without mesh-to-STEP substitution.
3. **Before phase 07:** decide attachment method, screw hardware and seam restraint;
   approve physical coupon plan. No universal wall-load or retention claim is possible.
4. **Before phase 08:** approve document-kit scope and output/page/archive limits.
5. **Before phase 09:** approve SVG/image scope, asset schema and decoding limits.
6. **Before phases 10–11 integrations and service decisions:** choose supported integrations, authoritative
   profile sources, language review, hosting/privacy/legal policy and any server use.
7. Foundation visual signoff and assistive/touch gaps remain visible release gates.

None prevents writing a useful draft. These are implementation blockers for the
named phase, not permission for a planner to invent product decisions silently.

## Documentation impact

Build resolves these proposals in reviewed plans; this task changes only this suite.

| Path | Required later change / no-change decision |
| --- | --- |
| `docs/product.md`, `docs/mvp-roadmap.md` | Approve phase boundaries; distinguish approved first pattern from rich proposed expansion; reconcile frame/document scope and spec links |
| `docs/architecture.md` | Record accepted version/worker/output contracts, project persistence and routing extension, asset boundaries; preserve stack/dependency direction |
| `docs/specs/website-definition.md` | Reconcile its earlier layout proposal with Gridline and accepted frame/library/document decisions; do not revive a side inspector |
| `docs/specs/website-foundation.md`, foundation/Gridline plans | Retain historical evidence; update availability expectations only when replaced by verified functions, not mark old gaps closed |
| `README.md` | Replace unavailable-state claims as phases ship; document local workflow, formats and honest limitations |
| `docs/development.md` | Add fixture, worker, memory, import, storage, export/slicer and accessibility reproduction steps with actual commands |
| `LICENSE` | No change; preserve owner rights. Dependency/asset notices are separate reviewed obligations |

## Implementation sequence and handoffs

This is a feature-exit sequence, not a technical task plan. First establish C1–C4
and phase 01's runnable headless export path. Connect its minimal editor. Verify
the three independent round trips before adding layouts, then shape, then movement.
Add full editor/lifecycle, qualify frame and packing, and then implement the retained
asset/integration contracts when their plans are approved. There is no separate
CAD/export feasibility prototype milestone: phase01 is a useful runnable generator
with all three exports, as the shared roadmap requires. Stop for user review and
plan approval at each selected phase.

Frontend consumes accepted revisions, diagnostics and field schemas; it never
constructs printable geometry. Geometry owns C1–C4 validation, canonical solids,
mesh checks and exports. QA uses the same versions, IDs and limits, not a separate
interpretation. Every phase below supplies its specific handoff and exit criteria.
