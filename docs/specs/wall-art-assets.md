# Wall art 09 — imported outlines and image fields

Status: **DRAFT for user review; later sequenced functionality, not an omission.**
Depends on [08](wall-art-print-kit.md). Authority: [C1–C4](wall-art.md).
Acceptance prefix: `WA-ASSET`. Proposed schema/generator: `7/6`.

## Problem, flow and evidence boundary

A maker needs an original outline or image to survive editing, saving, sharing
and export. Choose a local file, inspect normalization/crop, accept a bounded
candidate, generate and save a complete portable project. File failure must leave
the current artwork, frame, accepted assets and previous saved bytes unchanged.

SVG and image-field capability are **client-declared; execution unverified** inputs
to the coverage inventory. They are not claims of working Printametric features.
This spec retains complete behavior for later implementation rather than assuming
a visible importer or a verified generated download exists. All policies below
are Printametric proposals. Both features need schema and CAD contract approval.

Included: concave outlines with holes, safe SVG geometry subset, PNG/JPEG relief
and colour sampling, crop/orientation controls, embedded normalized assets and
invalid-asset recovery. Excluded: executing SVG scripts/CSS, remote resources,
vector artwork colours as a multi-part art design, animated images, image AI,
arbitrary uploaded code and runtime texture-to-mesh export substitutions.

## SVG contract

| Field / bound | Type / default | Range / unit / semantics |
| --- | --- | --- |
| outline | enum extension / existing value | Adds `imported`; selecting it requires an accepted outline asset |
| outlineAssetId | nullable digest string / null | SHA-256 of canonical normalized payload; required for imported outline |
| outlineFit | enum / stretch | stretch, contain; explicit independent-axis stretch or centered aspect-preserving fit |
| source byte bound | fixed | 2 MiB before UTF-8/XML parse |
| parse bounds | fixed | Depth16;10,000 elements;20,000 path commands;100,000 numeric tokens;50,000 temporary segments |
| normalized geometry | fixed | ≤256 rings,≤2500 vertices total,≥3 unique vertices/ring |
| occupiedAspectRatio | finite number / required | Original occupied width divided by height, positive; included in asset digest |
| flattening deviation | fixed | ≤0.05 mm at requested panel size, same as C4 chord limit |

Parse inertly without mounting raw XML in the DOM. Reject DOCTYPE/entities, scripts,
event attributes, foreignObject, CSS/style sheets, text/fonts, images, use references,
external or data URLs, filters, masks and clipping paths. No fetch or execution at
any stage. Unsupported content rejects the whole import, not silent removal of
potentially meaningful geometry. Error names the unsupported category without
echoing source markup.

Supported geometry: path commands M/L/H/V/C/S/Q/T/A/Z (absolute and relative), polygon,
rect including rounded corners, circle and ellipse, and groups with finite affine
translate/scale/rotate/matrix transforms. Transform expansion must remain inside
numeric/segment bounds; singular transforms reject. Open subpaths, lines and polylines
without a closed area reject. A valid finite positive viewBox defines the source
viewport; without one require finite positive numeric width/height in px. Percentages,
physical units and implicit viewport guessing reject in import version1.

Resolve inherited fill-rule explicitly: source default nonzero or explicit evenodd.
Reject strokes as shape input; the importer uses filled regions, not visual stroke
width. Normalize the union of supported filled areas, applying nonzero winding or
evenodd before ring extraction. Self-intersections, touching rings, coincident edges,
zero-area rings or ambiguous fill topology reject rather than guess a repair.
Disjoint filled islands are allowed. Holes lie strictly inside one outer ring and
may not touch it or each other. Nested filled islands become separate outers.

Bake transforms, flatten curves within the requested-size deviation bound, normalize
to the occupied filled bounding rectangle [0,1]², and invert SVG's downward Y to
assembly +Y-up. Save outer rings counterclockwise, holes clockwise, explicit parent
indices and stable ring order (bounding-box Y descending, X ascending, then area).
Retain the occupied source aspect ratio in this canonical payload and its digest.
A wide and a tall source rectangle must not become indistinguishable unit squares.
Contain reconstructs that aspect before uniform scaling; Stretch ignores it only
for placement. The invariant survives disposal of the source and offline reload.
Reject nonfinite/unsafe coordinates: proposed source magnitude≤1,000,000 and affine
scale magnitude≤10,000; no rounding-to-zero rescue. Changing panel size revalidates
flattening accuracy. Preserve canonical curve descriptors as well as normalized
rings if necessary to meet that bound without the original source; freeze this
payload choice in the reviewed schema before coding.

Stretch maps occupied source bounds independently to panel width/height. Contain
uses uniform scale to fit and centers the result; nominal panel dimensions stay
the requested rectangle, actual outline dimensions are reported. Outline holes
remain empty in decorative layout and frame; no automatic base sheet fills them.
Clipping may produce multiple cell components. Use phase02 suffix/exclusion rules,
including visible counts and export acknowledgment. A component with a hole or a
concavity must satisfy the full top/movement/offset solid contract. If homothetic
tops cross outside the base or make invalid native faces, reject the combination
with affected IDs; do not silently remove the hole or fill it with a mesh patch.

## Image-field contract

| Parameter | Type | Default | Range / step / unit |
| --- | --- | --- | --- |
| relief family | enum extension | existing family | Adds image; requires image asset |
| colour assignment | enum extension | existing assignment | Adds image; maps sampled colour to active band slots |
| imageAssetId | nullable digest string | null | Accepted normalized embedded asset required when used |
| fit | enum | contain | contain, cover, stretch |
| cropX, cropY | number each | 0.5 | 0–1 /0.01 /normalized center |
| cropScale | number | 1 | 1–8 /0.05 /zoom |
| imageRotation | enum | 0 | 0,90,180,270 degrees counterclockwise |
| flipX, flipY | boolean each | false | true/false |
| invertRelief | boolean | false | true/false |
| source bytes | limit | — | 8 MiB before decode |
| source pixels | limit | — | Each side1–4096;≤16,777,216 pixels;one image only |
| normalized grid | fixed proposal | 256×256 | Versioned RGBA8 and Float32 normalized height arrays |
| orientedSourceAspectRatio | finite number / required | Positive width/height after metadata orientation, before user transforms; included in asset digest |

Accept PNG/JPEG by actual signature and successful decode, not filename/MIME alone.
Reject animation, truncated files, unsupported bit depth/colour mode and decompression
over-budget dimensions before allocation where header inspection allows. Metadata
is untrusted; orientation is baked exactly once before user rotation/flip. Do not
retain EXIF/location data or original file names in portable payloads. Decode off
the UI thread where practical and terminate a stalled decoder; no server upload.

Proposed normalization: convert to sRGB, then linear-light RGB for grayscale
`Y=0.2126R+0.7152G+0.0722B`. PNG alpha composites against black for relief and the
first active band colour for colour mapping; expose this choice in help. Normalize
height to[0,1], invert only when selected, with no automatic histogram stretching.
Image top maps to assembly +Y. The same crop/fit/rotation/flip applies to relief and
colour. Contain letterboxes use height0 and colour slot1; Cover crops to panel
aspect; Stretch distorts independently. cropScale zooms about clamped crop center;
if chosen crop would leave the source, clamp the **crop rectangle in the explicit
preview** and save the actual rectangle, not a hidden export-time change.

Decode/resample the complete oriented source once into the versioned256×256 grid
using a frozen deterministic filter. The square grid is a normalized source-domain
representation, not a claim that the source aspect is square. Retain its oriented
source aspect ratio. Crop coordinates and the saved actual crop rectangle use this
source domain [0,1]² before user rotation/flip; apply crop, user transforms and fit
once when sampling. Quarter-turn rotation swaps the effective aspect. Do not bake
a crop into the pixels and then apply it again from metadata. Save the normalized
array bytes, dimensions, aspect, colour-space/version and transform, not just a URL
or source-file pointer. Regeneration samples this grid
bilinearly; all values must be finite and in range. Cross-browser raw decoder
differences must not change saved normalized data. Replacing an asset creates a
new content digest and one undo transaction. Missing/mismatched bytes/digest reject.

Image relief substitutes F in phase03, then uses the same depth/minimum/mean/blend/
planar-top/shape/movement pipeline. depth0 is valid and keeps image colour usable.
Image colour samples the part's area-weighted RGB mean and chooses the nearest
active slot in linear RGB squared distance; ties go to lower slot index. It is
not per-triangle multicolour printing. Count/labels/export metadata still use the
active palette contract. Palette changes can change image colour assignments but
must not rebuild CAD unless the relief asset/transform also changes.

## Persistence, resources and errors

Every project, backup and kit project embeds required normalized payloads with
content digests. Share either embeds the whole bounded definition or offers a file.
No silent missing-asset fallback, external URL reload or empty default outline.
Keep original source only in memory during import; discard it after acceptance or
cancel. Undo references immutable accepted assets; failed replacement retains old
asset and old saved bytes. Do not leak user images through logs or diagnostics.

Proposed asset-operation ceiling:128 MiB temporary decode/parse memory,10 s timeout
per normalization on C4 environment; C4 total memory still applies. Rationale: bound
malicious expansion and avoid locking the editor. Measure5 cold/20 warm max-input
runs; report actual peak/time, not a claim of proven limits. Source/parse limits
reject early; normalized limits reject before CAD. Geometry budgets remain unchanged.

States include no asset, reading, validating, normalizing, preview candidate,
generating, accepted, cancelled and failed. File picker cancellation changes nothing.
Keyboard users can choose file, adjust crop numerically, rotate/flip, accept/cancel
and remove. Remove while a family uses the asset must also choose a replacement
family in one explicit transaction; do not leave a broken accepted document.

## Acceptance and verification

| ID | Observable outcome | Verification |
| --- | --- | --- |
| WA-ASSET-AC-1 | Supported transformed SVGs normalize concave islands/holes and preserve orientation/bounds and occupied aspect | Own fixtures for every command/shape, nonzero/evenodd, stretch/contain and asymmetric holes; distinct200×100 and100×200 sources retain wide/tall Contain bounds after source disposal and offline reload |
| WA-ASSET-AC-2 | Unsupported/unsafe/ambiguous SVG never executes, fetches or changes valid state | Script/entity/style/URL/open/self-crossing/touching-ring fixtures with network/DOM/CAD sentinels |
| WA-ASSET-AC-3 | Byte/parse/ring/point budgets reject before expensive geometry | Each limit−1/limit/limit+1, deep transforms, huge coordinates and flattening exhaustion |
| WA-ASSET-AC-4 | PNG/JPEG orientation, aspect, crop, alpha and grayscale produce the stated normalized grid and single sampling transform | Analytic colour ramps, asymmetric orientation, crop/rotation/flip and1×1/4096-size fixtures; wide/tall images preserve Contain/Cover bounds and can be re-cropped after source disposal and offline reload without double transformation |
| WA-ASSET-AC-5 | Corrupt/animated/oversized images and nonfinite grids preserve previous asset/design | Decode failure, header bombs, digest mismatch, cancellation and worker-timeout tests |
| WA-ASSET-AC-6 | Image relief/colour obey shared height/band rules without a separate mesh path | depth0/max, blend0/1, palette edit CAD-call sentinel, curved STEP and mesh reimports |
| WA-ASSET-AC-7 | Project/backup/kit/share round trips preserve complete assets or reject explicitly | Offline reload, missing bytes, newer grid version, oversized share and file fallback |
| WA-ASSET-AC-8 | File/crop/accept/cancel/removal work by keyboard/narrow/zoom with clear states | Browser at320 px/real200% zoom; screen-reader labels and cancel/recovery checks |
| WA-ASSET-AC-9 | Maximum admitted assets meet resource policy without bypassing C4 | Timed/memory qualification, termination and repeat-resource-disposal evidence |

## Documentation impact and decisions

### Stories and required implementation tests

QA owns `tests/wall-art-assets.test.mjs` and
`tests/browser/wall-art-assets.spec.ts`. Each allowed command/format and each safety
bound gets a runnable case in the shared gate, not only one imported example.

| Story | Completion / acceptance IDs | Required automated assertions and manual limits |
| --- | --- | --- |
| WA-ASSET-ST-1 — Import complete safe outlines | WA-ASSET-AC-1/2/3 | Node: N every supported SVG command/element,transform,fill rule,island/hole; wide/tall Contain survives source disposal and offline reload; B256 rings/2500 vertices and parse bounds; I missing/nonpositive aspect,scripts/entities/refs/open/self-crossing/touching rings reject without network/CAD; E parser/flattening timeout keeps prior asset. Browser numeric fit and actual native-CAD round trip; original visual topology reviewed. |
| WA-ASSET-ST-2 — Use image relief and colours | WA-ASSET-AC-4/5/6/9 | Node: N PNG/JPEG orientation/alpha/grayscale/nearest-band and wide/tall Contain/Cover offline re-edit without double crop/rotation; B1 pixel/max dimensions,crop/rotation/flip/depth endpoints; I missing/nonpositive aspect,corrupt/animated/bomb/nonfinite grids reject before CAD; E decode/kernel failure or cancel preserves prior definition and releases memory. Browser conditional controls and metadata-only colour edits; measured resource evidence. |
| WA-ASSET-ST-3 — Retain assets across all workflows | WA-ASSET-AC-7/8 | Node/browser: N project/backup/kit/share round trip offline; B share size and complete embedded grid limits; I missing/digest-mismatched/newer payload rejects atomically; E picker cancel/failed replacement/removal leaves accepted asset and bytes unchanged.320 px/zoom keyboard automated; AT/touch/manual crop review additional. |

Product/roadmap: retain SVG/image as fully specified later functionality. Architecture:
approve inert parser/decoder boundaries, normalized payload version, curve retention
and deterministic resampling; no server requirement. README: supported formats,
fill/crop/alpha semantics and complete-file sharing. Development: malicious-input,
normalization and native-CAD fixtures. Root LICENSE unchanged; parser/decoder notices
and original fixture rights reviewed. Blocking before this phase's plan approval:
exact schema/filter, source colour-mode support and native concave/hole loft rules.

## Implementation steps and handoff

Freeze accepted subset/payload, verify pure normalization/security, then headless
CAD and complete-file round trips, then file/crop UI. Geometry owns AC-1–7/9;
frontend owns AC-8 and accepted-asset staging; QA owns independent malformed-source
and reader checks. Exit requires SVG and image paths, including all invalid cases,
not merely a successful imported screenshot.
