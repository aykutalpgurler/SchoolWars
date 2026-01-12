const aiState = {
  ai1: { aggression: 1.0 },
  ai2: { aggression: 1.0 },
};

export function runAI(game) {
  const targets = game.zones || [];
  if (targets.length === 0) return;

  // Simple online adaptation: if AI is behind player score, ramp aggression
  adapt(game);

  ['ai1', 'ai2'].forEach(teamId => {
    const units = game.teams[teamId] || [];
    const aggro = aiState[teamId]?.aggression || 1.0;
    units.forEach((unit, idx) => {
      const baseCooldown = 3800 - aggro * 800; // more aggression -> more frequent
      if (!unit.userData._cooldown || performance.now() - unit.userData._cooldown > baseCooldown + idx * 150) {
        unit.userData._cooldown = performance.now();
        const zone = pickZone(targets, unit, teamId, aggro);
        if (zone) {
          game.issueMove([unit], zone.position);
        }
      }
    });
  });
}

function adapt(game) {
  const playerScore = game.scores.player;
  const ai1Score = game.scores.ai1;
  const ai2Score = game.scores.ai2;

  aiState.ai1.aggression = clamp(0.6 + (playerScore - ai1Score) * 0.05, 0.5, 2.0);
  aiState.ai2.aggression = clamp(0.6 + (playerScore - ai2Score) * 0.05, 0.5, 2.0);
}

function pickZone(zones, unit, teamId, aggro) {
  let best = null;
  let bestScore = Infinity;
  zones.forEach(zone => {
    const d = zone.position.distanceTo(unit.position);
    const contested = zone.userData.owner && zone.userData.owner !== teamId;
    const weight = contested ? 0.8 / aggro : 1.0 / aggro;
    const score = d * weight;
    if (score < bestScore) {
      bestScore = score;
      best = zone;
    }
  });
  return best;
}

function clamp(v, a, b) {
  return Math.min(Math.max(v, a), b);
}

