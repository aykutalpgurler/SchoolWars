import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function setupCameraController(camera, domElement) {
  const state = {
    move: new THREE.Vector3(),
    rot: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Vector3(),
    targetQuat: camera.quaternion.clone(),
    speed: 12,
    rotSpeed: THREE.MathUtils.degToRad(80),
    damping: 8,
  };

  const keys = new Set();
  function onKey(e) {
    if (e.type === 'keydown') keys.add(e.code);
    else keys.delete(e.code);
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  let isDragging = false;
  let prev = new THREE.Vector2();
  domElement.addEventListener('contextmenu', e => e.preventDefault());
  domElement.addEventListener('pointerdown', e => {
    if (e.button === 2) {
      isDragging = true;
      prev.set(e.clientX, e.clientY);
      domElement.setPointerCapture(e.pointerId);
    }
  });
  domElement.addEventListener('pointerup', e => {
    if (e.button === 2) {
      isDragging = false;
      domElement.releasePointerCapture(e.pointerId);
    }
  });
  domElement.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.set(e.clientX, e.clientY);
    const yaw = -dx * 0.005;
    const pitch = -dy * 0.003;
    const euler = new THREE.Euler().setFromQuaternion(state.targetQuat, 'YXZ');
    euler.y += yaw;
    euler.x = THREE.MathUtils.clamp(euler.x + pitch, -Math.PI / 2.2, Math.PI / 2.2);
    state.targetQuat.setFromEuler(euler);
  });

  function update(dt) {
    // Movement input
    state.move.set(0, 0, 0);
    if (keys.has('KeyW')) state.move.z -= 1;
    if (keys.has('KeyS')) state.move.z += 1;
    if (keys.has('KeyA')) state.move.x -= 1;
    if (keys.has('KeyD')) state.move.x += 1;
    if (keys.has('KeyE')) state.move.y += 1;
    if (keys.has('KeyQ')) state.move.y -= 1;

    state.rot.set(0, 0, 0);
    if (keys.has('ArrowLeft')) state.rot.y += 1;
    if (keys.has('ArrowRight')) state.rot.y -= 1;
    if (keys.has('ArrowUp')) state.rot.x += 1;
    if (keys.has('ArrowDown')) state.rot.x -= 1;
    if (keys.has('KeyZ')) state.rot.z -= 1;
    if (keys.has('KeyX')) state.rot.z += 1;

    // Apply rotation target for explicit roll
    if (state.rot.z !== 0) {
      const euler = new THREE.Euler().setFromQuaternion(state.targetQuat, 'YXZ');
      euler.z += state.rot.z * state.rotSpeed * dt * 0.3;
      state.targetQuat.setFromEuler(euler);
    }

    camera.quaternion.slerp(state.targetQuat, 1 - Math.exp(-state.damping * dt));

    // Move in camera space
    const dir = state.move.lengthSq() > 0 ? state.move.normalize() : state.move;
    const moveWorld = dir.clone().applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(moveWorld, state.speed * dt);

    // Optional explicit yaw/pitch via arrows
    if (state.rot.y !== 0 || state.rot.x !== 0) {
      const euler = new THREE.Euler().setFromQuaternion(state.targetQuat, 'YXZ');
      euler.y += state.rot.y * state.rotSpeed * dt;
      euler.x = THREE.MathUtils.clamp(euler.x + state.rot.x * state.rotSpeed * dt, -Math.PI / 2.2, Math.PI / 2.2);
      state.targetQuat.setFromEuler(euler);
    }
  }

  return { update, keys };
}

