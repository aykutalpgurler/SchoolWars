import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { buildTerrain } from './terrain.js';
import { spawnTeams } from './units.js';

export function buildSceneContent(scene) {
  // Soft fog for depth
  scene.fog = new THREE.Fog(0x87b9ff, 35, 120);

  // Terrain platforms and ramps
  const terrain = buildTerrain(scene);

  // Zone tiles on selected platforms
  const zones = [];
  const tileGeo = new THREE.BoxGeometry(1.5, 0.05, 1.5);
  const heartMaterials = {
    neutral: new THREE.MeshStandardMaterial({ color: 0xffffff }),
    player: new THREE.MeshStandardMaterial({ color: 0x7c3aed }),
    ai1: new THREE.MeshStandardMaterial({ color: 0x22c55e }),
    ai2: new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
  };

  const placements = [
    { platform: 0, offset: new THREE.Vector3(0, 0.15, 0) },
    { platform: 1, offset: new THREE.Vector3(-1, 0.15, -1) },
    { platform: 1, offset: new THREE.Vector3(1.6, 0.15, 1.2) },
    { platform: 2, offset: new THREE.Vector3(0, 0.15, 0) },
    { platform: 3, offset: new THREE.Vector3(0, 0.15, 0) },
  ];

  placements.forEach((place, idx) => {
    const plat = terrain.platforms[place.platform];
    const tile = new THREE.Mesh(tileGeo, heartMaterials.neutral.clone());
    tile.position.copy(plat.top.position).add(place.offset);
    tile.receiveShadow = true;
    tile.userData = {
      id: `zone-${idx}`,
      owner: null,
      capture: 0,
    };
    scene.add(tile);
    zones.push(tile);
  });

  const teams = spawnTeams(scene, terrain.platforms);

  const nameArea = buildNameArea(scene);

  return { terrain, zones, teams, nameArea };
}

function buildLetter(pattern, color) {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const mat = new THREE.MeshStandardMaterial({ color });
  pattern.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '#') {
        const mesh = new THREE.Mesh(box, mat);
        mesh.position.set(c * 0.45, (pattern.length - r) * 0.45, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    });
  });
  group.position.multiplyScalar(1 / 2);
  return group;
}

function buildNameArea(scene) {
  const group = new THREE.Group();
  const patterns = [
    [
      '###',
      '#.#',
      '###',
      '#.#',
      '#.#',
    ], // A
    [
      '###',
      '#.#',
      '###',
      '#.#',
      '###',
    ], // B
    [
      '###',
      '#..',
      '#..',
      '#..',
      '###',
    ], // C
  ];

  const letters = ['A', 'B', 'C'];
  let offsetX = 0;
  patterns.forEach((pat, idx) => {
    const letter = buildLetter(pat, 0x7c3aed + idx * 0x111111);
    letter.position.set(offsetX, 0, 0);
    offsetX += 1.8;
    group.add(letter);
  });

  group.position.set(-14, 1.5, 12);
  scene.add(group);

  return {
    group,
    cameraPos: new THREE.Vector3(-14, 8, 12),
    lookAt: group.position.clone(),
  };
}

