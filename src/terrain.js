import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function buildTerrain(scene) {
  const platforms = [];
  const ramps = [];

  // Platform material - green grass-like
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59 });
  platformMat.castShadow = true;
  platformMat.receiveShadow = true;

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
    // Top surface - thin box for good shadows and accurate positioning
    const topThickness = 0.1;
    const topGeo = new THREE.BoxGeometry(width, topThickness, depth);
    const top = new THREE.Mesh(topGeo, platformMat.clone());
    // Position box center at 'height' so top face is at height + topThickness/2
    // But set position.y = height for pathfinding (small visual offset is acceptable)
    top.position.set(x, height, z);
    top.castShadow = true;
    top.receiveShadow = true;
    scene.add(top);

    // Side walls for visual depth (blocky diorama style)
    // Walls extend from base (y=0) to top surface (y=height + topThickness/2)
    const wallTop = height + topThickness / 2;
    const wallHeight = wallTop;
    if (wallHeight > 0.2) {
      const wallThickness = 0.2;
      // Front wall
      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, wallHeight, wallThickness),
        platformMat.clone()
      );
      frontWall.position.set(x, wallHeight / 2, z - depth / 2);
      frontWall.castShadow = true;
      frontWall.receiveShadow = true;
      scene.add(frontWall);

      // Back wall
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, wallHeight, wallThickness),
        platformMat.clone()
      );
      backWall.position.set(x, wallHeight / 2, z + depth / 2);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      scene.add(backWall);

      // Left wall
      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, depth),
        platformMat.clone()
      );
      leftWall.position.set(x - width / 2, wallHeight / 2, z);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      // Right wall
      const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, depth),
        platformMat.clone()
      );
      rightWall.position.set(x + width / 2, wallHeight / 2, z);
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

  // Create ramps
  rampConnections.forEach(([aIdx, bIdx, dir]) => {
    const platA = platforms[aIdx];
    const platB = platforms[bIdx];
    const posA = platA.top.position;
    const posB = platB.top.position;

    // Calculate direction vector from A to B
    const direction = new THREE.Vector3().subVectors(posB, posA);
    const horizontalDist = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    const verticalDist = direction.y;
    const totalLength = direction.length();

    // Ramp dimensions
    const rampWidth = 2.5; // Wide ramp
    const rampHeight = 0.3; // Thickness of ramp
    const rampLength = totalLength;

    // Position ramp at midpoint
    const rampPos = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);

    // Calculate rotation to align ramp with direction
    // First, rotate around Y axis to face the horizontal direction
    const yRotation = Math.atan2(direction.x, direction.z);
    // Then, rotate around X axis (in local space) to slope up/down
    const xRotation = -Math.atan2(verticalDist, horizontalDist);

    // Create ramp mesh
    const rampGeo = new THREE.BoxGeometry(rampWidth, rampHeight, rampLength);
    const ramp = new THREE.Mesh(rampGeo, rampMat.clone());
    ramp.position.copy(rampPos);
    // Apply rotations: use YXZ order so Y rotation happens first, then X
    ramp.rotation.order = 'YXZ';
    ramp.rotation.set(xRotation, yRotation, 0);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    scene.add(ramp);

    ramps.push({ a: aIdx, b: bIdx, mesh: ramp });
  });

  return { platforms, ramps };
}

