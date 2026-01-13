import { computePath, stepAlongPath } from './pathfinding.js';
import { runAI } from './ai.js';
import { GridCollisionSystem } from './collision.js';
import { spawnUnitAtBase, TEAM_BASES } from './units.js';

export class GameLogic {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.zones = terrain.zones || [];
    this.teams = terrain.teams || {};
    this.scores = { player: 0, ai1: 0, ai2: 0 };
    this.unitPaths = new Map();
    this.collisionSystem = new GridCollisionSystem(scene, terrain);

    // Periodic spawning of new units from each team's base
    this.baseSpawnInterval = 10; // seconds (default)
    this.buffedSpawnInterval = 9; // seconds (when buff is active)
    this.spawnInterval = this.baseSpawnInterval;
    this.spawnTimer = 0;

    // Buff grid tracking
    this.buffGrids = terrain.buffGrids || [];
    // Track how long each unit has been on a buff grid: Map<unitUuid, { cell, time }>
    this.unitBuffTimers = new Map();
    this.buffActivationTime = 10; // seconds to activate buff
    this.spawnSpeedBuffActive = false; // Global buff state
  }

  setSceneEntities({ zones, teams }) {
    this.zones = zones;
    this.teams = teams;
  }

  issueMove(units, target) {
    // Only allow moving cube units (team2)
    const cubeUnits = units.filter(unit => unit.userData.type === 'cube' && unit.userData.team === 'team2');
    cubeUnits.forEach(unit => {
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
    });
  }

  update(dt) {
    // Move units along paths FIRST
    // Only move cube units (team2) - other units are controlled by AI
    const cubeUnits = (this.teams.team2 || []).filter(unit => unit.userData.type === 'cube');
    const unitsThatFinished = [];
    cubeUnits.forEach(unit => {
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

    // Update buff grid interactions
    this.updateBuffGrids(dt);

    // Periodically spawn new units at each team's base
    // Use buffed spawn interval if buff is active
    this.spawnInterval = this.spawnSpeedBuffActive ? this.buffedSpawnInterval : this.baseSpawnInterval;
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;

      Object.keys(TEAM_BASES).forEach((teamId) => {
        const unit = spawnUnitAtBase(this.scene, this.terrain, teamId);
        if (unit) {
          if (!this.teams[teamId]) this.teams[teamId] = [];
          this.teams[teamId].push(unit);
        }
      });
    }

    // Zone control + scoring
    this.updateZones(dt);
  }

  /**
   * Track units standing on buff grids and activate spawn speed buff after 10 seconds
   */
  updateBuffGrids(dt) {
    // Get all units from all teams
    const allUnits = Object.values(this.teams).flat();
    
    // Track which units are currently on buff grids
    const unitsOnBuffGrids = new Map();
    
    allUnits.forEach(unit => {
      const cell = this.terrain.getCellFromWorldPos(unit.position.x, unit.position.z);
      if (cell && cell.type === 'buff') {
        unitsOnBuffGrids.set(unit.uuid, cell);
      }
    });
    
    // Update timers for units on buff grids
    unitsOnBuffGrids.forEach((cell, unitUuid) => {
      const existing = this.unitBuffTimers.get(unitUuid);
      if (existing && existing.cell === cell) {
        // Same cell, increment timer
        existing.time += dt;
        
        // Activate buff if timer reaches threshold
        if (existing.time >= this.buffActivationTime && !this.spawnSpeedBuffActive) {
          this.spawnSpeedBuffActive = true;
          console.log('Spawn speed buff activated! Spawn time reduced from 10s to 9s');
        }
      } else {
        // New cell or different cell, start timer
        this.unitBuffTimers.set(unitUuid, { cell, time: dt });
      }
    });
    
    // Remove timers for units that left buff grids
    this.unitBuffTimers.forEach((data, unitUuid) => {
      if (!unitsOnBuffGrids.has(unitUuid)) {
        this.unitBuffTimers.delete(unitUuid);
      }
    });
  }

  updateZones(dt) {
    if (!this.zones) return;
    this.zones.forEach(zone => {
      const radius = 1.0;
      const counts = { player: 0, ai1: 0, ai2: 0 };
      Object.entries(this.teams).forEach(([teamId, units]) => {
        units.forEach(u => {
          if (u.position.distanceTo(zone.position) < radius) counts[teamId] += 1;
        });
      });
      const maxTeam = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (maxTeam[1] > 0) {
        zone.userData.owner = maxTeam[0];
        zone.material.color.setHex(maxTeam[0] === 'player' ? 0x7c3aed : maxTeam[0] === 'ai1' ? 0x22c55e : 0xfacc15);
        this.scores[maxTeam[0]] += dt;
      } else {
        zone.userData.owner = null;
        zone.material.color.setHex(0xffffff);
      }
    });
  }
}

