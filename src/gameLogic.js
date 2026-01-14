import { computePath, stepAlongPath } from './pathfinding.js';
import { runAI } from './ai.js';
import { GridCollisionSystem } from './collision.js';
import { spawnUnitAtBase, TEAM_BASES, updateHealthBarVisual } from './units.js';
import { showEliminationMessage } from './ui.js';

export class GameLogic {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.zones = terrain.zones || [];
    this.teams = terrain.teams || {};
    this.buffScores = { team1: 0, team2: 0, team3: 0 }; // Buff grid count
    this.unitPaths = new Map();
    this.collisionSystem = new GridCollisionSystem(scene, terrain);
    this.gamePaused = false; // Game state flag

    // Periodic spawning of new units from each team's base
    this.baseSpawnInterval = 20; // seconds (default)
    this.teamSpawnTimers = {}; // Per-team spawn timers
    Object.keys(TEAM_BASES).forEach(teamId => {
      this.teamSpawnTimers[teamId] = 0;
    });

    // Buff grid tracking
    this.buffGrids = terrain.buffGrids || [];
    console.log('[GameLogic] Constructor - buffGrids count:', this.buffGrids.length);
    console.log('[GameLogic] Constructor - buffGrids:', this.buffGrids.map(c => ({ row: c.row, col: c.col, type: c.type, owner: c.owner })));
    // Track how long each unit has been on a buff grid: Map<unitUuid, { cell, time }>
    this.unitBuffTimers = new Map();
    this.buffActivationTime = 10; // seconds to activate buff
    this.spawnSpeedBuffActive = false; // Global buff state
    
    // Spawn grid capture tracking: Map<teamId, { enemyTeam, count, time }>
    this.spawnGridCapture = new Map();
    this.spawnGridCaptureTime = 8; // 8 seconds to eliminate team
    this.spawnGridCaptureThreshold = 3; // 3+ enemy units required
    this.eliminatedTeams = new Set(); // Track eliminated teams
    
    // Track game start time for victory timer
    this.gameStartTime = Date.now();
    
    // Color spawn grids with team colors
    this.colorSpawnGrids();

    // Initialize buff grid scores
    this.updateBuffScores();
  }

  setSceneEntities({ zones, teams }) {
    this.zones = zones;
    this.teams = teams;
  }

  /**
   * Color spawn grids with team colors
   */
  colorSpawnGrids() {
    const TEAM_COLORS = {
      team1: 0x7c3aed, // Purple (player)
      team2: 0x22c55e, // Green
      team3: 0xfacc15, // Yellow
    };
    
    Object.entries(TEAM_BASES).forEach(([teamId, base]) => {
      const spawnCell = this.terrain.getCell(base.startRow, base.startCol);
      if (spawnCell && spawnCell.mesh && TEAM_COLORS[teamId]) {
        spawnCell.mesh.material.color.setHex(TEAM_COLORS[teamId]);
        spawnCell.owner = teamId; // Mark spawn grid as owned by team
      }
    });
  }

  issueMove(units, target) {
    // Allow moving all units (player and AI controlled)
    units.forEach(unit => {
      const path = computePath({
        start: unit.position.clone(),
        target: target.clone(),
        terrain: this.terrain,
      });
      this.unitPaths.set(unit.uuid, path);
      unit.userData.target = target.clone();
      // Clear any stuck state when issuing a new move
      unit.userData._lastDist = undefined;
      unit.userData._stuckTime = 0;
      // Clear attack target so unit can move freely
      unit.userData._attackTarget = null;
      unit.userData._attackCooldown = 0;
    });
  }

  /**
   * Issue an attack order: selected units move toward an enemy
   * and will attack when in range.
   */
  issueAttack(units, target) {
    if (!target) return;

    // Allow all units to attack (not just player units)
    units.forEach(unit => {
      const path = computePath({
        start: unit.position.clone(),
        target: target.position.clone(),
        terrain: this.terrain,
      });
      this.unitPaths.set(unit.uuid, path);
      unit.userData.target = target.position.clone();

      // Set up attack targeting
      unit.userData._attackTarget = target;
      unit.userData._attackCooldown = 0;
    });

    // Ensure the enemy will fight back the closest attacker
    if (units.length > 0) {
      const attacker = units[0];
      target.userData._attackTarget = attacker;
      target.userData._attackCooldown = 0;
    }
  }

  update(dt) {
    // Skip update if game is over
    if (this.gamePaused) {
      return;
    }
    
    // Move units along paths FIRST
    // Process all units from all teams
    const allUnits = Object.values(this.teams).flat();
    const unitsThatFinished = [];
    allUnits.forEach(unit => {
      const path = this.unitPaths.get(unit.uuid);
      if (path && path.length > 0) {
        const done = stepAlongPath(unit, dt, path);
        if (done) {
          this.unitPaths.delete(unit.uuid);
          unitsThatFinished.push(unit);
        }
      }
    });

    // Update collision system after movement (snap units to grid)
    this.collisionSystem.updateAllUnits(this.teams);

    // Notify that units finished moving (for clearing selection)
    if (unitsThatFinished.length > 0 && this.onUnitsFinishedMoving) {
      this.onUnitsFinishedMoving(unitsThatFinished);
    }

    // Run basic AI
    runAI(this);

    // Handle combat between units (attacks every few seconds)
    this.updateCombat(dt);

    // Update buff grid interactions
    this.updateBuffGrids(dt);

    // Recompute buff-grid scoreboard (drives bottom-right HUD)
    this.updateBuffScores();
    
    // Check spawn grid captures for team elimination
    this.updateSpawnGridCapture(dt);

    // Periodically spawn new units at each team's base
    // Use dynamic spawn interval based on captured buff grids
    Object.keys(TEAM_BASES).forEach((teamId) => {
      // Skip eliminated teams
      if (this.eliminatedTeams.has(teamId)) return;
      
      // Increment this team's spawn timer
      this.teamSpawnTimers[teamId] += dt;
      
      // Count buff grids owned by this team
      const buffGridsOwned = this.buffGrids.filter(cell => cell.owner === teamId).length;
      const spawnReduction = buffGridsOwned * 0.5; // 0.5 seconds per buff grid
      const teamSpawnInterval = Math.max(1, this.baseSpawnInterval - spawnReduction); // Minimum 1 second
      
      if (this.teamSpawnTimers[teamId] >= teamSpawnInterval) {
        // Reset this team's timer
        this.teamSpawnTimers[teamId] = 0;
        
        // Spawn 1 unit
        const unit = spawnUnitAtBase(this.scene, this.terrain, teamId, buffGridsOwned);
        if (unit) {
          if (!this.teams[teamId]) this.teams[teamId] = [];
          this.teams[teamId].push(unit);
        }
      }
    });
  }

  /**
   * Check if enemy units are capturing spawn grids and eliminate teams after 8 seconds
   */
  updateSpawnGridCapture(dt) {
    // Check each team's spawn grid
    Object.keys(TEAM_BASES).forEach((defendingTeam) => {
      // Skip already eliminated teams
      if (this.eliminatedTeams.has(defendingTeam)) return;
      
      const base = TEAM_BASES[defendingTeam];
      const spawnCell = this.terrain.getCell(base.startRow, base.startCol);
      
      if (!spawnCell || !spawnCell.units) return;
      
      // Count enemy units on this spawn grid
      const enemyUnits = new Map(); // Map<enemyTeam, count>
      spawnCell.units.forEach(unit => {
        // Skip if unit doesn't have proper data
        if (!unit || !unit.userData || !unit.userData.team) return;
        
        const unitTeam = unit.userData.team;
        const unitLogicalData = unit.userData.unit;
        
        console.log(`[DEBUG Spawn ${defendingTeam}] Unit team: ${unitTeam}, defending: ${defendingTeam}, isDead: ${unitLogicalData?.isDead}`);
        
        // Only count living enemy units
        if (unitTeam !== defendingTeam && 
            !this.eliminatedTeams.has(unitTeam) &&
            unitLogicalData &&
            !unitLogicalData.isDead) {
          enemyUnits.set(unitTeam, (enemyUnits.get(unitTeam) || 0) + 1);
        }
      });
      
      console.log(`[DEBUG Spawn ${defendingTeam}] Enemy units:`, Array.from(enemyUnits.entries()));
      
      // Find enemy team with most units
      let maxEnemyTeam = null;
      let maxEnemyCount = 0;
      enemyUnits.forEach((count, enemyTeam) => {
        if (count > maxEnemyCount) {
          maxEnemyCount = count;
          maxEnemyTeam = enemyTeam;
        }
      });
      
      // Check if threshold is met (3+ enemy units)
      if (maxEnemyCount >= this.spawnGridCaptureThreshold) {
        const captureKey = `${defendingTeam}`;
        const existing = this.spawnGridCapture.get(captureKey);
        
        if (existing && existing.enemyTeam === maxEnemyTeam) {
          // Same enemy team, increment timer
          existing.time += dt;
          
          // Log progress every second
          if (Math.floor(existing.time) > Math.floor(existing.time - dt)) {
            const timeLeft = this.spawnGridCaptureTime - existing.time;
            console.log(`${maxEnemyTeam} capturing ${defendingTeam} spawn: ${timeLeft.toFixed(1)}s remaining (${maxEnemyCount} units)`);
          }
          
          // Eliminate team if threshold reached
          if (existing.time >= this.spawnGridCaptureTime) {
            console.log(`[ELIMINATION] ${defendingTeam} being eliminated by ${maxEnemyTeam}`);
            this.eliminateTeam(defendingTeam, maxEnemyTeam);
            this.spawnGridCapture.delete(captureKey);
          }
        } else {
          // New capture attempt or different enemy
          console.log(`${maxEnemyTeam} starting to capture ${defendingTeam} spawn with ${maxEnemyCount} units`);
          this.spawnGridCapture.set(captureKey, {
            enemyTeam: maxEnemyTeam,
            count: maxEnemyCount,
            time: dt
          });
        }
      } else {
        // Not enough enemies, reset capture
        this.spawnGridCapture.delete(`${defendingTeam}`);
      }
    });
  }

  /**
   * Eliminate a team and transfer all their buff grids to the conquering team
   */
  eliminateTeam(eliminatedTeam, conqueringTeam) {
    console.log(`[DEBUG eliminateTeam] eliminatedTeam: "${eliminatedTeam}", conqueringTeam: "${conqueringTeam}"`);
    console.log(`[DEBUG eliminateTeam] eliminatedTeam === 'team2': ${eliminatedTeam === 'team2'}`);
    
    const teamNames = {
      team1: 'Camel Team',
      team2: 'Player',
      team3: 'Ant Team'
    };
    
    const eliminatedName = teamNames[eliminatedTeam] || eliminatedTeam;
    const conqueringName = teamNames[conqueringTeam] || conqueringTeam;
    
    console.log(`${conqueringName} has eliminated ${eliminatedName}!`);
    
    // Show elimination message on screen
    showEliminationMessage(`${eliminatedName} has been ELIMINATED by ${conqueringName}!`);
    
    // Mark team as eliminated
    this.eliminatedTeams.add(eliminatedTeam);
    
    // Check for game over or victory
    if (eliminatedTeam === 'team2') {
      // Player lost (team2 is the player - cobras/snakes)
      console.log('[DEBUG] Player (team2) lost - triggering game over');
      this.triggerGameOver();
      return;
    } else {
      console.log('[DEBUG] AI team eliminated, checking for victory');
    }
    
    // Check if all AI teams are eliminated (victory)
    const aiTeams = ['team1', 'team3']; // Camel and Ant teams
    const allAIsEliminated = aiTeams.every(team => this.eliminatedTeams.has(team));
    if (allAIsEliminated) {
      console.log('[DEBUG] All AI teams eliminated - triggering victory');
      this.triggerVictory();
      return;
    }
    
    // Transfer all buff grids owned by eliminated team to conquering team
    const TEAM_COLORS = {
      team1: 0x7c3aed, // Purple
      team2: 0x22c55e, // Green
      team3: 0xfacc15, // Yellow
    };
    
    let transferredCount = 0;
    this.buffGrids.forEach(cell => {
      if (cell.owner === eliminatedTeam) {
        cell.owner = conqueringTeam;
        if (cell.mesh && TEAM_COLORS[conqueringTeam]) {
          cell.mesh.material.color.setHex(TEAM_COLORS[conqueringTeam]);
        }
        transferredCount++;
      }
    });
    
    if (transferredCount > 0) {
      console.log(`${conqueringTeam} captured ${transferredCount} buff grids from ${eliminatedTeam}`);
    }
    
    // Change spawn grid color to conquering team
    const eliminatedBase = TEAM_BASES[eliminatedTeam];
    if (eliminatedBase) {
      const spawnCell = this.terrain.getCell(eliminatedBase.startRow, eliminatedBase.startCol);
      if (spawnCell && spawnCell.mesh && TEAM_COLORS[conqueringTeam]) {
        spawnCell.mesh.material.color.setHex(TEAM_COLORS[conqueringTeam]);
        spawnCell.owner = conqueringTeam;
      }
    }
    
    // Remove all units from eliminated team
    if (this.teams[eliminatedTeam]) {
      const units = [...this.teams[eliminatedTeam]];
      units.forEach(unit => {
        this._handleUnitDeath(unit);
      });
      this.teams[eliminatedTeam] = [];
    }
  }

  triggerGameOver() {
    console.log('GAME OVER - Player has been eliminated!');
    // Pause the game
    this.gamePaused = true;
    // Show game over UI
    this.showGameEndScreen('GAME OVER', 'You have been eliminated!', '#ff0000');
  }

  triggerVictory() {
    console.log('VICTORY - All AI teams eliminated!');
    // Pause the game
    this.gamePaused = true;
    
    // Calculate time taken
    const elapsedMs = Date.now() - this.gameStartTime;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Show victory UI with time
    this.showGameEndScreen('VICTORY!', `You have conquered all enemy spawns!\n\nTime: ${timeString}`, '#00ff00');
  }

  showGameEndScreen(title, message, color) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'gameEndOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '20000';
    overlay.style.animation = 'fadeIn 0.5s ease-in';

    // Create parchment card container
    const cardContainer = document.createElement('div');
    cardContainer.style.background = '#e8c170 url(./assets/textures/parchment.png)';
    cardContainer.style.backgroundSize = 'cover';
    cardContainer.style.padding = '40px 60px';
    cardContainer.style.borderRadius = '12px';
    cardContainer.style.border = '3px solid rgba(101, 67, 33, 0.8)';
    cardContainer.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.7)';
    cardContainer.style.display = 'flex';
    cardContainer.style.flexDirection = 'column';
    cardContainer.style.alignItems = 'center';
    cardContainer.style.maxWidth = '600px';

    // Title
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.fontSize = '64px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = color === '#ff0000' ? '#654321' : '#2d5016';
    titleEl.style.textShadow = '0 2px 4px rgba(255, 255, 255, 0.3)';
    titleEl.style.marginBottom = '20px';
    titleEl.style.animation = 'scaleIn 0.5s ease-out';

    // Message
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.fontSize = '24px';
    messageEl.style.color = '#3d2817';
    messageEl.style.textShadow = '0 1px 2px rgba(255, 255, 255, 0.3)';
    messageEl.style.marginBottom = '40px';
    messageEl.style.whiteSpace = 'pre-line';
    messageEl.style.textAlign = 'center';
    messageEl.style.fontWeight = '600';

    // Restart button
    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart Game';
    restartBtn.style.fontSize = '20px';
    restartBtn.style.padding = '15px 40px';
    restartBtn.style.background = '#e8c170 url(./assets/textures/parchment.png)';
    restartBtn.style.backgroundSize = 'cover';
    restartBtn.style.color = '#3d2817';
    restartBtn.style.border = '2px solid rgba(101, 67, 33, 0.8)';
    restartBtn.style.borderRadius = '8px';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.fontWeight = 'bold';
    restartBtn.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
    restartBtn.style.transition = 'transform 0.2s';
    restartBtn.onmouseover = () => { restartBtn.style.transform = 'scale(1.05)'; };
    restartBtn.onmouseout = () => { restartBtn.style.transform = 'scale(1)'; };
    restartBtn.onclick = () => { window.location.reload(); };

    cardContainer.appendChild(titleEl);
    cardContainer.appendChild(messageEl);
    cardContainer.appendChild(restartBtn);
    overlay.appendChild(cardContainer);

    // Add animations if not present
    if (!document.getElementById('gameEndAnimations')) {
      const style = document.createElement('style');
      style.id = 'gameEndAnimations';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
  }

  /**
   * Track units standing on buff grids and activate spawn speed buff after 10 seconds
   * Multiple units on the same grid capture faster (1.3x per additional unit)
   */
  updateBuffGrids(dt) {
    // Get all units from all teams
    const allUnits = Object.values(this.teams).flat();
    
    // Track which units are currently on buff grids
    const unitsOnBuffGrids = new Map();
    
    // Count units per grid cell (for capture multiplier)
    const unitsPerCell = new Map(); // Map<cell, Map<team, count>>
    
    allUnits.forEach(unit => {
      const cell = this.terrain.getCellFromWorldPos(unit.position.x, unit.position.z);
      if (cell && cell.type === 'buff') {
        const team = unit.userData.team;
        unitsOnBuffGrids.set(unit.uuid, { cell, team });
        
        // Count units per cell per team
        if (!unitsPerCell.has(cell)) {
          unitsPerCell.set(cell, new Map());
        }
        const teamCounts = unitsPerCell.get(cell);
        teamCounts.set(team, (teamCounts.get(team) || 0) + 1);
      }
    });
    
    // Update timers for units on buff grids
    unitsOnBuffGrids.forEach(({ cell, team }, unitUuid) => {
      const existing = this.unitBuffTimers.get(unitUuid);
      
      // Calculate capture speed multiplier based on unit count
      // 1 unit = 1.0x, 2 units = 1.15x, 3 units = 1.3x, 4 units = 1.45x, etc.
      const teamCounts = unitsPerCell.get(cell);
      const unitCount = teamCounts ? (teamCounts.get(team) || 1) : 1;
      const captureMultiplier = 1.0 + ((unitCount - 1) * 0.15);
      const adjustedDt = dt * captureMultiplier;
      
      if (existing && existing.cell === cell) {
        // Same cell, increment timer with multiplier
        existing.time += adjustedDt;
        
        // Capture buff grid if timer reaches threshold
        if (existing.time >= this.buffActivationTime) {
          // Change buff grid color to team color and mark as owned
          if (cell.owner !== team) {
            console.log(`[updateBuffGrids] CAPTURING buff grid at ${cell.row},${cell.col} for ${team} (${unitCount} units, ${captureMultiplier.toFixed(1)}x speed)`);
            cell.owner = team;
            const TEAM_COLORS = {
              team1: 0x7c3aed, // Purple
              team2: 0x22c55e, // Green
              team3: 0xfacc15, // Yellow
            };
            if (cell.mesh && TEAM_COLORS[team]) {
              cell.mesh.material.color.setHex(TEAM_COLORS[team]);
            }
            const buffCount = this.buffGrids.filter(c => c.owner === team).length;
            const newSpawnTime = Math.max(1, this.baseSpawnInterval - (buffCount * 0.5));
            console.log(`${team} captured a buff grid! (Total: ${buffCount}) Spawn time: ${newSpawnTime}s`);
          }
        }
      } else {
        // New cell or different cell, start timer with multiplier
        this.unitBuffTimers.set(unitUuid, { cell, time: adjustedDt, team });
      }
    });
    
    // Remove timers for units that left buff grids
    this.unitBuffTimers.forEach((data, unitUuid) => {
      if (!unitsOnBuffGrids.has(unitUuid)) {
        this.unitBuffTimers.delete(unitUuid);
      }
    });
  }

  /**
   * Resolve combat: units with _attackTarget will deal damage every 3 seconds
   * when they are within a small range of their target.
   */
  updateCombat(dt) {
    const allUnits = Object.entries(this.teams).flatMap(([teamId, units]) =>
      units.map(u => ({ teamId, unit: u }))
    );

    const attackRange = 1.6;
    const attackPeriod = 3.0;
    const damage = 10;

    allUnits.forEach(({ teamId, unit }) => {
      const target = unit.userData._attackTarget;
      if (!target) return;

      // Ensure both units are still alive
      const selfData = unit.userData.unit;
      const targetData = target.userData?.unit;
      if (!selfData || !targetData || selfData.isDead || targetData.isDead) {
        unit.userData._attackTarget = null;
        return;
      }

      const dist = unit.position.distanceTo(target.position);
      if (dist > attackRange) return;

      // In range: tick cooldown
      const prev = unit.userData._attackCooldown ?? 0;
      const next = prev - dt;
      if (next > 0) {
        unit.userData._attackCooldown = next;
        return;
      }

      // Perform mutual damage
      targetData.takeDamage(damage);
      selfData.takeDamage(damage);

      // Update health bars
      updateHealthBarVisual(target);
      updateHealthBarVisual(unit);

      unit.userData._attackCooldown = attackPeriod;

      // Handle deaths
      if (targetData.isDead) {
        this._handleUnitDeath(target);
      }
      if (selfData.isDead) {
        this._handleUnitDeath(unit);
      }
    });
  }

  /**
   * Remove a unit from the scene, its team list, and its current cell.
   */
  _handleUnitDeath(unit) {
    // Remove from team arrays
    Object.entries(this.teams).forEach(([teamId, units]) => {
      const idx = units.indexOf(unit);
      if (idx !== -1) {
        units.splice(idx, 1);
      }
    });

    // Remove from its grid cell
    const cell = unit.userData.currentCell;
    if (cell) {
      cell.removeUnit(unit);
    }

    // Hide health bar (if any)
    if (unit.userData.healthBar) {
      unit.userData.healthBar.group.visible = false;
    }

    // Remove from scene
    if (this.scene && unit.parent) {
      this.scene.remove(unit);
    }

    unit.userData._attackTarget = null;
  }

  /**
   * Update buff grid scores
   */
  updateBuffScores() {
    this.buffScores = { team1: 0, team2: 0, team3: 0 };
    
    console.log('[updateBuffScores] Total buffGrids:', this.buffGrids.length);
    const ownedGrids = this.buffGrids.filter(c => c.owner);
    console.log('[updateBuffScores] Owned buffGrids:', ownedGrids.length);
    console.log('[updateBuffScores] Owners:', ownedGrids.map(c => ({ row: c.row, col: c.col, owner: c.owner })));
    
    // Count buff grids owned by each team
    this.buffGrids.forEach(cell => {
      if (cell.owner) {
        this.buffScores[cell.owner] = (this.buffScores[cell.owner] || 0) + 1;
      }
    });
    
    console.log('[updateBuffScores] Final scores:', this.buffScores);
  }
}

