# Wall art 06 — projects, local recovery and portable sharing

Status: **DRAFT for user review; no cloud-sync requirement.**
Depends on [05](wall-art-editor.md). Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-PROJECT`. Project envelope version 1 is independent of the
model schema/generator pair. This phase does not change CAD semantics.

Reuse phase 02's approved exact 1/1 and 2/2 dispatch and explicit upgrade contract.
Preserve original imported bytes through upgrade; opening a project must not
reinterpret a v1 model or add physical identification cuts automatically. See the
[owning decisions](wall-art-layouts.md#approved-decisions--2026-11-02).

Phase 02's approved capacity revision also separates private session-only native
snapshots and temporary export files from project persistence. Neither counts as
Save, recovery or a portable project. Reuse its ownership and cleanup contract;
do not place native snapshots in this phase's editable file envelope.

## Problem and user flow

A maker must be able to experiment without losing the last useful design. Start
an unsaved project, edit, use Undo, save it in this browser, find it in a library,
and carry a complete editable file elsewhere. Recovery after reload must not be
misrepresented as a successful explicit library save or remote synchronization.

Included: title, explicit Save/Update, automatic recovery draft, local library,
search/open/duplicate/delete/undo, bounded edit history, reset baselines, strict
portable files, bulk backup/merge and complete fragment sharing. Proposed expansion:
library, backup and sharing. Confirmed direction: local reproducible design files,
automatic valid-design recovery and failure preservation. Excluded: accounts,
cloud storage, collaboration and cross-device synchronization.

## Data and limits

| Field / limit | Type and default | Range / unit / policy |
| --- | --- | --- |
| projectId | opaque string; new on New/import-as-new/duplicate | 1–64 ASCII letters, digits, `-`/`_`; unique local identity |
| title | string; “Untitled wall art” | Trimmed 1–120 Unicode code points; plain text, no control characters |
| createdAt, updatedAt | UTC timestamp strings; local action time | Valid ISO timestamps within supported Date range; untrusted imports never control sort ahead of local imported time |
| savedRevision | nullable digest; null initially | Full accepted document digest including material/frame/print preferences/assets/baseline |
| baseline | versioned model-section snapshot; factory by default | Exact accepted preset/random baseline plus preset ID/version if applicable |
| thumbnail | optional derived PNG | Maximum 256×256, 128 KiB; never authoritative geometry |
| project bytes | integer limit | 16 MiB including embedded assets; phase 01 file remains bounded at 1 MiB |
| local records | integer limit | 200 live projects; application logical payload ≤256 MiB, not a promise of browser quota |
| backup/import batch | integer/byte limits | 20 projects per batch, 128 MiB source, 256 MiB decoded total; nesting≤16 |
| undo history | session-only records | 100 accepted actions or 64 MiB logical snapshots, whichever first; immutable assets deduplicated |
| deletion undo | session list | Last 20 deletions; retained tombstone data counts toward storage limit |
| share fragment | UTF-8 byte limit | 32 KiB entire fragment, 16 MiB decoded document ceiling; no network upload fallback |
| search | string; empty | 0–200 Unicode code points; all-word matching |
| libraryAutosave | boolean; true | Existing saved projects only; explicit user preference, separate from draft recovery |

Envelope contains format/version, ID/title, timestamps, supported model pair,
explicit seeds, complete parameters, frame/print preferences when supported,
normalized embedded assets, and baseline. It excludes CAD/mesh caches, UI drafts,
camera, room scene, selection, account data, credentials, raw runtime exceptions
and edit history. Exported title is not used directly as a filesystem path.
All optional fields are schema-defined. Missing required assets are errors.

Storage mechanism is a proposed transactional browser store, subject to reviewed
architecture planning. Use injectable adapters and compare-and-swap revision checks.
Do not implement multi-record atomicity with unrelated localStorage writes and
call it a transaction. Theme key and foundation lifetime remain unchanged.

## State and persistence contract

States are **Unsaved project**, **Unsaved changes**, **Saved in this browser**,
**Saving**, **Save failed**, and independent **Recovery draft available/failed**.
Dirty compares the accepted complete document with its last successfully saved
revision. Camera/selection changes do not dirty it. Undo back to saved values clears
dirty. A pending/invalid geometry candidate is not a saved or accepted document.

Save validates the title and current accepted document. New projects create one
record; existing projects update their expected revision. Save title changes with
the document. Rename in the library is an atomic metadata update and updates the
active document's saved title without discarding unsaved geometry. Failure preserves
old stored bytes and in-memory edits, keeps dirty, and offers Retry and Save file.
Never say “Synced” or “Saved” after a failed write.

Automatic draft recovery records only accepted revisions, scoped by project ID
and browser tab session. Proposed debounce 500 ms after acceptance; explicit Save
flushes first. The 500 ms delay coalesces slider results, not a benchmark target.
Do not rely on unload to guarantee storage. If a page closes before completion,
the previous recoverable revision remains. First return restores the last valid
active draft after strict validation; if newer than its library record, label it
“Recovered unsaved changes”. Corrupt/incompatible bytes are preserved and may be
downloaded explicitly for recovery; offer a valid new design without overwriting
the corrupt slot. A valid library record can open even if another draft is corrupt.

Cross-tab update conflict never overwrites silently. If expected revision differs,
show “This project changed in another tab”, with Reload saved version (confirm
discard), Save as copy, or Cancel. Do not automatically merge numeric parameters.
One tab's history cannot target another tab's new active project.

### Existing-project autosave and Saved Undo

Retain the interaction-observed lifecycle behavior as a full feature: when
libraryAutosave is enabled, returning to Projects flushes a valid dirty **existing
saved** project through the same compare-and-swap validation as Save. Show “Saved
in this browser” only after commit, with **Undo saved update** and **Dismiss**.
This Undo restores the prior stored document, keeps the current accepted editor
content, and marks the editor dirty against that restored saved revision. It is
not ordinary edit Undo. Retain the before/after saved revision pair until the next
successful save for that project or explicit dismissal; never undo over a concurrent
tab write. On conflict offer Save as copy or Cancel, not forced rollback.

Also flush the latest accepted existing-project revision on visibility becoming
hidden and pagehide, deduplicating both events. This is best effort: browser
termination can interrupt asynchronous storage. Do not promise the last edit was
saved unless a completed transaction was recorded. Recovery draft and manual file
backup remain the fallback. Test persisted completion in normal lifecycle events
and interrupted writes separately. A pending/invalid candidate does not overwrite
the saved record with the previous accepted design merely because navigation occurred.

Unsaved/new projects never enter the library through these triggers. Projects
shows **Return to open panel** with its unsaved status and explains that it is not
a library record. Unlike a lossy replacement, Printametric proposes to preserve its
recovery draft and offer Save/Keep draft/Cancel before opening another project.
This deliberate safety improvement is not an observed automatic-library-save claim.
With libraryAutosave disabled, navigation changes neither saved record nor dirty
state; explicit Save and accepted-draft recovery remain available. Preference
changes themselves cannot trigger an immediate hidden save.

### Separate curated community gallery

Retain this as a distinct feature, not another preset category. Inventory evidence:
**client-declared; execution unverified**, with an empty declared catalogue. It is
hidden when no eligible records exist. Do not add fake cards to imply a community
exists. The proposed initial delivery is an owner-curated, same-origin static
catalogue of permitted original designs; user submissions/moderation/accounts are
outside this phase.

Each card contains `id` (unique ASCII1–64), `title` (plain text1–120), `author`
(plain text1–80), a rights/provenance record, optional thumbnail (≤256×256,128 KiB),
and a complete supported versioned design including assets. Dataset default is
empty; maximum100 records and32 MiB decoded JSON; each design obeys the16 MiB
project and C4 budgets. No executable markup, cross-origin image, tracking URL or
credential is permitted. Missing thumbnail uses a neutral fallback.

Before showing a card, validate its metadata, versions, schema, asset references,
rights eligibility and resource bounds. Invalid/ineligible records fail closed
individually without crashing or hiding valid records. A malformed/oversized whole
dataset hides the gallery and exposes a nonblocking catalogue-unavailable notice;
local projects continue working. No debug or trial flag is required to show a
nonempty eligible catalogue. Hidden empty gallery has no dead navigation action.

Activate a card from Projects to stage generation, then open a **new unsaved project**
with a fresh identity, full card design and preserved source attribution metadata.
This replaces the whole document after confirmation/recovery, not in-editor preset
parameters with retained current dimensions. It does not automatically save to the
library. Failure retains current project/recovery/history and leaves other cards
usable. Cancel and Return to open panel restore focus to the originating context.

## Library and destructive actions

Library uses a labelled modal or tool-owned full-width view within Gridline, with
search, empty state, result count and list/grid alternatives. Do not add a global
catalogue route for model tools. Each record shows thumbnail or neutral fallback,
title, updated date, nominal size and layout. Most recent local updatedAt first;
ties use projectId. Titles and imported metadata render as text only.

Search normalizes Unicode to decomposed form, removes combining accents, applies
locale-independent case folding, splits on whitespace, and requires every word to
occur in normalized title or layout label. Empty query lists all. “No saved projects”
differs from “No matches”; Clear search is keyboard accessible.

Open validates and generates before replacing the active design. Unsaved work
offers Save, Keep recovery draft and open, or Cancel. Duplicate creates a new ID,
title suffix within 120 characters and current local timestamps, independent of
the source; it never shares mutable stored assets. Delete requires a second explicit
confirmation naming the project, then removes it from results and offers Undo.
No timed auto-dismiss. Undo restores exactly the record/bytes unless the same ID
now exists, in which case offer Restore as copy. Deleting the active record keeps
its accepted editor content as an unsaved new identity after confirmation; it must
not silently save back under the deleted ID. Reload preserves successful library
mutations; deletion-Undo is promised only during the current session.

## History and reset contract

Each successful atomic design edit adds one entry. A slider/drag gesture coalesces
from pointer-down to pointer-up; numeric typing coalesces until commit. Preset,
random design, resize including points, reset-section, import replacement and
colour reverse each count once. Failed candidates add none. Undo/Redo restores
parameters, seeds, palette, assets and baseline, then verifies/reuses the matching
valid geometry. New accepted edits clear redo. History eviction reports that older
actions are no longer available; no hidden unbounded cache.

Reset Section restores that section from the stored adapted preset/random baseline;
without one, use factory defaults. Reset All restores all design sections from
the same baseline but retains title/project ID, printer preferences and theme.
Preset baseline changes are part of the undo entry. Model topology IDs regenerate
under the original generator version. New/Open/duplicate starts a separate history;
Undo never navigates into another project or rewrites its saved record.

Buttons always work by keyboard. Optional Ctrl/Cmd+Z and redo shortcuts apply to
the editor only when focus is not in a native text-editing field; native input Undo
must remain native. Browser Back changes views/modes, not edit history.

## Import, backup and conflict contract

Accept phase 01's file through an explicit tested migration or reject with a useful
version message. Single-file import defaults to **Open as new**, stripping incoming
local identity for storage while preserving content and provenance version. Replacing
the current unsaved design requires explicit confirmation and one undo transaction.
Never update an existing library record merely because an imported ID matches.

Bulk backup exports a versioned JSON container with complete project documents and
assets, selected up to 20 records. Show counts/bytes and let larger libraries export
multiple batches. No thumbnail is required to reproduce a project. Import validates
the entire container, every version/asset/ID and all budgets before any store writes.
Geometric regeneration may be staged but no imported record is presented as validated
until its generation succeeds. Proposed all-or-nothing commit: one invalid member,
quota failure or cancellation preserves all existing records and bytes.

Merge policy: matching ID+canonical content digest skips a duplicate; matching ID
with different content imports a new ID and “Imported copy” label; different IDs
remain separate even if titles match. Incoming timestamps stay in provenance;
local creation/update time controls library order. Reject duplicate IDs within one
batch (including identical copies) as malformed. No overwrite mode in this phase.
Show preflight summary and explicit Import button. Source size and decoded size
guards apply before parsing/expansion; no archive decompression is needed for this
JSON backup. Cancellation releases staged assets and does not leave half a library.

## Complete fragment sharing and route proposal

Share captures the accepted definition, not project ID/title/history. Proposed
fragment grammar is `#design?share=v1.<base64url-UTF8-document>`, bounded at 32 KiB.
Do not compress in version 1. The document includes model/version/seeds, colours,
frame and all required normalized assets; omit only library metadata and printer
preferences by explicit share-format definition. If it cannot fit, offer Save
project file. Never drop SVG/image payloads silently to make a shorter URL.

Use explicit Copy link; clipboard denial exposes a labelled read-only text field
for manual copy. Warn that anyone with the link can read its design. No URL shortener,
upload, telemetry payload or server endpoint is required. At load, bound bytes,
decode once, validate then stage generation before changing active state. A valid
link opens as a new unsaved project after preserving/recovering existing work.
Reject malformed encoding/version/assets safely without echoing raw fragment text.

This is a proposed extension to `src/app/navigation.ts`, whose current parser accepts
only three exact hashes. Architecture review must define a pure route parser that
does not discard the share payload before validation. After successful acceptance,
replace the payload route with `#design`, preventing re-import on Back/reload;
preserve the loaded design through the recovery draft. Plain view links keep their
existing semantics. Room mode uses a separate explicit `#design?mode=room` proposal;
it cannot combine with a share payload. Back exits room and restores the saved
camera/focus; malformed combinations follow safe foundation recovery. No custom
pathname or routing-library requirement is implied.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-PROJECT-AC-1 | Save/update/rename/duplicate persist correctly and display honest dirty/saved state | Browser save→reload→open journey, title 1/120/121, save failure and retry |
| WA-PROJECT-AC-2 | Search is case/accent-insensitive all-word matching and lists most recent first | Pure normalization/tie fixtures; empty/no-match and thumbnail-failure UI tests |
| WA-PROJECT-AC-3 | Delete requires confirmation; Undo restores exact content without overwriting an ID conflict | Browser second-activation/cancel/delete/undo/reload tests, active-project deletion |
| WA-PROJECT-AC-4 | Recovery saves only accepted revisions and corrupt storage preserves old bytes | Storage sentinels, reload during debounce, quota/denied/read failure, unsupported-version cases |
| WA-PROJECT-AC-5 | Coalesced Undo/Redo, Reset Section and Reset All restore seeds/assets/baseline without crossing projects | Gesture,preset/palette reset,redo branching,history100/101 and byte-limit fixtures; change several sections then Reset All, compare every resettable section to adapted baseline, preserve title/ID/printer/theme, and one Undo restores the complete prior state |
| WA-PROJECT-AC-6 | Single import is complete and atomic; newer/unknown/oversized/invalid documents do not alter active state | 16 MiB boundaries, wrong types/version/seed/budget/assets; actual file round trip |
| WA-PROJECT-AC-7 | Backup/merge obeys all-or-nothing and collision policies | 20/21 records,128 MiB boundary, duplicate IDs, one corrupt member, cancellation/quota transaction tests |
| WA-PROJECT-AC-8 | Cross-tab conflicts cannot overwrite a newer saved revision | Two-context concurrency fixture and Save as copy/Reload/Cancel journeys |
| WA-PROJECT-AC-9 | Sharing reproduces complete definitions or offers a file; bad fragments preserve previous design | Size boundaries, missing asset, malformed base64, clipboard denial, no-network and history sentinels |
| WA-PROJECT-AC-10 | Library, confirmation, errors and copy fallback work with keyboard/narrow/zoom/AT | 320 px and genuine200% zoom, focus restoration, labels/live status and screen-reader checks |
| WA-PROJECT-AC-11 | Existing-project navigation/lifecycle autosave and Saved Undo follow the exact scope; new projects never auto-enter the library | Return-to-Projects/pagehide/visibility tests, interrupted writes, autosave off, concurrent Undo conflict and dirty-state assertions |
| WA-PROJECT-AC-12 | Empty gallery is hidden; eligible cards open complete new unsaved designs and invalid entries fail independently | Empty/mixed/oversized catalogue, card metadata/version/assets and generation-failure fixtures; keyboard open/return |

## Documentation impact and open decisions

### Stories and required implementation tests

QA owns `tests/wall-art-projects.test.mjs` and
`tests/browser/wall-art-projects.spec.ts`. Store adapter fixtures must test atomic
writes and actual browser reload. Every row is required future test work in the
shared gate, not a claim of present implementation.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-PROJECT-ST-1 — Manage and recover local projects | WA-PROJECT-AC-1/2/3/4/8 | Node/browser: N Save/Update/rename/search/open/duplicate/delete-confirm/Undo/reload; B title120,200 records,accent/all-word/no-match; I corrupt/unsupported stored record retains bytes; E quota/denial/two-tab conflict keeps dirty data and Retry works. Assert Return to open panel and dismiss notices do not mutate records. |
| WA-PROJECT-ST-2 — Undo and reset predictably | WA-PROJECT-AC-5 | Node/browser: N coalesced edit/preset/palette section reset restores saved baseline; separately change multiple sections, Reset All to adapted baseline, assert title/ID/printer/theme unchanged, then one Undo restores all prior values; B100/101 actions and64 MiB history; I failed candidate creates no history; E failed regeneration during Undo/reset preserves accepted view and exposes recovery. Native text Undo and browser Back do not cross project histories. |
| WA-PROJECT-ST-3 — Carry complete designs safely | WA-PROJECT-AC-6/7/9/10 | Node/browser: N single project,20-project backup and share round trips; B byte/fragment limits and duplicate conflict policy; I newer/malformed/missing-asset/duplicate-ID batch has zero writes; E cancellation/clipboard denial/storage failure preserves active and saved bytes. Keyboard/manual copy at320 px/zoom automated; AT reviewed manually. |
| WA-PROJECT-ST-4 — Autosave an existing record without losing Undo | WA-PROJECT-AC-11 | Node/browser: N Projects navigation autosaves existing dirty project and Saved Undo restores stored bytes while editor stays dirty; B duplicate visibility/pagehide events save once and new/unsaved records never enter library; I invalid/pending candidate cannot overwrite; E interrupted write/quota/concurrent Undo retains bytes and reports conflict. Browser termination guarantees are explicitly limited, not inferred from simulated events. |
| WA-PROJECT-ST-5 — Open a curated community design | WA-PROJECT-AC-12 and accessibility AC-10 | Node/browser: N eligible card opens complete new unsaved identity; B empty hides gallery,100 records/32 MiB limits; I invalid version/metadata/assets/rights exclude only offending card; E catalogue fetch or CAD failure preserves open project and valid neighboring cards. Owner content rights/visual thumbnail approval is manual. |

Architecture: transactional store, complete envelopes, route grammar and multi-tab
conflicts need reviewed decisions. Product/roadmap: distinguish automatic recovery
from explicit/library-navigation autosaving; approve library/share/bulk backup and
separate curated-gallery expansion. README:
local-only limitations, backup and corruption recovery. Development: atomic-write,
quota/concurrency, page lifecycle/Saved Undo, gallery, fragment and history fixtures. Foundation spec: route-extension
and storage-sentinel expectations change deliberately; retain theme behavior.
No LICENSE change; no server setup change. Blocking before implementation: approve
storage mechanism/transaction semantics, route extension, limits and migration table.

## Implementation steps and handoff

Freeze envelopes, validation and transactional behavior; verify file round trips
and history; connect library/recovery; then backup and sharing. Frontend owns state,
focus and AC-1–5/8–10. Geometry validates every restored model using C1–C4 and supplies
deterministic migrations/AC-6/7. QA tests real reloads and injected storage failures,
not only mocks of successful writes. Exit requires zero lost-design scenarios in
the invalid/concurrent matrix and visible local-only status throughout.
