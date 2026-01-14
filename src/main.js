// Entry point for School Wars 3D
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { setupCameraController } from './cameraController.js';
import { setupLights } from './lightController.js';
import { buildSceneContent } from './scene.js';
import { GameLogic } from './gameLogic.js';
import { setupInput } from './input.js';
import { initializeShaderController, setShaderMode, cycleShaderMode, getShaderMode, resizeShaderController, updateCelToonParams, updateChromaticAberrationParams, SHADER_MODES } from './shaderController.js';
import { getBuffGridScores } from './score.js';

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
const { hemi, directional, fillLight, spotlight, spotlightTarget, updateSpotlightRotation, setSpotlightDebugMode, getSpotlightDebugMode, toggleSpotlightHelpers, updateSpotlightHelpers } = setupLights(scene);

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
  const initialShaderMode = getShaderMode();
  updateShaderIndicator(initialShaderMode);
  
  // Apply configuration based on initial shader mode
  setTimeout(() => {
    if (initialShaderMode === SHADER_MODES.CEL_TOON) {
      applyCelToonLightingConfig();
    } else if (initialShaderMode === SHADER_MODES.NONE) {
      applyNormalShaderLightingConfig();
    }
  }, 100);
  
  // Setup shader debug panel controls
  setupShaderDebugPanel();
  
  // Setup spotlight debug panel controls
  const spotlightPanelControls = setupSpotlightPanel();
  
  // Setup lights control panel
  setupLightsPanel();
  
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

  // Day/night cycle for polish (only if not in spotlight debug mode and user hasn't manually changed lights)
  // Check if user has manually modified lights (stored in global flag)
  const isInSpotlightDebugMode = getSpotlightDebugMode && getSpotlightDebugMode() !== 0;
  const lightsManuallyModified = window.__schoolwars?.lightsManuallyModified === true;
  const dayNightCycleEnabled = document.getElementById('enableDayNightCycle')?.checked !== false;
  
  if (!isInSpotlightDebugMode && !lightsManuallyModified && dayNightCycleEnabled) {
    const time = performance.now() * 0.00005;
    directional.position.set(Math.sin(time) * 18, 14 + Math.cos(time) * 3, Math.cos(time) * 18);
    const daylight = 0.6 + 0.4 * Math.max(0.2, Math.cos(time));
    directional.intensity = daylight;
    scene.background.setHSL(0.58, 0.6, 0.65 * daylight);
    
    // Update UI sliders if they exist (so they reflect the auto-updated values)
    const dirIntensity = document.getElementById('dirIntensity');
    const dirIntensityValue = document.getElementById('dirIntensityValue');
    if (dirIntensity && dirIntensityValue) {
      dirIntensity.value = daylight.toFixed(2);
      dirIntensityValue.textContent = daylight.toFixed(2);
    }
    const dirPosX = document.getElementById('dirPosX');
    const dirPosXValue = document.getElementById('dirPosXValue');
    if (dirPosX && dirPosXValue) {
      dirPosX.value = (Math.sin(time) * 18).toFixed(1);
      dirPosXValue.textContent = (Math.sin(time) * 18).toFixed(1);
    }
    const dirPosY = document.getElementById('dirPosY');
    const dirPosYValue = document.getElementById('dirPosYValue');
    if (dirPosY && dirPosYValue) {
      dirPosY.value = (14 + Math.cos(time) * 3).toFixed(1);
      dirPosYValue.textContent = (14 + Math.cos(time) * 3).toFixed(1);
    }
    const dirPosZ = document.getElementById('dirPosZ');
    const dirPosZValue = document.getElementById('dirPosZValue');
    if (dirPosZ && dirPosZValue) {
      dirPosZ.value = (Math.cos(time) * 18).toFixed(1);
      dirPosZValue.textContent = (Math.cos(time) * 18).toFixed(1);
    }
  }
  
  // Update spotlight helpers if they exist
  if (updateSpotlightHelpers) {
    updateSpotlightHelpers();
  }

  // Only render if game is initialized
  if (game) {
    game.update(dt);
  }

  // Update buff grid scores
  if (terrain) {
    const buffScoreText = document.getElementById('buffScoreText');
    if (buffScoreText) {
      const scores = getBuffGridScores(terrain);
      buffScoreText.textContent = `Humanoids: ${scores.team2 || 0} | Animals: ${scores.team1 || 0} | Insects: ${scores.team3 || 0}`;
    }
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
      // Get camera direction in world space
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);
      
      const healthBarWorldPos = new THREE.Vector3();
      object.getWorldPosition(healthBarWorldPos);
      
      // Make health bar look at camera
      object.lookAt(cameraWorldPos);
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

// Apply Normal shader lighting configuration
function applyNormalShaderLightingConfig() {
  // Main directional light controls
  const dirIntensity = document.getElementById('dirIntensity');
  const dirIntensityValue = document.getElementById('dirIntensityValue');
  const dirEnabled = document.getElementById('dirEnabled');
  const fillIntensity = document.getElementById('fillIntensity');
  const fillIntensityValue = document.getElementById('fillIntensityValue');
  
  // Apply main directional light (disabled)
  if (dirEnabled && directional) {
    dirEnabled.checked = false;
    directional.intensity = 0;
    dirEnabled.dispatchEvent(new Event('change'));
  }
  
  // Apply fill directional light (intensity 1.11)
  if (fillIntensity && fillIntensityValue && fillLight) {
    fillIntensity.value = '1.11';
    fillIntensityValue.textContent = '1.11';
    fillLight.intensity = 1.11;
    fillIntensity.dispatchEvent(new Event('input'));
  }
}

// Apply Cel/Toon shader lighting configuration
function applyCelToonLightingConfig() {
  // Lights panel values
  const enableDayNightCycle = document.getElementById('enableDayNightCycle');
  const hemiIntensity = document.getElementById('hemiIntensity');
  const hemiIntensityValue = document.getElementById('hemiIntensityValue');
  const dirIntensity = document.getElementById('dirIntensity');
  const dirIntensityValue = document.getElementById('dirIntensityValue');
  const dirPosX = document.getElementById('dirPosX');
  const dirPosXValue = document.getElementById('dirPosXValue');
  const dirPosY = document.getElementById('dirPosY');
  const dirPosYValue = document.getElementById('dirPosYValue');
  const dirPosZ = document.getElementById('dirPosZ');
  const dirPosZValue = document.getElementById('dirPosZValue');
  const dirEnabled = document.getElementById('dirEnabled');
  const fillIntensity = document.getElementById('fillIntensity');
  const fillIntensityValue = document.getElementById('fillIntensityValue');
  const fillPosX = document.getElementById('fillPosX');
  const fillPosXValue = document.getElementById('fillPosXValue');
  const fillPosY = document.getElementById('fillPosY');
  const fillPosYValue = document.getElementById('fillPosYValue');
  const fillPosZ = document.getElementById('fillPosZ');
  const fillPosZValue = document.getElementById('fillPosZValue');
  const fillEnabled = document.getElementById('fillEnabled');
  
  // Spotlight values
  const spotlightIntensity = document.getElementById('spotlightIntensity');
  const spotlightIntensityValue = document.getElementById('spotlightIntensityValue');
  const spotlightEnabled = document.getElementById('spotlightEnabled');
  
  // Shader debug values
  const celQuantizationLevels = document.getElementById('celQuantizationLevels');
  const celQuantizationLevelsValue = document.getElementById('celQuantizationLevelsValue');
  const celEdgeThreshold = document.getElementById('celEdgeThreshold');
  const celEdgeThresholdValue = document.getElementById('celEdgeThresholdValue');
  
  // Apply day/night cycle
  if (enableDayNightCycle) {
    enableDayNightCycle.checked = false;
    window.__schoolwars = window.__schoolwars || {};
    window.__schoolwars.lightsManuallyModified = true;
  }
  
  // Apply hemisphere light (intensity only, colors stay from picker)
  if (hemiIntensity && hemiIntensityValue && hemi) {
    hemiIntensity.value = '0.30';
    hemiIntensityValue.textContent = '0.30';
    hemi.intensity = 0.30;
  }
  
  // Apply main directional light
  if (dirIntensity && dirIntensityValue && directional) {
    dirIntensity.value = '2.00';
    dirIntensityValue.textContent = '2.00';
    if (dirPosX && dirPosXValue) {
      dirPosX.value = '15.0';
      dirPosXValue.textContent = '15.0';
    }
    if (dirPosY && dirPosYValue) {
      dirPosY.value = '12.3';
      dirPosYValue.textContent = '12.3';
    }
    if (dirPosZ && dirPosZValue) {
      dirPosZ.value = '-9.9';
      dirPosZValue.textContent = '-9.9';
    }
    if (dirEnabled) {
      dirEnabled.checked = true;
    }
    directional.intensity = 2.00;
    directional.position.set(15.0, 12.3, -9.9);
    directional.castShadow = false;
  }
  
  // Apply fill directional light
  if (fillIntensity && fillIntensityValue && fillLight) {
    fillIntensity.value = '2.00';
    fillIntensityValue.textContent = '2.00';
    if (fillPosX && fillPosXValue) {
      fillPosX.value = '-8.0';
      fillPosXValue.textContent = '-8.0';
    }
    if (fillPosY && fillPosYValue) {
      fillPosY.value = '10.0';
      fillPosYValue.textContent = '10.0';
    }
    if (fillPosZ && fillPosZValue) {
      fillPosZ.value = '-6.0';
      fillPosZValue.textContent = '-6.0';
    }
    if (fillEnabled) {
      fillEnabled.checked = true;
    }
    fillLight.intensity = 2.00;
    fillLight.position.set(-8.0, 10.0, -6.0);
    fillLight.castShadow = false;
  }
  
  // Apply spotlight
  if (spotlight && spotlightTarget && updateSpotlightRotation) {
    const posX = document.getElementById('spotlightPosX');
    const posXValue = document.getElementById('spotlightPosXValue');
    const posY = document.getElementById('spotlightPosY');
    const posYValue = document.getElementById('spotlightPosYValue');
    const posZ = document.getElementById('spotlightPosZ');
    const posZValue = document.getElementById('spotlightPosZValue');
    const rotX = document.getElementById('spotlightRotX');
    const rotXValue = document.getElementById('spotlightRotXValue');
    const rotY = document.getElementById('spotlightRotY');
    const rotYValue = document.getElementById('spotlightRotYValue');
    const rotZ = document.getElementById('spotlightRotZ');
    const rotZValue = document.getElementById('spotlightRotZValue');
    
    // Update UI sliders and trigger events to update spotlight
    if (posX && posXValue) {
      posX.value = '-1.0';
      posXValue.textContent = '-1.0';
      posX.dispatchEvent(new Event('input'));
    }
    if (posY && posYValue) {
      posY.value = '19.8';
      posYValue.textContent = '19.8';
      posY.dispatchEvent(new Event('input'));
    }
    if (posZ && posZValue) {
      posZ.value = '-1.0';
      posZValue.textContent = '-1.0';
      posZ.dispatchEvent(new Event('input'));
    }
    if (rotX && rotXValue) {
      rotX.value = '-90';
      rotXValue.textContent = '-90';
      rotX.dispatchEvent(new Event('input'));
    }
    if (rotY && rotYValue) {
      rotY.value = '0';
      rotYValue.textContent = '0';
      rotY.dispatchEvent(new Event('input'));
    }
    if (rotZ && rotZValue) {
      rotZ.value = '0';
      rotZValue.textContent = '0';
      rotZ.dispatchEvent(new Event('input'));
    }
    
    // Update spotlight shadow
    spotlight.castShadow = true;
    
    if (spotlightIntensity && spotlightIntensityValue) {
      spotlightIntensity.value = '50.0';
      spotlightIntensityValue.textContent = '50.0';
      spotlightIntensity.dispatchEvent(new Event('input'));
    }
    if (spotlightEnabled) {
      spotlightEnabled.checked = true;
      spotlightEnabled.dispatchEvent(new Event('change'));
    }
  }
  
  // Apply shader debug values
  if (celQuantizationLevels && celQuantizationLevelsValue) {
    celQuantizationLevels.value = '10';
    celQuantizationLevelsValue.textContent = '10';
    updateCelToonParams(10, undefined);
  }
  if (celEdgeThreshold && celEdgeThresholdValue) {
    celEdgeThreshold.value = '0.50';
    celEdgeThresholdValue.textContent = '0.50';
    updateCelToonParams(undefined, 0.50);
  }
  
  // Trigger update functions if they exist
  if (window.__schoolwars?.spotlightPanelControls) {
    // Spotlight panel update will be triggered by the value changes above
  }
}

// Keyboard shortcuts for shader controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyG' && composer) {
    const newMode = cycleShaderMode();
    updateShaderIndicator(newMode);
    
    // Apply configuration based on shader mode
    if (newMode === SHADER_MODES.CEL_TOON) {
      applyCelToonLightingConfig();
    } else if (newMode === SHADER_MODES.NONE) {
      applyNormalShaderLightingConfig();
    }
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
  // Toggle lights control panel (I key)
  if (e.code === 'KeyI') {
    const lightsPanel = document.getElementById('lightsPanel');
    if (lightsPanel) {
      lightsPanel.classList.toggle('visible');
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
    // Initialize: helpers are disabled by default
    toggleSpotlightHelpers(false);
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
    // Initialize: force lit materials by default
    if (forceLit.checked) {
      forceLitMaterials(scene, true);
    }
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

// Setup lights control panel
function setupLightsPanel() {
  // Day/night cycle toggle
  const enableDayNightCycle = document.getElementById('enableDayNightCycle');
  
  // Hemisphere light controls
  const hemiIntensity = document.getElementById('hemiIntensity');
  const hemiIntensityValue = document.getElementById('hemiIntensityValue');
  const hemiSkyColor = document.getElementById('hemiSkyColor');
  const hemiGroundColor = document.getElementById('hemiGroundColor');
  
  // Main directional light controls
  const dirIntensity = document.getElementById('dirIntensity');
  const dirIntensityValue = document.getElementById('dirIntensityValue');
  const dirPosX = document.getElementById('dirPosX');
  const dirPosXValue = document.getElementById('dirPosXValue');
  const dirPosY = document.getElementById('dirPosY');
  const dirPosYValue = document.getElementById('dirPosYValue');
  const dirPosZ = document.getElementById('dirPosZ');
  const dirPosZValue = document.getElementById('dirPosZValue');
  const dirColor = document.getElementById('dirColor');
  const dirEnabled = document.getElementById('dirEnabled');
  
  // Fill light controls
  const fillIntensity = document.getElementById('fillIntensity');
  const fillIntensityValue = document.getElementById('fillIntensityValue');
  const fillPosX = document.getElementById('fillPosX');
  const fillPosXValue = document.getElementById('fillPosXValue');
  const fillPosY = document.getElementById('fillPosY');
  const fillPosYValue = document.getElementById('fillPosYValue');
  const fillPosZ = document.getElementById('fillPosZ');
  const fillPosZValue = document.getElementById('fillPosZValue');
  const fillColor = document.getElementById('fillColor');
  const fillEnabled = document.getElementById('fillEnabled');
  
  // Mark that lights have been manually modified (disables day/night cycle)
  function markLightsModified() {
    window.__schoolwars = window.__schoolwars || {};
    window.__schoolwars.lightsManuallyModified = true;
    // Uncheck the day/night cycle checkbox to show it's disabled
    if (enableDayNightCycle) {
      enableDayNightCycle.checked = false;
    }
  }
  
  // Helper function to update hemisphere light
  function updateHemisphereLight() {
    if (!hemi) return;
    hemi.intensity = parseFloat(hemiIntensity.value);
    hemi.color.setHex(parseInt(hemiSkyColor.value.replace('#', ''), 16));
    hemi.groundColor.setHex(parseInt(hemiGroundColor.value.replace('#', ''), 16));
    markLightsModified();
  }
  
  // Helper function to update directional light
  function updateDirectionalLight() {
    if (!directional) return;
    const intensity = parseFloat(dirIntensity.value);
    directional.intensity = dirEnabled.checked ? intensity : 0;
    directional.position.set(
      parseFloat(dirPosX.value),
      parseFloat(dirPosY.value),
      parseFloat(dirPosZ.value)
    );
    directional.color.setHex(parseInt(dirColor.value.replace('#', ''), 16));
    markLightsModified();
  }
  
  // Helper function to update fill light
  function updateFillLight() {
    if (!fillLight) return;
    const intensity = parseFloat(fillIntensity.value);
    fillLight.intensity = fillEnabled.checked ? intensity : 0;
    fillLight.position.set(
      parseFloat(fillPosX.value),
      parseFloat(fillPosY.value),
      parseFloat(fillPosZ.value)
    );
    fillLight.color.setHex(parseInt(fillColor.value.replace('#', ''), 16));
    markLightsModified();
  }
  
  // Hemisphere light event listeners
  if (hemiIntensity && hemiIntensityValue) {
    hemiIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      hemiIntensityValue.textContent = value.toFixed(2);
      updateHemisphereLight();
    });
  }
  
  if (hemiSkyColor) {
    hemiSkyColor.addEventListener('input', () => {
      updateHemisphereLight();
    });
  }
  
  if (hemiGroundColor) {
    hemiGroundColor.addEventListener('input', () => {
      updateHemisphereLight();
    });
  }
  
  // Directional light event listeners
  if (dirIntensity && dirIntensityValue) {
    dirIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      dirIntensityValue.textContent = value.toFixed(2);
      updateDirectionalLight();
    });
  }
  
  if (dirPosX && dirPosXValue) {
    dirPosX.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      dirPosXValue.textContent = value.toFixed(1);
      updateDirectionalLight();
    });
  }
  
  if (dirPosY && dirPosYValue) {
    dirPosY.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      dirPosYValue.textContent = value.toFixed(1);
      updateDirectionalLight();
    });
  }
  
  if (dirPosZ && dirPosZValue) {
    dirPosZ.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      dirPosZValue.textContent = value.toFixed(1);
      updateDirectionalLight();
    });
  }
  
  if (dirColor) {
    dirColor.addEventListener('input', () => {
      updateDirectionalLight();
    });
  }
  
  if (dirEnabled) {
    dirEnabled.addEventListener('change', () => {
      updateDirectionalLight();
    });
  }
  
  // Fill light event listeners
  if (fillIntensity && fillIntensityValue) {
    fillIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      fillIntensityValue.textContent = value.toFixed(2);
      updateFillLight();
    });
  }
  
  if (fillPosX && fillPosXValue) {
    fillPosX.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      fillPosXValue.textContent = value.toFixed(1);
      updateFillLight();
    });
  }
  
  if (fillPosY && fillPosYValue) {
    fillPosY.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      fillPosYValue.textContent = value.toFixed(1);
      updateFillLight();
    });
  }
  
  if (fillPosZ && fillPosZValue) {
    fillPosZ.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      fillPosZValue.textContent = value.toFixed(1);
      updateFillLight();
    });
  }
  
  if (fillColor) {
    fillColor.addEventListener('input', () => {
      updateFillLight();
    });
  }
  
  if (fillEnabled) {
    fillEnabled.addEventListener('change', () => {
      updateFillLight();
    });
  }
  
  // Day/night cycle toggle event listener
  if (enableDayNightCycle) {
    enableDayNightCycle.addEventListener('change', (e) => {
      window.__schoolwars = window.__schoolwars || {};
      if (e.target.checked) {
        // Re-enable day/night cycle (reset manual modification flag)
        window.__schoolwars.lightsManuallyModified = false;
      } else {
        // Disable day/night cycle (keep current manual settings)
        window.__schoolwars.lightsManuallyModified = true;
      }
    });
    
    // Initialize: day/night cycle is disabled by default
    window.__schoolwars = window.__schoolwars || {};
    window.__schoolwars.lightsManuallyModified = true;
  }
  
  // Initialize lights with current values (but don't mark as modified on init)
  // Only mark as modified when user actually changes something
  if (hemiIntensity && hemi) {
    hemi.intensity = parseFloat(hemiIntensity.value);
    hemi.color.setHex(parseInt(hemiSkyColor.value.replace('#', ''), 16));
    hemi.groundColor.setHex(parseInt(hemiGroundColor.value.replace('#', ''), 16));
  }
  if (dirIntensity && directional) {
    const intensity = parseFloat(dirIntensity.value);
    directional.intensity = dirEnabled.checked ? intensity : 0;
    directional.position.set(
      parseFloat(dirPosX.value),
      parseFloat(dirPosY.value),
      parseFloat(dirPosZ.value)
    );
    directional.color.setHex(parseInt(dirColor.value.replace('#', ''), 16));
  }
  if (fillIntensity && fillLight) {
    const intensity = parseFloat(fillIntensity.value);
    fillLight.intensity = fillEnabled.checked ? intensity : 0;
    fillLight.position.set(
      parseFloat(fillPosX.value),
      parseFloat(fillPosY.value),
      parseFloat(fillPosZ.value)
    );
    fillLight.color.setHex(parseInt(fillColor.value.replace('#', ''), 16));
  }
}

animate();
