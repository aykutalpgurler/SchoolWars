import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/**
 * Logical Unit data model.
 * Holds game stats (health, speed, team, type) and a Box3 collider
 * that wraps the rendered THREE.Object3D, following the MDN pattern:
 * https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection/Bounding_volume_collision_detection_with_THREE.js
 */
export class Unit {
  constructor({
    maxHealth = 100,
    health = maxHealth,
    speed = 2.0,
    team = null,
    type = 'generic',
  } = {}) {
    this.maxHealth = maxHealth;
    this.health = health;
    this.speed = speed;
    this.team = team;
    this.type = type;

    /** @type {THREE.Object3D | null} */
    this.object = null;

    // Axis-aligned bounding box collider for this unit
    this.collider = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  }

  /**
   * Attach this logical unit to a rendered THREE object.
   */
  bindObject(object3D) {
    this.object = object3D;
    this.updateCollider();
  }

  /**
   * Recompute the Box3 collider so it tightly wraps the rendered object
   * (including children and current transforms), using setFromObject as
   * recommended by MDN.
   * Scale the collider down to 50% to reduce collision size
   */
  updateCollider() {
    if (!this.object) return;
    this.collider.setFromObject(this.object);
    
    // Scale down the collision box to 48% to maintain spacing
    const center = this.collider.getCenter(new THREE.Vector3());
    const size = this.collider.getSize(new THREE.Vector3());
    
    // Apply 0.48 scale factor for better unit spacing
    const scaleFactor = 0.48;
    const newSize = size.multiplyScalar(scaleFactor);
    
    this.collider.setFromCenterAndSize(center, newSize);
  }

  /**
   * Simple AABB vs. AABB intersection test against another Unit.
   */
  intersects(otherUnit) {
    if (!otherUnit) return false;
    return this.collider.intersectsBox(otherUnit.collider);
  }

  /**
   * Apply damage, clamping between 0 and maxHealth.
   */
  takeDamage(amount) {
    this.health = Math.max(0, Math.min(this.maxHealth, this.health - amount));
  }

  /**
   * Heal the unit, clamped to maxHealth.
   */
  heal(amount) {
    this.health = Math.max(0, Math.min(this.maxHealth, this.health + amount));
  }

  /**
   * Returns true if the unit is at 0 health.
   */
  get isDead() {
    return this.health <= 0;
  }
}

