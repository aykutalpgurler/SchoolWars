import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { computePath, stepAlongPath } from './pathfinding.js';
import { runAI } from './ai.js';
import { GridCollisionSystem } from './collision.js';

export class GameLogic {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.zones = terrain.zones || [];
    this.teams = terrain.teams || {};
    this.scores = { player: 0, ai1: 0, ai2: 0 };
    this.unitPaths = new Map();
    this.collisionSystem = new GridCollisionSystem(scene, terrain);
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

    // Zone control + scoring
    this.updateZones(dt);
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

