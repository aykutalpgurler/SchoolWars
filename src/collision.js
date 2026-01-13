import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/**
 * Collision system for units walking on grid cells using raycasting
 * Uses raycasting to find actual terrain surface height at unit positions
 */
export class GridCollisionSystem {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.heightScale = 0.2; // Match terrain height scale
    this.unitBaseHeight = 0.25; // Base height offset for units
    this.cellSize = terrain.CELL_SIZE || 1.0;
    
    // Raycaster for finding terrain surface height
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true; // Optimize: only need first hit
    
    // Reusable vectors
    this.rayOrigin = new THREE.Vector3();
    this.rayDirection = new THREE.Vector3(0, -1, 0); // Cast downward

    // Reusable vector for simple unit-unit separation when Box3 colliders intersect
    this._tmpVec = new THREE.Vector3();
  }

  /**
   * Get actual terrain surface height at world position using raycasting
   * This ensures units follow the actual mesh geometry, not just cell values
   */
  getTerrainHeightAt(worldX, worldZ) {
    // Cast ray from high above the terrain downward
    this.rayOrigin.set(worldX, 100, worldZ);
    this.raycaster.set(this.rayOrigin, this.rayDirection);
    
    // Check intersection with terrain grid meshes
    const intersects = this.raycaster.intersectObjects(this.terrain.gridMeshes || [], false);
    
    if (intersects.length > 0) {
      return intersects[0].point.y;
    }
    
    // Fallback: use cell height if raycast fails
    const cell = this.terrain.getCellFromWorldPos(worldX, worldZ);
    if (cell) {
      return cell.getY() * this.heightScale;
    }
    
    return 0;
  }

  /**
   * Check if a point is within a cell's surface boundaries (X/Z plane only)
   */
  isPointInCellSurface(pointX, pointZ, cell) {
    const halfSize = this.cellSize / 2;
    const minX = cell.x - halfSize;
    const maxX = cell.x + halfSize;
    const minZ = cell.z - halfSize;
    const maxZ = cell.z + halfSize;
    
    return pointX >= minX && pointX <= maxX && 
           pointZ >= minZ && pointZ <= maxZ;
  }

  /**
   * Update collision for a single unit using surface-based detection
   * Uses raycasting to find exact terrain height at unit position
   */
  updateUnit(unit) {
    const unitX = unit.position.x;
    const unitZ = unit.position.z;
    
    // Get the grid cell at unit's X/Z position
    const cell = this.terrain.getCellFromWorldPos(unitX, unitZ);
    
    if (!cell) {
      console.warn('Unit outside terrain bounds:', unitX, unitZ);
      return null;
    }
    
    // Get actual terrain height at this position using raycasting
    const terrainHeight = this.getTerrainHeightAt(unitX, unitZ);
    
    // Position unit on terrain surface
    unit.position.y = terrainHeight + this.unitBaseHeight;
    
    // Update cell tracking
    const previousCell = unit.userData.currentCell;
    if (previousCell !== cell) {
      // Remove from old cell
      if (previousCell) {
        previousCell.removeUnit(unit);
      }
      
      // Add to new cell
      cell.addUnit(unit);
      unit.userData.currentCell = cell;
    }
    
    return cell;
  }

  /**
   * Update collision for all units in teams
   */
  updateAllUnits(teams) {
    const allUnits = Object.values(teams).flat();

    // First, keep units glued to the terrain surface using raycasting
    allUnits.forEach(unit => {
      this.updateUnit(unit);

      // Update Box3 collider if this unit has logical data attached
      if (unit.userData && unit.userData.unit) {
        unit.userData.unit.updateCollider();
      }
    });

    // Then, resolve simple box-vs-box collisions between units using their Box3
    this._resolveUnitCollisions(allUnits);
  }

  /**
   * Get terrain height at a specific world position
   * Public method that uses raycasting for accuracy
   */
  getHeightAt(worldX, worldZ) {
    return this.getTerrainHeightAt(worldX, worldZ);
  }

  /**
   * Check if a position is walkable (cell exists and is walkable)
   */
  isWalkable(worldX, worldZ) {
    const cell = this.terrain.getCellFromWorldPos(worldX, worldZ);
    return cell && cell.walkable;
  }

  /**
   * Validate unit position is on terrain surface
   * Returns corrected position if unit has drifted
   */
  validateUnitPosition(unit) {
    const expectedHeight = this.getTerrainHeightAt(unit.position.x, unit.position.z);
    const actualHeight = unit.position.y - this.unitBaseHeight;
    const heightDiff = Math.abs(expectedHeight - actualHeight);
    
    // If unit has drifted more than threshold, correct it
    if (heightDiff > 0.1) {
      unit.position.y = expectedHeight + this.unitBaseHeight;
      return true; // Position was corrected
    }
    
    return false; // Position was valid
  }

  /**
   * Simple AABB (Box3) based collision resolution between units.
   * Uses Unit.userData.unit.collider (a THREE.Box3) and intersectsBox,
   * following the pattern from MDN:
   * https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection/Bounding_volume_collision_detection_with_THREE.js
   */
  _resolveUnitCollisions(units) {
    const n = units.length;
    for (let i = 0; i < n; i++) {
      const a = units[i];
      const aData = a.userData && a.userData.unit;
      if (!aData) continue;

      for (let j = i + 1; j < n; j++) {
        const b = units[j];
        const bData = b.userData && b.userData.unit;
        if (!bData) continue;

        if (!aData.intersects(bData)) continue;

        // Check if units are in combat with each other - skip push if they are
        const aAttackingB = a.userData._attackTarget === b;
        const bAttackingA = b.userData._attackTarget === a;
        if (aAttackingB || bAttackingA) {
          continue; // Don't push units that are fighting
        }

        // Basic separation along XZ: push units slightly apart
        this._tmpVec.subVectors(a.position, b.position);
        // Avoid zero-length vector
        if (this._tmpVec.lengthSq() === 0) {
          this._tmpVec.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        }
        this._tmpVec.y = 0;
        this._tmpVec.normalize();

        const pushDistance = 0.05;
        a.position.addScaledVector(this._tmpVec, pushDistance * 0.5);
        b.position.addScaledVector(this._tmpVec, -pushDistance * 0.5);
      }
    }
  }
}