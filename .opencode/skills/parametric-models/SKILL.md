---
name: parametric-models
description: Use when implementing or validating parametric generators, wall-art geometry, mesh exports, or saved design parameters.
---

# Parametric model workflow

1. Read the feature spec. Define millimeters, axes, finite numeric bounds, integer
   counts, seed behavior, and a saved-design version. Validate imported data as
   untrusted input; reject unknown versions and excessive generation requests.
2. Write a deterministic geometry function independent of UI state. Use explicit
   seed input for randomness. Preserve stable part IDs for maps and print kits.
3. Establish the supported size/part-count budget. Avoid unbounded pairwise
   collision checks; document any small-input ceiling with a ponytail comment.
4. Include real-world thickness, clearance, and build-plate controls. Verify
   neighbouring parts remain separated and mounting features stay attached.
5. Derive preview and export from the same geometry; document any preview-only
   simplification. Dispose of obsolete rendering buffers and bound worker work.
6. Test reproducibility, minimum/maximum values, invalid/NaN/infinite inputs,
   finite vertices, nondegenerate triangles, closed surfaces, consistent winding,
   expected components, positive volume, and dimensions. Separate pieces may
   legitimately be disconnected; an individual solid must be closed.
7. Re-import exported STL/3MF and check units and dimensions. Review silhouette
   and assembly map, then open a representative export in a slicer if available.
   Distinguish automated mesh validity from actual physical print testing.
