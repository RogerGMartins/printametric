/** Review images use the exact exported canonical arrays, never regenerated shapes. */
import * as THREE from 'three';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { validateMesh, weldMesh } from '../../../src/shared/geometry/validate-mesh.ts';
window.renderSurfaceViews = async id => {
  const response = await fetch(`/models/${id}/preview.json`); if (!response.ok) throw Error('Missing preview manifest.');
  const data = await response.json(), scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
  const material = new THREE.MeshStandardMaterial({ color: '#8394a5', roughness: .8, metalness: 0, flatShading: true }), canonical = [];
  for (const part of data.parts) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(part.mesh.positions), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(part.mesh.indices), 1)); geometry.computeVertexNormals();
    canonical.push(validateMesh({ positions: geometry.attributes.position.array, indices: geometry.index.array }));
    const mesh = new THREE.Mesh(geometry, material); mesh.position.fromArray(part.translation); group.add(mesh);
  }
  const bounds = new THREE.Box3().setFromObject(group), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  const radius = size.length() / 2, renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(960, 600); renderer.setClearColor('#edf1f5');
  scene.add(new THREE.AmbientLight(0xffffff, 1.6)); const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-300, -500, 800); scene.add(light);
  const images = {};
  try {
    for (const [name, direction] of [['front', [0, 0, 1]], ['side', [0, -1, .001]], ['isometric', [1, -1, 1.4]]]) {
      const half = radius * 1.12, camera = new THREE.OrthographicCamera(-half * 1.6, half * 1.6, half, -half, .01, radius * 10);
      camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(radius * 4));
      camera.up.set(0, name === 'front' ? 1 : 0, name === 'front' ? 0 : 1); camera.lookAt(center); camera.updateProjectionMatrix();
      renderer.render(scene, camera); images[name] = renderer.domElement.toDataURL('image/png');
    }
    const bytes = await (await fetch(`/models/${id}/assembly.3mf`)).arrayBuffer(), imported = new ThreeMFLoader().parse(bytes); imported.updateMatrixWorld(true);
    const seen = new Set(); let maximumVolumeError = 0;
    imported.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      try {
        const vertices = geometry.attributes.position.array, indices = geometry.index?.array ?? Array.from({ length: vertices.length / 3 }, (_, i) => i);
        const checked = validateMesh(weldMesh(vertices, indices));
        const index = data.parts.findIndex(part => ['min', 'max'].every(side => checked.bounds[side].every((v, axis) => Math.abs(v - part.bounds[side][axis] - part.translation[axis]) < .001)));
        if (index < 0 || seen.has(index)) throw Error('Independent 3MF reader lost a placement.');
        seen.add(index); const error = Math.abs(checked.volume / canonical[index].volume - 1);
        if (error > .00001) throw Error('Independent 3MF volume differs from canonical source.'); maximumVolumeError = Math.max(maximumVolumeError, error);
      } finally { geometry.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); }
    });
    if (seen.size !== data.parts.length) throw Error('Independent 3MF part count differs.');
    return { images, independent3MFParts: seen.size, maximumVolumeError, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
  } finally { group.children.forEach(mesh => mesh.geometry.dispose()); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
};
