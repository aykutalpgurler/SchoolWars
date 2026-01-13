// Entry point for School Wars 3D
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { setupCameraController } from './cameraController.js';
import { setupLights } from './lightController.js';
import { buildSceneContent } from './scene.js';
import { GameLogic } from './gameLogic.js';
import { setupInput } from './input.js';

const appEl = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1b2b4f);
renderer.shadowMap.enabled = true;
// Set output color space to sRGB for correct color rendering
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Set tone mapping for better exposure
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b9ff); // bright blue sky

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(14, 16, 14);
camera.lookAt(0, 0, 0);

const cameraController = setupCameraController(camera, renderer.domElement);
const { directional, spotlight, spotlightTarget, spotlightUniforms } = setupLights(scene);

// Initialize scene content asynchronously (to load camel model)
let terrain, teams, game, input;

(async () => {
  const sceneContent = await buildSceneContent(scene);
  terrain = sceneContent.terrain;
  teams = sceneContent.teams;
  terrain.buffGrids = sceneContent.buffGrids || []; // Store buff grids in terrain for access

  // Setup game logic
  game = new GameLogic(scene, terrain);
  game.setSceneEntities({ teams });

  // Setup input
  input = setupInput({
    renderer,
    camera,
    scene,
    terrain,
    cameraController,
    game,
    spotlight,
    spotlightTarget,
  });

  // Expose for debug in console
  window.__schoolwars = { scene, camera, renderer, terrain };
})();

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

  // Only render if game is initialized
  if (game) {
    game.update(dt);
  }

  // Update debug info if unit is selected
  if (input) {
    const selected = input.selected;
    if (selected.size > 0) {
      const unit = Array.from(selected)[0];
      input.updateDebugInfo(unit);
    } else {
      input.updateDebugInfo(null);
    }
  }

  renderer.render(scene, camera);
}

animate();

