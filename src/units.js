import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// Import Three.js loaders (addons) - using CDN path for examples/jsm/loaders
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js';
import { Unit } from './unit.js';

const TEAM_COLORS = {
  team1: 0x7c3aed, // Purple
  team2: 0x22c55e, // Green
  team3: 0xfacc15, // Yellow
};

// Team model pools (using same team names for compatibility)
const TEAM_MODEL_POOLS = {
  team1: ['Camel', 'Cat', 'Fox'], // Camel team (sphere/purple)
  team2: ['Alien', 'Archer', 'Astronaut'], // Player team (cube/green) - old cobra
  team3: ['Ant', 'Grasshopper', 'Beetle'], // Ant team (triangle/yellow)
};

// Health bar height from ground for each model (adjust these values as needed)
const MODEL_HEALTHBAR_HEIGHTS = {
  // Team 1 models (Camel team - larger)
  'Camel': 9.0,
  'Cat': 22.0,
  'Fox': 4,
  
  // Team 2 models (Player team - medium)
  'Alien': 18.0,
  'Archer': 14.0,
  'Astronaut': 5.0,
  
  // Team 3 models (Ant team - smaller)
  'Ant': 2,
  'Grasshopper': 30.0,
  'Beetle': 30.0,
  
  // Fallback
  'default': 2.0,
};

// Cache for loaded models
let camelModelCache = null;
let catModelCache = null;
let foxModelCache = null;
let alienModelCache = null;
let archerModelCache = null;
let astronautModelCache = null;
let antModelCache = null;
let grasshopperModelCache = null;
let beetleModelCache = null;
let cobraModelCache = null; // Keep for backward compatibility

/**
 * Get a random model name from a team's pool
 */
function getRandomModelFromTeam(teamId) {
  const pool = TEAM_MODEL_POOLS[teamId];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get the cached model by name
 */
function getCachedModel(modelName) {
  const cacheMap = {
    'Camel': camelModelCache,
    'Cat': catModelCache,
    'Fox': foxModelCache,
    'Alien': alienModelCache,
    'Archer': archerModelCache,
    'Astronaut': astronautModelCache,
    'Ant': antModelCache,
    'Grasshopper': grasshopperModelCache,
    'Beetle': beetleModelCache,
    'Cobra': cobraModelCache, // backward compatibility
  };
  return cacheMap[modelName] || null;
}

/**
 * Load the cobra model (cached after first load)
 */
async function loadCobraModel() {
  if (cobraModelCache) {
    return cobraModelCache;
  }

  return new Promise((resolve, reject) => {
    // Use Three.js MTLLoader and OBJLoader (addons)
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    // Set the path for loading textures referenced in MTL
    mtlLoader.setPath('./assets/desert-creatures/Cobra/');
    objLoader.setPath('./assets/desert-creatures/Cobra/');

    // Load MTL material file first
    mtlLoader.load(
      'cobra.mtl',
      (materials) => {
        // Log loaded material names for debugging
        console.log('Cobra MTL loaded. Material names:', Object.keys(materials.materials));

        // Preload materials (this loads textures)
        materials.preload();

        // Verify texture loading and set color space
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            console.log(`Cobra texture loaded for ${materialName}:`, mtlMaterial.map.image ? 'Success' : 'Failed');
            // Set texture color space to sRGB for correct color rendering
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          } else {
            console.warn(`Cobra material ${materialName} has no texture map`);
          }
        });

        // Set materials for OBJ loader
        objLoader.setMaterials(materials);

        // Load OBJ model
        objLoader.load(
          'cobra.obj',
          (object) => {
            console.log('Cobra OBJ loaded. Meshes:', object.children.length);

            // Override materials with stylized low-poly material
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                // Log per-mesh material assignment
                const originalMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
                console.log(`Cobra mesh "${child.name || 'unnamed'}" material:`, originalMaterial?.name || 'default');

                // Ensure geometry has proper normals for flat shading
                if (child.geometry) {
                  // Compute vertex normals if needed (flat shading will use face normals)
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }

                // Handle both single material and material arrays
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];

                materials.forEach((material) => {
                  if (!material) return;

                  // Create a new stylized material for clean low-poly look
                  const newMaterial = new THREE.MeshStandardMaterial();

                  // Get texture from original material if it exists
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace; // Ensure sRGB
                    newMaterial.map.flipY = false;
                    console.log(`Cobra texture applied: ${material.map.image ? 'Success' : 'Failed'}`);
                  } else {
                    // Fallback: manually load texture if MTL didn't load it
                    console.warn('Cobra material has no texture, attempting fallback load...');
                    const textureLoader = new THREE.TextureLoader();
                    textureLoader.load(
                      './assets/desert-creatures/Cobra/cobraTxt.png',
                      (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.flipY = false;
                        newMaterial.map = texture;
                        newMaterial.needsUpdate = true;
                        console.log('Cobra fallback texture loaded successfully');
                      },
                      undefined,
                      (error) => {
                        console.error('Cobra fallback texture load failed:', error);
                      }
                    );
                  }

                  // Set color to white so texture shows at full brightness
                  // Some MTL materials have Kd 0,0,0 which means they rely entirely on texture
                  newMaterial.color.setHex(0xffffff);

                  // Stylized low-poly material properties
                  newMaterial.roughness = 0.8; // Medium-high roughness for stylized look (not plastic)
                  newMaterial.metalness = 0.0; // Non-metallic for organic look
                  newMaterial.flatShading = true; // Enable flat shading for low-poly facet readability

                  // Ensure proper side rendering
                  newMaterial.side = THREE.FrontSide;

                  newMaterials.push(newMaterial);
                });

                // Update the mesh material
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];

                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            // Calculate bounding box to determine scale
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            // Scale to larger size for better visibility
            const targetSize = 1.2;
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);

            // Recalculate box after scaling
            box.setFromObject(object);

            // Position model so its bottom (min Y) is at y=0
            const min = box.min;
            object.position.y = -min.y;

            // Center horizontally (x and z)
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            cobraModelCache = object;
            resolve(object);
          },
          undefined,
          (error) => {
            console.error('Error loading OBJ file:', error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Error loading MTL file:', error);
        // Fallback: load OBJ with manual texture
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          './assets/desert-creatures/Cobra/cobraTxt.png',
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            console.log('Cobra fallback texture loaded');
            objLoader.load(
              './assets/desert-creatures/Cobra/cobra.obj',
              (object) => {
                object.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                      map: texture,
                      color: 0xffffff,
                      roughness: 0.8,
                      metalness: 0.0,
                      flatShading: true // Low-poly facet readability
                    });
                    child.castShadow = true;
                    child.receiveShadow = true;
                  }
                });

                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const targetSize = 0.3;
                const scale = targetSize / maxDim;
                object.scale.set(scale, scale, scale);
                box.setFromObject(object);
                const min = box.min;
                object.position.y = -min.y;
                const center = box.getCenter(new THREE.Vector3());
                object.position.x = -center.x;
                object.position.z = -center.z;

                cobraModelCache = object;
                resolve(object);
              },
              undefined,
              reject
            );
          },
          undefined,
          reject
        );
      }
    );
  });
}

/**
 * Create a player team unit from a randomly selected model (Alien, Archer, or Astronaut)
 */
function makeCubeUnit(color) {
  // Randomly select a model from team2's pool
  const modelName = getRandomModelFromTeam('team2');
  const modelCache = getCachedModel(modelName);
  
  if (!modelCache) {
    console.error(`${modelName} model not loaded yet. Call load${modelName}Model() first.`);
    // Fallback to cube if model not loaded
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Clone the cached model (deep clone to clone materials and textures)
  const unit = modelCache.clone(true);
  
  // Store model name for health bar positioning
  unit.userData.modelName = modelName;

  // Calculate bounding box to determine size for collision helper
  const box = new THREE.Box3().setFromObject(unit);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Create an invisible collision helper (larger sphere for easier clicking)
  // Make it about 3x the size of the model for easier clicking (adjusted for larger models)
  const collisionRadius = maxDim * 3.0;
  const collisionHelper = new THREE.Mesh(
    new THREE.SphereGeometry(collisionRadius, 16, 16),
    new THREE.MeshBasicMaterial({
      visible: false, // Invisible but still raycastable
      transparent: true,
      opacity: 0
    })
  );
  collisionHelper.name = 'collisionHelper';
  collisionHelper.userData.isCollisionHelper = true;
  // Position at center of the model
  const center = box.getCenter(new THREE.Vector3());
  collisionHelper.position.copy(center);
  unit.add(collisionHelper);

  // Apply team color as a very subtle tint while preserving material properties
  unit.traverse((child) => {
    if (child.isMesh && child.material) {
      // Skip collision helper
      if (child.userData.isCollisionHelper) return;

      // Handle both single material and material arrays
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const clonedMaterials = materials.map(material => {
        if (!material) return material;
        const cloned = material.clone();

        // Preserve flat shading for low-poly look
        if (material.flatShading !== undefined) {
          cloned.flatShading = material.flatShading;
        }

        // Clone texture if present and ensure sRGB color space
        if (material.map) {
          cloned.map = material.map.clone();
          cloned.map.colorSpace = THREE.SRGBColorSpace;
          cloned.map.flipY = false;
        }

        return cloned;
      });

      clonedMaterials.forEach((material) => {
        if (!material) return;

        // If material has a texture, ensure it's visible with subtle team tint
        if (material.map) {
          // Set color to white so texture shows at full brightness
          material.color.setHex(0xffffff);
          // Apply very subtle team color tint (98% white, 2% team color)
          const teamColor = new THREE.Color(color);
          teamColor.lerp(new THREE.Color(0xffffff), 0.98);
          material.color.multiply(teamColor);
        } else {
          // If no texture, set the color directly
          material.color = new THREE.Color(color);
        }

        // Ensure material properties are preserved
        material.roughness = material.roughness ?? 0.8;
        material.metalness = material.metalness ?? 0.0;
        material.flatShading = material.flatShading ?? true;
      });

      // Update the mesh material
      child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
    }
  });

  return unit;
}

/**
 * Load the ant model (cached after first load)
 */
async function loadAntModel() {
  if (antModelCache) {
    return antModelCache;
  }

  return new Promise((resolve, reject) => {
    // Use Three.js MTLLoader and OBJLoader (addons)
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    // Set the path for loading textures referenced in MTL
    mtlLoader.setPath('./assets/desert-creatures/Ant/');
    objLoader.setPath('./assets/desert-creatures/Ant/');

    // Load MTL material file first
    mtlLoader.load(
      'ant.mtl',
      (materials) => {
        // Preload materials (this loads textures)
        materials.preload();

        // Ensure dark colors from MTL are properly applied
        // The MTL has very dark Kd values (0.03, 0.02, 0.03 and 0.01, 0.01, 0.01)
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial) {
            // Ensure the color from MTL Kd values is preserved
            // MTLLoader should set this, but we'll ensure it's correct
            if (mtlMaterial.color) {
              // The MTL Kd values are already very dark, so keep them
              // Don't override to white
            } else {
              // If color wasn't set, use the dark values from MTL
              // lambert7SG: Kd 0.03 0.02 0.03, lambert8SG: Kd 0.01 0.01 0.01
              if (materialName.includes('lambert8')) {
                mtlMaterial.color = new THREE.Color(0x010101); // Very dark, almost black
              } else {
                mtlMaterial.color = new THREE.Color(0x030203); // Dark gray
              }
            }
          }
        });

        // Set materials for OBJ loader
        objLoader.setMaterials(materials);

        // Load OBJ model
        objLoader.load(
          'ant.obj',
          (object) => {
            // Ensure all meshes have proper material settings
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                // Handle both single material and material arrays
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((material, index) => {
                  if (!material) return;

                  // Preserve the dark color from MTL - DO NOT override to white
                  // The MTL has intentionally dark Kd values (0.01-0.03) for a dark/black look

                  // Ensure material properties for good shading and contrast
                  if (material.isMeshStandardMaterial || material.isMeshPhongMaterial || material.isMeshLambertMaterial) {
                    // Material is already a standard type, just enhance properties
                    if (material.roughness !== undefined) {
                      material.roughness = 0.7; // For MeshStandardMaterial
                    }
                    if (material.metalness !== undefined) {
                      material.metalness = 0.1; // For MeshStandardMaterial
                    }
                    if (material.shininess !== undefined) {
                      material.shininess = 30; // For MeshPhongMaterial
                    }
                  } else {
                    // Convert to MeshStandardMaterial if it's not already a standard type
                    const newMaterial = new THREE.MeshStandardMaterial();

                    // Preserve the dark color from MTL
                    if (material.color) {
                      newMaterial.color.copy(material.color);
                    } else {
                      // Use dark color from MTL
                      newMaterial.color.setRGB(0.02, 0.02, 0.02);
                    }

                    newMaterial.roughness = 0.7;
                    newMaterial.metalness = 0.1;

                    if (material.map) {
                      newMaterial.map = material.map;
                      newMaterial.map.flipY = false;
                    }

                    materials[index] = newMaterial;
                    return;
                  }

                  // Ensure texture is configured correctly
                  if (material.map) {
                    material.map.flipY = false;
                    material.needsUpdate = true;
                  }

                  // CRITICAL: Do NOT override the color - keep the dark MTL colors
                  // The color should already be set correctly from the MTL Kd values
                });

                // Update the mesh material
                child.material = Array.isArray(child.material) ? materials : materials[0];

                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            // Calculate bounding box to determine scale
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            // Scale to larger size for better visibility
            const targetSize = 1.6;
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);

            // Recalculate box after scaling
            box.setFromObject(object);

            // Position model so its bottom (min Y) is at y=0
            const min = box.min;
            object.position.y = -min.y;

            // Center horizontally (x and z)
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            antModelCache = object;
            resolve(object);
          },
          undefined,
          (error) => {
            console.error('Error loading OBJ file:', error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Error loading MTL file:', error);
        // Fallback: load OBJ without MTL
        objLoader.load(
          './assets/desert-creatures/Ant/ant.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 0.4;
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            antModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      }
    );
  });
}

/**
 * Create an ant team unit from a randomly selected model (Ant, Grasshopper, or Beetle)
 */
function makeTriangleUnit(color) {
  // Randomly select a model from team3's pool
  const modelName = getRandomModelFromTeam('team3');
  const modelCache = getCachedModel(modelName);
  
  if (!modelCache) {
    console.error(`${modelName} model not loaded yet. Call load${modelName}Model() first.`);
    // Fallback to triangle if model not loaded
    const geo = new THREE.TetrahedronGeometry(0.2, 0);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Clone the cached model (deep clone to clone materials and textures)
  const unit = modelCache.clone(true);
  
  // Store model name for health bar positioning
  unit.userData.modelName = modelName;

  // Apply team color as a very subtle tint while preserving dark appearance
  unit.traverse((child) => {
    if (child.isMesh && child.material) {
      // Handle both single material and material arrays
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const clonedMaterials = materials.map(material => {
        if (!material) return material;
        return material.clone();
      });

      clonedMaterials.forEach((material) => {
        if (!material) return;

        // Clone texture if present
        if (material.map) {
          material.map = material.map.clone();
          material.map.flipY = false;
        }

        // Preserve the dark color from MTL, but apply a very subtle team color tint
        if (material.color) {
          // Get the current dark color
          const currentColor = material.color.clone();

          // Apply a very subtle team color tint (95% original dark color, 5% team color)
          // This keeps it dark but adds a hint of team color
          const teamColor = new THREE.Color(color);
          // Make team color darker to match the ant's dark aesthetic
          teamColor.multiplyScalar(0.15); // Darken team color significantly

          // Blend: mostly keep the dark color, add a tiny bit of darkened team color
          currentColor.lerp(teamColor, 0.05);
          material.color = currentColor;
        } else {
          // If no color, use dark with subtle team tint
          const darkBase = new THREE.Color(0x020202); // Very dark
          const teamColor = new THREE.Color(color);
          teamColor.multiplyScalar(0.15);
          darkBase.lerp(teamColor, 0.05);
          material.color = darkBase;
        }

        // Ensure material properties for good shading
        material.roughness = 0.7;
        material.metalness = 0.1;
      });

      // Update the mesh material
      child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
    }
  });

  return unit;
}

/**
 * Load the camel model (cached after first load)
 */
async function loadCamelModel() {
  if (camelModelCache) {
    return camelModelCache;
  }

  return new Promise((resolve, reject) => {
    // Use Three.js MTLLoader and OBJLoader (addons)
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    // Set the path for loading textures referenced in MTL
    mtlLoader.setPath('./assets/desert-creatures/Camel/');
    objLoader.setPath('./assets/desert-creatures/Camel/');

    // Load MTL material file first
    mtlLoader.load(
      'DromedaryCamels.mtl',
      (materials) => {
        // Log loaded material names for debugging
        console.log('Camel MTL loaded. Material names:', Object.keys(materials.materials));

        // Preload materials (this loads textures)
        materials.preload();

        // Verify texture loading and set color space
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            console.log(`Camel texture loaded for ${materialName}:`, mtlMaterial.map.image ? 'Success' : 'Failed');
            // Set texture color space to sRGB for correct color rendering
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          } else {
            console.warn(`Camel material ${materialName} has no texture map`);
          }
        });

        // Set materials for OBJ loader
        objLoader.setMaterials(materials);

        // Load OBJ model
        objLoader.load(
          'DromedaryCamels.obj',
          (object) => {
            console.log('Camel OBJ loaded. Meshes:', object.children.length);

            // Override materials with stylized low-poly material
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                // Log per-mesh material assignment
                const originalMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
                console.log(`Camel mesh "${child.name || 'unnamed'}" material:`, originalMaterial?.name || 'default');

                // Ensure geometry has proper normals for flat shading
                if (child.geometry) {
                  // Compute vertex normals if needed (flat shading will use face normals)
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }

                // Handle both single material and material arrays
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];

                materials.forEach((material) => {
                  if (!material) return;

                  // Create a new stylized material for clean low-poly look
                  const newMaterial = new THREE.MeshStandardMaterial();

                  // Get texture from original material if it exists
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace; // Ensure sRGB
                    newMaterial.map.flipY = false;
                    console.log(`Camel texture applied: ${material.map.image ? 'Success' : 'Failed'}`);
                  } else {
                    // Fallback: manually load texture if MTL didn't load it
                    console.warn('Camel material has no texture, attempting fallback load...');
                    const textureLoader = new THREE.TextureLoader();
                    textureLoader.load(
                      './assets/desert-creatures/Camel/DromedaryCamels_BaseColor.png',
                      (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.flipY = false;
                        newMaterial.map = texture;
                        newMaterial.needsUpdate = true;
                        console.log('Camel fallback texture loaded successfully');
                      },
                      undefined,
                      (error) => {
                        console.error('Camel fallback texture load failed:', error);
                      }
                    );
                  }

                  // Set color to white so texture shows at full brightness
                  // (MTL has Kd 0,0,0 which means it relies entirely on texture)
                  newMaterial.color.setHex(0xffffff);

                  // Stylized low-poly material properties
                  newMaterial.roughness = 0.8; // Medium-high roughness for stylized look (not plastic)
                  newMaterial.metalness = 0.0; // Non-metallic for organic look
                  newMaterial.flatShading = true; // Enable flat shading for low-poly facet readability

                  // Ensure proper side rendering
                  newMaterial.side = THREE.FrontSide;

                  newMaterials.push(newMaterial);
                });

                // Update the mesh material
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];

                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            // Calculate bounding box to determine scale
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            // Scale to larger size for better visibility
            const targetSize = 1.6;
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);

            // Recalculate box after scaling
            box.setFromObject(object);

            // Position model so its bottom (min Y) is at y=0
            const min = box.min;
            object.position.y = -min.y;

            // Center horizontally (x and z)
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            camelModelCache = object;
            resolve(object);
          },
          undefined,
          (error) => {
            console.error('Error loading OBJ file:', error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Error loading MTL file:', error);
        // Fallback: load OBJ with manual texture
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          './assets/desert-creatures/Camel/DromedaryCamels_BaseColor.png',
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            console.log('Camel fallback texture loaded');
            objLoader.load(
              './assets/desert-creatures/Camel/DromedaryCamels.obj',
              (object) => {
                object.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                      map: texture,
                      color: 0xffffff,
                      roughness: 0.8,
                      metalness: 0.0,
                      flatShading: true // Low-poly facet readability
                    });
                    child.castShadow = true;
                    child.receiveShadow = true;
                  }
                });

                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const targetSize = 0.4;
                const scale = targetSize / maxDim;
                object.scale.set(scale, scale, scale);
                box.setFromObject(object);
                const min = box.min;
                object.position.y = -min.y;
                const center = box.getCenter(new THREE.Vector3());
                object.position.x = -center.x;
                object.position.z = -center.z;

                camelModelCache = object;
                resolve(object);
              },
              undefined,
              reject
            );
          },
          undefined,
          reject
        );
      }
    );
  });
}

/**
 * Load the Cat model (cached after first load)
 */
async function loadCatModel() {
  if (catModelCache) {
    return catModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    mtlLoader.setPath('./assets/desert-creatures/Cat/');
    objLoader.setPath('./assets/desert-creatures/Cat/');

    mtlLoader.load(
      'Mesh_Cat.mtl',
      (materials) => {
        materials.preload();
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          }
        });
        objLoader.setMaterials(materials);

        objLoader.load(
          'Mesh_Cat.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                if (child.geometry) {
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];
                materials.forEach((material) => {
                  if (!material) return;
                  const newMaterial = new THREE.MeshStandardMaterial();
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    newMaterial.map.flipY = false;
                  }
                  newMaterial.color = new THREE.Color(0xffffff);
                  newMaterial.roughness = 0.8;
                  newMaterial.metalness = 0.0;
                  newMaterial.flatShading = true;
                  newMaterials.push(newMaterial);
                });
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.6; // Same as Camel team
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            catModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

/**
 * Load the Fox model (cached after first load)
 */
async function loadFoxModel() {
  if (foxModelCache) {
    return foxModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    mtlLoader.setPath('./assets/desert-creatures/Fox/');
    objLoader.setPath('./assets/desert-creatures/Fox/');

    mtlLoader.load(
      'Fox.mtl',
      (materials) => {
        materials.preload();
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          }
        });
        objLoader.setMaterials(materials);

        objLoader.load(
          'Fox.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                if (child.geometry) {
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];
                materials.forEach((material) => {
                  if (!material) return;
                  const newMaterial = new THREE.MeshStandardMaterial();
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    newMaterial.map.flipY = false;
                  }
                  newMaterial.color = new THREE.Color(0xffffff);
                  newMaterial.roughness = 0.8;
                  newMaterial.metalness = 0.0;
                  newMaterial.flatShading = true;
                  newMaterials.push(newMaterial);
                });
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.6; // Same as Camel team
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            foxModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

/**
 * Load the Alien model (cached after first load)
 */
async function loadAlienModel() {
  if (alienModelCache) {
    return alienModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    mtlLoader.setPath('./assets/desert-creatures/Alien/');
    objLoader.setPath('./assets/desert-creatures/Alien/');

    mtlLoader.load(
      'Alien.mtl',
      (materials) => {
        materials.preload();
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          }
        });
        objLoader.setMaterials(materials);

        objLoader.load(
          'Alien.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                if (child.geometry) {
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];
                materials.forEach((material) => {
                  if (!material) return;
                  const newMaterial = new THREE.MeshStandardMaterial();
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    newMaterial.map.flipY = false;
                  }
                  newMaterial.color = new THREE.Color(0xffffff);
                  newMaterial.roughness = 0.8;
                  newMaterial.metalness = 0.0;
                  newMaterial.flatShading = true;
                  newMaterials.push(newMaterial);
                });
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.2; // Same as Player team (old Cobra)
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            alienModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

/**
 * Load the Archer model (cached after first load)
 */
async function loadArcherModel() {
  if (archerModelCache) {
    return archerModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    mtlLoader.setPath('./assets/desert-creatures/Archer/');
    objLoader.setPath('./assets/desert-creatures/Archer/');

    mtlLoader.load(
      'Archer.mtl',
      (materials) => {
        materials.preload();
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          }
        });
        objLoader.setMaterials(materials);

        objLoader.load(
          'Archer.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                if (child.geometry) {
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];
                materials.forEach((material) => {
                  if (!material) return;
                  const newMaterial = new THREE.MeshStandardMaterial();
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    newMaterial.map.flipY = false;
                  }
                  newMaterial.color = new THREE.Color(0xffffff);
                  newMaterial.roughness = 0.8;
                  newMaterial.metalness = 0.0;
                  newMaterial.flatShading = true;
                  newMaterials.push(newMaterial);
                });
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.2; // Same as Player team (old Cobra)
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            archerModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

/**
 * Load the Astronaut model (cached after first load)
 */
async function loadAstronautModel() {
  if (astronautModelCache) {
    return astronautModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    mtlLoader.setPath('./assets/desert-creatures/Astronaut/');
    objLoader.setPath('./assets/desert-creatures/Astronaut/');

    mtlLoader.load(
      'Astronaut.mtl',
      (materials) => {
        materials.preload();
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          }
        });
        objLoader.setMaterials(materials);

        objLoader.load(
          'Astronaut.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                if (child.geometry) {
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];
                materials.forEach((material) => {
                  if (!material) return;
                  const newMaterial = new THREE.MeshStandardMaterial();
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    newMaterial.map.flipY = false;
                  }
                  newMaterial.color = new THREE.Color(0xffffff);
                  newMaterial.roughness = 0.8;
                  newMaterial.metalness = 0.0;
                  newMaterial.flatShading = true;
                  newMaterials.push(newMaterial);
                });
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.2; // Same as Player team (old Cobra)
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            astronautModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

/**
 * Load the Grasshopper model (cached after first load)
 */
async function loadGrasshopperModel() {
  if (grasshopperModelCache) {
    return grasshopperModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    mtlLoader.setPath('./assets/desert-creatures/Grasshopper/');
    objLoader.setPath('./assets/desert-creatures/Grasshopper/');

    mtlLoader.load(
      'grasshopper.mtl',
      (materials) => {
        materials.preload();
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          }
        });
        objLoader.setMaterials(materials);

        objLoader.load(
          'grasshopper.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                if (child.geometry) {
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];
                materials.forEach((material) => {
                  if (!material) return;
                  const newMaterial = new THREE.MeshStandardMaterial();
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    newMaterial.map.flipY = false;
                  }
                  newMaterial.color = new THREE.Color(0xffffff);
                  newMaterial.roughness = 0.7;
                  newMaterial.metalness = 0.1;
                  newMaterial.flatShading = true;
                  newMaterials.push(newMaterial);
                });
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.4; // Same as Ant team
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            grasshopperModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

/**
 * Load the Beetle model (cached after first load)
 */
async function loadBeetleModel() {
  if (beetleModelCache) {
    return beetleModelCache;
  }

  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    mtlLoader.setPath('./assets/desert-creatures/Beetle/');
    objLoader.setPath('./assets/desert-creatures/Beetle/');

    mtlLoader.load(
      'Mesh_Beetle.mtl',
      (materials) => {
        materials.preload();
        Object.keys(materials.materials).forEach((materialName) => {
          const mtlMaterial = materials.materials[materialName];
          if (mtlMaterial && mtlMaterial.map) {
            mtlMaterial.map.colorSpace = THREE.SRGBColorSpace;
            mtlMaterial.map.flipY = false;
          }
        });
        objLoader.setMaterials(materials);

        objLoader.load(
          'Mesh_Beetle.obj',
          (object) => {
            object.traverse((child) => {
              if (child.isMesh && child.material) {
                if (child.geometry) {
                  if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
                    child.geometry.computeVertexNormals();
                  }
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = [];
                materials.forEach((material) => {
                  if (!material) return;
                  const newMaterial = new THREE.MeshStandardMaterial();
                  if (material.map) {
                    newMaterial.map = material.map;
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    newMaterial.map.flipY = false;
                  }
                  newMaterial.color = new THREE.Color(0xffffff);
                  newMaterial.roughness = 0.7;
                  newMaterial.metalness = 0.1;
                  newMaterial.flatShading = true;
                  newMaterials.push(newMaterial);
                });
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.4; // Same as Ant team
            const scale = targetSize / maxDim;
            object.scale.set(scale, scale, scale);
            box.setFromObject(object);
            const min = box.min;
            object.position.y = -min.y;
            const center = box.getCenter(new THREE.Vector3());
            object.position.x = -center.x;
            object.position.z = -center.z;

            beetleModelCache = object;
            resolve(object);
          },
          undefined,
          reject
        );
      },
      undefined,
      reject
    );
  });
}

/**
 * Create a camel team unit from a randomly selected model (Camel, Cat, or Fox)
 */
function makeSphereUnit(color) {
  // Randomly select a model from team1's pool
  const modelName = getRandomModelFromTeam('team1');
  const modelCache = getCachedModel(modelName);
  
  if (!modelCache) {
    console.error(`${modelName} model not loaded yet. Call load${modelName}Model() first.`);
    // Fallback to sphere if model not loaded
    const geo = new THREE.SphereGeometry(0.2, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Clone the cached model (deep clone to clone materials and textures)
  const unit = modelCache.clone(true);
  
  // Store model name for health bar positioning
  unit.userData.modelName = modelName;
  
  // Store model name for health bar positioning
  unit.userData.modelName = modelName;

  // Apply team color as a very subtle tint while preserving material properties
  unit.traverse((child) => {
    if (child.isMesh && child.material) {
      // Handle both single material and material arrays
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const clonedMaterials = materials.map(material => {
        if (!material) return material;
        const cloned = material.clone();

        // Preserve flat shading for low-poly look
        if (material.flatShading !== undefined) {
          cloned.flatShading = material.flatShading;
        }

        // Clone texture if present and ensure sRGB color space
        if (material.map) {
          cloned.map = material.map.clone();
          cloned.map.colorSpace = THREE.SRGBColorSpace;
          cloned.map.flipY = false;
        }

        return cloned;
      });

      clonedMaterials.forEach((material) => {
        if (!material) return;

        // If material has a texture, ensure it's visible with subtle team tint
        if (material.map) {
          // Set color to white so texture shows at full brightness
          // (MTL file has Kd 0,0,0 which would darken the texture)
          material.color.setHex(0xffffff);
          // Apply very subtle team color tint (98% white, 2% team color)
          const teamColor = new THREE.Color(color);
          teamColor.lerp(new THREE.Color(0xffffff), 0.98);
          material.color.multiply(teamColor);
        } else {
          // If no texture, set the color directly
          material.color = new THREE.Color(color);
        }

        // Ensure material properties are preserved
        material.roughness = material.roughness ?? 0.8;
        material.metalness = material.metalness ?? 0.0;
        material.flatShading = material.flatShading ?? true;
      });

      // Update the mesh material
      child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
    }
  });

  return unit;
}

/**
 * Create a simple cylinder unit
 */
function makeCylinderUnit(color) {
  const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 12);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Get terrain height at a specific world position using raycasting
 */
function getTerrainHeightAt(scene, worldX, worldZ, cell) {
  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3(worldX, 100, worldZ); // Start high above
  const rayDirection = new THREE.Vector3(0, -1, 0); // Cast downward

  raycaster.set(rayOrigin, rayDirection);

  // Find all terrain meshes
  const terrainMeshes = [];
  scene.traverse((object) => {
    if (object.userData.isTerrain && object.isMesh) {
      terrainMeshes.push(object);
    }
  });

  const intersects = raycaster.intersectObjects(terrainMeshes, false);

  if (intersects.length > 0) {
    // Use the closest intersection (first one)
    return intersects[0].point.y;
  }

  // Fallback: calculate from cell height (height scale is 0.2)
  const heightScale = 0.2;
  return cell ? cell.getY() * heightScale : 0;
}

// Map geometry type to creator function and properties
const GEOMETRY_MAP = {
  sphere: { create: makeSphereUnit, yOffset: 0.2, type: 'sphere' }, // Camel
  cube: { create: makeCubeUnit, yOffset: 0.6, type: 'cube' }, // Cobra
  triangle: { create: makeTriangleUnit, yOffset: 0.2, type: 'triangle' }, // Ant
};

/**
 * Attach a simple health bar above the unit.
 * Green segment = remaining health, red segment = missing health.
 */
function attachHealthBar(visual, unitData) {
  const barGroup = new THREE.Group();

  let width = 1;  // Wider for all units
  let height = 0.18; // Longer for all units

 

  const bgGeom = new THREE.PlaneGeometry(width, height);
  // Bright red background so missing health is clearly visible
  const bgMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false });
  const bg = new THREE.Mesh(bgGeom, bgMat);

  const fgGeom = new THREE.PlaneGeometry(width, height);
  const fgMat = new THREE.MeshBasicMaterial({ color: 0x00aa00, depthTest: false }); // Darker green
  const fg = new THREE.Mesh(fgGeom, fgMat);
  fg.position.z = 0.001;

  barGroup.add(bg);
  barGroup.add(fg);

  // Add border lines (black outline around health bar)
  const borderThickness = 0.04;
  const borderColor = 0x000000; // Black
  
  // Top border
  const topBorderGeom = new THREE.PlaneGeometry(width + borderThickness * 2, borderThickness);
  const borderMat = new THREE.MeshBasicMaterial({ color: borderColor, depthTest: false });
  const topBorder = new THREE.Mesh(topBorderGeom, borderMat);
  topBorder.position.set(0, height / 2 + borderThickness / 2, 0.002);
  barGroup.add(topBorder);

  // Bottom border
  const bottomBorder = new THREE.Mesh(topBorderGeom, borderMat.clone());
  bottomBorder.position.set(0, -height / 2 - borderThickness / 2, 0.002);
  barGroup.add(bottomBorder);

  // Left border
  const sideBorderGeom = new THREE.PlaneGeometry(borderThickness, height + borderThickness * 2);
  const leftBorder = new THREE.Mesh(sideBorderGeom, borderMat.clone());
  leftBorder.position.set(-width / 2 - borderThickness / 2, 0, 0.002);
  barGroup.add(leftBorder);

  // Right border
  const rightBorder = new THREE.Mesh(sideBorderGeom, borderMat.clone());
  rightBorder.position.set(width / 2 + borderThickness / 2, 0, 0.002);
  barGroup.add(rightBorder);

  // Add division lines (StarCraft 2 style)
  const numDivisions = 6; // Number of segments
  const lineThickness = 0.02;
  const lineColor = 0x000000; // Black lines

  for (let i = 1; i < numDivisions; i++) {
    const lineGeom = new THREE.PlaneGeometry(lineThickness, height);
    const lineMat = new THREE.MeshBasicMaterial({ color: lineColor, depthTest: false });
    const line = new THREE.Mesh(lineGeom, lineMat);

    // Position lines evenly across the bar width
    const xPos = -(width / 2) + (width / numDivisions) * i;
    line.position.set(xPos, 0, 0.003); // Slightly in front of the bars
    barGroup.add(line);
  }

  // Use fixed dimensions for all units - same size regardless of model
  let barHeight = 2.0; // Default vertical position

  // Get model name from visual's userData and look up health bar height
  const modelName = visual.userData.modelName;
  if (modelName && MODEL_HEALTHBAR_HEIGHTS[modelName]) {
    barHeight = MODEL_HEALTHBAR_HEIGHTS[modelName];
  } else if (MODEL_HEALTHBAR_HEIGHTS[unitData.type]) {
    // Fallback to geometry type if model name not found
    barHeight = MODEL_HEALTHBAR_HEIGHTS[unitData.type];
  } else {
    // Final fallback based on old logic
    if (unitData.type === 'sphere') {
      barHeight = 9;
    } else if (unitData.type === 'cube') {
      barHeight = 7;
    } else if (unitData.type === 'triangle') {
      barHeight = 5;
    }
  }

  barGroup.position.set(0, barHeight, 0);

  barGroup.renderOrder = 10;
  barGroup.userData.isHealthBar = true;
  barGroup.userData.isBillboard = true; // Mark as billboard for camera-facing

  // Counterscale the health bar to cancel out the parent visual's scale
  // This ensures all health bars are the same size regardless of unit scale
  const scaleX = visual.scale.x || 1.0;
  const scaleY = visual.scale.y || 1.0;
  const scaleZ = visual.scale.z || 1.0;
  barGroup.scale.set(1 / scaleX, 1 / scaleY, 1 / scaleZ);

  visual.add(barGroup);

  visual.userData.healthBar = {
    group: barGroup,
    fg,
    width,
  };

  // Initialize bar scale
  updateHealthBarVisual(visual);
}

/**
 * Update a unit's health bar based on its current health.
 */
export function updateHealthBarVisual(visual) {
  if (!visual || !visual.userData) return;
  const unitData = visual.userData.unit;
  const hb = visual.userData.healthBar;
  if (!unitData || !hb) return;

  const frac = Math.max(0, Math.min(1, unitData.health / unitData.maxHealth));
  hb.fg.scale.x = frac;
  hb.fg.position.x = -(1 - frac) * (hb.width / 2);
  hb.group.visible = !unitData.isDead;
  
  // Change color based on health percentage
  if (frac < 0.5) {
    // Below 50%: dark yellow
    hb.fg.material.color.setHex(0xccaa00);
  } else {
    // Above 50%: green
    hb.fg.material.color.setHex(0x0dd101);
  }
}

/**
 * Create units for a team and place them on terrain vertex grids
 */
function createTeamUnits(scene, terrain, teamId, startRow, startCol, geometryType) {
  const units = [];
  const color = TEAM_COLORS[teamId];

  const geometry = GEOMETRY_MAP[geometryType];
  if (!geometry) return units;

  // Place 3 units on different grid cells
  const offsets = [
    { row: 0, col: 0 }, // Starting cell
    { row: 0, col: 1 }, // One cell right
    { row: 1, col: 0 }, // One cell down
  ];

  offsets.forEach((offset) => {
    const cellRow = startRow + offset.row;
    const cellCol = startCol + offset.col;
    const cell = terrain.getCell(cellRow, cellCol);

    if (cell) {
      const visual = geometry.create(color);

      // Attach logical Unit data (health, speed, collider) to the visual object
      const unitData = new Unit({
        maxHealth: 100,
        team: teamId,
        type: geometry.type,
        speed: 2.0,
      });
      unitData.bindObject(visual);

      // Expose unit data via userData while keeping existing fields
      visual.userData.unit = unitData;

      // Use raycasting to find exact terrain height at this position
      const terrainHeight = getTerrainHeightAt(scene, cell.x, cell.z, cell);

      // Place unit on the terrain surface
      visual.position.set(cell.x, terrainHeight + geometry.yOffset, cell.z);

      // Now that the unit is placed, update collider and attach health bar above the model
      unitData.updateCollider();
      attachHealthBar(visual, unitData);

      visual.userData = {
        ...(visual.userData || {}),
        team: teamId,
        cell,
        currentCell: cell, // Track current grid cell for collision
        type: geometry.type,
      };

      // Add unit to cell's units array
      cell.addUnit(visual);

      scene.add(visual);
      units.push(visual);
    }
  });

  return units;
}

/**
 * Find a valid spawn cell free of collisions.
 * Tries the base cell first, then adjacent cells in a spiral pattern.
 */
function findValidSpawnCell(scene, terrain, baseRow, baseCol, geometry) {
  // Search pattern: base cell + adjacent cells in spiral order
  const searchOrder = [
    { row: 0, col: 0 },     // Base cell
    { row: 0, col: 1 },     // Right
    { row: 1, col: 0 },     // Down
    { row: 0, col: -1 },    // Left
    { row: -1, col: 0 },    // Up
    { row: 1, col: 1 },     // Down-right
    { row: 1, col: -1 },    // Down-left
    { row: -1, col: 1 },    // Up-right
    { row: -1, col: -1 },   // Up-left
    { row: 0, col: 2 },     // Further right
    { row: 2, col: 0 },     // Further down
  ];

  for (const offset of searchOrder) {
    const cellRow = baseRow + offset.row;
    const cellCol = baseCol + offset.col;
    const cell = terrain.getCell(cellRow, cellCol);

    if (!cell || !cell.walkable) continue;

    // Check if this cell has any units already
    if (cell.units && cell.units.length > 0) continue;

    return cell;
  }

  // Fallback: return base cell (will overlap if necessary)
  return terrain.getCell(baseRow, baseCol);
}

/**
 * Spawn a single unit at a team's base cell (no offsets), used for periodic spawning.
 * Checks for collisions and tries to spawn in an adjacent cell if occupied.
 */
export function spawnUnitAtBase(scene, terrain, teamId, buffGridsOwned = 0) {
  const base = TEAM_BASES[teamId];
  if (!base) return null;

  const color = TEAM_COLORS[teamId];
  const geometry = GEOMETRY_MAP[base.geometryType];
  if (!geometry) return null;

  // Find a valid spawn cell without collisions
  const cell = findValidSpawnCell(scene, terrain, base.startRow, base.startCol, geometry);
  if (!cell) return null;

  const visual = geometry.create(color);

  // Attach logical Unit data with slight buff per captured grid (2% per grid)
  const healthBuff = 1 + (buffGridsOwned * 0.02);
  const speedBuff = 1 + (buffGridsOwned * 0.02);
  const unitData = new Unit({
    maxHealth: Math.floor(100 * healthBuff),
    team: teamId,
    type: geometry.type,
    speed: 2.0 * speedBuff,
  });
  unitData.bindObject(visual);

  const terrainHeight = getTerrainHeightAt(scene, cell.x, cell.z, cell);
  visual.position.set(cell.x, terrainHeight + geometry.yOffset, cell.z);

  // Update collider after placing, then attach health bar above model
  unitData.updateCollider();
  attachHealthBar(visual, unitData);

  visual.userData = {
    ...(visual.userData || {}),
    unit: unitData,
    team: teamId,
    cell,
    currentCell: cell,
    type: geometry.type,
  };

  cell.addUnit(visual);
  scene.add(visual);

  return visual;
}

/**
 * Spawn all teams on the terrain
 * Team 1: camel team (Camel, Cat, Fox), Team 2: player team (Alien, Archer, Astronaut), Team 3: ant team (Ant, Grasshopper, Beetle)
 */
export async function spawnTeams(scene, terrain) {
  // Load all models before creating units
  await Promise.all([
    // Team 1 models (Camel team)
    loadCamelModel(),
    loadCatModel(),
    loadFoxModel(),
    // Team 2 models (Player team)
    loadAlienModel(),
    loadArcherModel(),
    loadAstronautModel(),
    // Team 3 models (Ant team)
    loadAntModel(),
    loadGrasshopperModel(),
    loadBeetleModel()
  ]);

  const teams = {
    team1: createTeamUnits(scene, terrain, 'team1', TEAM_BASES.team1.startRow, TEAM_BASES.team1.startCol, TEAM_BASES.team1.geometryType),
    team2: createTeamUnits(scene, terrain, 'team2', TEAM_BASES.team2.startRow, TEAM_BASES.team2.startCol, TEAM_BASES.team2.geometryType),
    team3: createTeamUnits(scene, terrain, 'team3', TEAM_BASES.team3.startRow, TEAM_BASES.team3.startCol, TEAM_BASES.team3.geometryType),
  };

  // Mark base cells as spawn type and tint with team colors
  Object.entries(TEAM_BASES).forEach(([id, base]) => {
    const cell = terrain.getCell(base.startRow, base.startCol);
    if (cell) {
      cell.setType('spawn');
      if (cell.mesh && cell.mesh.material) {
        cell.mesh.material.color.setHex(TEAM_COLORS[id]);
        cell.mesh.material.needsUpdate = true;
      }
    }
  });

  return teams;
}

// Team base configuration: which grid cell and geometry each team uses
export const TEAM_BASES = {
  team1: { startRow: 2, startCol: 2, geometryType: 'sphere' }, // Top-left edge: camel
  team2: { startRow: 2, startCol: 20, geometryType: 'cube' }, // Top-right edge: cobra (player)
  team3: { startRow: 20, startCol: 2, geometryType: 'triangle' }, // Bottom-left edge: ant
};
