import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function setupInput({ renderer, camera, scene, terrain, game }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const selected = new Set();

  // Attack targeting state
  let attackHoverTarget = null;
  let attackArrow = null;

  const helpPanel = document.getElementById('helpPanel');
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
    console.log('[pickUnits] Total cube units:', cubeUnits.length);
    console.log('[pickUnits] Cube units:', cubeUnits.map(u => ({
      uuid: u.uuid,
      position: u.position,
      type: u.userData.type,
      team: u.userData.team,
      isGroup: u.isGroup,
      children: u.children?.length || 0
    })));

    // Collect all meshes from Groups for raycasting
    const allMeshes = [];
    cubeUnits.forEach(unit => {
      unit.traverse((child) => {
        if (child.isMesh) {
          allMeshes.push(child);
          // Log mesh details for debugging
          console.log('[pickUnits] Mesh found:', {
            uuid: child.uuid,
            position: child.position,
            worldPosition: child.getWorldPosition(new THREE.Vector3()),
            visible: child.visible,
            raycast: child.raycast !== undefined,
            material: child.material ? 'has material' : 'no material',
            geometry: child.geometry ? 'has geometry' : 'no geometry',
            parent: child.parent?.uuid
          });
        }
      });
    });
    console.log('[pickUnits] Total meshes collected:', allMeshes.length);

    // Log raycast details
    console.log('[pickUnits] Raycast origin:', raycaster.ray.origin);
    console.log('[pickUnits] Raycast direction:', raycaster.ray.direction);

    // Use recursive intersection to find hits
    const hits = raycaster.intersectObjects(cubeUnits, true);
    console.log('[pickUnits] Raycast hits (recursive):', hits.length);

    // Also try with meshes directly
    if (hits.length === 0 && allMeshes.length > 0) {
      const meshHits = raycaster.intersectObjects(allMeshes, false);
      console.log('[pickUnits] Raycast hits (meshes only):', meshHits.length);
      if (meshHits.length > 0) {
        hits.push(...meshHits);
      }

      // Try with all objects in scene to see if anything is hit
      const allHits = raycaster.intersectObjects(scene.children, true);
      console.log('[pickUnits] Raycast hits (all scene objects):', allHits.length);
      if (allHits.length > 0) {
        console.log('[pickUnits] First hit from scene:', {
          object: allHits[0].object.type,
          uuid: allHits[0].object.uuid,
          distance: allHits[0].distance,
          point: allHits[0].point
        });
      }
    }

    if (hits.length > 0) {
      console.log('[pickUnits] Hit object:', {
        uuid: hits[0].object.uuid,
        type: hits[0].object.type,
        isMesh: hits[0].object.isMesh,
        isGroup: hits[0].object.isGroup,
        isCollisionHelper: hits[0].object.userData?.isCollisionHelper,
        parent: hits[0].object.parent?.uuid,
        userData: hits[0].object.userData
      });
      // If we hit a mesh inside a Group, find the parent Group that represents the unit
      let selectedUnit = hits[0].object;
      // Traverse up the parent chain to find the unit Group
      while (selectedUnit.parent) {
        const parent = selectedUnit.parent;
        // Check if parent is a cube unit
        if (parent.userData && parent.userData.type === 'cube' && parent.userData.team === 'team2') {
          selectedUnit = parent;
          break;
        }
        selectedUnit = parent;
      }
      console.log('[pickUnits] Selected unit:', {
        uuid: selectedUnit.uuid,
        type: selectedUnit.userData?.type,
        team: selectedUnit.userData?.team
      });
      return selectedUnit;
    }
    console.log('[pickUnits] No hits found');
    return null;
  }

  /**
   * Pick any enemy unit under the cursor (non-team2).
   */
  function pickEnemyUnit(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);

    const allUnits = Object.values(game.teams || {})
      .flat()
      .filter(u => u.userData.team && u.userData.team !== 'team2');

    if (allUnits.length === 0) return null;

    const hits = raycaster.intersectObjects(allUnits, true);
    if (hits.length === 0) return null;

    let enemy = hits[0].object;
    while (enemy.parent) {
      const parent = enemy.parent;
      if (parent.userData && parent.userData.team && parent.userData.team !== 'team2') {
        enemy = parent;
        break;
      }
      enemy = parent;
    }

    if (enemy.userData && enemy.userData.team && enemy.userData.team !== 'team2') {
      return enemy;
    }

    return null;
  }

  // Track if we're in "move mode" (unit selected, waiting for terrain click)
  let moveMode = false;

  let clickedOnUnit = false;
  let initialUnitClick = null;

  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.button === 0) {
      console.log('[pointerdown] Left click at:', e.clientX, e.clientY);
      dragState.active = true;
      dragState.start.set(e.clientX, e.clientY);
      dragState.end.copy(dragState.start);

      const unit = pickUnits(e);
      clickedOnUnit = !!unit;
      initialUnitClick = unit;
      console.log('[pointerdown] Unit picked:', unit ? unit.uuid : 'null');

      if (unit) {
        console.log('[pointerdown] Clicked on unit:', {
          uuid: unit.uuid,
          type: unit.userData.type,
          team: unit.userData.team,
          alreadySelected: selected.has(unit)
        });
        // Clicked on a unit - select it immediately
        // If not already selected, clear and select this one
        if (!selected.has(unit)) {
          console.log('[pointerdown] Selecting unit (not already selected)');
          clearSelection();
          addSelection(unit);
        } else {
          console.log('[pointerdown] Unit already selected');
        }
        moveMode = true;
        updateDebugInfo(unit, terrain);
        console.log('[pointerdown] Selection size after click:', selected.size);
      } else {
        console.log('[pointerdown] No unit clicked, checking enemy or terrain');

        // First, see if we clicked an enemy unit to attack
        if (selected.size > 0) {
          const enemy = pickEnemyUnit(e);
          if (enemy) {
            console.log('[pointerdown] Issuing attack on enemy');
            game.issueAttack([...selected], enemy);
            // Clear the arrow when clicking enemy
            attackHoverTarget = null;
            if (attackArrow) attackArrow.visible = false;
            moveMode = false;
            // Keep selection so player still sees attackers selected
            updateDebugInfo([...selected][0], terrain);
            return;
          }
        }

        // Otherwise, check if we clicked on terrain to move
        const groundHit = pickGround(e);
        if (groundHit && selected.size > 0) {
          console.log('[pointerdown] Moving selected units to terrain');
          // Clicked on terrain with unit selected - move to that location
          game.issueMove([...selected], groundHit);
          moveMode = false;
          // Clear selection after issuing move command
          clearSelection();
          updateDebugInfo(null, terrain);
        }
        // If clicked on empty terrain, allow box selection (don't clear yet)
      }
    } else if (e.button === 2) {
      // Right click also works for movement
      const point = pickGround(e);
      if (point && selected.size > 0) {
        game.issueMove([...selected], point);
        moveMode = false;
        // Clear selection after issuing move command
        clearSelection();
        updateDebugInfo(null, terrain);
      }
    }
  });

  // Create selection box overlay
  const selectionBox = document.createElement('div');
  selectionBox.style.cssText = `
    position: fixed;
    border: 2px solid #4ade80;
    background: rgba(74, 222, 128, 0.1);
    pointer-events: none;
    display: none;
    z-index: 1000;
    box-sizing: border-box;
  `;
  document.body.appendChild(selectionBox);

  renderer.domElement.addEventListener('pointermove', e => {
    if (dragState.active) {
      dragState.end.set(e.clientX, e.clientY);

      const dx = Math.abs(dragState.end.x - dragState.start.x);
      const dy = Math.abs(dragState.end.y - dragState.start.y);
      const threshold = 6;

      // Show selection box if dragging far enough
      if (dx > threshold || dy > threshold) {
        const minX = Math.min(dragState.start.x, dragState.end.x);
        const maxX = Math.max(dragState.start.x, dragState.end.x);
        const minY = Math.min(dragState.start.y, dragState.end.y);
        const maxY = Math.max(dragState.start.y, dragState.end.y);

        selectionBox.style.display = 'block';
        selectionBox.style.left = `${minX}px`;
        selectionBox.style.top = `${minY}px`;
        selectionBox.style.width = `${maxX - minX}px`;
        selectionBox.style.height = `${maxY - minY}px`;
      } else {
        selectionBox.style.display = 'none';
      }
    }

    // Show arrow when hovering over enemy
    if (!dragState.active && selected.size > 0) {
      const enemy = pickEnemyUnit(e);
      attackHoverTarget = enemy;
    }
  });

  renderer.domElement.addEventListener('pointerup', e => {
    if (e.button === 0 && dragState.active) {
      const dx = Math.abs(dragState.end.x - dragState.start.x);
      const dy = Math.abs(dragState.end.y - dragState.start.y);
      const threshold = 6;

      if (dx > threshold || dy > threshold) {
        // Box selection - select all units in the box
        boxSelect();
        moveMode = false;
      } else if (clickedOnUnit && initialUnitClick) {
        // Single click on unit - ensure it's selected (already done in pointerdown, but verify)
        if (!selected.has(initialUnitClick)) {
          clearSelection();
          addSelection(initialUnitClick);
        }
        updateDebugInfo(initialUnitClick, terrain);
      } else if (!clickedOnUnit) {
        // Single click on empty terrain - clear selection
        clearSelection();
        updateDebugInfo(null, terrain);
        moveMode = false;
      }

      dragState.active = false;
      clickedOnUnit = false;
      initialUnitClick = null;
      // Hide selection box
      selectionBox.style.display = 'none';
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
      // Handle Group objects (like loaded models) - traverse to find meshes
      u.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => {
            if (material) {
              if (material.uniforms?.uColor) {
                material.uniforms.uColor.value.copy(material.color);
              } else if (material.emissive) {
                material.emissive.setHex(0x000000);
              }
            }
          });
        }
      });
    });
    selected.clear();
  }

  function addSelection(u) {
    console.log('[addSelection] Adding unit:', {
      uuid: u.uuid,
      type: u.userData.type,
      team: u.userData.team,
      isGroup: u.isGroup,
      children: u.children?.length || 0
    });
    selected.add(u);
    u.userData.selected = true;
    let meshCount = 0;
    // Handle Group objects (like loaded models) - traverse to find meshes
    u.traverse((child) => {
      if (child.isMesh && child.material) {
        meshCount++;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => {
          if (material) {
            if (material.uniforms?.uColor) {
              const tint = material.color.clone().offsetHSL(0, 0, 0.05);
              material.uniforms.uColor.value.copy(tint);
            } else if (material.emissive) {
              material.emissive.setHex(0x333333);
            }
          }
        });
      }
    });
    console.log('[addSelection] Found', meshCount, 'meshes, selection size:', selected.size);
  }

  // Keyboard toggles
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyH') {
      helpPanel.classList.toggle('visible');
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

  // Listen for units finishing movement to clear selection
  game.onUnitsFinishedMoving = (units) => {
    // Check if any of the finished units were selected
    const finishedSelected = units.filter(u => selected.has(u));
    if (finishedSelected.length > 0) {
      clearSelection();
      updateDebugInfo(null, terrain);
    }
  };

  // Expose updateDebugInfo for external updates
  return {
    selected,
    updateDebugInfo: (unit) => updateDebugInfo(unit, terrain),
    update: () => {
      // Show arrow on hover target only
      let target = attackHoverTarget;

      // Validate target (must be alive and in scene)
      if (target) {
        const isRemoved = !target.parent;
        const isDead = target.userData.unit?.isDead;
        if (isRemoved || isDead) {
          target = null;
          attackHoverTarget = null;
        }
      }

      if (target) {
        // Ensure arrow exists with static large size
        if (!attackArrow) {
          const dir = new THREE.Vector3(0, -1, 0);
          attackArrow = new THREE.ArrowHelper(
            dir,
            new THREE.Vector3(),
            1.5,      // Shaft length
            0xff0000,
            0.5,      // Head length
            0.4       // Head width
          );
          scene.add(attackArrow);
        }

        const origin = target.position.clone();
        origin.y += 2.0; // Start above target

        attackArrow.position.copy(origin);
        attackArrow.setLength(1.5, 0.5, 0.4); // Ensure size stays consistent
        attackArrow.visible = true;
      } else {
        if (attackArrow) {
          attackArrow.visible = false;
        }
      }
    },
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
