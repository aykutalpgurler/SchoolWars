import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function buildTerrain(scene) {
  const platforms = [];
  const ramps = [];

  // Platform top material - green grass-like
  const platformTopMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59 });
  platformTopMat.castShadow = true;
  platformTopMat.receiveShadow = true;

  // Platform side material - brown/darker earthy color
  const platformSideMat = new THREE.MeshStandardMaterial({ color: 0x6b4e3d });
  platformSideMat.castShadow = true;
  platformSideMat.receiveShadow = true;

  // Ramp material - brown wood-like
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  rampMat.castShadow = true;
  rampMat.receiveShadow = true;

  // Define platform layout: 2x3 grid (6 platforms)
  // Each platform: [x, z, width, depth, height]
  const platformDefs = [
    [-8, -6, 4, 4, 0],      // Bottom-left, ground level
    [0, -6, 5, 4, 1.5],     // Bottom-center, elevated
    [8, -6, 4, 4, 0.5],     // Bottom-right, slightly elevated
    [-8, 6, 4, 5, 2.5],     // Top-left, highest
    [0, 6, 5, 4, 1],        // Top-center, elevated
    [8, 6, 4, 4, 0],        // Top-right, ground level
  ];

  // Create platforms
  platformDefs.forEach(([x, z, width, depth, height], idx) => {
    // Top surface - use plane for accurate positioning
    const topGeo = new THREE.PlaneGeometry(width, depth);
    const top = new THREE.Mesh(topGeo, platformTopMat.clone());
    top.position.set(x, height, z);
    top.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    top.castShadow = true;
    top.receiveShadow = true;
    scene.add(top);

    // Side walls for visual depth (blocky diorama style with brown sides)
    const sideHeight = height;
    if (sideHeight > 0.1) {
      // Front wall
      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, sideHeight, 0.2),
        platformSideMat.clone()
      );
      frontWall.position.set(x, height - sideHeight / 2 - 0.1, z - depth / 2);
      frontWall.castShadow = true;
      frontWall.receiveShadow = true;
      scene.add(frontWall);

      // Back wall
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, sideHeight, 0.2),
        platformSideMat.clone()
      );
      backWall.position.set(x, height - sideHeight / 2 - 0.1, z + depth / 2);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      scene.add(backWall);

      // Left wall
      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, sideHeight, depth),
        platformSideMat.clone()
      );
      leftWall.position.set(x - width / 2, height - sideHeight / 2 - 0.1, z);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      // Right wall
      const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, sideHeight, depth),
        platformSideMat.clone()
      );
      rightWall.position.set(x + width / 2, height - sideHeight / 2 - 0.1, z);
      rightWall.castShadow = true;
      rightWall.receiveShadow = true;
      scene.add(rightWall);
    }

    platforms.push({ top });
  });

  // Define ramp connections (adjacent platforms in grid)
  // Format: [platformA_index, platformB_index, connection_direction]
  const rampConnections = [
    [0, 1, 'right'],   // Bottom-left to bottom-center
    [1, 2, 'right'],   // Bottom-center to bottom-right
    [0, 3, 'up'],      // Bottom-left to top-left
    [1, 4, 'up'],      // Bottom-center to top-center
    [2, 5, 'up'],      // Bottom-right to top-right
    [3, 4, 'right'],   // Top-left to top-center
    [4, 5, 'right'],   // Top-center to top-right
  ];

  // Create stepped ramps (stair-like)
  rampConnections.forEach(([aIdx, bIdx, dir]) => {
    const platA = platforms[aIdx];
    const platB = platforms[bIdx];
    const posA = platA.top.position;
    const posB = platB.top.position;

    // Calculate direction vector from A to B
    const direction = new THREE.Vector3().subVectors(posB, posA);
    const horizontalDist = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    const verticalDist = direction.y;

    // Ramp dimensions
    const rampWidth = 2.5; // Wide ramp
    const stepHeight = 0.25; // Height of each step
    const stepDepth = 0.7; // Depth of each step (horizontal distance per step)
    
    // Calculate number of steps needed
    const numSteps = Math.max(2, Math.ceil(horizontalDist / stepDepth));
    const actualStepDepth = horizontalDist / numSteps;
    const stepVerticalIncrement = verticalDist / numSteps;

    // Calculate the horizontal direction unit vector
    const horizontalDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const yRotation = Math.atan2(direction.x, direction.z);

    // Create individual step boxes
    const rampSteps = [];
    for (let i = 0; i < numSteps; i++) {
      const t = i / numSteps;
      const nextT = (i + 1) / numSteps;
      
      // Calculate step center position along the ramp path
      const stepCenterX = posA.x + direction.x * (t + nextT) / 2;
      const stepCenterZ = posA.z + direction.z * (t + nextT) / 2;
      // Step top surface should be at the interpolated height
      const stepTopY = posA.y + direction.y * (t + nextT) / 2;
      
      // Create step box
      const stepGeo = new THREE.BoxGeometry(rampWidth, stepHeight, actualStepDepth);
      const step = new THREE.Mesh(stepGeo, rampMat.clone());
      // Position step so its top surface is at stepTopY
      step.position.set(stepCenterX, stepTopY + stepHeight / 2, stepCenterZ);
      step.rotation.y = yRotation;
      step.castShadow = true;
      step.receiveShadow = true;
      scene.add(step);
      rampSteps.push(step);
    }

    // For pathfinding, create a dummy mesh at midpoint for reference
    // The actual steps are already positioned correctly
    const rampMidpoint = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
    const rampMesh = rampSteps[Math.floor(rampSteps.length / 2)]; // Use middle step as reference
    
    ramps.push({ a: aIdx, b: bIdx, mesh: rampMesh, steps: rampSteps });
  });

  return { platforms, ramps };
}

