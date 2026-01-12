// Entry point for School Wars 3D
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { setupCameraController } from './cameraController.js';
import { setupLights } from './lightController.js';
import { buildSceneContent } from './scene.js';
import { createUI } from './ui.js';
import { setupInput } from './input.js';
import { GameLogic } from './gameLogic.js';

const appEl = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1b2b4f);
renderer.shadowMap.enabled = true;
appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b9ff); // bright blue sky

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(14, 16, 14);
camera.lookAt(0, 0, 0);

const cameraController = setupCameraController(camera, renderer.domElement);
const { directional, spotlight, spotlightTarget, spotlightUniforms } = setupLights(scene);
const { terrain, zones, teams, nameArea } = buildSceneContent(scene);

const game = new GameLogic(scene, terrain);
game.setSceneEntities({ zones, teams });

const ui = createUI(game, { scene, directional, spotlight, spotlightTarget, terrain });
const input = setupInput({
  renderer,
  camera,
  scene,
  terrain,
  cameraController,
  game,
  ui,
  spotlight,
  spotlightTarget,
});

// Name area flythrough state
const flyState = {
  active: false,
  mode: 'idle', // idle | toName | back
  targetingName: false,
  t: 0,
  duration: 1.2,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromQuat: new THREE.Quaternion(),
  toQuat: new THREE.Quaternion(),
  savedPos: camera.position.clone(),
  savedQuat: camera.quaternion.clone(),
};

function quatLookAt(pos, target) {
  const m = new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function startFly(toName) {
  flyState.mode = toName ? 'toName' : 'back';
  flyState.targetingName = toName;
  flyState.t = 0;
  flyState.fromPos.copy(camera.position);
  flyState.fromQuat.copy(camera.quaternion);
  if (toName) {
    flyState.savedPos.copy(camera.position);
    flyState.savedQuat.copy(camera.quaternion);
    flyState.toPos.copy(nameArea.cameraPos);
    flyState.toQuat.copy(quatLookAt(nameArea.cameraPos, nameArea.lookAt));
  } else {
    flyState.toPos.copy(flyState.savedPos);
    flyState.toQuat.copy(flyState.savedQuat);
  }
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyN') {
    if (flyState.mode === 'idle' && !flyState.active) {
      flyState.active = true;
      startFly(true);
    } else if (flyState.mode === 'idle' && flyState.active) {
      startFly(false);
    }
  }
});

window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  cameraController.update(dt);
  game.update(dt);
  ui.update(dt);

  // Handle name area flythrough
  if (flyState.mode !== 'idle') {
    flyState.t += dt;
    const alpha = Math.min(flyState.t / flyState.duration, 1);
    const smooth = 1 - Math.cos(alpha * Math.PI * 0.5);
    camera.position.lerpVectors(flyState.fromPos, flyState.toPos, smooth);
    THREE.Quaternion.slerp(flyState.fromQuat, flyState.toQuat, camera.quaternion, smooth);
    if (alpha >= 1) {
      flyState.mode = 'idle';
      if (!flyState.targetingName) {
        camera.position.copy(flyState.savedPos);
        camera.quaternion.copy(flyState.savedQuat);
        flyState.active = false;
      } else {
        flyState.active = true;
      }
    }
  }

  // Day/night cycle for polish
  const time = performance.now() * 0.00005;
  directional.position.set(Math.sin(time) * 18, 14 + Math.cos(time) * 3, Math.cos(time) * 18);
  const daylight = 0.6 + 0.4 * Math.max(0.2, Math.cos(time));
  directional.intensity = daylight;
  scene.background.setHSL(0.58, 0.6, 0.65 * daylight);

  // Pass spotlight uniforms (position, direction) to materials if needed
  if (spotlightUniforms) {
    spotlightUniforms.spotPosition.value.copy(spotlight.position);
    spotlightUniforms.spotDirection.value.copy(spotlightTarget.position).sub(spotlight.position).normalize();
    spotlightUniforms.spotIntensity.value = spotlight.intensity;
  }

  renderer.render(scene, camera);
}

animate();

// Expose for debug in console
window.__schoolwars = { scene, camera, renderer, game };

