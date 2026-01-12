import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Multi-level pathfinding using a simple platform graph built from ramps.
export function computePath({ start, target, terrain }) {
  const platforms = terrain.platforms || [];
  const ramps = terrain.ramps || [];

  const findPlatformIndex = pos => {
    let best = { idx: -1, dist: Infinity };
    platforms.forEach((p, i) => {
      const d = p.top.position.distanceTo(pos);
      if (d < best.dist) best = { idx: i, dist: d };
    });
    return best.idx;
  };

  const startPlat = findPlatformIndex(start);
  const endPlat = findPlatformIndex(target);

  if (startPlat === -1 || endPlat === -1) {
    return [target.clone()];
  }

  if (startPlat === endPlat) {
    const t = target.clone();
    t.y = platforms[endPlat].top.position.y + 0.1;
    return [t];
  }

  // Build adjacency from ramps
  const adj = new Map();
  platforms.forEach((_, i) => adj.set(i, []));
  ramps.forEach((r, idx) => {
    adj.get(r.a).push({ to: r.b, rampIndex: idx });
    adj.get(r.b).push({ to: r.a, rampIndex: idx });
  });

  // BFS to find platform path
  const queue = [startPlat];
  const prev = new Map([[startPlat, { p: -1, ramp: -1 }]]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur === endPlat) break;
    for (const edge of adj.get(cur)) {
      if (!prev.has(edge.to)) {
        prev.set(edge.to, { p: cur, ramp: edge.rampIndex });
        queue.push(edge.to);
      }
    }
  }

  if (!prev.has(endPlat)) {
    // No path; fallback straight line
    return [target.clone()];
  }

  // Reconstruct platform sequence and ramps
  const rampSequence = [];
  let cur = endPlat;
  while (cur !== startPlat) {
    const info = prev.get(cur);
    rampSequence.push(info.ramp);
    cur = info.p;
  }
  rampSequence.reverse();

  const waypoints = [];
  
  // Track current platform for ramp waypoint generation
  let currentPlatIdx = startPlat;
  
  rampSequence.forEach(rampIdx => {
    const ramp = ramps[rampIdx];
    const platA = platforms[ramp.a];
    const platB = platforms[ramp.b];
    
    // Determine which platform is the start based on current path
    const startPlatform = (currentPlatIdx === ramp.a) ? platA : platB;
    const endPlatform = (currentPlatIdx === ramp.a) ? platB : platA;
    
    const startPos = startPlatform.top.position.clone();
    const endPos = endPlatform.top.position.clone();
    
    // Generate waypoints along the ramp surface
    // Create 4-5 waypoints distributed along the ramp
    const numWaypoints = Math.max(4, Math.ceil((startPos.distanceTo(endPos)) / 2));
    
    for (let i = 0; i <= numWaypoints; i++) {
      const t = i / numWaypoints;
      const waypoint = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      // Interpolate height linearly along the ramp
      waypoint.y = startPos.y + (endPos.y - startPos.y) * t;
      waypoints.push(waypoint);
    }
    
    // Update current platform
    currentPlatIdx = (currentPlatIdx === ramp.a) ? ramp.b : ramp.a;
  });

  const finalTarget = target.clone();
  finalTarget.y = platforms[endPlat].top.position.y + 0.1;
  waypoints.push(finalTarget);
  return waypoints;
}

export function stepAlongPath(unit, dt, path, speed = 2.5) {
  if (!path || path.length === 0) return true;
  const target = path[0];
  const dir = target.clone().sub(unit.position);
  const dist = dir.length();
  if (dist < 0.05) {
    path.shift();
    return path.length === 0;
  }
  dir.normalize();
  unit.position.addScaledVector(dir, speed * dt);
  // Keep height aligned
  unit.position.y = target.y;
  return false;
}

