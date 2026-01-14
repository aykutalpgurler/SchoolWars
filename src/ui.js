import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getBuffGridScores } from './score.js';

// Simple shader loader (fetches GLSL text once)
const shaderCache = new Map();
async function loadShader(path) {
  if (!shaderCache.has(path)) {
    const text = await fetch(path).then(r => r.text());
    shaderCache.set(path, text);
  }
  return shaderCache.get(path);
}

export function createUI(game, { scene, directional, spotlight, spotlightTarget, terrain }) {
  const shaderStatus = document.getElementById('shaderStatus');
  const buffScoreText = document.getElementById('buffScoreText');
  const appEl = document.getElementById('app');
  
  console.log('[UI] createUI called with terrain:', terrain ? 'defined' : 'undefined');
  if (terrain) {
    console.log('[UI] terrain.grid:', terrain.grid ? terrain.grid.length + ' cells' : 'undefined');
  }

  let currentShader = 'phong';
  let ready = false;
  let shaderMaterials = { phong: null, toon: null };

  // Load GLSL and build materials
  initShaders();

  async function initShaders() {
    const [phongVert, phongFrag, toonVert, toonFrag] = await Promise.all([
      loadShader('./shaders/phong.vert'),
      loadShader('./shaders/phong.frag'),
      loadShader('./shaders/toon.vert'),
      loadShader('./shaders/toon.frag'),
    ]);

    shaderMaterials.phong = makeShaderMaterial({
      vertex: phongVert,
      fragment: phongFrag,
      shininess: 48.0,
      specColor: new THREE.Color(0.8, 0.8, 0.8),
    });
    shaderMaterials.toon = makeShaderMaterial({
      vertex: toonVert,
      fragment: toonFrag,
      shininess: 16.0,
      specColor: new THREE.Color(0.6, 0.6, 0.6),
    });

    // Apply default shader once ready
    ready = true;
    shaderStatus.textContent = 'Shader: Phong';
    applyShaderToScene(shaderMaterials[currentShader]);
    updateLightUniforms();
  }

  function makeShaderMaterial({ vertex, fragment, shininess, specColor }) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uColor: { value: new THREE.Color(0xffffff) },
        uAmbient: { value: new THREE.Color(0.08, 0.1, 0.12) },
        uDirLightDirection: { value: new THREE.Vector3(0.5, 1, 0.5).normalize() },
        uDirLightColor: { value: new THREE.Color(1, 1, 1) },
        uSpecColor: { value: specColor.clone() },
        uShininess: { value: shininess },
        uSpotPosition: { value: new THREE.Vector3() },
        uSpotDirection: { value: new THREE.Vector3(0, -1, 0) },
        uSpotColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
        uSpotIntensity: { value: 1.0 },
        uSpotCosCutoff: { value: Math.cos(THREE.MathUtils.degToRad(22)) },
      },
      lights: false,
      fog: false, // disable three.js fog handling for custom shaders
    });
    // Expose color for game logic (zone tint)
    mat.color = mat.uniforms.uColor.value;
    return mat;
  }

  function cloneForMesh(mesh, baseMat) {
    const mat = baseMat.clone();
    mat.uniforms = THREE.UniformsUtils.clone(baseMat.uniforms);
    mat.color = mat.uniforms.uColor.value;
    if (mesh.material?.color) {
      mat.color.copy(mesh.material.color);
      mat.uniforms.uColor.value.copy(mat.color);
    }
    mat.name = `${baseMat.name || 'shader'}-${mesh.name || mesh.uuid}`;
    return mat;
  }

  function applyShaderToScene(material) {
    if (!scene || !material) return;
    scene.traverse(obj => {
      // Skip terrain objects
      if (obj.userData?.isTerrain) return;
      
      if (obj.isMesh && obj.material && (obj.material.isMeshStandardMaterial || obj.material.isMeshPhongMaterial || obj.material.isMeshToonMaterial || obj.material.isShaderMaterial || obj.material.isRawShaderMaterial)) {
        const mat = cloneForMesh(obj, material);
        obj.material = mat;
      }
    });
  }

  function updateLightUniforms() {
    if (!ready) return;
    const dir = directional.position.clone().normalize().negate(); // from surface to light
    const spotDir = spotlightTarget.position.clone().sub(spotlight.position).normalize();
    ['phong', 'toon'].forEach(key => {
      const mat = shaderMaterials[key];
      if (!mat) return;
      mat.uniforms.uDirLightDirection.value.copy(dir);
      mat.uniforms.uDirLightColor.value.copy(directional.color);
      mat.uniforms.uSpotPosition.value.copy(spotlight.position);
      mat.uniforms.uSpotDirection.value.copy(spotDir);
      mat.uniforms.uSpotColor.value.copy(spotlight.color);
      mat.uniforms.uSpotIntensity.value = spotlight.intensity;
    });
  }

  function toggleShader() {
    if (!ready) return;
    currentShader = currentShader === 'phong' ? 'toon' : 'phong';
    shaderStatus.textContent = `Shader: ${currentShader === 'phong' ? 'Phong' : 'Toon'}`;
    applyShaderToScene(shaderMaterials[currentShader]);
    updateLightUniforms();
  }

  function currentShaderName() {
    return currentShader === 'phong' ? 'Phong' : 'Toon';
  }

  function update(dt) {
    // Update buff grid scores by directly scanning terrain
    if (buffScoreText && terrain) {
      const scores = getBuffGridScores(terrain);
      // Player controls team2 (cube units); AI controls team1 + team3
      buffScoreText.textContent = `Player: ${scores.team2 || 0} | AI1: ${scores.team1 || 0} | AI2: ${scores.team3 || 0}`;
    }
    
    updateLightUniforms();
  }

  return { update, toggleShader, currentShaderName };
}

/**
 * Show elimination message on screen with red font
 */
export function showEliminationMessage(message) {
  // Create message element
  const msgEl = document.createElement('div');
  msgEl.textContent = message;
  msgEl.style.position = 'fixed';
  msgEl.style.top = '50%';
  msgEl.style.left = '50%';
  msgEl.style.transform = 'translate(-50%, -50%)';
  msgEl.style.fontSize = '24px';
  msgEl.style.fontWeight = 'bold';
  msgEl.style.color = '#654321';
  msgEl.style.textShadow = '0 1px 2px rgba(255, 255, 255, 0.3)';;
  msgEl.style.background = '#e8c170 url(./assets/textures/parchment.png)';
  msgEl.style.backgroundSize = 'cover';
  msgEl.style.padding = '15px 30px';
  msgEl.style.borderRadius = '8px';
  msgEl.style.border = '3px solid rgba(101, 67, 33, 0.8)';
  msgEl.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.6)';
  msgEl.style.zIndex = '10000';
  msgEl.style.pointerEvents = 'none';
  msgEl.style.animation = 'fadeInOut 4s ease-in-out';
  
  // Add CSS animation if not already present
  if (!document.getElementById('eliminationMessageStyle')) {
    const style = document.createElement('style');
    style.id = 'eliminationMessageStyle';
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; }
        10% { opacity: 1; }
        85% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(msgEl);
  
  // Remove after animation
  setTimeout(() => {
    if (msgEl.parentNode) {
      msgEl.parentNode.removeChild(msgEl);
    }
  }, 4000);
}

