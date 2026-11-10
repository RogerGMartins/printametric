/** Renderer-only camera and lighting; printable meshes are never regenerated here. */
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrthographicCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ModelResult } from '../../../shared/geometry/types.ts';

const fallback = <div className="empty-preview"><h2>3D preview unavailable</h2><p>Model settings, validation, and exports remain available when CAD is ready.</p></div>;
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? fallback : this.props.children; }
}
type CameraAction = 'Fit view' | 'Front view' | 'Isometric view' | 'Rotate left' | 'Rotate right' | 'Zoom in' | 'Zoom out';
const cameraActions: CameraAction[] = ['Fit view', 'Front view', 'Isometric view', 'Rotate left', 'Rotate right', 'Zoom in', 'Zoom out'];
function Scene({ result, action }: { result: ModelResult; action: { name: CameraAction; sequence: number } }) {
  const { camera, gl, size, invalidate } = useThree();
  const [controls, setControls] = useState<OrbitControls | null>(null);
  const consumedAction = useRef<{ camera: OrthographicCamera; sequence: number } | null>(null);
  useEffect(() => {
    camera.up.set(0, 0, 1);
    const orbit = new OrbitControls(camera, gl.domElement); orbit.enablePan = false; orbit.enableDamping = false;
    const redraw = () => invalidate();
    orbit.addEventListener('change', redraw); setControls(orbit);
    return () => { orbit.removeEventListener('change', redraw); orbit.dispose(); };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !controls) return;
    const [x, y, z] = result.bounds.max.map((value, index) => value - result.bounds.min[index]!);
    const radius = Math.hypot(x!, y!, z!) / 2;
    const target = new Vector3(...result.bounds.min).add(new Vector3(...result.bounds.max)).multiplyScalar(0.5);
    const zoom = action.name === 'Zoom in' || action.name === 'Zoom out';
    const rotate = action.name === 'Rotate left' || action.name === 'Rotate right';
    // A new camera needs framing. Model/viewport updates must not replay a button
    // command, including when StrictMode reconnects the orbit controls.
    if (consumedAction.current?.camera !== camera || (!zoom && !rotate)) {
      controls.target.copy(target);
      camera.position.copy(target).add(action.name === 'Front view' ? new Vector3(0, -0.001, radius * 3) : new Vector3(radius * 0.6, -radius * 1.25, radius * 2.6));
      camera.zoom = Math.min(size.width, size.height) / (radius * 2.35);
    } else if (consumedAction.current.sequence !== action.sequence) {
      if (zoom) camera.zoom = Math.max(0.05, Math.min(20, camera.zoom * (action.name === 'Zoom in' ? 1.2 : 1 / 1.2)));
      else if (rotate) camera.position.sub(controls.target).applyAxisAngle(new Vector3(0, 0, 1), action.name === 'Rotate left' ? Math.PI / 12 : -Math.PI / 12).add(controls.target);
    }
    consumedAction.current = { camera, sequence: action.sequence };
    // Enclose the current bounds even when a smaller model retains the old camera
    // distance and orbit target. This also covers subsequent pointer rotations.
    camera.near = 0.1;
    camera.far = camera.position.distanceTo(controls.target) + controls.target.distanceTo(target) + radius + 1;
    camera.updateProjectionMatrix(); controls.update(); invalidate();
  }, [action, result, camera, controls, size.width, size.height, invalidate]);
  return <><ambientLight intensity={1.5} /><directionalLight position={[-300, -500, 800]} intensity={3} />
    {result.parts.map(part => <mesh key={`${result.revision}-${part.id}`} position={part.translation}>
      <bufferGeometry onUpdate={geometry => geometry.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[part.mesh.positions, 3]} />
        <bufferAttribute attach="index" args={[part.mesh.indices, 1]} />
      </bufferGeometry><meshStandardMaterial color="#b5bcc7" roughness={0.85} flatShading />
    </mesh>)}
  </>;
}
export function WallArtPreview({ result }: { result: ModelResult | null }) {
  const [action, setAction] = useState({ name: 'Fit view' as CameraAction, sequence: 0 });
  const [contextLost, setContextLost] = useState(false);
  if (!result) return <div className="empty-preview"><h2>Preparing your wall art</h2><p>Loading the CAD engine and checking each part.</p></div>;
  return <div className="model-preview">
    <div className="model-canvas" role="img" aria-label={`Wall art assembly, ${result.parts.length} separate parts. Millimeters.`}>
      {/* Keep the last on-demand frame when Chromium composites the overlapping drawer. */}
      {contextLost ? fallback : <PreviewBoundary><Canvas orthographic frameloop="demand" dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }} fallback={fallback}
        onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true), { once: true }); }}>
        <Scene result={result} action={action} />
      </Canvas></PreviewBoundary>}
    </div>
    <div className="camera-actions" aria-label="Preview camera">{cameraActions.map(name => <button type="button" key={name} onClick={() => setAction(previous => ({ name, sequence: previous.sequence + 1 }))}>{name}</button>)}</div>
  </div>;
}
