import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function setupInput({ renderer, camera, scene, terrain, cameraController, game, ui, spotlight, spotlightTarget }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const selected = new Set();

  const helpPanel = document.getElementById('helpPanel');
  const shaderStatus = document.getElementById('shaderStatus');
  const dragState = { active: false, start: new THREE.Vector2(), end: new THREE.Vector2() };

  const axisState = {
    mode: 'translate', // or 'rotate'
    axis: 'y',
  };

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickGround(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    
    // Use terrain's raycastToGrid method to get both point and cell
    const hit = terrain.raycastToGrid(raycaster);
    if (hit) {
      return hit.point;
    }
    return null;
  }

  function pickGridCell(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    
    // Use terrain's raycastToGrid method to get the cell
    const hit = terrain.raycastToGrid(raycaster);
    if (hit) {
      return hit.cell;
    }
    return null;
  }

  function pickUnits(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    // Only allow selecting cube units (team2)
    const cubeUnits = (game.teams.team2 || []).filter(unit => unit.userData.type === 'cube');
    const hits = raycaster.intersectObjects(cubeUnits, false);
    return hits.length > 0 ? hits[0].object : null;
  }

  // Track if we're in "move mode" (unit selected, waiting for terrain click)
  let moveMode = false;

  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.button === 0) {
      dragState.active = true;
      dragState.start.set(e.clientX, e.clientY);
      dragState.end.copy(dragState.start);
      
      const unit = pickUnits(e);
      
      if (unit) {
        // Clicked on a unit - select it and enter move mode
        clearSelection();
        addSelection(unit);
        moveMode = true;
        updateDebugInfo(unit, terrain);
      } else {
        // Check if we clicked on terrain
        const groundHit = pickGround(e);
        if (groundHit && selected.size > 0) {
          // Clicked on terrain with unit selected - move to that location
          game.issueMove([...selected], groundHit);
          moveMode = false;
          // Keep debug info showing
          const unit = Array.from(selected)[0];
          updateDebugInfo(unit, terrain);
        } else if (groundHit) {
          // Clicked on empty terrain - clear selection
          clearSelection();
          moveMode = false;
          updateDebugInfo(null, terrain);
        }
      }
    } else if (e.button === 2) {
      // Right click also works for movement
      const point = pickGround(e);
      if (point && selected.size > 0) {
        game.issueMove([...selected], point);
        moveMode = false;
        updateDebugInfo(null, terrain);
      }
    }
  });

  renderer.domElement.addEventListener('pointermove', e => {
    if (!dragState.active) return;
    dragState.end.set(e.clientX, e.clientY);
  });

  renderer.domElement.addEventListener('pointerup', e => {
    if (e.button === 0 && dragState.active) {
      const dx = Math.abs(dragState.end.x - dragState.start.x);
      const dy = Math.abs(dragState.end.y - dragState.start.y);
      const threshold = 6;
      if (dx > threshold || dy > threshold) {
        boxSelect();
      }
      dragState.active = false;
    }
  });

  function boxSelect() {
    const minX = Math.min(dragState.start.x, dragState.end.x);
    const maxX = Math.max(dragState.start.x, dragState.end.x);
    const minY = Math.min(dragState.start.y, dragState.end.y);
    const maxY = Math.max(dragState.start.y, dragState.end.y);

    const rectContains = (v) => v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY;
    // Only allow selecting cube units (team2)
    const cubeUnits = (game.teams.team2 || []).filter(unit => unit.userData.type === 'cube');
    const newlySelected = [];
    cubeUnits.forEach(u => {
      const screenPos = u.position.clone().project(camera);
      const px = (screenPos.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
      const py = (-screenPos.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
      if (rectContains({ x: px, y: py })) newlySelected.push(u);
    });
    if (newlySelected.length > 0) {
      clearSelection();
      newlySelected.forEach(addSelection);
    }
  }

  function clearSelection() {
    selected.forEach(u => {
      u.userData.selected = false;
      if (u.material?.uniforms?.uColor) {
        u.material.uniforms.uColor.value.copy(u.material.color);
      } else {
        u.material.emissive?.setHex(0x000000);
      }
    });
    selected.clear();
  }
  function addSelection(u) {
    selected.add(u);
    u.userData.selected = true;
    if (u.material?.uniforms?.uColor) {
      const tint = u.material.color.clone().offsetHSL(0, 0, 0.05);
      u.material.uniforms.uColor.value.copy(tint);
    } else if (u.material.emissive) {
      u.material.emissive.setHex(0x333333);
    }
  }

  // Keyboard toggles
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyH') {
      helpPanel.classList.toggle('visible');
    }
    if (e.code === 'KeyL') {
      spotlight.visible = !spotlight.visible;
    }
    if (e.code === 'BracketRight') {
      spotlight.intensity = Math.min(spotlight.intensity + 0.1, 5);
    }
    if (e.code === 'BracketLeft') {
      spotlight.intensity = Math.max(spotlight.intensity - 0.1, 0);
    }
    if (e.code === 'KeyT') {
      ui.toggleShader();
      shaderStatus.textContent = `Shader: ${ui.currentShaderName()}`;
    }

    // Axis selection for transforms
    if (e.code === 'KeyX' || e.code === 'KeyY' || e.code === 'KeyZ') {
      axisState.axis = e.code === 'KeyX' ? 'x' : e.code === 'KeyY' ? 'y' : 'z';
      axisState.mode = e.shiftKey ? 'rotate' : 'translate';
    }
    // Translate along axis (C/V)
    if (e.code === 'KeyC') translateSelection(axisState.axis, 1);
    if (e.code === 'KeyV') translateSelection(axisState.axis, -1);
    // Rotate around axis (R/F)
    if (e.code === 'KeyR') rotateSelection(axisState.axis, 1);
    if (e.code === 'KeyF') rotateSelection(axisState.axis, -1);
  });

  // Spotlight keyboard steering (axis-based)
  window.addEventListener('keydown', e => {
    const step = 0.5;
    if (e.code === 'KeyI') spotlight.position.z -= step;
    if (e.code === 'KeyK') spotlight.position.z += step;
    if (e.code === 'KeyJ') spotlight.position.x -= step;
    if (e.code === 'KeyL') spotlight.position.x += step;
    if (e.code === 'KeyU') spotlight.position.y += step;
    if (e.code === 'KeyO') spotlight.position.y -= step;
  });

  /**
   * Update debug panel with unit and grid info
   */
  function updateDebugInfo(unit, terrain) {
    const debugPanel = document.getElementById('debugPanel');
    if (!debugPanel) return;

    if (unit && unit.userData.currentCell) {
      const cell = unit.userData.currentCell;
      debugPanel.style.display = 'block';
      
      document.getElementById('debugUnit').textContent = `${unit.userData.team || 'Unknown'} (${unit.userData.type || 'unit'})`;
      document.getElementById('debugCell').textContent = `Row: ${cell.row}, Col: ${cell.col}`;
      document.getElementById('debugCoords').textContent = `(${cell.x.toFixed(2)}, ${cell.z.toFixed(2)})`;
      document.getElementById('debugHeight').textContent = `${cell.getY().toFixed(2)}`;
      document.getElementById('debugWalkable').textContent = cell.walkable ? 'Yes' : 'No';
      document.getElementById('debugUnits').textContent = cell.units.length;
    } else if (unit) {
      // Unit selected but no cell yet
      debugPanel.style.display = 'block';
      document.getElementById('debugUnit').textContent = `${unit.userData.team || 'Unknown'} (${unit.userData.type || 'unit'})`;
      document.getElementById('debugCell').textContent = 'No cell';
      document.getElementById('debugCoords').textContent = `(${unit.position.x.toFixed(2)}, ${unit.position.z.toFixed(2)})`;
      document.getElementById('debugHeight').textContent = unit.position.y.toFixed(2);
      document.getElementById('debugWalkable').textContent = '-';
      document.getElementById('debugUnits').textContent = '-';
    } else {
      // No unit selected
      debugPanel.style.display = 'none';
    }
  }

  // Expose updateDebugInfo for external updates
  return {
    selected,
    updateDebugInfo: (unit) => updateDebugInfo(unit, terrain),
  };

  function translateSelection(axis, dir) {
    if (selected.size === 0) return;
    const step = 0.4 * dir;
    selected.forEach(u => {
      u.position[axis] += step;
      if (axis === 'y') {
        // keep feet on surface if moved vertically
        u.position.y = Math.max(u.position.y, 0.15);
      }
    });
  }

  function rotateSelection(axis, dir) {
    if (selected.size === 0) return;
    const angle = THREE.MathUtils.degToRad(10) * dir;
    selected.forEach(u => {
      const euler = new THREE.Euler();
      euler[axis] = angle;
      u.rotateOnWorldAxis(new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), angle);
    });
  }
}

