import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GridCell } from './gridCell.js';
import { TerrainGenerator } from './terrainGenerator.js';

export function buildTerrain(scene) {
  const GRID_SIZE = 16;
  const CELL_SIZE = 1.0; // Each grid cell is 1 unit square
  
  // Generate terrain using Diamond-Square and Perlin Noise
  const generator = new TerrainGenerator(GRID_SIZE, GRID_SIZE, CELL_SIZE, Date.now());
  const map = generator.generate();
  
  const grid = [];
  const gridMeshes = [];
  
  // Material for grid cells
  const gridMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  gridMaterial.castShadow = true;
  gridMaterial.receiveShadow = true;
  
  // Black material for grid lines
  const blackMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x000000,
    side: THREE.DoubleSide,
  });
  
  // Create individual grid meshes (quads connecting neighboring cells)
  for (let z = 0; z < GRID_SIZE - 1; z++) {
    for (let x = 0; x < GRID_SIZE - 1; x++) {
      createGridMesh(scene, map, x, z, gridMaterial, blackMaterial, CELL_SIZE, GRID_SIZE);
    }
  }
  
  // Flatten map array for compatibility (row-major order: row * GRID_SIZE + col)
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = map[x][z];
      grid.push(cell);
      if (cell.mesh) {
        gridMeshes.push(cell.mesh);
      }
    }
  }
  
  // Helper function to get cell at grid coordinates
  // Note: In our system, map[x][z] where x=col, z=row
  function getCell(row, col) {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    // map is indexed as [x][z], so map[col][row]
    if (map[col] && map[col][row]) {
      return map[col][row];
    }
    return null;
  }
  
  // Helper function to get cell from world position
  function getCellFromWorldPos(worldX, worldZ) {
    const col = Math.floor((worldX + (GRID_SIZE * CELL_SIZE) / 2) / CELL_SIZE);
    const row = Math.floor((worldZ + (GRID_SIZE * CELL_SIZE) / 2) / CELL_SIZE);
    return getCell(row, col);
  }
  
  return {
    grid,
    gridMeshes,
    GRID_SIZE,
    CELL_SIZE,
    getCell,
    getCellFromWorldPos,
    generator, // Expose generator for access to moisture/temperature maps
  };
}

/**
 * Create a quad mesh for a grid cell, connecting it with neighbors
 */
function createGridMesh(scene, map, x, z, material, lineMaterial, cellSize, gridSize) {
  const cell = map[x][z];
  
  // Get neighboring cells
  const cellRight = map[x + 1] ? map[x + 1][z] : null;
  const cellTop = map[x][z + 1] ? map[x][z + 1] : null;
  const cellTopRight = map[x + 1] && map[x + 1][z + 1] ? map[x + 1][z + 1] : null;
  
  // Calculate world positions for quad corners
  const worldX = (x - gridSize / 2) * cellSize + cellSize / 2;
  const worldZ = (z - gridSize / 2) * cellSize + cellSize / 2;
  
  // Height scale factor (make terrain variation more visible)
  const heightScale = 0.2;
  
  // Use the actual cell heights for each corner (shared corners will naturally match)
  const bottomLeft = new THREE.Vector3(
    worldX - cellSize / 2,
    cell.getY() * heightScale,
    worldZ - cellSize / 2
  );
  
  const bottomRight = new THREE.Vector3(
    worldX + cellSize / 2,
    cellRight ? cellRight.getY() * heightScale : cell.getY() * heightScale,
    worldZ - cellSize / 2
  );
  
  const topLeft = new THREE.Vector3(
    worldX - cellSize / 2,
    cellTop ? cellTop.getY() * heightScale : cell.getY() * heightScale,
    worldZ + cellSize / 2
  );
  
  const topRight = new THREE.Vector3(
    worldX + cellSize / 2,
    cellTopRight ? cellTopRight.getY() * heightScale : cell.getY() * heightScale,
    worldZ + cellSize / 2
  );
  
  // Create mesh geometry
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    bottomLeft.x, bottomLeft.y, bottomLeft.z,
    topLeft.x, topLeft.y, topLeft.z,
    topRight.x, topRight.y, topRight.z,
    bottomRight.x, bottomRight.y, bottomRight.z,
  ]);
  
  const indices = [
    0, 1, 2,
    2, 3, 0,
  ];
  
  const uvs = new Float32Array([
    0, 0,
    0, 1,
    1, 1,
    1, 0,
  ]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  
  // Create mesh with cell's color
  const cellMaterial = material.clone();
  cellMaterial.color.setHex(cell.color);
  
  const mesh = new THREE.Mesh(geometry, cellMaterial);
  mesh.userData.cell = cell;
  mesh.userData.isTerrain = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  
  // Store mesh reference in cell
  cell.mesh = mesh;
  
  // Create black border lines (only on right and top edges to avoid duplicates)
  const lineGeometry = new THREE.BufferGeometry();
  const lineVertices = new Float32Array([
    bottomRight.x, bottomRight.y + 0.01, bottomRight.z,
    topRight.x, topRight.y + 0.01, topRight.z,
    topLeft.x, topLeft.y + 0.01, topLeft.z,
  ]);
  
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
  
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.userData.isTerrain = true;
  line.renderOrder = 1000; // Draw on top
  scene.add(line);
}
