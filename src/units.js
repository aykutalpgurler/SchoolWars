import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js';

const TEAM_COLORS = {
  team1: 0x7c3aed, // Purple
  team2: 0x22c55e, // Green
  team3: 0xfacc15, // Yellow
};

// Cache for loaded camel model
let camelModelCache = null;

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
 * Load the camel model (cached after first load)
 */
async function loadCamelModel() {
  if (camelModelCache) {
    return camelModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    // Set the path for loading textures referenced in MTL
    mtlLoader.setPath('./assets/desert-creatures/Camel/');
    objLoader.setPath('./assets/desert-creatures/Camel/');

    // Load MTL material file first
    mtlLoader.load(
      'DromedaryCamels.mtl',
      (materials) => {
        // Preload materials (this loads textures)
        materials.preload();
        
        // Set materials for OBJ loader
        objLoader.setMaterials(materials);

        // Load OBJ model
        objLoader.load(
          'DromedaryCamels.obj',
          (object) => {
            // Ensure all meshes have proper material settings
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                // Ensure material properties are correct
                if (child.material.map) {
                  // Ensure texture is properly configured
                  child.material.map.flipY = false; // OBJ textures are typically not flipped
                  child.material.needsUpdate = true;
                }
                // Set color to white so texture shows properly (MTL has Kd 0,0,0 which would darken)
                child.material.color.setHex(0xffffff);
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            
            // Calculate bounding box to determine scale
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            // Scale to approximately match the old sphere size (0.2 radius = 0.4 diameter)
            const targetSize = 0.4;
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            
            // Recalculate box after scaling
            box.setFromObject(object);
            
            // Position model so its bottom (min Y) is at y=0
            const min = box.min;
            object.position.y = -min.y;
            
            // Center horizontally (x and z)
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;
            
            camelModelCache = object;
            resolve(object);
          },
          undefined,
          (error) => {
            console.error('Error loading OBJ file:', error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Error loading MTL file:', error);
        // Fallback: load OBJ with manual texture
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          './assets/desert-creatures/Camel/DromedaryCamels_BaseColor.png',
          (texture) => {
            texture.flipY = false;
            objLoader.load(
              './assets/desert-creatures/Camel/DromedaryCamels.obj',
              (object) => {
                object.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                      map: texture,
                      color: 0xffffff
                    });
                    child.castShadow = true;
                    child.receiveShadow = true;
                  }
                });
                
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const targetSize = 0.4;
                const scale = targetSize / maxDim;
                object.scale.set(scale, scale, scale);
                box.setFromObject(object);
                const min = box.min;
                object.position.y = -min.y;
                const center = box.getCenter(new THREE.Vector3());
                object.position.x = -center.x;
                object.position.z = -center.z;
                
                camelModelCache = object;
                resolve(object);
              },
              undefined,
              reject
            );
          },
          undefined,
          reject
        );
      }
    );
  });
}

/**
 * Create a camel unit from the loaded model
 */
function makeSphereUnit(color) {
  if (!camelModelCache) {
    console.error('Camel model not loaded yet. Call loadCamelModel() first.');
    // Fallback to sphere if model not loaded
    const geo = new THREE.SphereGeometry(0.2, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Clone the cached model (deep clone to clone materials and textures)
  const camel = camelModelCache.clone(true);
  
  // Apply team color as a very subtle tint to the materials
  camel.traverse((child) => {
    if (child.isMesh && child.material) {
      // Clone material to avoid affecting other instances
      child.material = child.material.clone();
      
      // If material has a texture, ensure it's cloned and visible
      if (child.material.map) {
        // Clone texture to avoid sharing
        child.material.map = child.material.map.clone();
        // Set color to white so texture shows at full brightness
        // (MTL file has Kd 0,0,0 which would darken the texture)
        child.material.color.setHex(0xffffff);
        // Apply very subtle team color tint (98% white, 2% team color)
        const teamColor = new THREE.Color(color);
        teamColor.lerp(new THREE.Color(0xffffff), 0.98);
        child.material.color.multiply(teamColor);
      } else {
        // If no texture, set the color directly
        child.material.color = new THREE.Color(color);
      }
    }
  });
  
  return camel;
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
    'sphere': { create: makeSphereUnit, yOffset: 0.05, type: 'sphere' }, // Camel model (feet at y=0)
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
 * Team 1: camel (replaces sphere), Team 2: cube, Team 3: triangle
 */
export async function spawnTeams(scene, terrain) {
  // Load camel model before creating units
  await loadCamelModel();
  
  const teams = {
    team1: createTeamUnits(scene, terrain, 'team1', 2, 2, 'sphere'),      // Top-left: camel (sphere type)
    team2: createTeamUnits(scene, terrain, 'team2', 2, 13, 'cube'),     // Top-right: cube
    team3: createTeamUnits(scene, terrain, 'team3', 13, 2, 'triangle'), // Bottom-left: triangle
  };
  
  return teams;
}
