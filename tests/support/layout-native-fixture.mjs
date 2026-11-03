// Synthetic numbered blades for the capacity gate, not a reachable v2 layout.
// All native temporaries are explicitly owned; no production finalizer dependency.
import { cast, makePolygon, makeBox } from 'replicad';
import { generateModel } from '../../src/tools/wall-art/geometry/generate.ts';
import { DEFAULT_PARAMETERS } from '../../src/tools/wall-art/model/parameters.ts';
import { digitPolygons, ORIENTATION_ARROW } from '../../src/tools/wall-art/geometry/glyphs.ts';

function boolean(kernel, Operation, left, right) {
  const builder = new Operation(), args = new kernel.NCollection_List_TopoDS_Shape(), tools = new kernel.NCollection_List_TopoDS_Shape();
  try {
    args.Append(left.wrapped); tools.Append(right.wrapped);
    builder.SetArguments(args); builder.SetTools(tools);
    builder.SetNonDestructive(true); builder.SetToFillHistory(false);
    builder.Build(); builder.SimplifyResult(true, true, 0.001);
    const raw = builder.Shape(); try { return cast(raw); } finally { raw.delete(); }
  } finally { builder.delete(); args.delete(); tools.delete(); }
}

export function translateNative(kernel, shape, [x, y, z]) {
  const vector = new kernel.gp_Vec(x, y, z), transform = new kernel.gp_Trsf();
  let builder;
  try {
    transform.SetTranslation(vector);
    // Translation is an isometry: a new location can share immutable geometry.
    // Boolean builders below are non-destructive; do not copy every glyph surface.
    builder = new kernel.BRepBuilderAPI_Transform(shape.wrapped, transform, false, false);
    const raw = builder.Shape(); try { return cast(raw); } finally { raw.delete(); }
  } finally { builder?.delete(); transform.delete(); vector.delete(); }
}

export function compoundNative(kernel, shapes) {
  const builder = new kernel.TopoDS_Builder(), raw = new kernel.TopoDS_Compound();
  try { builder.MakeCompound(raw); for (const shape of shapes) builder.Add(raw, shape.wrapped); return cast(raw); }
  finally { raw.delete(); builder.delete(); }
}

function extrudeFace(kernel, face) {
  const vector = new kernel.gp_Vec(0, 0, 1);
  let builder;
  try {
    builder = new kernel.BRepPrimAPI_MakePrism(face.wrapped, vector, false, true);
    const raw = builder.Shape(); try { return cast(raw); } finally { raw.delete(); }
  } finally { builder?.delete(); vector.delete(); }
}

function prism(kernel, polygon) {
  const face = makePolygon(polygon.map(([x, y]) => [x, y, 0]));
  try { return extrudeFace(kernel, face); } finally { face.delete(); }
}

function bottomFace(shape) {
  // Ten cached glyphs only. No face-wrapper iteration in the per-part hot path.
  const faces = shape.faces;
  try {
    for (const face of faces) {
      const box = face.boundingBox;
      try {
        if (Math.abs(box.bounds[0][2]) < 1e-6 && Math.abs(box.bounds[1][2]) < 1e-6) {
          const result = face.clone(); result.wrapped.Reverse(); return result;
        }
      } finally { box.delete(); }
    }
    throw Error('Missing glyph bottom face');
  } finally { faces.forEach(face => face.delete()); }
}

export function numberedBladeFactory(kernel, mode = 'cut', templates) {
  if (!['cut', 'profile'].includes(mode)) throw Error('Unknown native pocket experiment');
  const digits = [], scale = 47.5 * 0.34 / 10;
  let prototype, arrow, baseFace, upper;
  const dispose = () => { digits.splice(0).forEach(d => d.delete()); prototype?.delete(); prototype = null; arrow?.delete(); arrow = null; baseFace?.delete(); baseFace = null; upper?.delete(); upper = null; };
  try {
    if (templates) {
      if (templates.length !== 12) throw Error('Invalid fixture templates');
      prototype = templates[0].clone(); arrow = templates[1].clone();
      digits.push(...templates.slice(2).map(shape => shape.clone()));
    } else {
    const core = generateModel(DEFAULT_PARAMETERS, 1, kernel);
    try { prototype = core.solids[0].clone(); } finally { core.dispose(); }
    for (let digit = 0; digit < 10; digit++) {
      let joined;
      try {
        for (const polygon of digitPolygons(digit)) {
          const bar = prism(kernel, polygon.map(([x, y]) => [x * scale, -y * scale]));
          if (!joined) joined = bar;
          else {
            try { const next = boolean(kernel, kernel.BRepAlgoAPI_Fuse, joined, bar); joined.delete(); joined = next; }
            finally { bar.delete(); }
          }
        }
        digits.push(joined); joined = null;
      } finally { joined?.delete(); }
    }
    arrow = prism(kernel, ORIENTATION_ARROW);
    }
    if (mode === 'profile') {
      for (let i = 0; i < digits.length; i++) { const face = bottomFace(digits[i]); digits[i].delete(); digits[i] = face; }
      const face = bottomFace(arrow); arrow.delete(); arrow = face;
      baseFace = makePolygon([[-23.75, -23.75, 0], [23.75, -23.75, 0], [23.75, 23.75, 0], [-23.75, 23.75, 0]]);
      const lower = makeBox([-30, -30, -1], [30, 30, 1]);
      try { upper = boolean(kernel, kernel.BRepAlgoAPI_Cut, prototype, lower); } finally { lower.delete(); }
    }
  } catch (error) { dispose(); throw error; }
  return {
    templates() {
      if (mode !== 'cut') throw Error('Archive fixture templates before profile conversion');
      return [prototype, arrow, ...digits];
    },
    make(number) {
      if (!Number.isInteger(number) || number < 1 || number > 4000 || !prototype) throw Error('Invalid capacity fixture number');
      const text = String(number), width = (text.length * 7 - 1) * scale, tools = [];
      let cutter, profile, lower;
      try {
        for (let i = 0; i < text.length; i++) tools.push(translateNative(kernel, digits[Number(text[i])], [-width / 2 + i * 7 * scale, 5 * scale - 2.9, 0]));
        tools.push(translateNative(kernel, arrow, [0, 5 * scale - 2.1, 0]));
        cutter = compoundNative(kernel, tools);
        if (mode === 'profile') {
          // Same pocket volume: extrude the perforated bottom millimeter, then
          // fuse its ceiling to the unchanged upper blade. Islands in 0/6/8/9
          // attach through the ceiling; they must not become separate solids.
          profile = boolean(kernel, kernel.BRepAlgoAPI_Cut, baseFace, cutter);
          lower = extrudeFace(kernel, profile);
          return boolean(kernel, kernel.BRepAlgoAPI_Fuse, upper, lower);
        }
        return boolean(kernel, kernel.BRepAlgoAPI_Cut, prototype, cutter);
      } finally { lower?.delete(); profile?.delete(); cutter?.delete(); tools.forEach(t => t.delete()); }
    },
    dispose,
  };
}
