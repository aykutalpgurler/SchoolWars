// Entry point for School Wars 3D
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { setupCameraController } from './cameraController.js';
import { setupLights } from './lightController.js';
import { buildSceneContent } from './scene.js';
import { GameLogic } from './gameLogic.js';
import { setupInput } from './input.js';
import { initializeShaderController, setShaderMode, cycleShaderMode, getShaderMode, resizeShaderController, updateCelToonParams, updateChromaticAberrationParams, SHADER_MODES } from './shaderController.js';

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
const { directional } = setupLights(scene);

// Initialize scene content asynchronously (to load camel model)
let terrain, teams, game, input;
let composer = null;

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
    game,
  });

  // Initialize shader controller (post-processing)
  composer = await initializeShaderController(renderer, scene, camera);
  
  // Initialize shader indicator
  updateShaderIndicator(getShaderMode());
  
  // Setup shader debug panel controls
  setupShaderDebugPanel();

  // Expose for debug in console
  window.__schoolwars = { scene, camera, renderer, terrain, composer };
})();

window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) {
    resizeShaderController(innerWidth, innerHeight);
  }
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

  // Only render if game is initialized
  if (game) {
    game.update(dt);
  }

  // Update debug info if unit is selected
  if (input) {
    input.update();
    const selected = input.selected;
    if (selected.size > 0) {
      const unit = Array.from(selected)[0];
      input.updateDebugInfo(unit);
    } else {
      input.updateDebugInfo(null);
    }
  }

  // Make health bars face camera (billboard effect)
  scene.traverse((object) => {
    if (object.userData.isBillboard) {
      object.quaternion.copy(camera.quaternion);
    }
  });

  // Use composer for post-processing, or fallback to direct render
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

// Keyboard shortcuts for shader controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyG' && composer) {
    const newMode = cycleShaderMode();
    updateShaderIndicator(newMode);
  }
  // Toggle shader debug panel
  if (e.code === 'KeyT') {
    const shaderPanel = document.getElementById('shaderPanel');
    if (shaderPanel) {
      shaderPanel.classList.toggle('visible');
    }
  }
});

// Update shader mode indicator in HUD
function updateShaderIndicator(mode) {
  const scoreHud = document.getElementById('scoreHud');
  if (!scoreHud) return;
  
  let modeText = '';
  switch (mode) {
    case SHADER_MODES.CEL_TOON:
      modeText = 'Shader: Cel/Toon';
      break;
    case SHADER_MODES.CHROMATIC_ABERRATION:
      modeText = 'Shader: Chromatic Aberration';
      break;
    case SHADER_MODES.NONE:
    default:
      modeText = 'Shader: None';
      break;
  }
  
  // Add or update shader indicator
  let shaderIndicator = document.getElementById('shaderIndicator');
  if (!shaderIndicator) {
    shaderIndicator = document.createElement('div');
    shaderIndicator.id = 'shaderIndicator';
    shaderIndicator.style.marginTop = '4px';
    shaderIndicator.style.color = '#8fd3ff';
    shaderIndicator.style.fontSize = '12px';
    scoreHud.appendChild(shaderIndicator);
  }
  shaderIndicator.textContent = modeText + ' (G to cycle)';
}

// Setup shader debug panel controls
function setupShaderDebugPanel() {
  // Cel/Toon shader controls
  const celQuantizationLevels = document.getElementById('celQuantizationLevels');
  const celQuantizationLevelsValue = document.getElementById('celQuantizationLevelsValue');
  const celEdgeThreshold = document.getElementById('celEdgeThreshold');
  const celEdgeThresholdValue = document.getElementById('celEdgeThresholdValue');
  
  if (celQuantizationLevels && celQuantizationLevelsValue) {
    celQuantizationLevels.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      celQuantizationLevelsValue.textContent = value;
      updateCelToonParams(value, undefined);
    });
  }
  
  if (celEdgeThreshold && celEdgeThresholdValue) {
    celEdgeThreshold.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      celEdgeThresholdValue.textContent = value.toFixed(2);
      updateCelToonParams(undefined, value);
    });
  }
  
  // Chromatic Aberration shader controls
  const chromAberrationStrength = document.getElementById('chromAberrationStrength');
  const chromAberrationStrengthValue = document.getElementById('chromAberrationStrengthValue');
  const chromDistortionStrength = document.getElementById('chromDistortionStrength');
  const chromDistortionStrengthValue = document.getElementById('chromDistortionStrengthValue');
  
  if (chromAberrationStrength && chromAberrationStrengthValue) {
    chromAberrationStrength.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      chromAberrationStrengthValue.textContent = value.toFixed(3);
      updateChromaticAberrationParams(value, undefined);
    });
  }
  
  if (chromDistortionStrength && chromDistortionStrengthValue) {
    chromDistortionStrength.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      chromDistortionStrengthValue.textContent = value.toFixed(2);
      updateChromaticAberrationParams(undefined, value);
    });
  }
}

animate();
