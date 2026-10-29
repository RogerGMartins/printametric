# Product direction

## Goal

Printametric will offer a series of browser-based parametric tools that produce
printable 3D models. First: modular wall art with an interactive preview and a
downloadable print kit. The owner will self-host the official service and may
monetize it through ads or paid features. Local personal use remains possible.
The source is public under a restrictive personal-use license, not open source.

## Reference: verified public claims

Reviewed 2026-10-29:
https://makerworld.com/en/crowdfunding/411-parete-parametric-wall-art-generator?sourceFrom=crowdfunding

Parete by DotCom Artwork publicly describes:

- Browser-designed wall panels comprising dozens or hundreds of printed pieces.
- Organic cells, swirling vortices, and long overlapping blade patterns.
- Adjustable size, pattern, and colours.
- Rectangle outlines, with oval, hexagon, and arch available in some tiers.
- Numbered pieces and print files sorted by colour for Bambu Studio.
- Neighbour checks that shorten blades which would touch.
- A design, print, and hang workflow; a trial up to 1 x 1 metre at campaign launch.

These are marketing-page claims, not results from testing its editor. Exact
parameter ranges, geometry algorithms, kit contents/formats, mounting method,
and performance limits have not been verified. This project will implement its
own behavior and visual design rather than assume undocumented details.

## First vertical slice (proposed)

1. One rectangular panel and one deterministic blade pattern.
2. Controls for panel dimensions, spacing, height, thickness, angle, and seed.
   Define supported ranges and printer-related tolerances in the feature spec.
3. Interactive 3D preview with clear units and parameter validation.
4. Export STEP, binary STL, and standard 3MF from the same canonical CAD model.
   Keep CAD solids for STEP and use their controlled tessellation for preview
   and mesh exports. Prove all three formats on a small model before editor work.
5. Save/load a versioned JSON design locally and reproduce its geometry.

Preview updates follow valid parameter changes. STEP/STL/3MF compilation and file
packaging occur only when the user explicitly presses Export/Download, and only
for the selected format. No background file exports on edits. The downloaded
file must represent the accepted design captured when the export was requested.

Acceptance must include deterministic output, bounded generation, no neighbour
collisions at supported settings, finite vertices, closed positive-volume
components, millimeter scale, and round-trip validation for each format. STEP
must preserve CAD solids, not merely wrap a tessellated STL; it need not preserve
the generator's feature history. Validate STEP in a CAD reader and STL/3MF in a
slicer. Standard 3MF model export is required; slicer-specific project settings
and filament/plate presets are a separate future scope. A visual preview is not
evidence that geometry or an exported file is valid.

## Subsequent milestones

- Multi-piece kits, stable numbering, assembly map, colour grouping, and packing
  against configurable build-plate dimensions.
- More patterns and outlines; evaluate slicer-specific 3MF project integration.
- A simple tool catalogue and shared editor controls when a second tool exists.
- Self-hosted deployment, then monetization with privacy and layout considered.

## Decisions still needed

The application stack and geometry boundaries are selected in
[architecture.md](architecture.md). Remaining decisions: initial parameter ranges and print tolerances;
mounting mechanism; hosting target/domain; monetization format. Accounts,
billing, ad networks, databases, and a plugin framework are not initial-slice
requirements. Validate the custom license with legal counsel before commercial
launch, especially contribution rights and generated-output restrictions.
