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
    
    // Check for nearby enemies and engage in combat (highest priority)
    if (engageNearbyEnemies(game, teamId, units)) {
      return; // Fighting enemies, skip other strategies
    }
    
    // Check if AI should rush player spawn (second highest priority)
    if (checkSpawnRush(game, teamId, units)) {
      return; // Rushing player spawn, skip other strategies
    }
    
    // Check for spawn defense (third priority)
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
 * Engage nearby enemies with combat orders
 * Returns true if any units were engaged in combat
 */
function engageNearbyEnemies(game, teamId, units) {
  const ENGAGEMENT_RANGE = 3.0; // Range to detect and attack enemies
  let engaged = false;
  
  // Check each unit for nearby enemies
  units.forEach(unit => {
    // Skip if already attacking
    if (unit.userData._attackTarget) return;
    
    // Find all enemy units
    const enemies = [];
    Object.entries(game.teams).forEach(([otherTeamId, otherUnits]) => {
      if (otherTeamId !== teamId) {
        enemies.push(...otherUnits);
      }
    });
    
    // Find closest enemy within engagement range
    let closestEnemy = null;
    let closestDist = ENGAGEMENT_RANGE;
    
    enemies.forEach(enemy => {
      const dist = unit.position.distanceTo(enemy.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    });
    
    // Attack closest enemy if found
    if (closestEnemy) {
      game.issueAttack([unit], closestEnemy);
      engaged = true;
    }
  });
  
  return engaged;
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
    team2: { startRow: 2, startCol: 20 },
    team3: { startRow: 20, startCol: 2 },
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
 * Check if AI should rush enemy spawn (any enemy team)
 * Returns true if spawn rush was initiated
 */
function checkSpawnRush(game, teamId, units) {
  const TEAM_BASES = {
    team1: { startRow: 2, startCol: 2 },
    team2: { startRow: 2, startCol: 20 },
    team3: { startRow: 20, startCol: 2 },
  };
  
  // Check all enemy teams
  const allTeams = ['team1', 'team2', 'team3'];
  const enemyTeams = allTeams.filter(t => t !== teamId);
  
  for (const enemyTeam of enemyTeams) {
    // Skip eliminated teams
    if (game.eliminatedTeams.has(enemyTeam)) continue;
    
    const enemyBase = TEAM_BASES[enemyTeam];
    if (!enemyBase) continue;
    
    const enemySpawnCell = game.terrain.getCell(enemyBase.startRow, enemyBase.startCol);
    if (!enemySpawnCell) continue;
    
    // Count units near enemy spawn (within 3 cells)
    const checkRadius = 3;
    let aiUnitsNearSpawn = 0;
    let enemyUnitsNearSpawn = 0;
    
    for (let dr = -checkRadius; dr <= checkRadius; dr++) {
      for (let dc = -checkRadius; dc <= checkRadius; dc++) {
        const cell = game.terrain.getCell(enemyBase.startRow + dr, enemyBase.startCol + dc);
        if (cell && cell.units) {
          cell.units.forEach(u => {
            if (!u || !u.userData || !u.userData.team) return;
            if (u.userData.team === teamId) {
              aiUnitsNearSpawn++;
            } else if (u.userData.team === enemyTeam) {
              enemyUnitsNearSpawn++;
            }
          });
        }
      }
    }
    
    // If AI has 3+ more units than enemy near their spawn, rush it
    const unitAdvantage = aiUnitsNearSpawn - enemyUnitsNearSpawn;
    if (unitAdvantage >= 3) {
      console.log(`${teamId} rushing ${enemyTeam} spawn! Advantage: ${unitAdvantage} (${aiUnitsNearSpawn} vs ${enemyUnitsNearSpawn})`);
      game.issueMove(units, enemySpawnCell.getCenter());
      return true;
    }
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
 * Spreads units across 2-3 grids to avoid clustering
 */
function executeSplitStrategy(game, teamId, units) {
  const buffGrids = findBuffGrids(game.terrain);
  const uncapturedBuffs = buffGrids.filter(g => !isBuffCapturedBy(g, teamId));
  
  if (uncapturedBuffs.length === 0) return;
  
  // Determine number of groups (2-3 based on unit count, max 2-3 units per grid)
  const maxUnitsPerGrid = 3;
  const numGroups = Math.min(
    Math.ceil(units.length / maxUnitsPerGrid),
    uncapturedBuffs.length,
    3 // Maximum 3 groups
  );
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
 * Spawn Rush Strategy: Send units to enemy spawns when we have advantage
 */
function executeSpawnRushStrategy(game, teamId, units) {
  const TEAM_BASES = {
    team1: { startRow: 2, startCol: 2 },
    team2: { startRow: 2, startCol: 20 },
    team3: { startRow: 20, startCol: 2 },
  };
  
  // Find all enemy teams
  const allTeams = ['team1', 'team2', 'team3'];
  const enemyTeams = allTeams.filter(t => t !== teamId);
  
  // Check which enemy spawn is most vulnerable
  let bestTarget = null;
  let bestAdvantage = 2; // Need at least 3+ advantage
  
  for (const enemyTeam of enemyTeams) {
    // Skip eliminated teams
    if (game.eliminatedTeams.has(enemyTeam)) continue;
    
    const enemyBase = TEAM_BASES[enemyTeam];
    if (!enemyBase) continue;
    
    const enemySpawnCell = game.terrain.getCell(enemyBase.startRow, enemyBase.startCol);
    if (!enemySpawnCell) continue;
    
    // Count nearby units (within 4 cells)
    const checkRadius = 4;
    let friendlyCount = 0;
    let enemyCount = 0;
    
    for (let dr = -checkRadius; dr <= checkRadius; dr++) {
      for (let dc = -checkRadius; dc <= checkRadius; dc++) {
        const cell = game.terrain.getCell(enemyBase.startRow + dr, enemyBase.startCol + dc);
        if (cell && cell.units) {
          cell.units.forEach(u => {
            if (!u || !u.userData || !u.userData.team) return;
            if (u.userData.team === teamId) friendlyCount++;
            else if (u.userData.team === enemyTeam) enemyCount++;
          });
        }
      }
    }
    
    const advantage = friendlyCount - enemyCount;
    if (advantage > bestAdvantage) {
      bestAdvantage = advantage;
      bestTarget = { team: enemyTeam, cell: enemySpawnCell };
    }
  }
  
  if (bestTarget && units.length >= 3) {
    // Send 50% of units to attack spawn
    const rushCount = Math.max(3, Math.ceil(units.length * 0.5));
    const rushUnits = units.slice(0, rushCount);
    const remainingUnits = units.slice(rushCount);
    
    console.log(`${teamId} executing spawn rush on ${bestTarget.team} with ${rushCount} units (advantage: ${bestAdvantage})`);
    game.issueMove(rushUnits, bestTarget.cell.getCenter());
    
    // Remaining units capture buffs with spread strategy
    if (remainingUnits.length > 0) {
      executeSplitStrategy(game, teamId, remainingUnits);
    }
  } else {
    // No good target, fall back to split strategy
    executeSplitStrategy(game, teamId, units);
  }
}

