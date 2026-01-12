import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const TEAM_COLORS = {
  player: 0x7c3aed,
  ai1: 0x22c55e,
  ai2: 0xfacc15,
};

function makeStudent(color) {
  const geo = new THREE.CapsuleGeometry(0.25, 0.6, 6, 12);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshStandardMaterial({ color: 0x202020 }));
  head.position.y = 0.6;
  mesh.add(head);
  return mesh;
}

function makeTeacher(color) {
  const geo = new THREE.BoxGeometry(0.45, 0.9, 0.35);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), new THREE.MeshStandardMaterial({ color: 0x1e1e1e }));
  head.position.y = 0.6;
  mesh.add(head);
  return mesh;
}

function makeRobot(color) {
  const geo = new THREE.ConeGeometry(0.32, 0.9, 5);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.35 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0x444444 }));
  head.position.y = 0.55;
  mesh.add(head);
  return mesh;
}

function placeUnits(platform, count, teamId) {
  const units = [];
  for (let i = 0; i < count; i++) {
    const type = i % 3;
    const color = TEAM_COLORS[teamId];
    const mesh = type === 0 ? makeStudent(color) : type === 1 ? makeTeacher(color) : makeRobot(color);
    const spread = 0.6;
    mesh.position.set(
      platform.top.position.x + (Math.random() - 0.5) * spread,
      platform.top.position.y + 0.25,
      platform.top.position.z + (Math.random() - 0.5) * spread
    );
    mesh.userData = {
      team: teamId,
      hp: 100,
      selected: false,
      velocity: new THREE.Vector3(),
      target: null,
    };
    units.push(mesh);
  }
  return units;
}

export function spawnTeams(scene, platforms) {
  const teams = {
    player: placeUnits(platforms[0], 5, 'player'),
    ai1: placeUnits(platforms[1], 5, 'ai1'),
    ai2: placeUnits(platforms[2], 5, 'ai2'),
  };
  Object.values(teams).flat().forEach(u => scene.add(u));
  return teams;
}

