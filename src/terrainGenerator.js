import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GridCell } from './gridCell.js';

/**
 * Simple Perlin Noise implementation
 */
class PerlinNoise {
  constructor(seed = 0) {
    this.seed = seed;
    this.permutation = [];
    this.p = [];
    
    // Initialize permutation table
    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }
    
    // Shuffle using seed
    let rng = this.seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    
    // Duplicate permutation
    for (let i = 0; i < 512; i++) {
      this.permutation[i] = this.p[i & 255];
    }
  }
  
  seededRandom(seed) {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }
  
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  lerp(a, b, t) {
    return a + t * (b - a);
  }
  
  grad(hash, x, y) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const AA = this.permutation[A];
    const AB = this.permutation[A + 1];
    const B = this.permutation[X + 1] + Y;
    const BA = this.permutation[B];
    const BB = this.permutation[B + 1];
    
    return this.lerp(
      this.lerp(
        this.grad(this.permutation[AA], x, y),
        this.grad(this.permutation[BA], x - 1, y),
        u
      ),
      this.lerp(
        this.grad(this.permutation[AB], x, y - 1),
        this.grad(this.permutation[BB], x - 1, y - 1),
        u
      ),
      v
    );
  }
}

/**
 * Terrain Generator using Diamond-Square and Perlin Noise
 */
export class TerrainGenerator {
  constructor(width = 16, height = 16, cellSize = 1.0, seed = null) {
    this.WIDTH = width;
    this.HEIGHT = height;
    this.CELL_SIZE = cellSize;
    this.Rng = seed !== null ? this.seededRandom(seed) : () => Math.random();
    this.map = [];
    this.moistureMap = null;
    this.temperatureMap = null;
  }
  
  seededRandom(seed) {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }
  
  /**
   * Generate the terrain
   */
  generate() {
    // Initialize grid cells
    // Map structure: map[x][z] where x=col, z=row
    this.map = [];
    for (let x = 0; x < this.WIDTH; x++) {
      this.map[x] = [];
      for (let z = 0; z < this.HEIGHT; z++) {
        const worldX = (x - this.WIDTH / 2) * this.CELL_SIZE + this.CELL_SIZE / 2;
        const worldZ = (z - this.HEIGHT / 2) * this.CELL_SIZE + this.CELL_SIZE / 2;
        const cell = new GridCell(z, x, worldX, 0, worldZ); // row=z, col=x
        cell.setY(0); // Start with flat terrain
        cell.setSize(this.CELL_SIZE);
        cell.setColor(0xffffff); // Default white
        this.map[x][z] = cell;
      }
    }
    
    // Set 4 corners with random heights
    this.map[0][0].setY(Math.floor(this.Rng() * 10));
    this.map[this.WIDTH - 1][0].setY(Math.floor(this.Rng() * 10));
    this.map[0][this.HEIGHT - 1].setY(Math.floor(this.Rng() * 10));
    this.map[this.WIDTH - 1][this.HEIGHT - 1].setY(Math.floor(this.Rng() * 10));
    
    // Run Diamond-Square algorithm
    this.diamondSquare(0, 0, this.WIDTH - 1, this.HEIGHT - 1);
    
    // Smooth the map
    this.smoothMap(2);
    
    // Generate auxiliary maps
    this.moistureMap = this.generatePerlinMap(5.0, 42.1, 91.7);
    this.temperatureMap = this.generatePerlinMap(8.0, 13.5, 77.3);
    
    return this.map;
  }
  
  /**
   * Diamond-Square algorithm for terrain generation
   */
  diamondSquare(xMin, zMin, xMax, zMax) {
    const sizeX = xMax - xMin;
    const sizeZ = zMax - zMin;
    const halfX = Math.floor(sizeX / 2);
    const halfZ = Math.floor(sizeZ / 2);
    
    const midX = xMin + halfX;
    const midZ = zMin + halfZ;
    
    if (halfX < 1 || halfZ < 1) return;
    
    // SQUARE STEP
    const avgCornerHeight = Math.floor((
      this.map[xMin][zMin].getY() +
      this.map[xMax][zMin].getY() +
      this.map[xMin][zMax].getY() +
      this.map[xMax][zMax].getY()
    ) / 4);
    
    this.map[midX][midZ].setY(avgCornerHeight + this.randomOffset());
    
    // DIAMOND STEP
    this.setDiamond(midX, zMin, xMin, zMin, xMax, zMin, midX, midZ); // Top
    this.setDiamond(xMax, midZ, xMax, zMin, xMax, zMax, midX, midZ); // Right
    this.setDiamond(midX, zMax, xMin, zMax, xMax, zMax, midX, midZ); // Bottom
    this.setDiamond(xMin, midZ, xMin, zMin, xMin, zMax, midX, midZ); // Left
    
    // RECURSE into 4 quadrants
    this.diamondSquare(xMin, zMin, midX, midZ);
    this.diamondSquare(midX, zMin, xMax, midZ);
    this.diamondSquare(xMin, midZ, midX, zMax);
    this.diamondSquare(midX, midZ, xMax, zMax);
  }
  
  /**
   * Diamond step helper
   */
  setDiamond(x, z, x1, z1, x2, z2, centerX, centerZ) {
    let count = 0;
    let sum = 0;
    
    if (this.isInsideMap(x1, z1)) {
      sum += this.map[x1][z1].getY();
      count++;
    }
    
    if (this.isInsideMap(x2, z2)) {
      sum += this.map[x2][z2].getY();
      count++;
    }
    
    if (this.isInsideMap(centerX, centerZ)) {
      sum += this.map[centerX][centerZ].getY();
      count++;
    }
    
    if (count > 0 && this.isInsideMap(x, z)) {
      this.map[x][z].setY(Math.floor(sum / count) + this.randomOffset());
    }
  }
  
  /**
   * Check if coordinates are inside map bounds
   */
  isInsideMap(x, z) {
    return x >= 0 && x < this.WIDTH && z >= 0 && z < this.HEIGHT;
  }
  
  /**
   * Random offset for height variation
   */
  randomOffset() {
    return Math.floor(this.Rng() * 20) - 5; // Random between -2 and 2
  }
  
  /**
   * Smooth the height map using 3x3 mean filter
   */
  smoothMap(iterations = 1) {
    for (let it = 0; it < iterations; it++) {
      const newHeights = [];
      
      for (let x = 0; x < this.WIDTH; x++) {
        newHeights[x] = [];
        for (let z = 0; z < this.HEIGHT; z++) {
          let sum = 0;
          let count = 0;
          
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const nx = x + dx;
              const nz = z + dz;
              if (this.isInsideMap(nx, nz)) {
                sum += this.map[nx][nz].getY();
                count++;
              }
            }
          }
          
          newHeights[x][z] = Math.floor(sum / count);
        }
      }
      
      for (let x = 0; x < this.WIDTH; x++) {
        for (let z = 0; z < this.HEIGHT; z++) {
          this.map[x][z].setY(newHeights[x][z]);
        }
      }
    }
  }
  
  /**
   * Generate Perlin noise map
   */
  generatePerlinMap(scale, offsetX, offsetZ) {
    const noise = new PerlinNoise(Math.floor(offsetX * 1000 + offsetZ * 1000));
    const noiseMap = [];
    
    for (let x = 0; x < this.WIDTH; x++) {
      noiseMap[x] = [];
      for (let z = 0; z < this.HEIGHT; z++) {
        const sampleX = offsetX + (x / this.WIDTH) * scale;
        const sampleZ = offsetZ + (z / this.HEIGHT) * scale;
        noiseMap[x][z] = (noise.noise(sampleX, sampleZ) + 1) / 2; // Normalize to 0-1
      }
    }
    
    return noiseMap;
  }
  
  /**
   * Get cell at coordinates
   */
  getCell(x, z) {
    if (this.isInsideMap(x, z)) {
      return this.map[x][z];
    }
    return null;
  }
  
  /**
   * Get moisture value at coordinates
   */
  getMoisture(x, z) {
    if (this.moistureMap && this.isInsideMap(x, z)) {
      return this.moistureMap[x][z];
    }
    return 0;
  }
  
  /**
   * Get temperature value at coordinates
   */
  getTemperature(x, z) {
    if (this.temperatureMap && this.isInsideMap(x, z)) {
      return this.temperatureMap[x][z];
    }
    return 0;
  }
}
