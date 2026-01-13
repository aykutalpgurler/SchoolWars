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
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows for better quality
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
const { directional, spotlight, spotlightTarget, updateSpotlightRotation, setSpotlightDebugMode, getSpotlightDebugMode, toggleSpotlightHelpers, updateSpotlightHelpers } = setupLights(scene);

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
  
  // Setup spotlight debug panel controls
  const spotlightPanelControls = setupSpotlightPanel();
  
  // Diagnose lighting materials and ensure shadows are enabled
  diagnoseLighting(scene);
  ensureShadowsOnTerrain(terrain);

  // Expose for debug in console (store controls globally for animate loop access)
  window.__schoolwars = { scene, camera, renderer, terrain, composer, spotlight, spotlightPanelControls };
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

  // Day/night cycle for polish (only if not in spotlight debug mode)
  const isInSpotlightDebugMode = getSpotlightDebugMode && getSpotlightDebugMode() !== 0;
  if (!isInSpotlightDebugMode) {
    const time = performance.now() * 0.00005;
    directional.position.set(Math.sin(time) * 18, 14 + Math.cos(time) * 3, Math.cos(time) * 18);
    const daylight = 0.6 + 0.4 * Math.max(0.2, Math.cos(time));
    directional.intensity = daylight;
    scene.background.setHSL(0.58, 0.6, 0.65 * daylight);
  }
  
  // Update spotlight helpers if they exist
  if (updateSpotlightHelpers) {
    updateSpotlightHelpers();
  }

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
  // Check bypassPostFX flag from spotlight panel
  const shouldBypass = window.__schoolwars?.bypassPostFX === true;
  if (composer && !shouldBypass) {
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
  // Toggle spotlight debug panel
  if (e.code === 'KeyL') {
    const spotlightPanel = document.getElementById('spotlightPanel');
    if (spotlightPanel) {
      spotlightPanel.classList.toggle('visible');
    }
  }
  // Toggle spotlight helpers (K key)
  if (e.code === 'KeyK') {
    const showHelpers = document.getElementById('spotlightShowHelpers');
    if (showHelpers) {
      showHelpers.checked = !showHelpers.checked;
      showHelpers.dispatchEvent(new Event('change'));
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

// Material diagnosis function - analyzes scene for lighting compatibility
function diagnoseLighting(scene) {
  const materialCounts = {};
  const unlitMeshes = [];
  let totalMeshes = 0;

  scene.traverse((object) => {
    if (object.isMesh && object.material) {
      totalMeshes++;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const materialType = material.type || 'Unknown';
      
      materialCounts[materialType] = (materialCounts[materialType] || 0) + 1;
      
      // Detect unlit materials
      if (materialType === 'MeshBasicMaterial') {
        unlitMeshes.push({
          name: object.name || object.uuid.substring(0, 8),
          type: materialType,
          isTerrain: object.userData?.isTerrain || false
        });
      } else if (materialType === 'ShaderMaterial') {
        // ShaderMaterial might or might not respond to lights - just warn
        unlitMeshes.push({
          name: object.name || object.uuid.substring(0, 8),
          type: materialType,
          isTerrain: object.userData?.isTerrain || false,
          warning: 'May not respond to lights'
        });
      }
    }
  });

  // Print diagnostic report
  console.log('=== LIGHTING DIAGNOSTIC REPORT ===');
  console.log(`Total meshes: ${totalMeshes}`);
  console.log('Material type counts:');
  Object.entries(materialCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  if (unlitMeshes.length > 0) {
    console.warn(`\n⚠️ Found ${unlitMeshes.length} meshes with unlit materials:`);
    unlitMeshes.slice(0, 10).forEach(mesh => {
      const terrainNote = mesh.isTerrain ? ' (TERRAIN)' : '';
      const warning = mesh.warning ? ` - ${mesh.warning}` : '';
      console.warn(`  - ${mesh.name}: ${mesh.type}${terrainNote}${warning}`);
    });
    if (unlitMeshes.length > 10) {
      console.warn(`  ... and ${unlitMeshes.length - 10} more`);
    }
    console.warn('\n💡 Use "Force Lit Materials (Debug)" in spotlight panel to temporarily convert MeshBasicMaterial to MeshStandardMaterial');
  } else {
    console.log('\n✅ All meshes use materials that respond to lights');
  }
  console.log('===================================\n');

  // Store diagnostic info for UI display
  window.__schoolwars = window.__schoolwars || {};
  window.__schoolwars.lightingDiagnostic = {
    totalMeshes,
    materialCounts,
    unlitCount: unlitMeshes.filter(m => m.type === 'MeshBasicMaterial').length,
    shaderMaterialCount: unlitMeshes.filter(m => m.type === 'ShaderMaterial').length
  };

  return { materialCounts, unlitMeshes, totalMeshes };
}

// Ensure terrain meshes have shadow flags set
function ensureShadowsOnTerrain(terrain) {
  if (!terrain || !terrain.gridMeshes) return;
  
  terrain.gridMeshes.forEach(mesh => {
    if (mesh && mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

// Force lit materials on all meshes (non-destructive - stores originals)
let forcedLitState = false;
const originalMaterials = new WeakMap();

function forceLitMaterials(scene, enabled) {
  if (forcedLitState === enabled) return;
  forcedLitState = enabled;

  scene.traverse((object) => {
    if (object.isMesh && object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      
      materials.forEach((material, index) => {
        if (enabled && material.type === 'MeshBasicMaterial') {
          // Store original material
          if (!originalMaterials.has(material)) {
            originalMaterials.set(material, material);
          }
          
          // Create lit material replacement
          const litMaterial = new THREE.MeshStandardMaterial({
            color: material.color ? material.color.clone() : 0xffffff,
            map: material.map || null,
            transparent: material.transparent || false,
            opacity: material.opacity !== undefined ? material.opacity : 1.0,
            side: material.side || THREE.FrontSide
          });
          
          // Replace material
          if (Array.isArray(object.material)) {
            object.material[index] = litMaterial;
          } else {
            object.material = litMaterial;
          }
        } else if (!enabled && originalMaterials.has(material)) {
          // Restore original material
          const original = originalMaterials.get(material);
          if (Array.isArray(object.material)) {
            object.material[index] = original;
          } else {
            object.material = original;
          }
        }
      });
    }
  });
}

// Enable shadows on all meshes (stores previous state for restoration)
let shadowsForcedState = false;
const originalShadowFlags = new WeakMap();

function forceShadowsOnAll(scene, enabled) {
  if (shadowsForcedState === enabled) return;
  shadowsForcedState = enabled;

  scene.traverse((object) => {
    if (object.isMesh) {
      if (enabled) {
        // Store original flags
        if (!originalShadowFlags.has(object)) {
          originalShadowFlags.set(object, {
            castShadow: object.castShadow,
            receiveShadow: object.receiveShadow
          });
        }
        // Force shadows
        object.castShadow = true;
        object.receiveShadow = true;
      } else {
        // Restore original flags
        const original = originalShadowFlags.get(object);
        if (original) {
          object.castShadow = original.castShadow;
          object.receiveShadow = original.receiveShadow;
        }
      }
    }
  });
}

// Setup spotlight debug panel controls
function setupSpotlightPanel() {
  // Position controls
  const posX = document.getElementById('spotlightPosX');
  const posXValue = document.getElementById('spotlightPosXValue');
  const posY = document.getElementById('spotlightPosY');
  const posYValue = document.getElementById('spotlightPosYValue');
  const posZ = document.getElementById('spotlightPosZ');
  const posZValue = document.getElementById('spotlightPosZValue');
  
  // Rotation controls
  const rotX = document.getElementById('spotlightRotX');
  const rotXValue = document.getElementById('spotlightRotXValue');
  const rotY = document.getElementById('spotlightRotY');
  const rotYValue = document.getElementById('spotlightRotYValue');
  const rotZ = document.getElementById('spotlightRotZ');
  const rotZValue = document.getElementById('spotlightRotZValue');
  
  // Property controls
  const intensity = document.getElementById('spotlightIntensity');
  const intensityValue = document.getElementById('spotlightIntensityValue');
  const angle = document.getElementById('spotlightAngle');
  const angleValue = document.getElementById('spotlightAngleValue');
  const penumbra = document.getElementById('spotlightPenumbra');
  const penumbraValue = document.getElementById('spotlightPenumbraValue');
  const distance = document.getElementById('spotlightDistance');
  const distanceValue = document.getElementById('spotlightDistanceValue');
  const decay = document.getElementById('spotlightDecay');
  const decayValue = document.getElementById('spotlightDecayValue');
  const enabled = document.getElementById('spotlightEnabled');
  
  // Debug controls
  const showHelpers = document.getElementById('spotlightShowHelpers');
  const debugMode = document.getElementById('spotlightDebugMode');
  const forceLit = document.getElementById('spotlightForceLit');
  const forceShadows = document.getElementById('spotlightForceShadows');
  const bypassPostFX = document.getElementById('spotlightBypassPostFX');
  
  // Current values display
  const currentPos = document.getElementById('spotlightCurrentPos');
  const currentRot = document.getElementById('spotlightCurrentRot');
  const currentIntensity = document.getElementById('spotlightCurrentIntensity');
  const diagnosticInfo = document.getElementById('spotlightDiagnosticInfo');
  
  // Helper function to update spotlight
  function updateSpotlight() {
    // Update position
    const x = parseFloat(posX.value);
    const y = parseFloat(posY.value);
    const z = parseFloat(posZ.value);
    spotlight.position.set(x, y, z);
    
    // Update rotation
    const pitch = parseFloat(rotX.value);
    const yaw = parseFloat(rotY.value);
    const roll = parseFloat(rotZ.value);
    updateSpotlightRotation(pitch, yaw, roll);
    
    // Update intensity
    const intValue = parseFloat(intensity.value);
    spotlight.intensity = enabled.checked ? intValue : 0;
    
    // Update angle (convert degrees to radians)
    const angleDeg = parseFloat(angle.value);
    spotlight.angle = THREE.MathUtils.degToRad(angleDeg);
    
    // Update penumbra
    spotlight.penumbra = parseFloat(penumbra.value);
    
    // Update distance (0 means infinite)
    const distValue = parseFloat(distance.value);
    spotlight.distance = distValue === 0 ? 0 : distValue;
    
    // Update decay
    spotlight.decay = parseFloat(decay.value);
    
    // Update matrix worlds for helpers
    spotlight.updateMatrixWorld(true);
    spotlightTarget.updateMatrixWorld(true);
    updateSpotlightHelpers();
    
    // Update current values display
    currentPos.textContent = `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
    currentRot.textContent = `(${pitch}°, ${yaw}°, ${roll}°)`;
    currentIntensity.textContent = enabled.checked ? intValue.toFixed(1) : '0.0 (off)';
  }
  
  // Update diagnostic info display
  function updateDiagnosticInfo() {
    if (window.__schoolwars?.lightingDiagnostic && diagnosticInfo) {
      const diag = window.__schoolwars.lightingDiagnostic;
      diagnosticInfo.textContent = `Meshes: ${diag.totalMeshes} | Unlit: ${diag.unlitCount} | ShaderMat: ${diag.shaderMaterialCount}`;
    }
  }
  
  // Position event listeners
  if (posX && posXValue) {
    posX.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      posXValue.textContent = value.toFixed(1);
      updateSpotlight();
    });
  }
  
  if (posY && posYValue) {
    posY.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      posYValue.textContent = value.toFixed(1);
      updateSpotlight();
    });
  }
  
  if (posZ && posZValue) {
    posZ.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      posZValue.textContent = value.toFixed(1);
      updateSpotlight();
    });
  }
  
  // Rotation event listeners
  if (rotX && rotXValue) {
    rotX.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      rotXValue.textContent = value;
      updateSpotlight();
    });
  }
  
  if (rotY && rotYValue) {
    rotY.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      rotYValue.textContent = value;
      updateSpotlight();
    });
  }
  
  if (rotZ && rotZValue) {
    rotZ.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      rotZValue.textContent = value;
      updateSpotlight();
    });
  }
  
  // Property event listeners
  if (intensity && intensityValue) {
    intensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      intensityValue.textContent = value.toFixed(1);
      updateSpotlight();
    });
  }
  
  if (angle && angleValue) {
    angle.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      angleValue.textContent = value;
      updateSpotlight();
    });
  }
  
  if (penumbra && penumbraValue) {
    penumbra.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      penumbraValue.textContent = value.toFixed(2);
      updateSpotlight();
    });
  }
  
  if (distance && distanceValue) {
    distance.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      distanceValue.textContent = value === 0 ? '∞' : value.toString();
      updateSpotlight();
    });
  }
  
  if (decay && decayValue) {
    decay.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      decayValue.textContent = value.toFixed(1);
      updateSpotlight();
    });
  }
  
  // Enabled toggle event listener
  if (enabled) {
    enabled.addEventListener('change', () => {
      updateSpotlight();
    });
  }
  
  // Debug controls event listeners
  if (showHelpers) {
    showHelpers.addEventListener('change', (e) => {
      toggleSpotlightHelpers(e.target.checked);
    });
  }
  
  if (debugMode) {
    debugMode.addEventListener('change', (e) => {
      const mode = parseInt(e.target.value);
      setSpotlightDebugMode(mode);
      
      // When entering debug mode, boost spotlight intensity if needed
      if (mode !== 0 && enabled.checked) {
        const currentInt = parseFloat(intensity.value);
        if (currentInt < 15) {
          intensity.value = '20';
          intensityValue.textContent = '20.0';
          updateSpotlight();
        }
        // Also optimize spotlight for debug visibility
        if (mode === 1) {
          angle.value = '15';
          angleValue.textContent = '15';
          penumbra.value = '0';
          penumbraValue.textContent = '0.00';
          distance.value = '0';
          distanceValue.textContent = '∞';
          decay.value = '1';
          decayValue.textContent = '1.0';
          updateSpotlight();
        }
      }
    });
  }
  
  if (forceLit) {
    forceLit.addEventListener('change', (e) => {
      forceLitMaterials(scene, e.target.checked);
    });
  }
  
  if (forceShadows) {
    forceShadows.addEventListener('change', (e) => {
      forceShadowsOnAll(scene, e.target.checked);
    });
  }
  
  if (bypassPostFX) {
    bypassPostFX.addEventListener('change', (e) => {
      window.__schoolwars = window.__schoolwars || {};
      window.__schoolwars.bypassPostFX = e.target.checked;
    });
  }
  
  // Initialize display
  updateSpotlight();
  updateDiagnosticInfo();
  
  // Update diagnostic info periodically (in case scene changes)
  setInterval(updateDiagnosticInfo, 2000);
}

animate();
