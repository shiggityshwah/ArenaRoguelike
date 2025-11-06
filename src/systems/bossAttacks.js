/**
 * Boss Attack Pattern Library
 *
 * Implements all boss attack patterns, telegraphs, and special abilities:
 * - Projectile patterns (spread, burst, orbit, rain)
 * - Melee attacks (charge, slam)
 * - Special mechanics (laser, gravity, hazards)
 * - Telegraph/warning systems
 */

import * as THREE from 'three';

/**
 * Create ground warning circle for telegraphed attacks
 * @param {Object} scene - THREE.js scene
 * @param {THREE.Vector3} position - Warning position
 * @param {number} radius - Warning radius
 * @param {number} duration - How long warning lasts
 * @param {number} color - Warning color (hex)
 * @returns {Object} Warning object with update/destroy methods
 */
export function createGroundWarning(scene, position, radius, duration, color = 0xff0000) {
  const geometry = new THREE.RingGeometry(radius * 0.9, radius, 32);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.position.set(position.x, 1, position.z); // Slightly above ground
  ring.rotation.x = Math.PI / 2;

  scene.add(ring);

  let elapsed = 0;
  let active = true;

  return {
    update(delta) {
      if (!active) return false;

      elapsed += delta;

      // Pulse effect
      const pulse = Math.sin(elapsed * 10) * 0.2 + 0.6;
      material.opacity = pulse;

      // Scale pulse
      const scale = 1 + Math.sin(elapsed * 8) * 0.05;
      ring.scale.set(scale, scale, 1);

      if (elapsed >= duration) {
        this.destroy();
        return false;
      }

      return true;
    },
    destroy() {
      if (active) {
        scene.remove(ring);
        geometry.dispose();
        material.dispose();
        active = false;
      }
    },
    ring,
  };
}

/**
 * Create laser telegraph (line showing where laser will fire)
 * @param {Object} scene - THREE.js scene
 * @param {THREE.Vector3} start - Laser start position
 * @param {THREE.Vector3} end - Laser end position
 * @param {number} duration - Telegraph duration
 * @returns {Object} Telegraph object
 */
export function createLaserTelegraph(scene, start, end, duration) {
  const points = [start.clone(), end.clone()];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xff0000,
    linewidth: 3,
    transparent: true,
    opacity: 0.8,
  });

  const line = new THREE.Line(geometry, material);
  scene.add(line);

  let elapsed = 0;
  let active = true;

  return {
    update(delta) {
      if (!active) return false;

      elapsed += delta;

      // Blink effect
      material.opacity = Math.sin(elapsed * 15) * 0.3 + 0.7;

      if (elapsed >= duration) {
        this.destroy();
        return false;
      }

      return true;
    },
    destroy() {
      if (active) {
        scene.remove(line);
        geometry.dispose();
        material.dispose();
        active = false;
      }
    },
    line,
  };
}

/**
 * Fire spread shot pattern
 * @param {Object} params - Attack parameters
 * @returns {Array} Created projectiles
 */
export function fireSpreadShot(params) {
  const {
    scene,
    position,
    targetPosition,
    projectileCount,
    arcDegrees,
    projectileSpeed,
    projectileColor,
    projectileSize,
    projectiles,
    projectilePool,
  } = params;

  // Validate position
  if (!position || typeof position.x !== 'number' || typeof position.z !== 'number' ||
      isNaN(position.x) || isNaN(position.z)) {
    console.warn('fireSpreadShot: Invalid position', position);
    return [];
  }

  if (!targetPosition || typeof targetPosition.x !== 'number' || typeof targetPosition.z !== 'number') {
    console.warn('fireSpreadShot: Invalid targetPosition', targetPosition);
    return [];
  }

  const createdProjectiles = [];

  // Calculate direction to target
  const direction = new THREE.Vector2(
    targetPosition.x - position.x,
    targetPosition.z - position.z
  ).normalize();

  const baseAngle = Math.atan2(direction.y, direction.x);
  const arcRadians = (arcDegrees * Math.PI) / 180;
  const angleStep = projectileCount > 1 ? arcRadians / (projectileCount - 1) : 0;
  const startAngle = baseAngle - arcRadians / 2;

  for (let i = 0; i < projectileCount; i++) {
    const angle = startAngle + angleStep * i;

    // Get projectile from pool
    const projectileObj = projectilePool.get();

    // Set position at player height (y=2 matches playerCone height)
    projectileObj.mesh.position.set(position.x, 2, position.z);

    // Set direction (horizontal only, no vertical component)
    projectileObj.direction.set(
      Math.cos(angle),
      0,
      Math.sin(angle)
    ).normalize();

    projectileObj.distanceTraveled = 0;
    projectileObj.damage = params.damage || 25; // Set damage from params

    // Add to projectiles array
    projectiles.push(projectileObj);
    createdProjectiles.push(projectileObj);
  }

  return createdProjectiles;
}

/**
 * Fire burst shot pattern (rapid sequential shots)
 * @param {Object} params - Attack parameters
 * @returns {Object} Burst state object
 */
export function startBurstShot(params) {
  const {
    projectileCount,
    delayBetweenShots,
    onFireProjectile,
  } = params;

  let shotsFired = 0;
  let timeSinceLastShot = 0;

  return {
    update(delta) {
      if (shotsFired >= projectileCount) {
        return false; // Burst complete
      }

      timeSinceLastShot += delta;

      if (timeSinceLastShot >= delayBetweenShots) {
        onFireProjectile(shotsFired);
        shotsFired++;
        timeSinceLastShot = 0;
      }

      return true; // Burst ongoing
    },
    complete: () => shotsFired >= projectileCount,
  };
}

/**
 * Fire homing missile
 * @param {Object} params - Attack parameters
 * @returns {Object} Created missile
 */
export function fireHomingMissile(params) {
  const {
    scene,
    position,
    target,
    projectileSpeed,
    homingStrength,
    projectileColor,
    projectiles,
    projectilePool,
  } = params;

  const projectile = projectilePool.acquire();
  projectile.position.copy(position);

  // Initial velocity toward target
  const direction = new THREE.Vector3()
    .subVectors(target, position)
    .normalize();

  const velocity = direction.multiplyScalar(projectileSpeed);

  projectile.userData.velocity = velocity;
  projectile.userData.damage = params.damage || 30;
  projectile.userData.lifetime = params.lifetime || 8.0;
  projectile.userData.age = 0;
  projectile.userData.fromEnemy = true;
  projectile.userData.homing = true;
  projectile.userData.homingTarget = target;
  projectile.userData.homingStrength = homingStrength;

  projectile.material.color.setHex(projectileColor);
  projectile.material.emissive.setHex(projectileColor);
  projectile.material.emissiveIntensity = 1.5;

  projectiles.push(projectile);
  scene.add(projectile);

  return projectile;
}

/**
 * Update homing projectile
 * @param {Object} projectile - Projectile mesh
 * @param {THREE.Vector3} targetPosition - Current target position
 * @param {number} delta - Time delta
 */
export function updateHomingProjectile(projectile, targetPosition, delta) {
  if (!projectile.userData.homing) return;

  const currentVelocity = projectile.userData.velocity;
  const toTarget = new THREE.Vector3()
    .subVectors(targetPosition, projectile.position)
    .normalize();

  // Blend current velocity with target direction
  const homingStrength = projectile.userData.homingStrength || 0.5;
  currentVelocity.lerp(
    toTarget.multiplyScalar(currentVelocity.length()),
    homingStrength * delta * 2
  );

  // Rotate projectile to face direction
  const angle = Math.atan2(currentVelocity.z, currentVelocity.x);
  projectile.rotation.y = angle;
}

/**
 * Create orbital projectiles (circle around boss then shoot out)
 * @param {Object} params - Attack parameters
 * @returns {Array} Created orbital projectiles
 */
export function createOrbitalProjectiles(params) {
  const {
    scene,
    centerPosition,
    projectileCount,
    orbitRadius,
    projectileColor,
    projectileSize,
  } = params;

  const orbitals = [];
  const angleStep = (Math.PI * 2) / projectileCount;

  for (let i = 0; i < projectileCount; i++) {
    const angle = angleStep * i;
    const geometry = new THREE.SphereGeometry(projectileSize || 3);
    const material = new THREE.MeshStandardMaterial({
      color: projectileColor,
      emissive: projectileColor,
      emissiveIntensity: 1.0,
    });

    const projectile = new THREE.Mesh(geometry, material);

    projectile.position.set(
      centerPosition.x + Math.cos(angle) * orbitRadius,
      2, // Match player height
      centerPosition.z + Math.sin(angle) * orbitRadius
    );

    projectile.userData.orbitAngle = angle;
    projectile.userData.orbitRadius = orbitRadius;
    projectile.userData.orbitCenter = new THREE.Vector3(centerPosition.x, 2, centerPosition.z); // Use player height
    projectile.userData.damage = params.damage || 20;

    scene.add(projectile);
    orbitals.push(projectile);
  }

  return orbitals;
}

/**
 * Update orbital projectiles
 * @param {Array} orbitals - Orbital projectile array
 * @param {number} delta - Time delta
 * @param {number} rotationSpeed - Degrees per second
 */
export function updateOrbitalProjectiles(orbitals, delta, rotationSpeed) {
  const rotationRadians = (rotationSpeed * Math.PI * delta) / 180;

  orbitals.forEach((orbital) => {
    if (!orbital.userData.orbitAngle) return;

    orbital.userData.orbitAngle += rotationRadians;

    const { orbitCenter, orbitRadius, orbitAngle } = orbital.userData;

    orbital.position.set(
      orbitCenter.x + Math.cos(orbitAngle) * orbitRadius,
      2, // Keep at player height
      orbitCenter.z + Math.sin(orbitAngle) * orbitRadius
    );
  });
}

/**
 * Launch orbital projectiles outward
 * @param {Array} orbitals - Orbital projectile array
 * @param {number} speed - Launch speed
 * @param {Array} projectiles - Main projectile array to add to
 */
export function launchOrbitalProjectiles(orbitals, speed, projectiles) {
  orbitals.forEach((orbital) => {
    const angle = orbital.userData.orbitAngle || 0;
    const direction = new THREE.Vector3(
      Math.cos(angle),
      0,
      Math.sin(angle)
    ).normalize();

    // Convert orbital mesh to projectile format
    const projectile = {
      mesh: orbital,
      direction: direction,
      distanceTraveled: 0,
      damage: orbital.userData.damage || 20,
    };

    projectiles.push(projectile);
  });
}

/**
 * Create plasma rain attack (projectiles fall from sky)
 * @param {Object} params - Attack parameters
 * @returns {Object} Rain state with warnings
 */
export function createPlasmaRain(params) {
  const {
    scene,
    targetPosition,
    projectileCount,
    targetRadius,
    fallSpeed,
    telegraphDuration,
    projectileColor,
    warnings,
  } = params;

  const impactPositions = [];

  // Create random impact positions in target area
  for (let i = 0; i < projectileCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * targetRadius;

    const position = new THREE.Vector3(
      targetPosition.x + Math.cos(angle) * distance,
      0,
      targetPosition.z + Math.sin(angle) * distance
    );

    impactPositions.push(position);

    // Create warning
    const warning = createGroundWarning(scene, position, 15, telegraphDuration, projectileColor);
    warnings.push(warning);
  }

  return {
    impactPositions,
    telegraphDuration,
    launched: false,
  };
}

/**
 * Launch plasma rain projectiles after telegraph
 * @param {Object} params - Launch parameters
 */
export function launchPlasmaRain(params) {
  const {
    scene,
    impactPositions,
    fallSpeed,
    projectileColor,
    projectiles,
    projectilePool,
  } = params;

  impactPositions.forEach((impactPos) => {
    const projectile = projectilePool.acquire();

    projectile.position.set(impactPos.x, 200, impactPos.z); // High in sky

    const velocity = new THREE.Vector3(0, -fallSpeed, 0);

    projectile.userData.velocity = velocity;
    projectile.userData.damage = params.damage || 35;
    projectile.userData.lifetime = 10.0;
    projectile.userData.age = 0;
    projectile.userData.fromEnemy = true;
    projectile.userData.plasmaRain = true;

    projectile.material.color.setHex(projectileColor);
    projectile.material.emissive.setHex(projectileColor);
    projectile.scale.setScalar(1.5);

    projectiles.push(projectile);
    scene.add(projectile);
  });
}

/**
 * Create laser beam attack
 * @param {Object} params - Laser parameters
 * @returns {Object} Laser beam object
 */
export function createLaserBeam(params) {
  const {
    scene,
    start,
    end,
    width,
    color,
    duration,
  } = params;

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  direction.normalize();

  const geometry = new THREE.CylinderGeometry(width, width, length, 8);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
  });

  const beam = new THREE.Mesh(geometry, material);

  // Position beam between start and end
  beam.position.copy(start).add(direction.multiplyScalar(length / 2));

  // Rotate to point from start to end
  const axis = new THREE.Vector3(0, 1, 0);
  const angle = Math.acos(axis.dot(direction));
  const rotationAxis = new THREE.Vector3().crossVectors(axis, direction).normalize();

  if (rotationAxis.length() > 0) {
    beam.quaternion.setFromAxisAngle(rotationAxis, angle);
  }

  scene.add(beam);

  let elapsed = 0;
  let active = true;

  return {
    update(delta) {
      if (!active) return false;

      elapsed += delta;

      // Pulse effect
      const pulse = Math.sin(elapsed * 20) * 0.2 + 0.8;
      material.opacity = pulse;

      if (elapsed >= duration) {
        this.destroy();
        return false;
      }

      return true;
    },
    destroy() {
      if (active) {
        scene.remove(beam);
        geometry.dispose();
        material.dispose();
        active = false;
      }
    },
    beam,
    damage: params.damage || 50,
  };
}

/**
 * Create ground hazard (persistent damage zone)
 * @param {Object} params - Hazard parameters
 * @returns {Object} Hazard object
 */
export function createGroundHazard(params) {
  const {
    scene,
    position,
    radius,
    duration,
    damagePerSecond,
    color,
  } = params;

  const geometry = new THREE.CircleGeometry(radius, 32);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });

  const hazard = new THREE.Mesh(geometry, material);
  hazard.position.set(position.x, 0.5, position.z); // Ensure ground level
  hazard.rotation.x = Math.PI / 2;

  scene.add(hazard);

  let elapsed = 0;
  let active = true;

  return {
    position: new THREE.Vector3(position.x, 0, position.z), // Store ground-level position
    radius,
    damagePerSecond,
    update(delta) {
      if (!active) return false;

      elapsed += delta;

      // Pulse effect
      const pulse = Math.sin(elapsed * 5) * 0.2 + 0.5;
      material.opacity = pulse;

      if (elapsed >= duration) {
        this.destroy();
        return false;
      }

      return true;
    },
    destroy() {
      if (active) {
        scene.remove(hazard);
        geometry.dispose();
        material.dispose();
        active = false;
      }
    },
    hazard,
  };
}

/**
 * Create gravity zone (pulls player toward center)
 * @param {Object} params - Zone parameters
 * @returns {Object} Gravity zone object
 */
export function createGravityZone(params) {
  const {
    scene,
    position,
    radius,
    duration,
    pullStrength,
    color,
  } = params;

  // Outer ring
  const outerGeometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
  });

  const outerRing = new THREE.Mesh(outerGeometry, outerMaterial);
  outerRing.position.set(position.x, 1, position.z); // Lock to ground level
  outerRing.rotation.x = Math.PI / 2;

  // Inner circle
  const innerGeometry = new THREE.CircleGeometry(radius * 0.3, 32);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  const innerCircle = new THREE.Mesh(innerGeometry, innerMaterial);
  innerCircle.position.set(position.x, 1.1, position.z); // Lock to ground level
  innerCircle.rotation.x = Math.PI / 2;

  scene.add(outerRing);
  scene.add(innerCircle);

  let elapsed = 0;
  let active = true;

  return {
    position: new THREE.Vector3(position.x, 0, position.z), // Store ground-level position
    radius,
    pullStrength,
    update(delta) {
      if (!active) return false;

      elapsed += delta;

      // Rotation effect
      outerRing.rotation.z += delta;
      innerCircle.rotation.z -= delta * 2;

      // Pulse
      const pulse = Math.sin(elapsed * 3) * 0.2 + 0.6;
      outerMaterial.opacity = pulse;

      if (elapsed >= duration) {
        this.destroy();
        return false;
      }

      return true;
    },
    destroy() {
      if (active) {
        scene.remove(outerRing);
        scene.remove(innerCircle);
        outerGeometry.dispose();
        outerMaterial.dispose();
        innerGeometry.dispose();
        innerMaterial.dispose();
        active = false;
      }
    },
  };
}

/**
 * Spawn minions for a boss
 * @param {Object} params - Spawn parameters
 * @param {Function} spawnEnemyFunction - Function to spawn enemy
 */
export function spawnBossMinions(params, spawnEnemyFunction) {
  const {
    bossPosition,
    minionType,
    count,
    level,
  } = params;

  const minions = [];
  const spawnRadius = 80;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const spawnPos = new THREE.Vector3(
      bossPosition.x + Math.cos(angle) * spawnRadius,
      100, // Spawn height
      bossPosition.z + Math.sin(angle) * spawnRadius
    );

    const minion = spawnEnemyFunction(minionType, level, spawnPos);
    if (minion && minion.mesh) {
      if (!minion.mesh.userData) {
        minion.mesh.userData = {};
      }
      minion.mesh.userData.isMinionOf = params.bossId;
      minions.push(minion);
    }
  }

  return minions;
}
