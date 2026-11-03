// Early native capacity gate, before connecting v2 to the editor. Synthetic count is explicit.
// This uses actual numbered cuts, not cloned identical output, and never starts a print.
import { mkdir, writeFile } from 'node:fs/promises';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { loadKernel } from '../tests/support/wall-art-kernel.mjs';
import { generateModel } from '../src/tools/wall-art/geometry/generate.ts';
import { DEFAULT_PARAMETERS } from '../src/tools/wall-art/model/parameters.ts';
import { LIMITS_V2 } from '../src/tools/wall-art/model/validation-v2.ts';
import { digitPolygons, ORIENTATION_ARROW } from '../src/tools/wall-art/geometry/glyphs.ts';
import { makePolygon, cast, measureShapeVolumeProperties } from 'replicad';
import { validateSolid } from '../src/shared/geometry/kernel.ts';
import { weldMesh, validateMesh } from '../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../src/shared/export/step.ts';
import { gzipSync, gunzipSync } from 'fflate';

const output = 'artifacts/wall-art-layouts';
if (isMainThread) {
  await mkdir(output, { recursive: true });
  const count = Number(process.env.LAYOUT_PARTS ?? 512);
  const diagnosticMode = process.env.LAYOUT_DIAGNOSTIC ?? '';
  if (!['', 'release-parts', 'clean-release', 'yield-release'].includes(diagnosticMode)) throw Error('Unknown LAYOUT_DIAGNOSTIC');
  const diagnosticRelease = Boolean(diagnosticMode);
  const startNumber = Number(process.env.LAYOUT_START_NUMBER ?? 1);
  const nativeArchive = process.env.LAYOUT_NATIVE_ARCHIVE === '1';
  if (!Number.isInteger(count) || count < 1 || count > 4000) throw Error('LAYOUT_PARTS must be 1–4000.');
  if (!Number.isInteger(startNumber) || startNumber < 1 || startNumber + count - 1 > 4000) throw Error('Numbered range must stay within 1–4000.');
  const samples = [], started = performance.now();
  const worker = new Worker(new URL(import.meta.url), { workerData: { count, diagnosticRelease, diagnosticMode, startNumber, nativeArchive } });
  // Sample total process RSS externally while synchronous native calls block the child.
  // This includes the small controller and is a conservative worker envelope, not WASM-only.
  const baselineRSS = process.memoryUsage().rss;
  let peakRSS = baselineRSS;
  const sampler = setInterval(() => { peakRSS = Math.max(peakRSS, process.memoryUsage().rss); }, 10);
  const report = await new Promise(resolve => {
    const watchdog = setTimeout(() => resolve({ passed: false, failure: '120-second native gate timeout' }), LIMITS_V2.timeoutMs);
    worker.on('message', message => {
      samples.push(message);
      if (message.done) { clearTimeout(watchdog); resolve(message); }
    });
    worker.on('error', error => { clearTimeout(watchdog); resolve({ passed: false, failure: String(error) }); });
    worker.on('exit', code => { if (code) { clearTimeout(watchdog); resolve({ passed: false, failure: `Worker exited ${code}` }); } });
  });
  clearInterval(sampler); await worker.terminate();
  const evidence = { ...report, count, startNumber, nativeArchive, synthetic: true, diagnosticRelease, diagnosticMode, node: process.version, platform: process.platform,
    elapsedMs: performance.now() - started, baselineRSS, peakRSS,
    memoryMethod: '10 ms process RSS sampling; includes controller, JS and native memory', samples };
  if (peakRSS > LIMITS_V2.workerPeakBytes) { evidence.passed = false; evidence.failure = 'Process RSS exceeds the 768 MiB worker envelope; isolate worker measurement before qualification.'; }
  await writeFile(`${output}/${diagnosticRelease ? diagnosticMode : 'native-capacity'}-${count}${startNumber === 1 ? '' : `-from-${startNumber}`}.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, samples: samples.length }, null, 2));
  if (!evidence.passed) process.exitCode = 1;
} else {
  const kernel = await loadKernel(), solids = [], parts = [], digits = [];
  let prototype, arrow;
  const ownOperation = (Operation, left, right) => {
    const operation = new Operation();
    const argumentsList = new kernel.NCollection_List_TopoDS_Shape(), toolsList = new kernel.NCollection_List_TopoDS_Shape();
    try {
      argumentsList.Append(left.wrapped); toolsList.Append(right.wrapped);
      operation.SetArguments(argumentsList); operation.SetTools(toolsList);
      operation.SetNonDestructive(true); operation.SetToFillHistory(false);
      operation.Build(); operation.SimplifyResult(true, true, LIMITS_V2.cadTolerance);
      const raw = operation.Shape(); try { return cast(raw); } finally { raw.delete(); }
    } finally { operation.delete(); argumentsList.delete(); toolsList.delete(); }
  };
  const translated = (shape, [x, y, z]) => {
    const vector = new kernel.gp_Vec(x, y, z), transform = new kernel.gp_Trsf();
    let operation;
    try {
      transform.SetTranslation(vector);
      operation = new kernel.BRepBuilderAPI_Transform(shape.wrapped, transform, true, false);
      const raw = operation.Shape(); try { return cast(raw); } finally { raw.delete(); }
    } finally { operation?.delete(); transform.delete(); vector.delete(); }
  };
  const compound = shapes => {
    const builder = new kernel.TopoDS_Builder(), raw = new kernel.TopoDS_Compound();
    try { builder.MakeCompound(raw); for (const shape of shapes) builder.Add(raw, shape.wrapped); return cast(raw); }
    finally { raw.delete(); builder.delete(); }
  };
  const prism = polygon => {
    const face = makePolygon(polygon.map(([x, y]) => [x, y, 0]));
    try {
      const vector = new kernel.gp_Vec(0, 0, 1);
      try {
        const operation = new kernel.BRepPrimAPI_MakePrism(face.wrapped, vector, false, true);
        try { const raw = operation.Shape(); try { return cast(raw); } finally { raw.delete(); } }
        finally { operation.delete(); }
      } finally { vector.delete(); }
    } finally { face.delete(); }
  };
  try {
    const core = generateModel(DEFAULT_PARAMETERS, 1, kernel);
    try { prototype = core.solids[0].clone(); } finally { core.dispose(); }
    const scale = 47.5 * 0.34 / 10;
    for (let digit = 0; digit < 10; digit++) {
      let tool;
      try {
        for (const polygon of digitPolygons(digit)) {
          const bar = prism(polygon.map(([x, y]) => [x * scale, -y * scale]));
          if (!tool) tool = bar;
          else {
            try { const joined = ownOperation(kernel.BRepAlgoAPI_Fuse, tool, bar); tool.delete(); tool = joined; }
            finally { bar.delete(); }
          }
        }
        validateSolid(kernel, tool); digits.push(tool); tool = null;
      } finally { tool?.delete(); }
    }
    arrow = prism(ORIENTATION_ARROW);
    const started = performance.now(); let meshBytes = 0, triangles = 0, nativeBytes = 0, compressedNativeBytes = 0;
    for (let index = 0; index < workerData.count; index++) {
      const number = String(workerData.startNumber + index), width = (number.length * 7 - 1) * scale;
      const tools = [];
      const capacities = { before: kernel.wasmMemory.buffer.byteLength };
      let cutter, solid;
      try {
        for (let i = 0; i < number.length; i++) tools.push(translated(digits[Number(number[i])], [-width / 2 + i * 7 * scale, 5 * scale - 2.9, 0]));
        tools.push(translated(arrow, [0, 5 * scale - 2.1, 0]));
        cutter = compound(tools);
        capacities.tools = kernel.wasmMemory.buffer.byteLength;
        solid = ownOperation(kernel.BRepAlgoAPI_Cut, prototype, cutter);
        capacities.cut = kernel.wasmMemory.buffer.byteLength;
        validateSolid(kernel, solid);
        capacities.validation = kernel.wasmMemory.buffer.byteLength;
        const raw = solid.mesh({ tolerance: LIMITS_V2.chordTolerance, angularTolerance: LIMITS_V2.angleRadians });
        capacities.mesh = kernel.wasmMemory.buffer.byteLength;
        const mesh = weldMesh(raw.vertices, raw.triangles), checked = validateMesh(mesh);
        const props = measureShapeVolumeProperties(solid);
        try { if (Math.abs(checked.volume - props.volume) > props.volume * 0.001) throw Error('CAD/mesh volume mismatch'); }
        finally { props.delete(); }
        capacities.volume = kernel.wasmMemory.buffer.byteLength;
        if (capacities.before !== capacities.volume) parentPort.postMessage({ stage: 'native growth', part: index + 1, capacities });
        if (workerData.nativeArchive) {
          // Research only: test the installed native archive binding. Do not replace
          // accepted application handles or introduce this as a saved-design format.
          const progress = new kernel.Message_ProgressRange(), restoredRaw = new kernel.TopoDS_Shape();
          let restored;
          try {
            kernel.BRepTools.Clean(solid.wrapped, false);
            if (!kernel.BinTools.Write(solid.wrapped, '/probe.brep', progress)) throw Error('Native archive write failed');
            const bytes = new Uint8Array(kernel.FS.readFile('/probe.brep'));
            nativeBytes += bytes.byteLength;
            const compressed = gzipSync(bytes), expanded = gunzipSync(compressed);
            compressedNativeBytes += compressed.byteLength;
            if (bytes.length !== expanded.length || bytes.some((v, i) => v !== expanded[i])) throw Error('Native archive compression changed bytes');
            kernel.FS.unlink('/probe.brep'); kernel.FS.writeFile('/probe.brep', expanded);
            if (!kernel.BinTools.Read(restoredRaw, '/probe.brep', progress)) throw Error('Native archive read failed');
            restored = cast(restoredRaw); validateSolid(kernel, restored);
            const properties = measureShapeVolumeProperties(restored);
            try { if (Math.abs(checked.volume - properties.volume) > properties.volume * 0.001) throw Error('Archive volume mismatch'); }
            finally { properties.delete(); }
          } finally { restored?.delete(); restoredRaw.delete(); progress.delete(); try { kernel.FS.unlink('/probe.brep'); } catch {} }
        }
        solids.push(solid); solid = null;
        parts.push({ id: `capacity-${index + 1}`, mapNumber: index + 1,
          translation: [(index % 64) * 50, Math.floor(index / 64) * 50, 0], ...checked, mesh });
        meshBytes += mesh.positions.byteLength + mesh.indices.byteLength; triangles += mesh.indices.length / 3;
        const wasmBytes = kernel.wasmMemory.buffer.byteLength;
        const estimatedBytes = wasmBytes + 4 * meshBytes + triangles * 100;
        if ((index + 1) % 32 === 0 || index + 1 === workerData.count) parentPort.postMessage({ stage: 'generation', parts: index + 1, wasmBytes, meshBytes, triangles, estimatedBytes, elapsedMs: performance.now() - started });
        if (estimatedBytes > LIMITS_V2.memoryBytes) throw Error(`Estimated geometry memory exceeds 512 MiB at part ${index + 1}.`);
        if (triangles > LIMITS_V2.triangles) throw Error('Triangle budget exceeded.');
        if (workerData.diagnosticRelease) {
          const finished = solids.pop();
          if (workerData.diagnosticMode === 'clean-release') kernel.BRepTools.Clean(finished.wrapped, false);
          finished.delete();
          if (workerData.diagnosticMode === 'yield-release') await new Promise(resolve => setImmediate(resolve));
        }
      } finally { solid?.delete(); cutter?.delete(); tools.forEach(tool => tool.delete()); }
    }
    if (workerData.diagnosticRelease) {
      parentPort.postMessage({ done: true, passed: false, diagnosticComplete: true, parts: parts.length,
        failure: 'Diagnostic only: native parts were released, so this does not qualify retained CAD or export.', wasmBytes: kernel.wasmMemory.buffer.byteLength });
    } else {
      parentPort.postMessage({ stage: 'STEP start', parts: parts.length, wasmBytes: kernel.wasmMemory.buffer.byteLength });
      const bytes = await serializeSTEP(parts, solids);
      const wasmBytes = kernel.wasmMemory.buffer.byteLength;
      if (wasmBytes + bytes.byteLength * 2 + meshBytes * 4 > LIMITS_V2.memoryBytes) throw Error('STEP export exceeds the 512 MiB estimated budget.');
      parentPort.postMessage({ done: true, passed: true, stage: 'STEP complete', parts: parts.length, wasmBytes, exportBytes: bytes.byteLength, meshBytes, triangles, nativeBytes, compressedNativeBytes });
    }
  } catch (error) {
    parentPort.postMessage({ done: true, passed: false, failure: String(error), parts: parts.length, wasmBytes: kernel.wasmMemory.buffer.byteLength });
  } finally { solids.forEach(solid => solid.delete()); digits.forEach(digit => digit.delete()); arrow?.delete(); prototype?.delete(); }
}
