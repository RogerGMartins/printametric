# Third-party components

Printametric's root LICENSE applies to original application code. The components
below retain their own licenses, including the rights to modify, replace, and
reverse-engineer LGPL components for debugging modifications. These notices do
not change ownership of the original application or generated designs.

This file and the license texts are served at `/licenses/`. They are available
from About. Run `node scripts/update-third-party-notices.mjs` after reviewing a
dependency update; it copies installed and pinned upstream texts. Ordinary
builds use the checked-in files and require no external license service.

## Browser components

| Component | Version | License text |
| --- | --- | --- |
| React / React DOM | 19.3.1 | react.txt / react-dom.txt (MIT) |
| Three.js | 0.187.0 | three.txt (MIT) |
| React Three Fiber | 9.8.2 | react-three-fiber.txt (MIT) |
| Replicad | 1.2.0 | replicad.txt (MIT) |
| replicad-opencascadejs | 1.1.0 | replicad-opencascadejs.txt (LGPL-2.1-only) |
| fflate | 0.8.3 | fflate.txt (MIT) |

The root package-lock.json pins the transitive versions. Their supplied texts are
scheduler.txt, zustand.txt, react-use-measure.txt, suspend-react.txt, its-fine.txt,
react-reconciler.txt, use-sync-external-store.txt, babel-runtime.txt, buffer.txt,
base64-js.txt, ieee754.txt, flatbush.txt, flatqueue.txt, and opentype-js.txt.
Fiber's bundled reconciler retains React's MIT license. Fiber's own license is
copied from upstream commit `d74622ea8ed717f7212d7e19d65ff3e325508389` because
the npm package omits it and its reported gitHead did not resolve upstream.
Third-party copyright
statements remain in those exact texts. Build and test packages are not shipped
as application modules. The independent development-only STEP reader is
occt-import-js 0.0.23 (LGPL-2.1); its package includes its own license.

## CAD binary provenance and corresponding sources

The application uses the **unmodified single-threaded** JS/WASM pair from
replicad-opencascadejs 1.1.0. The emitted WASM is a separate replaceable file;
there is no integrity lock or obfuscation. No multi-threaded runtime is used.

- Package source and build configuration:
  https://github.com/sgenoud/replicad/tree/e4b05f67dc4e2393a876ce8c5064a9c93db05bf1/packages/replicad-opencascadejs
- Complete source archive:
  https://github.com/sgenoud/replicad/archive/e4b05f67dc4e2393a876ce8c5064a9c93db05bf1.tar.gz
- The package's `buildSingle` script renders its checked-in ytt build configuration
  and links with `ghcr.io/taucad/opencascade.js:canary-ebd263f1-single-threaded`.
- Builder, bindings, patches, Dockerfile, and dependency manifest:
  https://github.com/taucad/opencascade.js/tree/ebd263f1
  (source archive: https://github.com/taucad/opencascade.js/archive/ebd263f1.tar.gz).
  Its LICENSE and OCCT exception are included as opencascade-js.txt and
  opencascade-js-exception.txt.
- The pinned builder's DEPS.json identifies OCCT **8.0.1**, commit
  `b8f597c677811d1f9f4d8a97f5ae2825c0353a42`:
  https://github.com/Open-Cascade-SAS/OCCT/archive/b8f597c677811d1f9f4d8a97f5ae2825c0353a42.tar.gz.
  OCCT is LGPL-2.1 with its additional exception: occt-lgpl-2.1.txt and
  occt-exception.txt. Copyright belongs to Open Cascade and its contributors.
- The builder applies its recorded OCCT using-statements, dump-stub, noexcept
  destructor, and STEPCAF dynamic-type patches. These are in the builder source
  above; Printametric adds no kernel patches.
- The manifest also pins RapidJSON
  `24b5e7a8b27f42fa16b96fc70aade9106cf7102f` and FreeType 2.13.0
  `de8b92dd7ec634e9e2b25ef534c54a3537555c11`. Their notices are included as
  rapidjson.txt and freetype.txt. Some portions of this software are copyright
  The FreeType Project (www.freetype.org). All rights reserved.
  Sources: https://github.com/Tencent/rapidjson and https://github.com/freetype/freetype
  at those commits.
- Emscripten 5.0.1 runtime notices are included in emscripten.txt. Source and
  toolchain: https://github.com/emscripten-core/emscripten/tree/5.0.1.

To rebuild or substitute the library, obtain those pinned sources and follow the
package's `buildSingle` instructions with its recorded Docker image. Replace the
installed package's `dist/replicad_single.js` and `.wasm` with the compatible
rebuilt pair, then run `npm run check` and `npm run build`. The application resolves
the separate WASM through Vite's asset URL. Modified compatible libraries can
also be substituted before building; keep their source, build instructions,
notices, and applicable licenses with any redistributed version. A self-hosted
release must keep corresponding source access and these notices available with
its binary distribution. There is no deployment configured by this change.

## Mesh format

3MF output implements the public 3MF Core 1.4 model/package contract. It does not
contain slicer profiles or claim to be a slicer project. Specification:
https://3mf.io/specification/.
