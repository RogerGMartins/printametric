/** Switching preview mode does not regenerate geometry or remount the 3D camera. */
import type { WallArtEditor } from './useWallArt.ts';
import { WallArtPreview } from './WallArtPreview.tsx';
import { WallArtPlan } from './WallArtPlan.tsx';
export function WallArtWorkspacePreview({editor}:{editor:WallArtEditor}) {
  const {plan,setPlan}=editor,layout=editor.snapshot.upgrade??editor.snapshot.accepted?.layout;
  const result=editor.snapshot.upgrade?.result??editor.snapshot.accepted?.result??null;
  return <>
    {layout&&<div className="preview-mode" role="group" aria-label="Model preview mode"><button type="button" aria-pressed={!plan} onClick={()=>setPlan(false)}>3D</button><button type="button" aria-pressed={plan} onClick={()=>setPlan(true)}>Numbered plan</button></div>}
    <div className="preview-layer" hidden={Boolean(plan&&layout)}><WallArtPreview result={result}/></div>
    {plan&&layout&&<WallArtPlan layout={layout} number={editor.selectedPart} setNumber={editor.setSelectedPart}/>}
  </>;
}
