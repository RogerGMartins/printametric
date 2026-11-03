/** Native CAD STEP. Transform clones because Replicad transformations consume wrappers. */
import { getOC, type Shape3D } from 'replicad';
import type { Part } from '../geometry/types.ts';

export async function serializeSTEP(parts: Part[], solids: Shape3D[]): Promise<Uint8Array<ArrayBuffer>> {
  if (parts.length !== solids.length) throw new Error('STEP solid identity mismatch.');
  const copies: Shape3D[] = [];
  const oc = getOC();
  const resources: { delete(): void }[] = [];
  const own = <T extends { delete(): void }>(value: T): T => { resources.push(value); return value; };
  try {
    // Native writer objects can retain an entire transfer graph. Own each handle
    // explicitly: waiting for JS finalizers exceeds the budget on repeated exports.
    const format = own(new oc.TCollection_ExtendedString('XmlOcaf', true));
    const document = own(new oc.TDocStd_Document(format));
    const root = own(document.Main());
    const shapeTool = own(oc.XCAFDoc_DocumentTool.ShapeTool(root));
    oc.XCAFDoc_ShapeTool.SetAutoNaming(false);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const shape = solids[i]!.clone().translate(part.translation); copies.push(shape);
      const label = own(shapeTool.NewShape());
      shapeTool.SetShape(label, shape.wrapped);
      const name = own(new oc.TCollection_ExtendedString(part.id, true));
      own(oc.TDataStd_Name.Set(label, name));
    }
    shapeTool.UpdateAssemblies();
    const writer = own(new oc.STEPCAFControl_Writer());
    writer.SetNameMode(true);
    oc.Interface_Static.SetCVal('xstep.cascade.unit', 'MM');
    oc.Interface_Static.SetCVal('write.step.unit', 'MM');
    const progress = own(new oc.Message_ProgressRange());
    if (!writer.Perform(document, 'wall-art.step', progress)) throw new Error('Native STEP writer failed.');
    return new Uint8Array(oc.FS.readFile('/wall-art.step'));
  } finally {
    resources.reverse().forEach(resource => resource.delete());
    copies.forEach(shape => shape.delete());
    try { oc.FS.unlink('/wall-art.step'); } catch { /* Failure may precede file creation. */ }
  }
}
