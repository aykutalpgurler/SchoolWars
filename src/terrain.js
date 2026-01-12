import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Helper to merge geometries (fallback if BufferGeometryUtils not available)
function mergeGeometries(geometries) {
  if (geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1) return geometries[0];
  
  // Try to use BufferGeometryUtils if available
  if (typeof THREE.BufferGeometryUtils !== 'undefined' && THREE.BufferGeometryUtils.mergeGeometries) {
    return THREE.BufferGeometryUtils.mergeGeometries(geometries);
  }
  
  // Manual merge fallback
  const merged = geometries[0].clone();
  for (let i = 1; i < geometries.length; i++) {
    const geo = geometries[i];
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    
    const mergedPos = merged.attributes.position;
    const mergedNorm = merged.attributes.normal;
    const mergedUv = merged.attributes.uv;
    
    const oldCount = mergedPos.count;
    const newCount = oldCount + pos.count;
    
    const newPos = new Float32Array(newCount * 3);
    const newNorm = new Float32Array(newCount * 3);
    const newUv = new Float32Array(newCount * 2);
    
    newPos.set(mergedPos.array, 0);
    newNorm.set(mergedNorm.array, 0);
    newUv.set(mergedUv.array, 0);
    
    newPos.set(pos.array, oldCount * 3);
    newNorm.set(norm.array, oldCount * 3);
    newUv.set(uv.array, oldCount * 2);
    
    merged.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(newUv, 2));
    
    // Update indices - handle overflow with Uint32Array if needed
    const oldIndices = merged.index ? merged.index.array : [];
    const newIndices = geo.index ? geo.index.array : [];
    const offset = oldCount;
    const totalIndices = oldIndices.length + newIndices.length;
    
    if (newCount > 65535 || totalIndices > 65535) {
      // Use Uint32Array for large geometries
      const combinedIndices = new Uint32Array(totalIndices);
      combinedIndices.set(oldIndices, 0);
      for (let j = 0; j < newIndices.length; j++) {
        combinedIndices[oldIndices.length + j] = newIndices[j] + offset;
      }
      merged.setIndex(new THREE.BufferAttribute(combinedIndices, 1));
    } else {
      // Use Uint16Array for smaller geometries
      const combinedIndices = new Uint16Array(totalIndices);
      combinedIndices.set(oldIndices, 0);
      for (let j = 0; j < newIndices.length; j++) {
        combinedIndices[oldIndices.length + j] = newIndices[j] + offset;
      }
      merged.setIndex(new THREE.BufferAttribute(combinedIndices, 1));
    }
  }
  merged.computeBoundingSphere();
  return merged;
}

// ============================================================================
// CONFIG
// ============================================================================
const CONFIG = {
  tileSize: 4.0,        // Size of each grid tile in world units
  stepHeight: 2.0,      // Height difference between levels
  width: 32,            // Grid width (tiles)
  depth: 32,            // Grid depth (tiles)
  shaderMode: 'toon',   // 'toon' or 'phong' - will be set from UI
};

// Ramp directions: 0=none, 1=N, 2=S, 3=E, 4=W
const RAMP_NONE = 0;
const RAMP_N = 1;
const RAMP_S = 2;
const RAMP_E = 3;
const RAMP_W = 4;

// ============================================================================
// HANDCRAFTED HEIGHT MAP (terraced island)
// ============================================================================
function createHeightMap() {
  const { width, depth } = CONFIG;
  const height = Array(width).fill(null).map(() => Array(depth).fill(0));
  const walkable = Array(width).fill(null).map(() => Array(depth).fill(false));
  const ramps = Array(width).fill(null).map(() => Array(depth).fill(0));

  // Create a terraced island shape
  const centerX = width / 2;
  const centerZ = depth / 2;

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      const dx = x - centerX;
      const dz = z - centerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const maxDist = Math.min(width, depth) * 0.4;

      // Outer ring (level 0) - base level
      if (dist <= maxDist) {
        walkable[x][z] = true;
        if (dist > maxDist * 0.85) {
          height[x][z] = 0;
        }
        // Middle ring (level 1)
        else if (dist > maxDist * 0.6) {
          height[x][z] = 1;
        }
        // Inner ring (level 2)
        else if (dist > maxDist * 0.35) {
          height[x][z] = 2;
        }
        // Center plateau (level 3)
        else {
          height[x][z] = 3;
        }
      }
    }
  }

  // Controlled ramp placement: place only a few strategic ramps
  function placeRampAtBoundary(lowLevel, highLevel, preferDir) {
    // Search for a tile at lowLevel whose neighbor in preferDir is highLevel
    for (let x = 1; x < width - 1; x++) {
      for (let z = 1; z < depth - 1; z++) {
        if (!walkable[x][z] || height[x][z] !== lowLevel) continue;
        
        let nx, nz, rampDir;
        if (preferDir === 'N') {
          nx = x;
          nz = z - 1;
          rampDir = RAMP_N;
        } else if (preferDir === 'S') {
          nx = x;
          nz = z + 1;
          rampDir = RAMP_S;
        } else if (preferDir === 'E') {
          nx = x + 1;
          nz = z;
          rampDir = RAMP_E;
        } else if (preferDir === 'W') {
          nx = x - 1;
          nz = z;
          rampDir = RAMP_W;
        } else {
          continue;
        }
        
        // Check if neighbor is walkable and at highLevel
        if (nx >= 0 && nx < width && nz >= 0 && nz < depth &&
            walkable[nx][nz] && height[nx][nz] === highLevel) {
          // Place ramp on the lower tile
          ramps[x][z] = rampDir;
          return true;
        }
      }
    }
    return false;
  }

  // Place strategic ramps between levels (only 4-6 total)
  placeRampAtBoundary(0, 1, 'N'); // Level 0->1 ramp at North
  placeRampAtBoundary(1, 2, 'E'); // Level 1->2 ramp at East
  placeRampAtBoundary(2, 3, 'S'); // Level 2->3 ramp at South
  placeRampAtBoundary(1, 2, 'W'); // Optional: Level 1->2 ramp at West
  placeRampAtBoundary(0, 1, 'E'); // Optional: Level 0->1 ramp at East

  // Debug: count ramp tiles
  let rampCount = 0;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      if (ramps[x][z] !== RAMP_NONE) rampCount++;
    }
  }
  console.log('Terrain: Ramp tiles placed:', rampCount);

  // Mark specific flat tiles for zones/spawns (center of each level)
  const zoneTiles = [
    { x: Math.floor(centerX), z: Math.floor(centerZ), level: 3 }, // Center plateau
    { x: Math.floor(centerX + 6), z: Math.floor(centerZ), level: 2 }, // Level 2
    { x: Math.floor(centerX - 6), z: Math.floor(centerZ), level: 2 },
    { x: Math.floor(centerX), z: Math.floor(centerZ + 6), level: 1 }, // Level 1
    { x: Math.floor(centerX), z: Math.floor(centerZ - 6), level: 1 },
  ];

  return { height, walkable, ramps, zoneTiles };
}

// ============================================================================
// MESH BUILDING
// ============================================================================

// Helper: check if an edge is a ramp edge
function isRampEdge(tileRampDir, edgeDirChar) {
  if (tileRampDir === RAMP_NONE) return false;
  return (tileRampDir === RAMP_N && edgeDirChar === 'N') ||
         (tileRampDir === RAMP_S && edgeDirChar === 'S') ||
         (tileRampDir === RAMP_E && edgeDirChar === 'E') ||
         (tileRampDir === RAMP_W && edgeDirChar === 'W');
}

// Build ramp as explicit quad with correct corner heights
function buildRampQuad(centerX, centerZ, yBase, yNeighbor, dir, tileSize) {
  const halfSize = tileSize / 2;
  
  // Tile corners: NW, NE, SE, SW
  const corners = [
    { x: centerX - halfSize, z: centerZ - halfSize }, // NW
    { x: centerX + halfSize, z: centerZ - halfSize }, // NE
    { x: centerX + halfSize, z: centerZ + halfSize }, // SE
    { x: centerX - halfSize, z: centerZ + halfSize }, // SW
  ];
  
  // Set corner heights based on ramp direction
  let heights;
  if (dir === RAMP_N) {
    // North edge (NW, NE) at yNeighbor, South edge (SW, SE) at yBase
    heights = [yNeighbor, yNeighbor, yBase, yBase];
  } else if (dir === RAMP_S) {
    // South edge (SW, SE) at yNeighbor, North edge (NW, NE) at yBase
    heights = [yBase, yBase, yNeighbor, yNeighbor];
  } else if (dir === RAMP_E) {
    // East edge (NE, SE) at yNeighbor, West edge (NW, SW) at yBase
    heights = [yBase, yNeighbor, yNeighbor, yBase];
  } else if (dir === RAMP_W) {
    // West edge (NW, SW) at yNeighbor, East edge (NE, SE) at yBase
    heights = [yNeighbor, yBase, yBase, yNeighbor];
  } else {
    heights = [yBase, yBase, yBase, yBase];
  }
  
  // Create geometry with 4 vertices
  const positions = new Float32Array(12);
  const normals = new Float32Array(12);
  const uvs = new Float32Array(8);
  
  for (let i = 0; i < 4; i++) {
    positions[i * 3 + 0] = corners[i].x;
    positions[i * 3 + 1] = heights[i];
    positions[i * 3 + 2] = corners[i].z;
    
    uvs[i * 2 + 0] = i === 0 || i === 3 ? 0 : 1;
    uvs[i * 2 + 1] = i === 0 || i === 1 ? 1 : 0;
  }
  
  // Compute normals from triangle faces
  // Two triangles: [0,2,1] and [0,3,2] (CCW from above)
  const v0 = new THREE.Vector3(positions[0], positions[1], positions[2]);
  const v1 = new THREE.Vector3(positions[3], positions[4], positions[5]);
  const v2 = new THREE.Vector3(positions[6], positions[7], positions[8]);
  const v3 = new THREE.Vector3(positions[9], positions[10], positions[11]);
  
  // Normal for triangle 0-2-1
  const e1 = new THREE.Vector3().subVectors(v2, v0);
  const e2 = new THREE.Vector3().subVectors(v1, v0);
  const n1 = new THREE.Vector3().crossVectors(e1, e2).normalize();
  
  // Normal for triangle 0-3-2
  const e3 = new THREE.Vector3().subVectors(v3, v0);
  const e4 = new THREE.Vector3().subVectors(v2, v0);
  const n2 = new THREE.Vector3().crossVectors(e3, e4).normalize();
  
  // Average normals for shared vertices
  const avgNormal = new THREE.Vector3().addVectors(n1, n2).normalize();
  
  for (let i = 0; i < 4; i++) {
    normals[i * 3 + 0] = avgNormal.x;
    normals[i * 3 + 1] = avgNormal.y;
    normals[i * 3 + 2] = avgNormal.z;
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  
  // Indices: two triangles
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2]);
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  
  return geo;
}

function buildTerrainMesh(heightMap, shaderMaterial) {
  const { height, walkable, ramps } = heightMap;
  const { tileSize, stepHeight } = CONFIG;
  const grassGeos = [];
  const cliffGeos = [];
  const rampGeos = [];

  // Materials
  const grassMat = shaderMaterial || new THREE.MeshStandardMaterial({ color: 0x7cb342 });
  const cliffMat = shaderMaterial || new THREE.MeshStandardMaterial({ color: 0x8d6e63 });

  // Neighbor directions (defined once for reuse)
  const neighbors = [
    { dx: 0, dz: -1, dir: 'N' }, // North
    { dx: 0, dz: 1, dir: 'S' },  // South
    { dx: 1, dz: 0, dir: 'E' },  // East
    { dx: -1, dz: 0, dir: 'W' }, // West
  ];

  // Build grass tops and cliffs
  for (let x = 0; x < CONFIG.width; x++) {
    for (let z = 0; z < CONFIG.depth; z++) {
      if (!walkable[x][z]) continue;

      const h = height[x][z];
      const y = h * stepHeight;
      const rampDir = ramps[x][z];

      // Grass top quad (skip if this tile has a ramp - ramp will cover it)
      if (rampDir === RAMP_NONE) {
        const grassGeo = new THREE.PlaneGeometry(tileSize, tileSize);
        grassGeo.rotateX(-Math.PI / 2);
        grassGeo.translate(x * tileSize - (CONFIG.width * tileSize) / 2, y, z * tileSize - (CONFIG.depth * tileSize) / 2);
        grassGeos.push(grassGeo);
      }

      // Check neighbors for cliff walls
      neighbors.forEach(({ dx, dz, dir }) => {
        const nx = x + dx;
        const nz = z + dz;
        const neighborWalkable = nx >= 0 && nx < CONFIG.width && nz >= 0 && nz < CONFIG.depth && walkable[nx][nz];
        const neighborHeight = neighborWalkable ? height[nx][nz] : -1;
        const neighborY = neighborHeight >= 0 ? neighborHeight * stepHeight : -stepHeight;

        // Build cliff if neighbor is lower or outside map, AND this edge is NOT a ramp edge
        if (neighborY < y && !isRampEdge(rampDir, dir)) {
          const wallGeo = new THREE.PlaneGeometry(tileSize, y - neighborY);
          const wallY = (y + neighborY) / 2;

          if (dir === 'N') {
            wallGeo.rotateX(Math.PI / 2);
            wallGeo.translate(x * tileSize - (CONFIG.width * tileSize) / 2, wallY, z * tileSize - (CONFIG.depth * tileSize) / 2 - tileSize / 2);
          } else if (dir === 'S') {
            wallGeo.rotateX(-Math.PI / 2);
            wallGeo.translate(x * tileSize - (CONFIG.width * tileSize) / 2, wallY, z * tileSize - (CONFIG.depth * tileSize) / 2 + tileSize / 2);
          } else if (dir === 'E') {
            wallGeo.rotateY(-Math.PI / 2);
            wallGeo.translate(x * tileSize - (CONFIG.width * tileSize) / 2 + tileSize / 2, wallY, z * tileSize - (CONFIG.depth * tileSize) / 2);
          } else if (dir === 'W') {
            wallGeo.rotateY(Math.PI / 2);
            wallGeo.translate(x * tileSize - (CONFIG.width * tileSize) / 2 - tileSize / 2, wallY, z * tileSize - (CONFIG.depth * tileSize) / 2);
          }

          cliffGeos.push(wallGeo);
        }
      });

      // Build ramp geometry using explicit quad
      if (rampDir !== RAMP_NONE) {
        let nx, nz;
        if (rampDir === RAMP_N) {
          nx = x;
          nz = z - 1;
        } else if (rampDir === RAMP_S) {
          nx = x;
          nz = z + 1;
        } else if (rampDir === RAMP_E) {
          nx = x + 1;
          nz = z;
        } else if (rampDir === RAMP_W) {
          nx = x - 1;
          nz = z;
        } else {
          nx = x;
          nz = z;
        }
        
        const neighborHeight = (nx >= 0 && nx < CONFIG.width && nz >= 0 && nz < CONFIG.depth && walkable[nx][nz]) ? height[nx][nz] : h;
        const neighborY = neighborHeight * stepHeight;
        
        const centerX = x * tileSize - (CONFIG.width * tileSize) / 2;
        const centerZ = z * tileSize - (CONFIG.depth * tileSize) / 2;
        
        const rampGeo = buildRampQuad(centerX, centerZ, y, neighborY, rampDir, tileSize);
        rampGeos.push(rampGeo);
      }
    }
  }

  // Merge geometries
  const group = new THREE.Group();

  if (grassGeos.length > 0) {
    const mergedGrass = mergeGeometries(grassGeos);
    const grassMesh = new THREE.Mesh(mergedGrass, grassMat.clone());
    grassMesh.receiveShadow = true;
    group.add(grassMesh);
  }

  if (cliffGeos.length > 0) {
    const mergedCliff = mergeGeometries(cliffGeos);
    const cliffMesh = new THREE.Mesh(mergedCliff, cliffMat.clone());
    cliffMesh.castShadow = true;
    cliffMesh.receiveShadow = true;
    group.add(cliffMesh);
  }

  if (rampGeos.length > 0) {
    const mergedRamp = mergeGeometries(rampGeos);
    const rampMesh = new THREE.Mesh(mergedRamp, grassMat.clone());
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);
  }

  return group;
}

// ============================================================================
// PUBLIC API
// ============================================================================
export function buildTerrain(scene, shaderMaterial = null) {
  const heightMap = createHeightMap();
  const terrainGroup = buildTerrainMesh(heightMap, shaderMaterial);
  scene.add(terrainGroup);

  // Helper functions
  function worldToGrid(wx, wz) {
    const offsetX = (CONFIG.width * CONFIG.tileSize) / 2;
    const offsetZ = (CONFIG.depth * CONFIG.tileSize) / 2;
    const gx = Math.floor((wx + offsetX) / CONFIG.tileSize);
    const gz = Math.floor((wz + offsetZ) / CONFIG.tileSize);
    return { x: gx, z: gz };
  }

  function gridToWorld(gx, gz) {
    const offsetX = (CONFIG.width * CONFIG.tileSize) / 2;
    const offsetZ = (CONFIG.depth * CONFIG.tileSize) / 2;
    const wx = gx * CONFIG.tileSize - offsetX + CONFIG.tileSize / 2;
    const wz = gz * CONFIG.tileSize - offsetZ + CONFIG.tileSize / 2;
    return { x: wx, z: wz };
  }

  function getGroundHeight(wx, wz) {
    const { x: gx, z: gz } = worldToGrid(wx, wz);
    
    // Check bounds
    if (gx < 0 || gx >= CONFIG.width || gz < 0 || gz >= CONFIG.depth) {
      return 0; // Outside map, return base level
    }

    if (!heightMap.walkable[gx][gz]) {
      return 0;
    }

    const h = heightMap.height[gx][gz];
    const rampDir = heightMap.ramps[gx][gz];
    const baseY = h * CONFIG.stepHeight;

    // If on a ramp tile, interpolate height based on position within tile
    if (rampDir !== RAMP_NONE) {
      const { x: tileCenterX, z: tileCenterZ } = gridToWorld(gx, gz);
      const dx = wx - tileCenterX;
      const dz = wz - tileCenterZ;
      
      // Get neighbor height in ramp direction
      let neighborHeight = h;
      if (rampDir === RAMP_N && gz > 0 && heightMap.walkable[gx][gz - 1]) {
        neighborHeight = heightMap.height[gx][gz - 1];
      } else if (rampDir === RAMP_S && gz < CONFIG.depth - 1 && heightMap.walkable[gx][gz + 1]) {
        neighborHeight = heightMap.height[gx][gz + 1];
      } else if (rampDir === RAMP_E && gx < CONFIG.width - 1 && heightMap.walkable[gx + 1][gz]) {
        neighborHeight = heightMap.height[gx + 1][gz];
      } else if (rampDir === RAMP_W && gx > 0 && heightMap.walkable[gx - 1][gz]) {
        neighborHeight = heightMap.height[gx - 1][gz];
      }

      const neighborY = neighborHeight * CONFIG.stepHeight;
      const heightDiff = neighborY - baseY;
      
      // Interpolate based on position along ramp with correct direction
      let t = 0;
      if (rampDir === RAMP_N) {
        t = (-dz + CONFIG.tileSize / 2) / CONFIG.tileSize;
      } else if (rampDir === RAMP_S) {
        t = (dz + CONFIG.tileSize / 2) / CONFIG.tileSize;
      } else if (rampDir === RAMP_E) {
        t = (dx + CONFIG.tileSize / 2) / CONFIG.tileSize;
      } else if (rampDir === RAMP_W) {
        t = (-dx + CONFIG.tileSize / 2) / CONFIG.tileSize;
      }
      t = Math.max(0, Math.min(1, t));
      
      return baseY + heightDiff * t;
    }

    return baseY;
  }

  function isWalkableWorld(wx, wz) {
    const { x: gx, z: gz } = worldToGrid(wx, wz);
    if (gx < 0 || gx >= CONFIG.width || gz < 0 || gz >= CONFIG.depth) {
      return false;
    }
    return heightMap.walkable[gx][gz];
  }

  // Backwards compatibility: return object similar to old API
  return {
    group: terrainGroup,
    data: heightMap,
    getGroundHeight,
    worldToGrid,
    gridToWorld,
    isWalkableWorld,
    // Old API compatibility
    platforms: heightMap.zoneTiles.map((zt, idx) => {
      const world = gridToWorld(zt.x, zt.z);
      return {
        top: {
          position: new THREE.Vector3(world.x, getGroundHeight(world.x, world.z), world.z),
        },
        group: terrainGroup,
      };
    }),
    ramps: [], // Ramps are now part of terrain mesh
    zones: [], // Will be populated by scene.js
    teams: {}, // Will be populated by scene.js
  };
}
