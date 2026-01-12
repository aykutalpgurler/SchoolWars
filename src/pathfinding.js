import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Grid-based pathfinding using A* algorithm
export function computePath({ start, target, terrain }) {
  const grid = terrain.grid || [];
  const GRID_SIZE = terrain.GRID_SIZE || 16;
  
  // Get grid cells for start and target positions
  const startCell = terrain.getCellFromWorldPos(start.x, start.z);
  const targetCell = terrain.getCellFromWorldPos(target.x, target.z);
  
  if (!startCell || !targetCell) {
    return [target.clone()];
  }
  
  if (startCell === targetCell) {
    const t = target.clone();
    const heightScale = 0.2;
    const unitBaseHeight = 0.25;
    const cellHeight = startCell.getY() * heightScale;
    t.y = cellHeight + unitBaseHeight;
    return [t];
  }
  
  // A* pathfinding
  const openSet = [startCell];
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  
  gScore.set(startCell, 0);
  fScore.set(startCell, heuristic(startCell, targetCell));
  
  function heuristic(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }
  
  function getNeighbors(cell) {
    const neighbors = [];
    const directions = [
      { row: -1, col: 0 }, // up
      { row: 1, col: 0 },  // down
      { row: 0, col: -1 }, // left
      { row: 0, col: 1 },  // right
      { row: -1, col: -1 }, // diagonal
      { row: -1, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 },
    ];
    
    directions.forEach(dir => {
      const neighbor = terrain.getCell(cell.row + dir.row, cell.col + dir.col);
      if (neighbor && neighbor.walkable && !closedSet.has(neighbor)) {
        neighbors.push(neighbor);
      }
    });
    
    return neighbors;
  }
  
  while (openSet.length > 0) {
    // Find cell with lowest fScore
    let current = openSet[0];
    let currentIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      const f = fScore.get(openSet[i]) ?? Infinity;
      const currentF = fScore.get(current) ?? Infinity;
      if (f < currentF) {
        current = openSet[i];
        currentIdx = i;
      }
    }
    
    if (current === targetCell) {
      // Reconstruct path
      const path = [];
      let node = targetCell;
      while (node) {
        path.unshift(node);
        node = cameFrom.get(node);
      }
      
      // Convert grid cells to waypoints
      // Use cell center X/Z but let collision system handle Y
      const heightScale = 0.2;
      const unitBaseHeight = 0.25;
      const waypoints = path.map(cell => {
        const center = cell.getCenter();
        const cellHeight = cell.getY() * heightScale;
        return new THREE.Vector3(center.x, cellHeight + unitBaseHeight, center.z);
      });
      
      // Add final target position with correct height
      const finalTarget = target.clone();
      const targetHeight = targetCell.getY() * heightScale;
      finalTarget.y = targetHeight + unitBaseHeight;
      waypoints.push(finalTarget);
      
      return waypoints;
    }
    
    openSet.splice(currentIdx, 1);
    closedSet.add(current);
    
    const neighbors = getNeighbors(current);
    neighbors.forEach(neighbor => {
      if (closedSet.has(neighbor)) return;
      
      const tentativeG = (gScore.get(current) ?? Infinity) + 1;
      const neighborG = gScore.get(neighbor) ?? Infinity;
      
      if (!openSet.includes(neighbor)) {
        openSet.push(neighbor);
      } else if (tentativeG >= neighborG) {
        return;
      }
      
      cameFrom.set(neighbor, current);
      gScore.set(neighbor, tentativeG);
      fScore.set(neighbor, tentativeG + heuristic(neighbor, targetCell));
    });
  }
  
  // No path found, return direct target with correct height
  const fallbackTarget = target.clone();
  if (targetCell) {
    const heightScale = 0.2;
    const unitBaseHeight = 0.25;
    const cellHeight = targetCell.getY() * heightScale;
    fallbackTarget.y = cellHeight + unitBaseHeight;
  }
  return [fallbackTarget];
}

export function stepAlongPath(unit, dt, path, speed = 5.0) {
  if (!path || path.length === 0) return true;
  const target = path[0];
  
  // Calculate distance only in X/Z plane (ignore Y since collision system handles it)
  const dx = target.x - unit.position.x;
  const dz = target.z - unit.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  // Use larger threshold to prevent getting stuck
  if (dist < 0.2) {
    path.shift();
    // Clear stuck tracking when reaching a waypoint
    if (unit.userData._lastDist !== undefined) {
      unit.userData._lastDist = undefined;
      unit.userData._stuckTime = 0;
    }
    return path.length === 0;
  }
  
  // Safety check: if unit is making no progress (stuck), skip to next waypoint
  // This prevents infinite loops where a unit can't reach a waypoint
  if (unit.userData._lastDist !== undefined) {
    if (Math.abs(dist - unit.userData._lastDist) < 0.01) {
      unit.userData._stuckTime = (unit.userData._stuckTime || 0) + dt;
      // If stuck for more than 0.5 seconds, skip to next waypoint
      if (unit.userData._stuckTime > 0.5) {
        path.shift();
        unit.userData._lastDist = undefined;
        unit.userData._stuckTime = 0;
        return path.length === 0;
      }
    } else {
      unit.userData._stuckTime = 0;
    }
  }
  unit.userData._lastDist = dist;
  
  // Normalize direction in X/Z plane only
  const dirX = dx / dist;
  const dirZ = dz / dist;
  
  // Move in X and Z only, let collision system handle Y
  const moveDistance = speed * dt;
  unit.position.x += dirX * moveDistance;
  unit.position.z += dirZ * moveDistance;
  // Y will be set by collision system
  return false;
}

