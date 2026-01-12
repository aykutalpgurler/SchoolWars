import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { buildTerrain } from './terrain.js';
import { spawnTeams } from './units.js';

export async function buildSceneContent(scene) {
  // Soft fog for depth
  scene.fog = new THREE.Fog(0x87b9ff, 35, 120);

  // Terrain grid
  const terrain = buildTerrain(scene);

  // Spawn placeholder team units (now async to load camel model)
  const teams = await spawnTeams(scene, terrain);

  return { terrain, teams };
}

