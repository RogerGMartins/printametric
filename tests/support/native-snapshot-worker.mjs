// Fresh-worker snapshot fixtures. No browser hooks or production debug entry point.
import { parentPort, workerData } from 'node:worker_threads';
import { makeCylinder, makeBox, drawEllipse, drawRectangle, measureShapeVolumeProperties } from 'replicad';
import { loadKernel } from './wall-art-kernel.mjs';
import { numberedBladeFactory } from './layout-native-fixture.mjs';
import { archiveNative, restoreNative } from './native-snapshot.mjs';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { weldMesh, validateMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';

const kernel = await loadKernel();
let shape;
function fromDrawing(drawing) {
  const sketch = drawing.sketchOnPlane('XY');
  try { return sketch.extrude(10); } finally { sketch.delete(); }
}
try {
  if (workerData.snapshot) shape = await restoreNative(kernel, workerData.snapshot, workerData.identity);
  else if (workerData.fixture === 'cylinder') shape = makeCylinder(10, 25);
  else if (workerData.fixture === 'ellipse') shape = fromDrawing(drawEllipse(40, 30).intersect(drawRectangle(40, 60).translate(20, 0)));
  else if (workerData.fixture === 'arch') {
    shape = fromDrawing(drawEllipse(40, 40).intersect(drawRectangle(80, 40).translate(0, 20)).fuse(drawRectangle(80, 40).translate(0, -20)));
  } else if (workerData.fixture === 'radial') {
    const outer = makeCylinder(40, 10), inner = makeCylinder(20, 10), quadrant = makeBox([0, 0, 0], [50, 50, 10]);
    let ring;
    try { ring = outer.cut(inner); shape = ring.intersect(quadrant); }
    finally { ring?.delete(); outer.delete(); inner.delete(); quadrant.delete(); }
  } else if (workerData.fixture === 'numbered') {
    const factory = numberedBladeFactory(kernel);
    try { shape = factory.make(4000); } finally { factory.dispose(); }
  } else throw Error('Unknown snapshot fixture');
  validateSolid(kernel, shape);
  const properties = measureShapeVolumeProperties(shape);
  let volume;
  try { volume = properties.volume; } finally { properties.delete(); }
  const surfaces = {}, explorer = new kernel.TopExp_Explorer(shape.wrapped, kernel.TopAbs_ShapeEnum.TopAbs_FACE, kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    while (explorer.More()) {
      const raw = explorer.Current(), face = kernel.TopoDS.Face(raw), adaptor = new kernel.BRepAdaptor_Surface(face, true);
      try {
        const type = adaptor.GetType();
        const name = Object.keys(kernel.GeomAbs_SurfaceType).find(key => kernel.GeomAbs_SurfaceType[key] === type) ?? String(type.value);
        surfaces[name] = (surfaces[name] ?? 0) + 1;
      } finally { adaptor.delete(); face.delete(); raw.delete(); }
      explorer.Next();
    }
  } finally { explorer.delete(); }
  const raw = shape.mesh({ tolerance: 0.05, angularTolerance: 5 * Math.PI / 180 });
  const checked = validateMesh(weldMesh(raw.vertices, raw.triangles));
  const snapshot = workerData.snapshot ?? await archiveNative(kernel, shape, workerData.identity);
  const step = workerData.step ? await serializeSTEP([{ id: workerData.identity, translation: workerData.translation }], [shape]) : undefined;
  parentPort.postMessage({ snapshot, volume, surfaces, bounds: checked.bounds, meshVolume: checked.volume, ...(step ? { step } : {}) }, [snapshot.bytes.buffer, ...(step ? [step.buffer] : [])]);
} catch (error) { parentPort.postMessage({ error: String(error) }); }
finally { shape?.delete(); }
