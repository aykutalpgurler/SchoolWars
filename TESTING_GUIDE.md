# Testing Guide for Spotlight 6DOF and Shader System

This guide explains how to test all the newly implemented functionalities.

## Keyboard Layout Summary

### Target Selection
- **1** = Object (selected units)
- **2** = Camera
- **3** = Spotlight
- **4** = Spotlight Target

### Axis Selection
- **X** = X-axis (Shift+X for rotate mode)
- **Y** = Y-axis (Shift+Y for rotate mode)
- **Z** = Z-axis (Shift+Z for rotate mode)

### Transform Controls
- **N** = Translate/rotate in positive direction
- **M** = Translate/rotate in negative direction
- **J** = Rotate in positive direction (when in rotate mode)
- **K** = Rotate in negative direction (when in rotate mode)

### Other Controls
- **L** = Toggle spotlight on/off
- **=** = Increase spotlight intensity
- **-** = Decrease spotlight intensity
- **T** = Toggle shader (Phong ↔ Toon)
- **H** = Toggle help panel

## Testing Procedures

### 1. Testing Spotlight 6 DOF Control

#### Translation (3 DOF)
1. **Select spotlight as target**: Press **3**
2. **Select X-axis**: Press **X**
3. **Translate along X**: Press **N** (positive) or **M** (negative)
   - Observe the spotlight moving left/right in the scene
   - Check the status panel (bottom-right) shows "Spotlight" as target
4. **Select Y-axis**: Press **Y**
5. **Translate along Y**: Press **N** or **M**
   - Observe the spotlight moving up/down
6. **Select Z-axis**: Press **Z**
7. **Translate along Z**: Press **N** or **M**
   - Observe the spotlight moving forward/backward

#### Rotation (3 DOF)
1. **Select spotlight as target**: Press **3**
2. **Select X-axis for rotation**: Press **Shift+X**
   - Status panel should show "Rotate" mode and "X" axis
3. **Rotate around X-axis**: Press **J** (positive) or **K** (negative)
   - Observe the spotlight direction changing (pitch)
   - The light cone should tilt up/down
4. **Select Y-axis for rotation**: Press **Shift+Y**
5. **Rotate around Y-axis**: Press **J** or **K**
   - Observe the spotlight rotating left/right (yaw)
6. **Select Z-axis for rotation**: Press **Shift+Z**
7. **Rotate around Z-axis**: Press **J** or **K**
   - Observe the spotlight rolling (twisting)

#### Spotlight Target Control
1. **Select spotlight target**: Press **4**
2. **Select axis**: Press **X**, **Y**, or **Z**
3. **Translate target**: Press **N** or **M**
   - Observe the spotlight target moving, which changes where the light points
4. **Rotate target around spotlight**: Press **Shift+X/Y/Z**, then **J** or **K**
   - The target rotates around the spotlight position

#### Intensity Control
1. **Increase intensity**: Press **=** (equals key)
   - Observe the spotlight getting brighter
   - Check status panel shows increasing intensity value
2. **Decrease intensity**: Press **-** (minus key)
   - Observe the spotlight getting dimmer
3. **Toggle on/off**: Press **L**
   - Spotlight should disappear/reappear
   - Status panel should show "Off" or "On"

### 2. Testing Shader System

#### Shader Switching
1. **Toggle to Toon shader**: Press **T**
   - Observe the scene switching to cel-shaded/toon style
   - Notice discrete color steps instead of smooth gradients
   - Status panel (bottom-left) should show "Shader: Toon"
2. **Toggle back to Phong**: Press **T** again
   - Scene returns to smooth, realistic lighting with specular highlights
   - Status panel should show "Shader: Phong"

#### Visual Differences
- **Phong Shader**: 
  - Smooth, continuous lighting gradients
  - Specular highlights (shiny reflections)
  - Realistic appearance
- **Toon Shader**:
  - Discrete color bands (stepped lighting)
  - No specular highlights
  - Cartoon/cel-shaded appearance

Both shaders should affect **all objects** in the scene (units, terrain features, etc.), not just specific parts.

### 3. Testing Axis Selection System

#### Target Switching
1. **Select Object target**: Press **1**
   - Status panel should show "Target: Object"
   - Select a unit by clicking on it
   - Press **X**, then **N** or **M** to translate the selected unit
2. **Select Camera target**: Press **2**
   - Status panel should show "Target: Camera"
   - Press **Y**, then **N** or **M** to move camera up/down
3. **Select Spotlight target**: Press **3**
   - Status panel should show "Target: Spotlight"
4. **Select Spotlight Target**: Press **4**
   - Status panel should show "Target: Spot Target"

#### Axis Selection
1. **Select X-axis (translate mode)**: Press **X**
   - Status panel should show "Axis: X" and "Mode: Translate"
2. **Select Y-axis (translate mode)**: Press **Y**
   - Status panel should show "Axis: Y" and "Mode: Translate"
3. **Select Z-axis (translate mode)**: Press **Z**
   - Status panel should show "Axis: Z" and "Mode: Translate"
4. **Select X-axis (rotate mode)**: Press **Shift+X**
   - Status panel should show "Axis: X" and "Mode: Rotate"
5. **Select Y-axis (rotate mode)**: Press **Shift+Y**
6. **Select Z-axis (rotate mode)**: Press **Shift+Z**

### 4. Testing Camera Control via Axis Selection

1. **Select Camera target**: Press **2**
2. **Select X-axis**: Press **X**
3. **Translate camera**: Press **N** or **M**
   - Camera should move left/right
4. **Select Y-axis**: Press **Y**
5. **Translate camera**: Press **N** or **M**
   - Camera should move up/down
6. **Select Z-axis**: Press **Z**
7. **Translate camera**: Press **N** or **M**
   - Camera should move forward/backward
8. **Rotate camera**: Press **Shift+X/Y/Z**, then **J** or **K**
   - Camera should rotate around the selected axis

### 5. Testing Object Control via Axis Selection

1. **Select a unit**: Click on any unit in the scene
2. **Select Object target**: Press **1** (should already be selected)
3. **Select X-axis**: Press **X**
4. **Translate unit**: Press **N** or **M**
   - Selected unit should move along X-axis
5. **Select Y-axis**: Press **Y**
6. **Translate unit**: Press **N** or **M**
   - Unit should move up/down
7. **Rotate unit**: Press **Shift+X/Y/Z**, then **J** or **K**
   - Unit should rotate around the selected axis

## Status Panel Reference

The status panel (bottom-right corner) displays:
- **Target**: Current transform target (Object/Camera/Spotlight/Spot Target)
- **Axis**: Current axis (X/Y/Z)
- **Mode**: Current mode (Translate/Rotate)
- **Spotlight**: Spotlight status (On/Off) and intensity value

## Expected Behaviors

### Spotlight
- Should be visible in the scene (yellow/golden light)
- Should cast shadows
- Should respond to all 6 DOF controls
- Intensity should range from 0.0 to 5.0
- Can be toggled on/off

### Shaders
- Both shaders should apply to entire scene
- Visual difference should be immediately obvious
- Switching should be instant (no lag)
- Both should properly handle spotlight lighting

### Axis Selection
- Status panel should update immediately when changing target/axis/mode
- Transform operations should work for all targets
- No conflicts with camera movement (WASD/QE)

## Troubleshooting

- **Spotlight not visible**: Press **L** to toggle it on
- **Can't select target**: Make sure you're pressing number keys (1-4), not function keys
- **Transform not working**: Check status panel to ensure correct target/axis/mode are selected
- **Shader not switching**: Press **T** key (make sure no other application has focus)
- **Status panel not updating**: Check browser console for errors

## Quick Test Sequence

1. Press **3** → **X** → **N** (move spotlight right)
2. Press **Shift+X** → **J** (rotate spotlight around X-axis)
3. Press **L** (toggle spotlight off, then on)
4. Press **=** (increase intensity)
5. Press **T** (switch to Toon shader)
6. Press **T** (switch back to Phong)
7. Press **2** → **Y** → **N** (move camera up)
8. Press **1** → Select a unit → **X** → **N** (move unit right)

All operations should work smoothly without conflicts.

