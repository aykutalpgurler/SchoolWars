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

  // User-controllable spotlight with 6 DOF
  const spotlight = new THREE.SpotLight(0xffffff, 50.0); // Start with intensity 50.0 (enabled)
  spotlight.position.set(-1.0, 19.8, -1.0);
  spotlight.angle = THREE.MathUtils.degToRad(60); // 60 degrees
  spotlight.penumbra = 0.20;
  spotlight.decay = 1.0;
  spotlight.distance = 37;
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 2048;
  spotlight.shadow.mapSize.height = 2048;
  spotlight.shadow.camera.near = 0.5;
  spotlight.shadow.camera.far = 100;
  spotlight.shadow.bias = -0.0001;
  
  // Spotlight target (where it points)
  const spotlightTarget = new THREE.Object3D();
  spotlightTarget.position.set(0, 0, 0);
  scene.add(spotlightTarget);
  spotlight.target = spotlightTarget;
  scene.add(spotlight);

  // Store original light intensities for debug mode restoration
  const originalIntensities = {
    hemi: hemi.intensity,
    directional: directional.intensity,
    fill: fillLight.intensity
  };

  // Spotlight helpers for visualization
  const spotHelper = new THREE.SpotLightHelper(spotlight);
  spotHelper.visible = false;
  scene.add(spotHelper);

  const spotCamHelper = new THREE.CameraHelper(spotlight.shadow.camera);
  spotCamHelper.visible = false;
  scene.add(spotCamHelper);

  // Helper function to update spotlight rotation from Euler angles
  function updateSpotlightRotation(pitch, yaw, roll) {
    // Create rotation quaternion from Euler angles
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(pitch),
      THREE.MathUtils.degToRad(yaw),
      THREE.MathUtils.degToRad(roll),
      'XYZ'
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    
    // Calculate target position relative to spotlight position
    // Use -Z as forward direction (Three.js convention)
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(quaternion);
    direction.multiplyScalar(10); // Distance to target
    
    spotlightTarget.position.copy(spotlight.position).add(direction);
    
    // Update matrix worlds to ensure helpers update correctly
    spotlight.updateMatrixWorld(true);
    spotlightTarget.updateMatrixWorld(true);
  }

  // Initialize with default rotation (pointing straight down)
  updateSpotlightRotation(-90, 0, 0);

  // Debug mode: 0=Normal, 1=Spotlight Only, 2=Low Ambient
  let debugMode = 0;
  
  // Expose debug mode getter for day/night cycle check
  function getSpotlightDebugMode() {
    return debugMode;
  }

  function setSpotlightDebugMode(mode) {
    debugMode = mode;
    
    if (mode === 0) {
      // Normal mode - restore original intensities
      hemi.intensity = originalIntensities.hemi;
      directional.intensity = originalIntensities.directional;
      fillLight.intensity = originalIntensities.fill;
    } else if (mode === 1) {
      // Spotlight Only - turn off all other lights
      hemi.intensity = 0;
      directional.intensity = 0;
      fillLight.intensity = 0;
    } else if (mode === 2) {
      // Low Ambient - reduce other lights, emphasize spotlight
      hemi.intensity = originalIntensities.hemi * 0.1;
      directional.intensity = originalIntensities.directional * 0.1;
      fillLight.intensity = 0;
    }
  }

  function toggleSpotlightHelpers(visible) {
    spotHelper.visible = visible;
    spotCamHelper.visible = visible;
    if (visible) {
      // Update helpers when showing
      spotHelper.update();
      spotCamHelper.update();
    }
  }

  function updateSpotlightHelpers() {
    if (spotHelper.visible) {
      spotHelper.update();
    }
    if (spotCamHelper.visible) {
      spotCamHelper.update();
    }
  }

  return { 
    hemi,
    directional,
    fillLight,
    spotlight,
    spotlightTarget,
    updateSpotlightRotation,
    setSpotlightDebugMode,
    getSpotlightDebugMode,
    toggleSpotlightHelpers,
    updateSpotlightHelpers,
    originalIntensities
  };
}
