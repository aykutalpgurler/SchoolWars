import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

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
  const scoreText = document.getElementById('scoreText');
  const shaderStatus = document.getElementById('shaderStatus');
  const appEl = document.getElementById('app');

  // Minimap canvas
  const minimap = document.createElement('canvas');
  minimap.width = 220;
  minimap.height = 140;
  minimap.style.position = 'absolute';
  minimap.style.right = '12px';
  minimap.style.bottom = '12px';
  minimap.style.border = '1px solid rgba(255,255,255,0.15)';
  minimap.style.background = 'rgba(0,0,0,0.65)';
  minimap.style.borderRadius = '10px';
  minimap.style.backdropFilter = 'blur(4px)';
  minimap.style.pointerEvents = 'none';
  appEl.appendChild(minimap);
  const mctx = minimap.getContext('2d');

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
    if (scoreText) {
      const s = game.scores;
      scoreText.textContent = `Player: ${s.player.toFixed(0)} | AI1: ${s.ai1.toFixed(0)} | AI2: ${s.ai2.toFixed(0)}`;
    }
    updateLightUniforms();
    drawMinimap();
  }

  return { update, toggleShader, currentShaderName };

  function drawMinimap() {
    mctx.clearRect(0, 0, minimap.width, minimap.height);
    mctx.fillStyle = 'rgba(0,0,0,0.55)';
    mctx.fillRect(0, 0, minimap.width, minimap.height);

    if (!terrain) return;

    // Calculate bounds from terrain grid
    let bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    
    if (terrain.data && terrain.gridToWorld) {
      // New terrain API: calculate bounds from grid
      const tileSize = 4.0; // Should match CONFIG.tileSize
      const width = terrain.data.walkable.length;
      const depth = terrain.data.walkable[0].length;
      bounds.minX = -width * tileSize / 2;
      bounds.maxX = width * tileSize / 2;
      bounds.minZ = -depth * tileSize / 2;
      bounds.maxZ = depth * tileSize / 2;
    } else if (terrain.platforms && terrain.platforms.length > 0) {
      // Old terrain API fallback
      bounds = terrain.platforms.reduce(
        (acc, p) => {
          acc.minX = Math.min(acc.minX, p.top.position.x - (p.size?.width || 4) / 2);
          acc.maxX = Math.max(acc.maxX, p.top.position.x + (p.size?.width || 4) / 2);
          acc.minZ = Math.min(acc.minZ, p.top.position.z - (p.size?.length || 4) / 2);
          acc.maxZ = Math.max(acc.maxZ, p.top.position.z + (p.size?.length || 4) / 2);
          return acc;
        },
        { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
      );
    } else {
      return;
    }

    const pad = 12;
    const scaleX = (minimap.width - pad * 2) / (bounds.maxX - bounds.minX + 0.0001);
    const scaleZ = (minimap.height - pad * 2) / (bounds.maxZ - bounds.minZ + 0.0001);

    // Draw terrain tiles
    if (terrain.data && terrain.data.walkable) {
      const { walkable, height } = terrain.data;
      for (let x = 0; x < walkable.length; x++) {
        for (let z = 0; z < walkable[0].length; z++) {
          if (walkable[x][z]) {
            const world = terrain.gridToWorld(x, z);
            const mapX = pad + (world.x - bounds.minX) * scaleX;
            const mapZ = pad + (world.z - bounds.minZ) * scaleZ;
            const h = height[x][z];
            // Color by height level
            const colors = ['#2d864d', '#3d9e5d', '#4db86d', '#5dd27d'];
            mctx.fillStyle = colors[Math.min(h, colors.length - 1)] || '#2d864d';
            mctx.fillRect(mapX - 2, mapZ - 2, 4, 4);
          }
        }
      }
    } else if (terrain.platforms) {
      // Fallback: draw platforms
      terrain.platforms.forEach(p => {
        const x = pad + (p.top.position.x - bounds.minX) * scaleX;
        const z = pad + (p.top.position.z - bounds.minZ) * scaleZ;
        mctx.fillStyle = '#2d864d';
        mctx.fillRect(x - 4, z - 4, 8, 8);
      });
    }

    // Units
    const drawUnits = (teamId, color) => {
      const units = game.teams[teamId] || [];
      mctx.fillStyle = color;
      units.forEach(u => {
        const x = pad + (u.position.x - bounds.minX) * scaleX;
        const z = pad + (u.position.z - bounds.minZ) * scaleZ;
        mctx.beginPath();
        mctx.arc(x, z, 3, 0, Math.PI * 2);
        mctx.fill();
      });
    };
    drawUnits('player', '#a855f7');
    drawUnits('ai1', '#22c55e');
    drawUnits('ai2', '#facc15');
  }
}

