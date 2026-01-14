import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { buildTerrain } from './terrain.js';
import { spawnTeams, TEAM_BASES } from './units.js';

/**
 * Create buff grids (15 blue cells that provide spawn speed buffs)
 * Places them randomly but avoids spawn cells and edges
 */
function createBuffGrids(terrain) {
  const buffGrids = [];
  const numBuffGrids = 15; // 15 buff grids
  const spawnCells = new Set();
  
  // Mark spawn cells as off-limits
  Object.values(TEAM_BASES).forEach(base => {
    spawnCells.add(`${base.startRow},${base.startCol}`);
  });
  
  // Also avoid cells adjacent to spawn cells
  Object.values(TEAM_BASES).forEach(base => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        spawnCells.add(`${base.startRow + dr},${base.startCol + dc}`);
      }
    }
  });
  
  let attempts = 0;
  const maxAttempts = 200;
  
  while (buffGrids.length < numBuffGrids && attempts < maxAttempts) {
    attempts++;
    // Place buff grids away from edges (rows/cols 1 to GRID_SIZE-2)
    const row = 1 + Math.floor(Math.random() * (terrain.GRID_SIZE - 2));
    const col = 1 + Math.floor(Math.random() * (terrain.GRID_SIZE - 2));
    const key = `${row},${col}`;
    
    if (!spawnCells.has(key)) {
      const cell = terrain.getCell(row, col);
      if (cell && cell.type !== 'buff') {
        cell.setType('buff');
        buffGrids.push(cell);
        spawnCells.add(key); // Prevent duplicates
      }
    }
  }
  
  return buffGrids;
}

export async function buildSceneContent(scene) {
  // Soft fog for depth
  scene.fog = new THREE.Fog(0x87b9ff, 35, 120);

  // Terrain grid
  const terrain = buildTerrain(scene);

  // Create buff grids (5-8 blue cells)
  const buffGrids = createBuffGrids(terrain);
  console.log('[buildSceneContent] Created', buffGrids.length, 'buff grids');
  console.log('[buildSceneContent] Buff grids:', buffGrids.map(c => ({ row: c.row, col: c.col, type: c.type })));

  // Spawn placeholder team units (now async to load camel model)
  const teams = await spawnTeams(scene, terrain);

  return { terrain, teams, buffGrids };
}

