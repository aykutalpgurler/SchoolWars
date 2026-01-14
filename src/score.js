/**
 * Dedicated scoring system for buff grid control
 * Directly scans terrain to count owned grids
 */

/**
 * Count buff grids controlled by each team
 * @param {Object} terrain - The terrain object with grid cells
 * @returns {Object} Scores for each team { team1: number, team2: number, team3: number }
 */
export function getBuffGridScores(terrain) {
  const scores = { team1: 0, team2: 0, team3: 0 };
  
  if (!terrain) {
    console.error('[score.js] terrain is undefined or null');
    return scores;
  }
  
  if (!terrain.grid) {
    console.error('[score.js] terrain.grid is undefined or null');
    return scores;
  }
  
  console.log('[score.js] Scanning terrain.grid with', terrain.grid.length, 'cells');
  
  let buffCount = 0;
  let ownedCount = 0;
  
  // Scan all cells in the terrain grid
  terrain.grid.forEach(cell => {
    // Check if it's a buff grid and has an owner
    if (cell.type === 'buff') {
      buffCount++;
      if (cell.owner) {
        ownedCount++;
        console.log('[score.js] Found owned buff at row', cell.row, 'col', cell.col, 'owner:', cell.owner);
        scores[cell.owner] = (scores[cell.owner] || 0) + 1;
      }
    }
  });
  
  console.log('[score.js] Total buff grids:', buffCount, 'Owned:', ownedCount, 'Scores:', scores);
  
  return scores;
}

/**
 * Get total number of buff grids on the map
 * @param {Object} terrain - The terrain object with grid cells
 * @returns {number} Total buff grid count
 */
export function getTotalBuffGrids(terrain) {
  if (!terrain || !terrain.grid) {
    return 0;
  }
  
  let count = 0;
  terrain.grid.forEach(cell => {
    if (cell.type === 'buff') {
      count++;
    }
  });
  
  return count;
}

/**
 * Get detailed buff grid information
 * @param {Object} terrain - The terrain object
 * @returns {Array} Array of buff grid info objects
 */
export function getBuffGridDetails(terrain) {
  if (!terrain || !terrain.grid) {
    return [];
  }
  
  const buffGrids = [];
  terrain.grid.forEach(cell => {
    if (cell.type === 'buff') {
      buffGrids.push({
        row: cell.row,
        col: cell.col,
        owner: cell.owner || 'none',
        position: { x: cell.x, z: cell.z }
      });
    }
  });
  
  return buffGrids;
}
