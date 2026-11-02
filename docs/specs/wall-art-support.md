# Wall art 11 — contextual help, languages and service boundaries

Status: **DRAFT for user review. Local help is required; hosted policy needs owner decisions.**
Depends on the functional phases it explains. Authority: [suite](wall-art.md).
Acceptance prefix: `WA-SUPPORT`. No geometry version change.

## Problem, flow and scope

A maker needs to understand every conditional control, recover from errors, and
know where designs are stored. Help must explain the actual shipped capability,
not promise a disabled future function. Local users should not encounter mandatory
accounts or a payment gate merely to generate/export their own design.

Included: all-section contextual help, resets and no-effect explanations, library
return actions, dismissible recovery notices, English/Italian selection, legal,
privacy/contact/support, and explicit contracts for possible hosted access/trial/
account actions. Language actions are **client-declared; visibility/execution
unverified** in the inventory. Hosted menu/access interactions do not establish an
approved Printametric business model. Policy choices are retained as decisions,
not silently omitted or represented as already enabled.

Excluded: copying another service's terms, access codes, trial durations, branding,
pricing or licensing; automatic telemetry; billing/cloud sync unless independently
specified later. Preserve the authoritative root LICENSE and owner hosting rights.

## Local experience and contextual help

Every functional section has a keyboard-operable Help action or disclosure: Size,
Outline import, Layout, Numbering, Shape, Surface, Image field, Movement, Plan,
Colour/materials, Frame/hardware, Printer/keepouts, Print layout, Assembly/documents,
Projects/backup/share, Preview/room and Export/handoff. Include units, defaults,
range, a plain-language effect, cross-field limits, no-effect cases and Reset scope.
Help does not disappear with Show workspace tips off. Never rely only on hover.

Use original small diagrams where direction, axes, clearances or coordinates are
hard to explain. Every diagram has equivalent text. Explain nominal versus actual
bounds, seed/versions, base versus top, surface versus movement, degrees from
vertical, pocket clearance per side, printer margins versus part spacing, assembly
versus print coordinates, and solid-weight versus sliced material estimates.

In a home/library context, **Return to open panel** restores the currently accepted
editor project and view without reopening another record or resetting state. It is
unavailable with a clear explanation if no active project exists. Six original
starter shortcuts and the full23-preset catalogue are phase05 content, not separate
duplicate model definitions. Room mode's **Edit panel** exits room and restores
editing camera/panel/focus just like Exit. Plan's **Remove selected point** and the
editor-list Remove action target the same selected ID and history transaction.

Recovery/deletion notices have a labelled Dismiss action. Dismiss hides that notice
without undoing deletion, erasing recovery bytes, marking a failed save successful
or dismissing unrelated field errors. Before dismissing the only visible Undo for
a deletion, explain that Undo remains in the session deletion list until its defined
history limit; provide that list. Persistent failed-save/invalid-state indicators
remain visible even when explanatory notice text is dismissed. Reload can show an
unresolved failure again; do not persist a false success state.

Help/About preserve native modal focus/inertness/Escape/opener restoration and exact
LICENSE access. Errors retain field linkage and keyboard recovery when the bottom
panel is closed. Complete keyboard paths, both themes, forced colours,320 px and
genuine200% browser zoom are release criteria. Screen-reader and physical-touch
checks are separate required evidence, not inferred from automated tests.

## Localization contract

| Setting | Type / default | Bounds / semantics |
| --- | --- | --- |
| language | enum / en | en, it; explicit English/Italian actions |
| followBrowserLanguage | boolean / true on first visit | Match supported browser base language; unsupported→English; explicit choice disables following |
| contactMessage | string / empty, only if contact form approved |1–4000 Unicode characters; plain text |
| contactEmail | string / empty, only if form approved |≤254 characters; validated address; never required for local modelling |

Language controls are visible in local settings once translations are implemented,
not silently hidden because of an unrelated trial. Persist independently of project
geometry; storage failure retains in-memory choice and old bytes with Retry. Locale
changes all labels, help, errors, dates and selected document output. Model JSON keys,
IDs, seeds, numeric geometry and format versions stay locale-independent.

Numeric UI accepts the selected locale's decimal separator but rejects ambiguous
mixed grouping/decimal input. Normalize accepted values to JSON numbers; do not parse
“1,200” as an arbitrary guess. Unit stays mm. Freeze exact input examples and errors
in language fixtures. Input drafts retain their text when language changes and need
explicit recommit; no silent reinterpretation. Screen-reader names use the same
language as visible controls. Do not fall back silently to untranslated critical
validation/legal text: show the available language and keep a clear English fallback.

All en/it message keys must have reviewed translations with interpolation/escaping
tests, including plural/count states. Document locale is captured in kits; changing
it invalidates document caches, not CAD. Exact root LICENSE is not replaced by an
unreviewed translation; label translations as explanatory if later approved.

## Legal, privacy and contact actions

About retains the source-available explanation and exact LICENSE. Add separate
Privacy, Terms (hosted when applicable), Contact and Support entry points, accessible
without an active trial/account. Local privacy copy states what browser storage
contains, complete-file/share risks, and that no server upload occurs in the local
core. Do not claim no network traffic if runtime assets are fetched; distinguish
application delivery from transmission of user designs. No analytics or marketing
consent is presumed.

Contact has an owner-approved destination; until one is supplied show “Contact
destination not configured” rather than a fake link. An email action opens the
user's email application only after activation. A hosted form, if selected, requires
an approved endpoint/privacy policy, length limits, rate limiting, visible pending/
success/failure/retry, and accessible alternatives. Never attach design files,
signed links, system diagnostics or credentials automatically. Support can prepare
a redacted copyable diagnostic summary (app/generator/browser versions, error code,
budget counts); the user reviews it before copying/sending. No entire design by default.

Legal text needs owner/legal review for the actual deployment and data handling;
this spec supplies behavior, not legal advice or final terms. Version policy texts
and show effective date. Preserve an active local design when opening/closing them.

## Conditional hosted access/account contract

All listed actions remain in coverage: Enter access code, Continue trial, show
current trial/access status, open account menu, Terms, Privacy, Contact, Support,
Sign out, and recover from session expiry. Their adoption, labels, entitlement
matrix and duration are independent owner decisions. None is enabled by this draft.
No local-only build needs a fake account menu or enforced commercial tier.

| Field / policy | Proposed bounds and behavior |
| --- | --- |
| accessCode | String,empty;8–128 ASCII printable characters;no control characters;outer whitespace handling declared by issuer |
| access mode | enum local/trial/authenticated/expired;local default in local deployment |
| trial duration/quota | No default invented; owner-approved server policy required |
| entitlement response | Versioned allowlisted capability IDs,expiry,server signature/session binding;unknown values deny hosted capability safely |
| retry | Explicit action;server Retry-After respected;no uncontrolled background retry loop |
| session token | Server-managed secure cookie if hosted auth adopted;not model JSON,fragment,logs or browser project library |

Entry states: idle,submitting,accepted,invalid,rate-limited,offline/server failed and
expired. Never log the code; input has a visible label and optional show/hide toggle
that does not submit. Disable duplicate submission; errors do not clear the code
unless the user chooses Clear. Do not expose whether a specific person/account exists.
Trial starts only on explicit Continue trial and states its actual restrictions.

Hosted entitlement restrictions must be enforced server-side for server-provided
features. A disabled client button is not authorization. Show why an action is
unavailable, what remains locally usable, and a non-destructive recovery path. No
trial state can discard, corrupt or silently change a local model. Local core
model/file export remains governed by local deployment rights, not a fabricated
remote login dependency. Exact commercial restriction boundaries require review.

Sign out requires explicit action, clears hosted session through the service, and
reports success/failure honestly. It does not delete local library/projects without
a separate confirmed action. Session expiry during generation/save/export retains
local accepted data, cancels only unauthorized hosted requests, and offers sign-in
or local file fallback as policy permits. A prepared local file remains accessible.
Use safe return-to-editor state, not arbitrary untrusted redirect URLs.

Authenticated account menu also displays identity email, edition and license status,
or the code-access status appropriate to the accepted session. Treat these as
server-provided plain text with bounded schema: email≤254 characters, edition and
license labels≤80, code-access label≤80. Never display the submitted access code or
session token. Before identity resolves, show a loading status. On failed identity
fetch, retain a **links-only fallback** with Terms/Privacy/Contact/Support and permitted
session actions, not a fabricated identity. Retry the fetch on next menu open;
do not loop while closed. Cached identity must be invalidated after sign-out/expiry.

The menu dismisses on Escape, outside activation, or Tab moving focus out. Escape
returns focus to its trigger; outside activation keeps focus at the clicked target;
Tab follows normal focus order, not a modal trap. Dismissal alone never signs out or
clears a project. These are menu behavior proposals retaining the declared actions;
restricted authentication execution remains unverified inventory evidence.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-SUPPORT-AC-1 | Every section/control has accurate help including range/no-effect/reset guidance | Schema-to-help completeness test and all-help keyboard expansion journey |
| WA-SUPPORT-AC-2 | Return/Edit/Remove aliases and notice dismissal preserve their exact state contracts | Active/no-project, selected/no-point, deletion/recovery/failed-save browser fixtures |
| WA-SUPPORT-AC-3 | English/Italian cover all keys without changing geometry or reinterpreting drafts | Key parity/interpolation/number fixtures, language switch and storage-failure tests |
| WA-SUPPORT-AC-4 | Legal/privacy/contact/support remain accessible and do not leak design data | Exact LICENSE test, text review, network/clipboard/mail sentinels and redaction fixtures |
| WA-SUPPORT-AC-5 | Optional code/trial/account states are bounded, accessible and server-authorized | Conditional service contract tests for valid/invalid/expired/rate-limit/offline; no hosted UI in local mode |
| WA-SUPPORT-AC-6 | Sign out/session expiry preserve local design/library and do not claim failed logout succeeded | Conditional active-job/session-expiry/logout-failure journeys with storage/export sentinels |
| WA-SUPPORT-AC-7 | Whole workflow is usable at320 px, real200% zoom, both themes and with assistive technology | Automated browser regressions plus documented screen-reader/touch and legal-language review |
| WA-SUPPORT-AC-8 | Account identity/code status and links-only fallback are truthful; next-open retry and menu dismissal preserve focus/design | Valid/invalid/failed identity fixtures, bounded text/no-secret assertions, Escape/outside/Tab and sign-out cache invalidation tests |

## Documentation impact and unresolved decisions

### Stories and required implementation tests

QA owns `tests/wall-art-support.test.mjs` and
`tests/browser/wall-art-support.spec.ts`. The suite's mandatory completion contract
applies to local and conditionally approved hosted stories; optional adoption does
not permit claiming unimplemented hosted acceptance as passed.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-SUPPORT-ST-1 — Understand and recover every option | WA-SUPPORT-AC-1/2/7 | Node/browser: N schema-to-help key completeness,all Help actions,Return/Edit/Remove aliases,Dismiss; B absent project/selection and320 px/real zoom; I hidden invalid fields remain recoverable; E dismissed failed-save notice cannot claim success or erase bytes. Full-help wording,AT/touch and visual review manual. |
| WA-SUPPORT-ST-2 — Work in either language and reach support | WA-SUPPORT-AC-3/4 | Node/browser: N en/it key parity,explicit actions,legal/privacy/contact/support; B decimal/text/contact limits; I ambiguous numeric input or untranslated critical keys fail clearly; E locale-storage/contact/clipboard failure preserves data and offers Retry. Assert no geometry change/design leakage. Translation/legal/contact-owner approval manual. |
| WA-SUPPORT-ST-3 — Preserve local work through hosted access changes | WA-SUPPORT-AC-5/6/8 | Conditional automated service/browser cases: N access code/trial/identity/edition/license/code status/menu/sign-out; B8/128 code lengths,text limits and exact expiry; I invalid/unknown entitlement grants no access or forged identity; E identity fetch falls back to links and retries next open,offline/expiry/logout failure retains work. Assert Escape/outside/Tab focus behavior and no secrets. Local build has no forced gate. Policy/security review remains manual. |

Product/roadmap: list local help/localization and each optional hosted decision
separately. Architecture: language adapter, support redaction and any approved
session/service boundary; no local geometry change. README: actual languages,
local storage/privacy, support and hosted limitations. Development: translation,
numeric parsing, AT/touch, session-expiry and no-secret diagnostics checks.
Foundation spec: preserve modal/theme contracts and record resolved gaps only with
evidence. Root LICENSE unchanged. Blockers: reviewed translations, contact destination,
actual legal/privacy text and all hosted policy/security/hosting decisions.

## Implementation steps and handoff

Complete schema-linked help and local aliases, then translations, legal/support
actions, then only approved hosted behavior. Frontend owns AC-1–4/7; geometry checks
that language/help edits do not alter C1–C4; QA owns completeness, state/error and
AT evidence. Hosted AC-5/6 need separately approved service work. Exit reports local
and hosted criteria separately; tests establish observed behavior, not bug-free or
legally certified operation.
