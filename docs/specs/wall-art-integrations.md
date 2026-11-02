# Wall art 10 — material, printer and slicer integrations

Status: **DRAFT for user review; later sequenced contracts.**
Depends on [09](wall-art-assets.md). Authority: [suite](wall-art.md).
Acceptance prefix: `WA-INTEGRATE`. Adapter/profile schema version1 proposed.

## Problem, scope and evidence

A maker may want named filament choices, a verified printer profile, a slicer
project or an explicit desktop handoff. Those conveniences must not compromise
portable files, expose designs without permission or imply a print has started.

Material selection is interaction-observed coverage. Vendor project compilation,
downloads and direct desktop handoff are **client-declared; execution unverified**
coverage, not claims that Printametric already implements them. Full scope retains
all actions here. The exact supplier/platform and any hosted delivery are independent
owner decisions. Local core continues to function without an account/server.

Included: complete data-driven material families, named verified printer adapters,
explicit vendor-project packaging, Change printer, desktop handoff and mobile/file
fallback. Excluded: G-code, starting a printer, remote device control, automatic
unconsented upload, and pretending a generic3MF is a slicer-specific project.

## Material catalogue contract

Provide two collapsible material-family groups: **Standard PLA** and **Matte PLA**.
Coverage target:30 selectable standard entries and25 matte entries,55 total, in
both the selected panel-band selector and independent frame selector. Do not replace
this with a few sample hex colours. The actual dataset must be independently built
from permitted authoritative manufacturer data or an approved original equivalent;
no borrowed table, thumbnails, branding or colour claims. Names/colours/profile IDs
need source and license review during implementation. A different verified count
requires explicit owner scope review, not silent truncation.

| Data field | Type / default | Constraints |
| --- | --- | --- |
| catalogueVersion | version string / required | Immutable version,1–64 ASCII characters |
| materialId | string / required | Unique1–64 ASCII characters, independent of display name |
| family | enum / required | standard-pla, matte-pla |
| displayName | string / required |1–80 Unicode characters, plain text |
| previewColour | string / required | Canonical #RRGGBB; approximate appearance label always visible |
| density | nullable number / null |0.5–3 g/cm³; source/version required when provided |
| sourceRecord | provenance record / required | Authoritative source, verification date, permission/license and independently authored display data |
| slicerMaterialKey | nullable string / null | Adapter-specific, validated and versioned; not a secret |

Selecting a material sets the selected colour slot's hex, label and optional material
ID; frame selection changes only frame colour/material. It does not change wall-art
geometry or silently choose a printer. Editing hex afterward clears material binding
and labels the slot Custom, retaining explicit density only if the user confirms it.
Repeated names or equal hex values do not merge IDs. Display inactive/unused bands
as phase05 requires. Collapsed groups report count and selected entry; searching,
if offered, matches family/name with the project search normalization contract.

If a saved material version is unavailable, keep embedded hex/label/density and
show “Material profile unavailable; using saved colour”. Geometry/export remain
possible in portable formats. Vendor-project output requiring an absent material
key is blocked with a portable alternative, not silently mapped to another filament.
Iterate **all55 entries in both selectors** in automated tests, including group
collapse/reopen, keyboard selection, saved round trip and independent frame state.

## Printer adapter contract

Retain core numeric bed controls. A named adapter provides authoritative dimensions,
build height, margins, keepouts, permitted rotations and a profile version. Coverage
includes nine independently named profiles: one180×180 class, six256×256 classes,
one340×320 class and one350×320 class. Identical XY does not make those profiles
interchangeable; each requires its own official keepout/height/variant evidence.
These classes are inventory targets, not verified dimensions of a named product.

All values obey phase08 bounds. Unknown versions, excessive polygons, invalid
dimensions or unsupported variants reject before packing. Display the actual usable
area and source verification status. An adapter cannot weaken C4 thickness/clearance
or bypass fit. Choosing Change printer returns to editable settings with focus on
the current profile, preserves model/colours/frame parameters, cancels or marks old
preparation stale, then requires explicit re-preparation. Never reuse a cached ZIP
solely because two profiles share nominal XY.

## Vendor-project contract

User chooses Portable model or a specific supported slicer-project adapter. Portable
STEP/STL/standard3MF remain available. Adapter projects may contain multiple plates,
filament assignments and printer settings only when the target application's actual
version/schema is supported. Display target application/version and contents before
Prepare. No generic “3MF” label hides vendor-specific semantics.

An adapter consumes the phase08 immutable snapshot and part/plate manifests, never
rebuilds geometry. Preserve mm scale, IDs, colour groups, print transforms and actual
fit. Map every used material explicitly; no default filament replacement without
confirmation. Reject unsupported profiles/material count/extensions rather than
dropping objects. Test target import and visible plate/filament assignments using
the installed target application. A valid ZIP/XML package alone does not prove
compatibility. Adapter registry is a bounded explicit list, not a plugin framework.

## Explicit desktop handoff

Parameters: handoff method enum `download` (default), `desktop-link`, or
`hosted-link` (only if separately approved); target adapter ID1–64 ASCII characters;
rememberPermission boolean defaultfalse (session-only, not a blanket upload grant).

Flow: select target → prepare validated file → click Open in slicer → review what
will be sent and how → consent → invoke registered handler once → show **Sent to
desktop handler**. Do not say Opened, Imported or Printed without an actual supported
acknowledgment. Browser links cannot establish that a desktop app opened successfully.
States: unavailable, ready, preparing, permission requested, sent, failed, expired.
Offer Retry and Download file/ZIP in every failure or unsupported/mobile case.
Never attempt a custom scheme on page load or after an unrelated click.

Local method must use a verified supported file/handler mechanism. If the target
requires a remotely reachable file URL, do not invent a client-only blob URL that
the desktop cannot read. Offer download instead unless the hosted method is approved.
Browser protocol confirmation/cancel may be unverifiable; explain uncertainty and
keep the file available. No automatic repeated invocation or hidden popups.

### Conditional hosted delivery decision

Hosted delivery is **not required for basic local work** and needs architecture,
privacy, storage and authentication approval before implementation. Proposed bounds
if approved: explicit upload consent per snapshot; maximum256 MiB file; one active
upload;15-minute signed-link lifetime; deletion within24 hours after expiry; no
public listing; no logs of project contents or signed tokens. These are policy
proposals, not established service guarantees. Owner must approve concrete limits,
authentication/authorization, abuse prevention, region/retention, cancellation and
deletion evidence. A server must enforce them; client flags cannot secure uploads.

Cache keys include revision, profile, material IDs/versions, frame, adapter version,
format and locale. An expired link may be regenerated only by explicit action and
renewed permission when content/upload scope changes. Cancellation preserves local
accepted design and file, attempts server deletion if applicable, and reports if
deletion confirmation is unavailable. A signed URL may expose its token to the
desktop; show that trust boundary and never include it in analytics or support logs.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-INTEGRATE-AC-1 | All55 approved material records appear and select correctly in both selectors | Dataset schema/count/uniqueness; generated110 selection cases, group keyboard and save/load tests |
| WA-INTEGRATE-AC-2 | Custom hex clears binding; missing catalogue retains saved colours but blocks unsupported vendor mapping | Metadata-only CAD sentinel, unavailable-version and invalid density/material-key fixtures |
| WA-INTEGRATE-AC-3 | All nine named profiles have independently verified bounds and valid keepouts | Per-profile provenance review and automated phase08 fit cases, invalid/newer variants |
| WA-INTEGRATE-AC-4 | Change printer preserves model but invalidates exact kit/cache and restores focus | Browser action during ready/preparing states, same-XY/different-profile fixture |
| WA-INTEGRATE-AC-5 | Vendor project preserves all plates/parts/materials in a supported target | Package tests plus actual target import/version evidence; unsupported count/schema failures |
| WA-INTEGRATE-AC-6 | Explicit consent invokes handler once and reports Sent, not unverified Opened | Browser protocol spy, cancel/no-handler/mobile cases, Retry/download fallback and keyboard tests |
| WA-INTEGRATE-AC-7 | Hosted transfer cannot occur in local mode or without approved consent/policy | No-network sentinels; conditional service authorization/expiry/delete/cancel tests if adopted |
| WA-INTEGRATE-AC-8 | Complete snapshot keys prevent stale material/printer/frame/locale handoff | Cache mutation matrix, expired link and changed-revision retry tests |

## Documentation impact and decisions

### Stories and required implementation tests

QA owns `tests/wall-art-integrations.test.mjs` and
`tests/browser/wall-art-integrations.spec.ts`. Conditional hosted tests, if that
service is approved, also run in the shared gate with isolated service doubles;
deployment-policy evidence remains separate. No real user upload is a CI requirement.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-INTEGRATE-ST-1 — Select the entire material catalogue | WA-INTEGRATE-AC-1/2 | Node: N all55 independently approved records validate; B30/25 group counts,band1/8 and frame selector; I duplicate/missing/bad hex/density/key reject dataset; E unavailable version preserves saved colour. Browser110 individual selection/pressed-label/persistence cases, both collapsible groups, keyboard. Official facts/data permissions require manual review. |
| WA-INTEGRATE-ST-2 — Use verified printer and vendor projects | WA-INTEGRATE-AC-3/4/5/8 | Node: N each ofnine profiles,portable/project output and full snapshot key; B profile dimensions/keepouts/material counts; I unknown version/unsupported profile or mappings block; E preparation failure/Change printer invalidates cache without discarding model. Browser profile actions; actual target app version import and authoritative dimensions manually verified. |
| WA-INTEGRATE-ST-3 — Hand off explicitly and recover | WA-INTEGRATE-AC-6/7/8 | Browser/service fixtures: N one consented handler invocation and truthful Sent; B mobile/unavailable/expiry/size limits; I unapproved host or absent consent produces no network; E denial/cancel/no-handler/upload failure retains file and permits Retry/Download. Desktop protocol confirmation and deployed retention policy need manual evidence. |

Product/roadmap: retain full material/printer/handoff inventory and explicitly approve
selected adapters, rather than treating a portable file as completion of handoff.
Architecture: adapter metadata boundary and any hosted service proposal require
review; core client-side path unchanged. README: exact supported target versions,
material approximation, fallback and privacy behavior. Development: data verification,
target import setup and protocol/expiry tests. LICENSE unchanged; supplier data,
trademarks, imagery and redistribution permissions reviewed separately. Blocking:
chosen authoritative datasets, target schemas/versions and hosted-delivery decision.

## Implementation steps and handoff

Approve data/profile sources, validate complete datasets, qualify vendor packaging,
then explicit handoff and conditional service. Frontend owns selector completeness,
consent/focus and AC-1/2/4/6; geometry/export owns AC-3/5/8; QA verifies every dataset
entry and real target import. Hosted AC-7 requires separate approved service work.
Exit must distinguish passing portable export, passing adapter import and unverified
desktop launch. No test proves that every third-party version or printer is safe.
