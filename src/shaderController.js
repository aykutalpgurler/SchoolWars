import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';

// Shader modes
export const SHADER_MODES = {
  NONE: 'none',
  CEL_TOON: 'cel-toon',
  CHROMATIC_ABERRATION: 'chromatic-aberration'
};

let composer = null;
let renderPass = null;
let celToonPass = null;
let chromaticAberrationPass = null;
let currentMode = SHADER_MODES.NONE;

// Load shader source from file
async function loadShader(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${url}`);
  }
  return await response.text();
}

// Create shader material from vertex and fragment shader files
async function createShaderMaterial(vertPath, fragPath, uniforms = {}) {
  const vertSource = await loadShader(vertPath);
  const fragSource = await loadShader(fragPath);
  
  return new THREE.ShaderMaterial({
    vertexShader: vertSource,
    fragmentShader: fragSource,
    uniforms: uniforms
  });
}

export async function initializeShaderController(renderer, scene, camera) {
  // Create EffectComposer
  composer = new EffectComposer(renderer);
  
  // Create render pass (renders the scene)
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Load and create Cel/Toon shader pass
  const celToonMaterial = await createShaderMaterial(
    './shaders/cel-toon.vert',
    './shaders/cel-toon.frag',
    {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uQuantizationLevels: { value: 5.0 },
      uEdgeThreshold: { value: 0.15 }
    }
  );
  celToonPass = new ShaderPass(celToonMaterial);
  celToonPass.enabled = false;
  composer.addPass(celToonPass);
  
  // Load and create Chromatic Aberration shader pass
  const chromaticAberrationMaterial = await createShaderMaterial(
    './shaders/chromatic-aberration.vert',
    './shaders/chromatic-aberration.frag',
    {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uAberrationStrength: { value: 0.02 },
      uDistortionStrength: { value: 0.3 }
    }
  );
  chromaticAberrationPass = new ShaderPass(chromaticAberrationMaterial);
  chromaticAberrationPass.enabled = false;
  composer.addPass(chromaticAberrationPass);
  
  // Set initial mode
  setShaderMode(SHADER_MODES.NONE);
  
  return composer;
}

export function setShaderMode(mode) {
  if (!composer) return;
  
  currentMode = mode;
  
  // Disable all shader passes
  if (celToonPass) celToonPass.enabled = false;
  if (chromaticAberrationPass) chromaticAberrationPass.enabled = false;
  
  // Enable selected shader pass
  switch (mode) {
    case SHADER_MODES.CEL_TOON:
      if (celToonPass) celToonPass.enabled = true;
      break;
    case SHADER_MODES.CHROMATIC_ABERRATION:
      if (chromaticAberrationPass) chromaticAberrationPass.enabled = true;
      break;
    case SHADER_MODES.NONE:
    default:
      // No shader pass enabled
      break;
  }
}

export function getShaderMode() {
  return currentMode;
}

export function cycleShaderMode() {
  const modes = [SHADER_MODES.NONE, SHADER_MODES.CEL_TOON, SHADER_MODES.CHROMATIC_ABERRATION];
  const currentIndex = modes.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  setShaderMode(modes[nextIndex]);
  return modes[nextIndex];
}

export function resizeShaderController(width, height) {
  if (!composer) return;
  
  composer.setSize(width, height);
  
  // Update shader uniforms with new resolution
  if (celToonPass && celToonPass.material && celToonPass.material.uniforms) {
    celToonPass.material.uniforms.uResolution.value.set(width, height);
  }
  if (chromaticAberrationPass && chromaticAberrationPass.material && chromaticAberrationPass.material.uniforms) {
    chromaticAberrationPass.material.uniforms.uResolution.value.set(width, height);
  }
}

export function render() {
  if (!composer) return;
  composer.render();
}

export function getComposer() {
  return composer;
}

// Update Cel/Toon shader parameters
export function updateCelToonParams(quantizationLevels, edgeThreshold) {
  if (celToonPass && celToonPass.material && celToonPass.material.uniforms) {
    if (quantizationLevels !== undefined) {
      celToonPass.material.uniforms.uQuantizationLevels.value = quantizationLevels;
    }
    if (edgeThreshold !== undefined) {
      celToonPass.material.uniforms.uEdgeThreshold.value = edgeThreshold;
    }
  }
}

// Update Chromatic Aberration shader parameters
export function updateChromaticAberrationParams(aberrationStrength, distortionStrength) {
  if (chromaticAberrationPass && chromaticAberrationPass.material && chromaticAberrationPass.material.uniforms) {
    if (aberrationStrength !== undefined) {
      chromaticAberrationPass.material.uniforms.uAberrationStrength.value = aberrationStrength;
    }
    if (distortionStrength !== undefined) {
      chromaticAberrationPass.material.uniforms.uDistortionStrength.value = distortionStrength;
    }
  }
}

