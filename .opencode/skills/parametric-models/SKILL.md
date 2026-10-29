---
name: parametric-models
description: Use when implementing or validating parametric generators, wall-art geometry, mesh exports, or saved design parameters.
---

# Parametric model workflow

1. Read the feature spec. Define millimeters, axes, finite numeric bounds, integer
   counts, seed behavior, and a saved-design version. Validate imported data as
   untrusted input; reject unknown versions and excessive generation requests.
2. Build deterministic CAD solids with Replicad/OpenCascade, independent of UI
   state. Keep solids in the worker for native STEP and derive preview/STL/3MF
   through controlled tessellation. Use explicit seeds and stable part IDs.
3. Establish the supported size/part-count budget. Avoid unbounded pairwise
   collision checks; document any small-input ceiling with a ponytail comment.
4. Include real-world thickness, clearance, and build-plate controls. Verify
   neighbouring parts remain separated and mounting features stay attached.
5. Derive preview and export from the same geometry; document any preview-only
   simplification and mesh tolerances. Dispose of obsolete WASM objects and
   rendering buffers, bound worker work, and reject stale generation results.
6. Test reproducibility, minimum/maximum values, invalid/NaN/infinite inputs,
   finite vertices, nondegenerate triangles, closed surfaces, consistent winding,
   expected components, positive volume, and dimensions. Separate pieces may
   legitimately be disconnected; an individual solid must be closed.
7. Check CAD solid validity as well as meshes. Re-import STEP/STL/3MF and check
   units, dimensions, and part placement. STEP must preserve CAD surfaces/solids,
   not merely package triangles. Verify 3MF package structure and distinguish
   standard models from slicer-specific projects. Review silhouette and assembly
   map, then inspect STEP in a CAD reader and mesh exports in a slicer if available.
   Distinguish automated validity from actual physical print testing.
