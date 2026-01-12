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
    t.y = startCell.y + 0.1;
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
      const waypoints = path.map(cell => {
        const pos = cell.getCenter();
        return new THREE.Vector3(pos.x, pos.y, pos.z);
      });
      
      // Add final target position
      const finalTarget = target.clone();
      finalTarget.y = targetCell.y + 0.1;
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
  
  // No path found, return direct target
  return [target.clone()];
}

export function stepAlongPath(unit, dt, path, speed = 2.5) {
  if (!path || path.length === 0) return true;
  const target = path[0];
  const dir = target.clone().sub(unit.position);
  const dist = dir.length();
  if (dist < 0.05) {
    path.shift();
    return path.length === 0;
  }
  dir.normalize();
  unit.position.addScaledVector(dir, speed * dt);
  // Keep height aligned
  unit.position.y = target.y;
  return false;
}

