import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Grid-based A* pathfinding with ramp awareness
export function computePath({ start, target, terrain }) {
  if (!terrain || !terrain.data) {
    // Fallback for old terrain API
    return [target.clone()];
  }

  const { data, worldToGrid, gridToWorld, getGroundHeight } = terrain;
  const { height, walkable, ramps } = data;

  const startGrid = worldToGrid(start.x, start.z);
  const targetGrid = worldToGrid(target.x, target.z);

  // Check if start/target are walkable
  if (!walkable[startGrid.x] || !walkable[startGrid.x][startGrid.z] ||
      !walkable[targetGrid.x] || !walkable[targetGrid.x][targetGrid.z]) {
    return [target.clone()];
  }

  // A* pathfinding
  const openSet = [{ x: startGrid.x, z: startGrid.z, g: 0, h: 0, f: 0 }];
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  const getKey = (x, z) => `${x},${z}`;
  const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

  gScore.set(getKey(startGrid.x, startGrid.z), 0);
  fScore.set(getKey(startGrid.x, startGrid.z), heuristic(startGrid, targetGrid));

  while (openSet.length > 0) {
    // Find node with lowest f score
    openSet.sort((a, b) => {
      const fa = fScore.get(getKey(a.x, a.z)) || Infinity;
      const fb = fScore.get(getKey(b.x, b.z)) || Infinity;
      return fa - fb;
    });

    const current = openSet.shift();
    const currentKey = getKey(current.x, current.z);

    if (current.x === targetGrid.x && current.z === targetGrid.z) {
      // Reconstruct path
      const path = [];
      let node = current;
      while (node) {
        const world = gridToWorld(node.x, node.z);
        const y = getGroundHeight(world.x, world.z);
        path.unshift(new THREE.Vector3(world.x, y + 0.1, world.z));
        const fromKey = cameFrom.get(getKey(node.x, node.z));
        if (!fromKey) break;
        const [nx, nz] = fromKey.split(',').map(Number);
        node = { x: nx, z: nz };
      }
      // Add final target position
      const finalY = getGroundHeight(target.x, target.z);
      path.push(new THREE.Vector3(target.x, finalY + 0.1, target.z));
      return path;
    }

    closedSet.add(currentKey);

    // Check neighbors (N, S, E, W)
    const neighbors = [
      { dx: 0, dz: -1, dir: 1 }, // N
      { dx: 0, dz: 1, dir: 2 },  // S
      { dx: 1, dz: 0, dir: 3 },  // E
      { dx: -1, dz: 0, dir: 4 }, // W
    ];

    neighbors.forEach(({ dx, dz, dir }) => {
      const nx = current.x + dx;
      const nz = current.z + dz;

      // Check bounds
      if (nx < 0 || nx >= walkable.length || nz < 0 || nz >= walkable[0].length) {
        return;
      }

      if (!walkable[nx][nz]) {
        return;
      }

      const neighborKey = getKey(nx, nz);
      if (closedSet.has(neighborKey)) {
        return;
      }

      // Check height difference
      const currentHeight = height[current.x][current.z];
      const neighborHeight = height[nx][nz];
      const heightDiff = Math.abs(currentHeight - neighborHeight);

      // Can only traverse if same height OR height diff is 1 with ramp
      if (heightDiff > 1) {
        return; // Cliff, cannot traverse
      }

      if (heightDiff === 1) {
        // Need ramp in correct direction
        const currentRamp = ramps[current.x][current.z];
        const neighborRamp = ramps[nx][nz];
        
        // Check if ramp exists from current to neighbor
        const hasRamp = (currentRamp === dir) || (neighborRamp === (dir === 1 ? 2 : dir === 2 ? 1 : dir === 3 ? 4 : 3));
        
        if (!hasRamp) {
          return; // No ramp, cannot traverse
        }
      }

      // Calculate movement cost (slightly higher for ramps)
      const moveCost = heightDiff === 1 ? 1.2 : 1.0;
      const tentativeG = (gScore.get(currentKey) || Infinity) + moveCost;

      if (!openSet.some(n => n.x === nx && n.z === nz)) {
        openSet.push({ x: nx, z: nz, g: tentativeG, h: 0, f: 0 });
      } else if (tentativeG >= (gScore.get(neighborKey) || Infinity)) {
        return; // Not a better path
      }

      // This is a better path
      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeG);
      const h = heuristic({ x: nx, z: nz }, targetGrid);
      fScore.set(neighborKey, tentativeG + h);
    });
  }

  // No path found, return direct path
  const finalY = getGroundHeight(target.x, target.z);
  return [new THREE.Vector3(target.x, finalY + 0.1, target.z)];
}

export function stepAlongPath(unit, dt, path, speed = 2.5) {
  if (!path || path.length === 0) return true;
  const target = path[0];
  const dir = target.clone().sub(unit.position);
  const dist = dir.length();
  if (dist < 0.15) {
    path.shift();
    return path.length === 0;
  }
  dir.normalize();
  unit.position.addScaledVector(dir, speed * dt);
  
  // Smoothly interpolate height to target (for ramp traversal)
  const heightDiff = target.y - unit.position.y;
  const heightSpeed = Math.abs(heightDiff) > 0.1 ? speed * 0.8 : speed;
  unit.position.y += Math.sign(heightDiff) * Math.min(Math.abs(heightDiff), heightSpeed * dt);
  
  return false;
}
