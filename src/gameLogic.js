import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { computePath, stepAlongPath } from './pathfinding.js';
import { runAI } from './ai.js';

export class GameLogic {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.zones = terrain.zones || [];
    this.teams = terrain.teams || {};
    this.scores = { player: 0, ai1: 0, ai2: 0 };
    this.unitPaths = new Map();
  }

  setSceneEntities({ zones, teams }) {
    this.zones = zones;
    this.teams = teams;
  }

  issueMove(units, target) {
    units.forEach(unit => {
      const path = computePath({
        start: unit.position.clone(),
        target: target.clone(),
        terrain: this.terrain,
      });
      this.unitPaths.set(unit.uuid, path);
      unit.userData.target = target.clone();
    });
  }

  update(dt) {
    // Move units along paths
    Object.values(this.teams).flat().forEach(unit => {
      const path = this.unitPaths.get(unit.uuid);
      if (path && path.length > 0) {
        const done = stepAlongPath(unit, dt, path);
        if (done) this.unitPaths.delete(unit.uuid);
      }
    });

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

