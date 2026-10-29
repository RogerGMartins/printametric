# Product direction

## Goal

Printametric will offer a series of browser-based parametric tools that produce
printable 3D models. First: modular wall art with an interactive preview and a
downloadable print kit. The owner will self-host the official service and may
monetize it through ads or paid features. Local personal use remains possible.
The source is public under a restrictive personal-use license, not open source.

## First vertical slice (proposed)

1. One rectangular panel and one deterministic blade pattern.
2. Controls for panel dimensions, spacing, height, thickness, angle, and seed.
   Define supported ranges and printer-related tolerances in the feature spec.
3. Interactive 3D preview with clear units and parameter validation.
4. Export a printable STL from the same geometry used in the preview.
5. Save/load a versioned JSON design locally and reproduce its geometry.

Acceptance must include deterministic output, bounded generation, no neighbour
collisions at supported settings, finite vertices, closed positive-volume
components, explicit millimeter export, and a slicer import check. A visual
preview is not evidence that a mesh is printable.

## Subsequent milestones

- Multi-piece kits, stable numbering, assembly map, colour grouping, and packing
  against configurable build-plate dimensions.
- More patterns and outlines; assess 3MF after the STL workflow works.
- A simple tool catalogue and shared editor controls when a second tool exists.
- Self-hosted deployment, then monetization with privacy and layout considered.

## Decisions still needed

UI/rendering/geometry libraries; initial parameter ranges and print tolerances;
mounting mechanism; hosting target/domain; monetization format. Accounts,
billing, ad networks, databases, and a plugin framework are not initial-slice
requirements. Validate the custom license with legal counsel before commercial
launch, especially contribution rights and generated-output restrictions.
