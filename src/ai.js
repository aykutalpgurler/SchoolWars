const aiState = {
  team1: { 
    strategy: 'split',
    targetGrids: [],
    unitGroups: new Map(),
    lastDecision: 0,
    gameStartTime: performance.now()
  },
  team3: { 
    strategy: 'split',
    targetGrids: [],
    unitGroups: new Map(),
    lastDecision: 0,
    gameStartTime: performance.now()
  },
};

const DECISION_COOLDOWN = 2000; // 2 seconds between decisions

export function runAI(game) {
  const now = performance.now();
  
  // AI controls team1 and team3
  ['team1', 'team3'].forEach(teamId => {
    const state = aiState[teamId];
    if (!state) return;
    
    // Only make decisions every 2 seconds
    if (now - state.lastDecision < DECISION_COOLDOWN) return;
    state.lastDecision = now;
    
    const units = game.teams[teamId] || [];
    if (units.length === 0) return;
    
    // Check for spawn defense (highest priority)
    if (checkSpawnDefense(game, teamId, units)) {
      return; // Defending spawn, skip other strategies
    }
    
    // Select strategy based on game time
    const gameTime = (now - state.gameStartTime) / 1000; // seconds
    selectStrategy(state, gameTime, game, teamId);
    
    // Execute current strategy
    executeStrategy(game, teamId, units, state);
  });
}

/**
 * Find all buff grids on the map
 */
function findBuffGrids(terrain) {
  const buffGrids = [];
  const gridSize = terrain.GRID_SIZE || 17;
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cell = terrain.getCell(row, col);
      if (cell && cell.type === 'buff') {
        buffGrids.push(cell);
      }
    }
  }
  
  return buffGrids;
}

/**
 * Check if buff grid is captured by checking owner
 */
function isBuffCaptured(cell) {
  return cell.owner !== null && cell.owner !== undefined;
}

/**
 * Check if buff grid is captured by specific team
 */
function isBuffCapturedBy(cell, teamId) {
  return cell.owner === teamId;
}

/**
 * Check if buff grid is being contested (has enemy units)
 */
function isBuffContested(cell, teamId) {
  if (!cell.units || cell.units.length === 0) return false;
  return cell.units.some(u => u.userData.team !== teamId);
}

/**
 * Check if enemy is rushing our spawn and defend if needed
 */
function checkSpawnDefense(game, teamId, units) {
  const TEAM_BASES = {
    team1: { startRow: 2, startCol: 2 },
    team2: { startRow: 2, startCol: 13 },
    team3: { startRow: 13, startCol: 2 },
  };
  
  const base = TEAM_BASES[teamId];
  if (!base) return false;
  
  const spawnCell = game.terrain.getCell(base.startRow, base.startCol);
  if (!spawnCell) return false;
  
  // Check for enemy units near spawn (within 2 cells)
  const enemyUnitsNearSpawn = [];
  const checkRadius = 2;
  
  for (let dr = -checkRadius; dr <= checkRadius; dr++) {
    for (let dc = -checkRadius; dc <= checkRadius; dc++) {
      const cell = game.terrain.getCell(base.startRow + dr, base.startCol + dc);
      if (cell && cell.units) {
        cell.units.forEach(u => {
          if (u.userData.team !== teamId) {
            enemyUnitsNearSpawn.push(u);
          }
        });
      }
    }
  }
  
  // If 3+ enemies near spawn, defend
  if (enemyUnitsNearSpawn.length >= 3) {
    console.log(`${teamId} defending spawn from ${enemyUnitsNearSpawn.length} enemies!`);
    game.issueMove(units, spawnCell.getCenter());
    return true;
  }
  
  return false;
}

/**
 * Select strategy based on game state
 */
function selectStrategy(state, gameTime, game, teamId) {
  const buffGrids = findBuffGrids(game.terrain);
  const capturedByUs = buffGrids.filter(g => isBuffCapturedBy(g, teamId)).length;
  
  // Early game (0-120s): Split army
  if (gameTime < 120) {
    state.strategy = 'split';
  }
  // Mid game (120-300s): Grouped rush
  else if (gameTime < 300) {
    state.strategy = 'grouped';
  }
  // Late game (300s+): Spawn rush if we have 10+ buffs, otherwise grouped
  else {
    if (capturedByUs >= 10) {
      state.strategy = 'spawnRush';
    } else {
      state.strategy = 'grouped';
    }
  }
}

/**
 * Execute the current strategy
 */
function executeStrategy(game, teamId, units, state) {
  switch (state.strategy) {
    case 'grouped':
      executeGroupedStrategy(game, teamId, units);
      break;
    case 'split':
      executeSplitStrategy(game, teamId, units);
      break;
    case 'spawnRush':
      executeSpawnRushStrategy(game, teamId, units);
      break;
  }
}

/**
 * Grouped Strategy: Send all units to closest uncaptured buff grid
 */
function executeGroupedStrategy(game, teamId, units) {
  const buffGrids = findBuffGrids(game.terrain);
  const uncapturedBuffs = buffGrids.filter(g => !isBuffCapturedBy(g, teamId));
  
  if (uncapturedBuffs.length === 0) return; // All buffs captured
  
  // Find team center position
  const centerX = units.reduce((sum, u) => sum + u.position.x, 0) / units.length;
  const centerZ = units.reduce((sum, u) => sum + u.position.z, 0) / units.length;
  const teamCenter = { x: centerX, z: centerZ };
  
  // Find closest uncaptured buff to team center
  let closestBuff = null;
  let closestDist = Infinity;
  
  uncapturedBuffs.forEach(buff => {
    const center = buff.getCenter();
    const dx = center.x - teamCenter.x;
    const dz = center.z - teamCenter.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < closestDist) {
      closestDist = dist;
      closestBuff = buff;
    }
  });
  
  if (closestBuff) {
    game.issueMove(units, closestBuff.getCenter());
  }
}

/**
 * Split Strategy: Divide units into groups targeting different buff grids
 */
function executeSplitStrategy(game, teamId, units) {
  const buffGrids = findBuffGrids(game.terrain);
  const uncapturedBuffs = buffGrids.filter(g => !isBuffCapturedBy(g, teamId));
  
  if (uncapturedBuffs.length === 0) return;
  
  // Determine number of groups (2-3 based on unit count)
  const numGroups = units.length >= 8 ? 3 : 2;
  const groupSize = Math.ceil(units.length / numGroups);
  
  // Find closest buff grids for each group
  const targetBuffs = [];
  const teamCenter = { 
    x: units.reduce((sum, u) => sum + u.position.x, 0) / units.length,
    z: units.reduce((sum, u) => sum + u.position.z, 0) / units.length
  };
  
  for (let i = 0; i < numGroups && i < uncapturedBuffs.length; i++) {
    let closestBuff = null;
    let closestDist = Infinity;
    
    uncapturedBuffs.forEach(buff => {
      if (targetBuffs.includes(buff)) return; // Already assigned
      
      const center = buff.getCenter();
      const dx = center.x - teamCenter.x;
      const dz = center.z - teamCenter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < closestDist) {
        closestDist = dist;
        closestBuff = buff;
      }
    });
    
    if (closestBuff) {
      targetBuffs.push(closestBuff);
    }
  }
  
  // Assign units to groups
  for (let i = 0; i < targetBuffs.length; i++) {
    const start = i * groupSize;
    const end = Math.min(start + groupSize, units.length);
    const group = units.slice(start, end);
    
    if (group.length > 0) {
      game.issueMove(group, targetBuffs[i].getCenter());
    }
  }
}

/**
 * Spawn Rush Strategy: Send 3+ units to enemy spawn, rest capture buffs
 */
function executeSpawnRushStrategy(game, teamId, units) {
  const TEAM_BASES = {
    team1: { startRow: 2, startCol: 2 },
    team2: { startRow: 2, startCol: 13 },
    team3: { startRow: 13, startCol: 2 },
  };
  
  // Find enemy spawn (prioritize player team2)
  const enemyTeam = 'team2';
  const enemyBase = TEAM_BASES[enemyTeam];
  
  if (!enemyBase || units.length < 3) {
    // Not enough units, fall back to grouped
    executeGroupedStrategy(game, teamId, units);
    return;
  }
  
  const enemySpawn = game.terrain.getCell(enemyBase.startRow, enemyBase.startCol);
  if (!enemySpawn) return;
  
  // Send 3-5 units to enemy spawn
  const rushCount = Math.min(5, Math.ceil(units.length * 0.3));
  const rushUnits = units.slice(0, rushCount);
  const remainingUnits = units.slice(rushCount);
  
  // Rush units attack spawn
  game.issueMove(rushUnits, enemySpawn.getCenter());
  
  // Remaining units continue capturing buffs
  if (remainingUnits.length > 0) {
    executeGroupedStrategy(game, teamId, remainingUnits);
  }
}

