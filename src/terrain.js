import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

function makePlatform({ width, length, height, elevation, position }) {
  const group = new THREE.Group();
  const topGeo = new THREE.BoxGeometry(width, 0.2, length);
  const topMat = new THREE.MeshStandardMaterial({ color: 0x7cb342 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.set(position.x, elevation + height + 0.1, position.z);
  top.receiveShadow = true;
  group.add(top);

  const edgeGeo = new THREE.BoxGeometry(width, height, length);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.position.set(position.x, elevation + height / 2, position.z);
  edge.castShadow = true;
  edge.receiveShadow = true;
  group.add(edge);

  return { group, top };
}

function makeRamp({ start, end, width }) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
  const height = end.y - start.y;
  const slope = Math.atan2(height, len || 0.0001);
  const rampGeo = new THREE.BoxGeometry(width, Math.abs(height), len || 0.001);
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x7cb342 });
  const mesh = new THREE.Mesh(rampGeo, rampMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
  mesh.rotation.x = -slope;
  mesh.rotation.y = Math.atan2(dir.x, dir.z);
  return mesh;
}

export function buildTerrain(scene) {
  const platforms = [];
  const ramps = [];

  const platformDefs = [
    { width: 8, length: 8, height: 1.2, elevation: 2.5, position: new THREE.Vector3(-6, 0, -4) },
    { width: 6, length: 6, height: 1.0, elevation: 1.0, position: new THREE.Vector3(2, 0, -2) },
    { width: 5, length: 5, height: 0.8, elevation: 0.2, position: new THREE.Vector3(6, 0, 5) },
    { width: 4, length: 4, height: 0.8, elevation: 3.0, position: new THREE.Vector3(4, 0, -7) },
  ];

  for (const def of platformDefs) {
    const { group, top } = makePlatform(def);
    group.userData = {
      elevation: def.elevation + def.height,
      size: { width: def.width, length: def.length },
    };
    scene.add(group);
    platforms.push({ ...def, group, top });
  }

  // Ramps between key platforms
  const rampDefs = [
    { a: 0, b: 1 },
    { a: 1, b: 2 },
    { a: 0, b: 3 },
  ];
  for (const { a, b } of rampDefs) {
    const pa = platforms[a];
    const pb = platforms[b];
    const start = pa.top.position.clone();
    const end = pb.top.position.clone();
    start.y = pa.group.userData.elevation + 0.05;
    end.y = pb.group.userData.elevation + 0.05;
    const ramp = makeRamp({ start, end, width: 1.4 });
    scene.add(ramp);
    ramps.push({ a, b, mesh: ramp });
  }

  return { platforms, ramps };
}

