import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function setupLights(scene) {
  // Reduced hemisphere light intensity to avoid flattening colors
  // Keep it subtle for better contrast and shading
  const hemi = new THREE.HemisphereLight(0x8fd3ff, 0x224466, 0.3);
  scene.add(hemi);

  // Main directional light - key light for good shading
  const directional = new THREE.DirectionalLight(0xffffff, 0.85);
  directional.position.set(10, 18, 8);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 80;
  directional.shadow.camera.left = -30;
  directional.shadow.camera.right = 30;
  directional.shadow.camera.top = 30;
  directional.shadow.camera.bottom = -30;
  scene.add(directional);
  
  // Add a subtle fill light for better visibility without flattening
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
  fillLight.position.set(-8, 10, -6);
  scene.add(fillLight);

  return { directional };
}
