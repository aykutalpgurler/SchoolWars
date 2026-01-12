import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/**
 * GridCell class - represents a single cell in the grid
 */
export class GridCell {
  constructor(row, col, x, y, z, mesh = null) {
    // Grid coordinates
    this.row = row;
    this.col = col;
    
    // World position
    this.x = x;
    this.y = y;
    this.z = z;
    
    // Three.js mesh reference
    this.mesh = mesh;
    
    // Grid properties
    this.walkable = true;
    this.type = 'ground'; // 'ground', 'obstacle', 'water', 'wall', etc.
    this.color = 0xffffff; // Default white
    this.height = 0;
    this.size = 1.0; // Cell size
    
    // Game properties
    this.owner = null; // For zone control
    this.units = []; // Units currently on this cell
    
    // Custom properties
    this.properties = {};
  }
  
  /**
   * Get world position as Vector3
   */
  getWorldPosition() {
    return new THREE.Vector3(this.x, this.y, this.z);
  }
  
  /**
   * Get center position (slightly above ground)
   */
  getCenter() {
    return new THREE.Vector3(this.x, this.y + 0.05, this.z);
  }
  
  /**
   * Set the cell type and update properties accordingly
   */
  setType(type) {
    this.type = type;
    
    // Set default properties based on type
    switch (type) {
      case 'ground':
        this.walkable = true;
        this.color = 0xffffff;
        this.height = 0;
        break;
      case 'obstacle':
        this.walkable = false;
        this.color = 0x888888;
        this.height = 0;
        break;
      case 'water':
        this.walkable = false;
        this.color = 0x4a90e2;
        this.height = -0.1;
        break;
      case 'wall':
        this.walkable = false;
        this.color = 0x333333;
        this.height = 0;
        break;
      default:
        this.walkable = true;
        this.color = 0xffffff;
        this.height = 0;
    }
  }
  
  /**
   * Set the cell color
   */
  setColor(color) {
    this.color = color;
    if (this.mesh && this.mesh.material) {
      if (this.mesh.material.color) {
        this.mesh.material.color.setHex(color);
      }
    }
  }
  
  /**
   * Add a unit to this cell
   */
  addUnit(unit) {
    if (!this.units.includes(unit)) {
      this.units.push(unit);
    }
  }
  
  /**
   * Remove a unit from this cell
   */
  removeUnit(unit) {
    const index = this.units.indexOf(unit);
    if (index > -1) {
      this.units.splice(index, 1);
    }
  }
  
  /**
   * Set a custom property
   */
  setProperty(key, value) {
    this.properties[key] = value;
  }
  
  /**
   * Get a custom property
   */
  getProperty(key, defaultValue = null) {
    return this.properties.hasOwnProperty(key) ? this.properties[key] : defaultValue;
  }
  
  /**
   * Check if this cell is adjacent to another cell
   */
  isAdjacent(otherCell) {
    const rowDiff = Math.abs(this.row - otherCell.row);
    const colDiff = Math.abs(this.col - otherCell.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  }
  
  /**
   * Get distance to another cell (Manhattan distance)
   */
  getDistance(otherCell) {
    return Math.abs(this.row - otherCell.row) + Math.abs(this.col - otherCell.col);
  }
  
  /**
   * Set Y height (for terrain generation)
   */
  setY(y) {
    this.y = y;
    this.height = y;
    if (this.mesh) {
      this.mesh.position.y = y;
    }
  }
  
  /**
   * Get Y height
   */
  getY() {
    return this.y;
  }
  
  /**
   * Set cell size
   */
  setSize(size) {
    this.size = size;
  }
  
  /**
   * Get cell size
   */
  getSize() {
    return this.size;
  }
}
