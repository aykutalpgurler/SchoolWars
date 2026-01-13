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

// Cache for loaded models
let camelModelCache = null;
let antModelCache = null;
let cobraModelCache = null;

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
 * Create a cobra unit from the loaded model (replaces cube)
 */
function makeCubeUnit(color) {
  if (!cobraModelCache) {
    console.error('Cobra model not loaded yet. Call loadCobraModel() first.');
    // Fallback to cube if model not loaded
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Clone the cached model (deep clone to clone materials and textures)
  const cobra = cobraModelCache.clone(true);
  
  // Calculate bounding box to determine size for collision helper
  const box = new THREE.Box3().setFromObject(cobra);
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
  cobra.add(collisionHelper);
  
  // Apply team color as a very subtle tint while preserving material properties
  cobra.traverse((child) => {
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
  
  return cobra;
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
 * Create an ant unit from the loaded model
 */
function makeTriangleUnit(color) {
  if (!antModelCache) {
    console.error('Ant model not loaded yet. Call loadAntModel() first.');
    // Fallback to triangle if model not loaded
  const geo = new THREE.TetrahedronGeometry(0.2, 0);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
  }

  // Clone the cached model (deep clone to clone materials and textures)
  const ant = antModelCache.clone(true);
  
  // Apply team color as a very subtle tint while preserving dark appearance
  ant.traverse((child) => {
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
  
  return ant;
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
 * Create a camel unit from the loaded model
 */
function makeSphereUnit(color) {
  if (!camelModelCache) {
    console.error('Camel model not loaded yet. Call loadCamelModel() first.');
    // Fallback to sphere if model not loaded
  const geo = new THREE.SphereGeometry(0.2, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
  }

  // Clone the cached model (deep clone to clone materials and textures)
  const camel = camelModelCache.clone(true);
  
  // Apply team color as a very subtle tint while preserving material properties
  camel.traverse((child) => {
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
  
  return camel;
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
 * Spawn a single unit at a team's base cell (no offsets), used for periodic spawning.
 */
export function spawnUnitAtBase(scene, terrain, teamId) {
  const base = TEAM_BASES[teamId];
  if (!base) return null;

  const color = TEAM_COLORS[teamId];
  const geometry = GEOMETRY_MAP[base.geometryType];
  if (!geometry) return null;

  const cell = terrain.getCell(base.startRow, base.startCol);
  if (!cell) return null;

  const visual = geometry.create(color);

  // Attach logical Unit data
  const unitData = new Unit({
    maxHealth: 100,
    team: teamId,
    type: geometry.type,
    speed: 2.0,
  });
  unitData.bindObject(visual);

  const terrainHeight = getTerrainHeightAt(scene, cell.x, cell.z, cell);
  visual.position.set(cell.x, terrainHeight + geometry.yOffset, cell.z);

  visual.userData = {
    ...(visual.userData || {}),
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
 * Team 1: camel (replaces sphere), Team 2: cube, Team 3: ant (replaces triangle)
 */
export async function spawnTeams(scene, terrain) {
  // Load models before creating units
  await Promise.all([
    loadCamelModel(),
    loadAntModel(),
    loadCobraModel()
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
  team1: { startRow: 2, startCol: 2, geometryType: 'sphere' }, // Top-left: camel
  team2: { startRow: 2, startCol: 13, geometryType: 'cube' }, // Top-right: cobra
  team3: { startRow: 13, startCol: 2, geometryType: 'triangle' }, // Bottom-left: ant
};
