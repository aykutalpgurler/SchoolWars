import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const TEAM_COLORS = {
  team1: 0x7c3aed, // Purple
  team2: 0x22c55e, // Green
  team3: 0xfacc15, // Yellow
};

/**
 * Create a simple cube unit
 */
function makeCubeUnit(color) {
  const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Create a simple triangle (3D tetrahedron) unit
 */
function makeTriangleUnit(color) {
  const geo = new THREE.TetrahedronGeometry(0.2, 0);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Create a simple sphere unit
 */
function makeSphereUnit(color) {
  const geo = new THREE.SphereGeometry(0.2, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Create a simple cylinder unit
 */
function makeCylinderUnit(color) {
  const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 12);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Get terrain height at a specific world position using raycasting
 */
function getTerrainHeightAt(scene, worldX, worldZ, cell) {
  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3(worldX, 100, worldZ); // Start high above
  const rayDirection = new THREE.Vector3(0, -1, 0); // Cast downward
  
  raycaster.set(rayOrigin, rayDirection);
  
  // Find all terrain meshes
  const terrainMeshes = [];
  scene.traverse((object) => {
    if (object.userData.isTerrain && object.isMesh) {
      terrainMeshes.push(object);
    }
  });
  
  const intersects = raycaster.intersectObjects(terrainMeshes, false);
  
  if (intersects.length > 0) {
    // Use the closest intersection (first one)
    return intersects[0].point.y;
  }
  
  // Fallback: calculate from cell height (height scale is 0.2)
  const heightScale = 0.2;
  return cell ? cell.getY() * heightScale : 0;
}

/**
 * Create units for a team and place them on terrain vertex grids
 */
function createTeamUnits(scene, terrain, teamId, startRow, startCol, geometryType) {
  const units = [];
  const color = TEAM_COLORS[teamId];
  
  // Map geometry type to creator function and properties
  const geometryMap = {
    'sphere': { create: makeSphereUnit, yOffset: 0.2, type: 'sphere' },
    'cube': { create: makeCubeUnit, yOffset: 0.15, type: 'cube' },
    'triangle': { create: makeTriangleUnit, yOffset: 0.1, type: 'triangle' },
  };
  
  const geometry = geometryMap[geometryType];
  if (!geometry) return units;
  
  // Place 3 units on different grid cells
  const offsets = [
    { row: 0, col: 0 },  // Starting cell
    { row: 0, col: 1 },  // One cell right
    { row: 1, col: 0 },  // One cell down
  ];
  
  offsets.forEach((offset) => {
    const cellRow = startRow + offset.row;
    const cellCol = startCol + offset.col;
    const cell = terrain.getCell(cellRow, cellCol);
    
    if (cell) {
      const unit = geometry.create(color);
      
      // Use raycasting to find exact terrain height at this position
      const terrainHeight = getTerrainHeightAt(scene, cell.x, cell.z, cell);
      
      // Place unit on the terrain surface
      unit.position.set(cell.x, terrainHeight + geometry.yOffset, cell.z);
      
      unit.userData = {
        team: teamId,
        cell: cell,
        currentCell: cell, // Track current grid cell for collision
        type: geometry.type,
      };
      
      // Add unit to cell's units array
      if (cell) {
        cell.addUnit(unit);
      }
      
      scene.add(unit);
      units.push(unit);
    }
  });
  
  return units;
}

/**
 * Spawn all teams on the terrain
 * Team 1: sphere, Team 2: cube, Team 3: triangle
 */
export function spawnTeams(scene, terrain) {
  const teams = {
    team1: createTeamUnits(scene, terrain, 'team1', 2, 2, 'sphere'),      // Top-left: sphere
    team2: createTeamUnits(scene, terrain, 'team2', 2, 13, 'cube'),     // Top-right: cube
    team3: createTeamUnits(scene, terrain, 'team3', 13, 2, 'triangle'), // Bottom-left: triangle
  };
  
  return teams;
}
