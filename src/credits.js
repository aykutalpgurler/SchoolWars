import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js';

// Readable pixel art font - 5x7 grid for each letter (1 = cat, 0 = empty)
const PIXEL_FONT = {
  'A': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1]
  ],
  'B': [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0]
  ],
  'C': [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,1,1,1]
  ],
  'Ç': [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,1,1,1]
  ],
  'D': [
    [1,1,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,1,0],
    [1,1,1,0,0]
  ],
  'E': [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1]
  ],
  'G': [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,1]
  ],
  'Ğ': [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,1]
  ],
  'H': [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1]
  ],
  'I': [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [1,1,1,1,1]
  ],
  'İ': [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [1,1,1,1,1]
  ],
  'K': [
    [1,0,0,0,1],
    [1,0,0,1,0],
    [1,0,1,0,0],
    [1,1,0,0,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1]
  ],
  'L': [
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1]
  ],
  'M': [
    [1,0,0,0,1],
    [1,1,0,1,1],
    [1,0,1,0,1],
    [1,0,1,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1]
  ],
  'O': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  'Ö': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  'P': [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0]
  ],
  'R': [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1]
  ],
  'T': [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0]
  ],
  'U': [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  'Ü': [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  'Y': [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0]
  ],
  'Z': [
    [1,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1]
  ],
  ' ': [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0]
  ]
};

export class CreditsSystem {
  constructor(scene, camera, cameraController) {
    this.scene = scene;
    this.camera = camera;
    this.cameraController = cameraController;
    this.catObjects = [];
    this.isShowingCredits = false;
    this.originalCameraPosition = new THREE.Vector3();
    this.originalCameraRotation = new THREE.Euler();
    this.originalCameraFov = null;
    this.originalFog = null;
    this.catModel = null;
    this.isAnimating = false;
    this.creditsLight = null;
  }

  async loadCatModel() {
    if (this.catModel) return this.catModel;

    return new Promise((resolve, reject) => {
      const mtlLoader = new MTLLoader();
      const objLoader = new OBJLoader();

      mtlLoader.setPath('./assets/desert-creatures/Cat/');
      mtlLoader.load('Mesh_Cat.mtl', (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.setPath('./assets/desert-creatures/Cat/');
        
        objLoader.load('Mesh_Cat.obj', (object) => {
          this.catModel = object;
          resolve(object);
        }, undefined, reject);
      }, undefined, reject);
    });
  }

  createTextFromCats(text, startX, startY, startZ) {
    const letterSpacing = 6;
    const catScale = 0.035;
    let currentX = startX;

    const words = text.toUpperCase().split(' ');
    
    words.forEach((word, wordIndex) => {
      if (wordIndex > 0) currentX += letterSpacing; // Space between words
      
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        const pattern = PIXEL_FONT[char] || PIXEL_FONT[' '];
        
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 5; col++) {
            if (pattern[row][col] === 1) {
              const cat = this.catModel.clone();
              cat.position.set(
                currentX + (col * 1.1),
                startY - (row * 1.1),
                startZ
              );
              cat.scale.set(catScale, catScale, catScale);
              
              
              this.scene.add(cat);
              this.catObjects.push(cat);
            }
          }
        }
        
        currentX += letterSpacing;
      }
    });
  }

  async showCredits() {
    if (this.isShowingCredits || this.isAnimating) return;
    
    console.log('[Credits] Loading credits scene...');
    this.isAnimating = true;

    try {
      // Save current camera position and settings for returning to game
      this.originalCameraPosition.copy(this.camera.position);
      this.originalCameraRotation.copy(this.camera.rotation);
      this.originalCameraFov = this.camera.fov;
      this.originalFog = this.scene.fog;

      // Disable fog during credits
      this.scene.fog = null;

      // DISABLE camera controller so it doesn't interfere
      if (this.cameraController && this.cameraController.enabled !== undefined) {
        this.cameraController.enabled = false;
      }

      // Load cat model
      await this.loadCatModel();

      // Add lighting for credits area
      this.creditsLight = new THREE.DirectionalLight(0xffffff, 2);
      this.creditsLight.position.set(0, 250, 150);
      this.scene.add(this.creditsLight);

      // Create the names with cat objects - far away from terrain
      const names = [
        'AYKUT ALP GURLER',
        'OGUZ PARLAKKAYA',
        'HALIL IBRAHIM CAK'
      ];

      let startY = 200;
      names.forEach((name, index) => {
        this.createTextFromCats(name, -60, startY - (index * 12), 150);
      });

      console.log(`[Credits] Created ${this.catObjects.length} cat objects`);

      // IMMEDIATELY set camera to look at text BEFORE animation starts
      const textCenter = new THREE.Vector3(-10, 195, 150);
      this.camera.lookAt(textCenter);

      // Animate camera to credits view
      await this.animateCameraToCredits();
      
      // Lock camera to look at text center after animation
      this.camera.lookAt(textCenter);
      
      this.isShowingCredits = true;
    } catch (error) {
      console.error('[Credits] Error loading credits:', error);
      // Cleanup on error
      this.catObjects.forEach(cat => this.scene.remove(cat));
      this.catObjects = [];
      if (this.creditsLight) {
        this.scene.remove(this.creditsLight);
        this.creditsLight = null;
      }
    } finally {
      this.isAnimating = false;
    }
  }

  async hideCredits() {
    if (!this.isShowingCredits || this.isAnimating) return;
    
    console.log('[Credits] Returning to game...');
    this.isAnimating = true;

    try {
      // Animate camera back
      await this.animateCameraBack();

      // Remove all cat objects
      this.catObjects.forEach(cat => {
        this.scene.remove(cat);
      });
      this.catObjects = [];

      // Remove credits light
      if (this.creditsLight) {
        this.scene.remove(this.creditsLight);
        this.creditsLight = null;
      }

      // Restore fog
      this.scene.fog = this.originalFog;

      // RE-ENABLE camera controller
      if (this.cameraController && this.cameraController.enabled !== undefined) {
        this.cameraController.enabled = true;
      }

      console.log('[Credits] Cleaned up cat objects');
      
      this.isShowingCredits = false;
    } catch (error) {
      console.error('[Credits] Error hiding credits:', error);
    } finally {
      this.isAnimating = false;
    }
  }

  animateCameraToCredits() {
    return new Promise((resolve) => {
      // Position camera to view text clearly
      const targetPosition = new THREE.Vector3(-10, 195, 240);
      const textCenter = new THREE.Vector3(-10, 195, 150);
      
      // Make FOV smaller for less perspective distortion
      const startFov = this.camera.fov;
      const targetFov = 65;
      
      this.animateCameraToLookAt(targetPosition, textCenter, startFov, targetFov, 2000, resolve);
    });
  }

  animateCameraBack() {
    return new Promise((resolve) => {
      const startFov = this.camera.fov;
      this.animateCameraWithFov(
        this.originalCameraPosition,
        this.originalCameraRotation,
        startFov,
        this.originalCameraFov,
        2000,
        resolve
      );
    });
  }

  animateCameraToLookAt(targetPos, lookAtTarget, startFov, targetFov, duration, onComplete) {
    const startPos = this.camera.position.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.camera.position.lerpVectors(startPos, targetPos, eased);
      
      // Always look at the text center
      this.camera.lookAt(lookAtTarget);
      
      // Animate FOV
      this.camera.fov = startFov + (targetFov - startFov) * eased;
      this.camera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    animate();
  }

  animateCameraWithFov(targetPos, targetRot, startFov, targetFov, duration, onComplete) {
    const startPos = this.camera.position.clone();
    const startRot = this.camera.rotation.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.camera.position.lerpVectors(startPos, targetPos, eased);
      this.camera.rotation.set(
        startRot.x + (targetRot.x - startRot.x) * eased,
        startRot.y + (targetRot.y - startRot.y) * eased,
        startRot.z + (targetRot.z - startRot.z) * eased
      );
      
      // Animate FOV
      this.camera.fov = startFov + (targetFov - startFov) * eased;
      this.camera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    animate();
  }

  async toggle() {
    if (this.isAnimating) return;
    
    if (this.isShowingCredits) {
      await this.hideCredits();
    } else {
      await this.showCredits();
    }
  }
}
