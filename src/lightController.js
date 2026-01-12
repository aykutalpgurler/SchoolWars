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

  const spotlight = new THREE.SpotLight(0xfff3c4, 2.0, 50, THREE.MathUtils.degToRad(30), 0.2, 1.5);
  spotlight.position.set(6, 14, 6);
  const spotlightTarget = new THREE.Object3D();
  spotlightTarget.position.set(0, 0, 0);
  spotlight.target = spotlightTarget;
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.set(1024, 1024);
  spotlight.shadow.camera.near = 1;
  spotlight.shadow.camera.far = 60;
  scene.add(spotlightTarget);
  scene.add(spotlight);

  // Uniform placeholders for shader materials
  const spotlightUniforms = {
    spotPosition: { value: spotlight.position.clone() },
    spotDirection: { value: new THREE.Vector3(0, -1, 0) },
    spotIntensity: { value: spotlight.intensity },
  };

  return { directional, spotlight, spotlightTarget, spotlightUniforms };
}

