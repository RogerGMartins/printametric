/** Binary STL chunks over the same validated meshes used by the preview. */
import { validateMesh } from '../geometry/validate-mesh.ts';
import type { Part } from '../geometry/types.ts';
import { serializeSTL } from './stl.ts';
import type { ByteSink, StreamOptions } from './stream.ts';

export async function streamSTL(parts: readonly Part[],sink:ByteSink,{signal,maxBytes=2*1024**3}:StreamOptions={}) {
  if(!parts.length||parts.length>4000)throw Error('STL part budget exceeded.');
  let triangles=0;
  for(const part of parts){
    signal?.throwIfAborted();validateMesh(part.mesh);
    if(part.translation.length!==3||!part.translation.every(Number.isFinite))throw Error('Invalid STL placement.');
    triangles+=part.mesh.indices.length/3;
  }
  const bytes=84+triangles*50;
  if(triangles>2_000_000||bytes>maxBytes)throw Error('STL output budget exceeded.');
  const header=new Uint8Array(84);header.set(new TextEncoder().encode('Printametric assembled model; coordinates in millimeters'));
  new DataView(header.buffer).setUint32(80,triangles,true);await sink.write(header);
  for(const part of parts){signal?.throwIfAborted();await sink.write(serializeSTL([part]).subarray(84));}
  return {bytes,triangles,parts:parts.length};
}
