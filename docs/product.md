# Product direction

## Goal

Printametric will offer a series of browser-based parametric tools that produce
printable 3D models. First: modular wall art with an interactive preview and a
downloadable print kit. The owner will self-host the official service and may
monetize it through ads or paid features. Local personal use remains possible.
The source is public under a restrictive personal-use license, not open source.

## MVP delivery order

Follow the [MVP roadmap and checklist](mvp-roadmap.md): define and build the
website foundation, then the wall-art generator, editor, build-plate preparation,
and self-hosted launch. Create feature specs as each milestone starts.

## First generator

1. One rectangular panel and one deterministic blade pattern.
2. Controls for panel dimensions, spacing, height, thickness, angle, and seed.
   Define supported ranges and printer-related tolerances in the feature spec.
3. Interactive 3D preview with clear units and parameter validation.
4. Export STEP, binary STL, and standard 3MF from the same canonical CAD model.
   Keep CAD solids for STEP and use their controlled tessellation for preview
   and mesh exports. Verify all three formats during generator implementation.
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

## Print preparation and launch (within MVP)

- Multi-piece kits, stable numbering, assembly map, colour grouping, and packing
  against configurable build-plate dimensions.
- Self-hosted deployment and usage documentation.

## After MVP

- More patterns and outlines; evaluate slicer-specific 3MF project integration.
- A second tool and shared editor controls when needed. The initial website
  already includes a simple tool catalogue.
- Monetization with privacy and layout considered.

## Decisions still needed

The application stack and geometry boundaries are selected in
[architecture.md](architecture.md). Remaining decisions: initial parameter ranges and print tolerances;
mounting mechanism; hosting target/domain; monetization format. Accounts,
billing, ad networks, databases, and a plugin framework are not initial-slice
requirements. Validate the custom license with legal counsel before commercial
launch, especially contribution rights and generated-output restrictions.
