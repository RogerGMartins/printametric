/** Explicit ownership for hot-path native operations; inputs are never consumed. */
import { cast, isShape3D, type AnyShape, type Shape3D } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import { DesignError } from '../model/budget.ts';

export function nativeBoolean(kernel: Kernel, kind: 'cut' | 'fuse' | 'common', left: AnyShape, right: AnyShape): AnyShape {
  const Operation = kind === 'cut' ? kernel.BRepAlgoAPI_Cut : kind === 'fuse' ? kernel.BRepAlgoAPI_Fuse : kernel.BRepAlgoAPI_Common;
  const builder = new Operation(), args = new kernel.NCollection_List_TopoDS_Shape(), tools = new kernel.NCollection_List_TopoDS_Shape();
  try {
    args.Append(left.wrapped); tools.Append(right.wrapped); builder.SetArguments(args); builder.SetTools(tools);
    builder.SetNonDestructive(true); builder.SetToFillHistory(false); builder.Build();
    if (!builder.IsDone()) throw new DesignError('CAD_BOOLEAN', `Native ${kind} failed.`);
    builder.SimplifyResult(true,true,0.001);
    const raw = builder.Shape(); try { return cast(raw); } finally { raw.delete(); }
  } finally { builder.delete(); args.delete(); tools.delete(); }
}

export function nativeExtrude(kernel: Kernel, face: AnyShape, height: number): Shape3D {
  const vector = new kernel.gp_Vec(0,0,height);
  const builder = new kernel.BRepPrimAPI_MakePrism(face.wrapped,vector,false,true);
  try {
    const raw = builder.Shape(); let shape;
    try { shape=cast(raw); } finally { raw.delete(); }
    if (!isShape3D(shape)) { shape.delete(); throw new DesignError('CAD_SOLID','Extrusion did not return a solid.'); }
    return shape;
  } finally { builder.delete(); vector.delete(); }
}

export function requireSolid(shape: AnyShape): Shape3D {
  if (isShape3D(shape)) return shape;
  shape.delete(); throw new DesignError('CAD_SOLID','Expected a native solid.');
}

export function nativeTranslate(kernel: Kernel, shape: AnyShape, x: number, y: number, z: number): AnyShape {
  const vector=new kernel.gp_Vec(x,y,z), transform=new kernel.gp_Trsf();
  let builder;
  try {
    transform.SetTranslation(vector);
    builder=new kernel.BRepBuilderAPI_Transform(shape.wrapped,transform,false,false);
    const raw=builder.Shape(); try { return cast(raw); } finally { raw.delete(); }
  } finally { builder?.delete();transform.delete();vector.delete(); }
}

export function nativeScale(kernel: Kernel, shape: AnyShape, factor: number): AnyShape {
  const origin=new kernel.gp_Pnt(0,0,0), transform=new kernel.gp_Trsf();
  let builder;
  try {
    transform.SetScale(origin,factor);
    builder=new kernel.BRepBuilderAPI_Transform(shape.wrapped,transform,true,false);
    const raw=builder.Shape();try{return cast(raw);}finally{raw.delete();}
  }finally{builder?.delete();transform.delete();origin.delete();}
}
