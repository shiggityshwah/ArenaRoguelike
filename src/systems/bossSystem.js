/**
 * Boss System
 *
 * Core boss management system:
 * - Boss spawning and lifecycle
 * - Phase-based state machine
 * - Boss AI and behaviors
 * - Attack pattern execution
 * - Integration with boss attacks and UI
 */

import * as THREE from 'three';
import bossTypes, { calculateBossHealth } from '../config/bossTypes.js';
import enemyTypes from '../config/enemyTypes.js';
import * as BossAttacks from './bossAttacks.js';

let nextBossId = 1;

/**
 * Create a boss entity
 * @param {Object} params - Boss creation parameters
 * @returns {Object} Boss entity data
 */
export function createBoss(params) {
  const {
    scene,
    bossType,
    waveNumber,
    level,
    spawnPosition,
  } = params;

  const bossConfig = bossTypes[bossType];
  const enemyConfig = enemyTypes[bossType];

  if (!bossConfig || !enemyConfig) {
    console.error(`Unknown boss type: ${bossType}`);
    return null;
  }

  // Create geometry
  const geometry = typeof enemyConfig.geometry === 'function'
    ? enemyConfig.geometry()
    : enemyConfig.geometry.clone();

  // Create material with boss colors
  const material = new THREE.MeshStandardMaterial({
    color: bossConfig.color,
    emissive: bossConfig.emissiveColor || bossConfig.color,
    emissiveIntensity: bossConfig.emissiveIntensity || 0.5,
    metalness: 0.5,
    roughness: 0.5,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Position and scale
  mesh.position.copy(spawnPosition);
  mesh.scale.setScalar(bossConfig.scale);

  scene.add(mesh);

  // Calculate stats
  const maxHealth = calculateBossHealth(bossType, waveNumber);
  const baseSpeed = enemyConfig.baseSpeed + (level || 0) * (enemyConfig.speedLevelScale || 0.01);

  // Create boss entity
  const boss = {
    id: `boss_${nextBossId++}`,
    bossType,
    mesh,
    health: maxHealth,
    maxHealth,
    baseSpeed,
    contactDamage: bossConfig.contactDamage,
    level: level || 1,
    waveNumber: waveNumber || 1,

    // Phase system
    currentPhase: 0,
    phaseData: bossConfig.phases[0],

    // AI state
    state: 'spawning', // spawning, idle, attacking, special
    stateTimer: 0,
    attackCooldown: 0,
    currentAttack: null,
    maintainDistance: bossConfig.phases[0].maintainDistance || null,

    // Attack patterns
    activeAttacks: [], // Currently executing attacks
    activeWarnings: [], // Telegraph warnings
    activeHazards: [], // Ground hazards
    activeOrbitals: [], // Orbital projectiles
    activeLasers: [], // Laser beams
    activeGravityZones: [], // Gravity zones

    // Boss-specific data
    clones: [], // For Phantom Blade / Shade Monarch
    platforms: [], // For Warlord
    isInvulnerable: false,
    invulnerabilityHits: 0,
    shieldActive: false,
    weaponRotationTimer: 0,
    currentWeaponIndex: 0,

    // Special flags
    isBoss: true,
    isActive: true,
    spawning: true,
    spawnAnimationTime: 2.0,
    spawnAnimationElapsed: 0,

    // Minions spawned by this boss
    minions: [],
  };

  // Initialize boss-specific visuals
  initializeBossVisuals(scene, boss, bossConfig);

  return boss;
}

/**
 * Initialize boss-specific visual elements
 */
function initializeBossVisuals(scene, boss, bossConfig) {
  const mesh = boss.mesh;

  // Add crown for Cube King
  if (bossConfig.hasCrown) {
    const crownGeometry = new THREE.ConeGeometry(15, 30, 4);
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: bossConfig.crownColor,
      emissive: bossConfig.crownColor,
      emissiveIntensity: 1.0,
    });

    const crown = new THREE.Mesh(crownGeometry, crownMaterial);
    crown.position.y = 25;
    crown.rotation.y = Math.PI / 4;
    mesh.add(crown);

    boss.crown = crown;
  }

  // Add shield for Juggernaut (Phase 1)
  if (bossConfig.hasShield) {
    const shieldGroup = new THREE.Group();

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const hexGeometry = new THREE.CircleGeometry(8, 6);
      const hexMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });

      const hex = new THREE.Mesh(hexGeometry, hexMaterial);
      const radius = 50;

      hex.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      hex.rotation.y = -angle;

      shieldGroup.add(hex);
    }

    mesh.add(shieldGroup);
    boss.shieldGroup = shieldGroup;
    boss.shieldActive = true;
  }

  // Add weapon platforms for Warlord
  if (bossConfig.hasWeaponPlatforms) {
    boss.platformGroup = new THREE.Group();
    scene.add(boss.platformGroup);
  }

  // Add ghost fragments for Shade Monarch
  if (bossConfig.hasFragments) {
    const fragmentGroup = new THREE.Group();

    for (let i = 0; i < bossConfig.fragmentCount; i++) {
      const angle = (Math.PI * 2 * i) / bossConfig.fragmentCount;
      const fragGeometry = new THREE.TetrahedronGeometry(3);
      const fragMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
      });

      const fragment = new THREE.Mesh(fragGeometry, fragMaterial);
      const radius = 40;

      fragment.position.set(Math.cos(angle) * radius, 10, Math.sin(angle) * radius);
      fragment.userData.orbitAngle = angle;
      fragment.userData.orbitRadius = radius;

      fragmentGroup.add(fragment);
    }

    mesh.add(fragmentGroup);
    boss.fragmentGroup = fragmentGroup;
  }
}

/**
 * Update boss
 * @param {Object} boss - Boss entity
 * @param {Object} gameState - Current game state
 * @param {number} delta - Time delta in seconds
 */
export function updateBoss(boss, gameState, delta) {
  if (!boss.isActive || !boss.mesh) return;

  // Update spawn animation
  if (boss.spawning) {
    updateSpawnAnimation(boss, delta);
    if (boss.spawning) return; // Still spawning
  }

  // Update phase based on health
  updateBossPhase(boss, gameState);

  // Update boss-specific visual elements
  updateBossVisuals(boss, gameState, delta);

  // Update AI and behaviors
  updateBossAI(boss, gameState, delta);

  // Update active attacks
  updateActiveAttacks(boss, delta);

  // Update cooldowns
  if (boss.attackCooldown > 0) {
    boss.attackCooldown -= delta;
  }

  boss.stateTimer += delta;
}

/**
 * Update spawn animation
 */
function updateSpawnAnimation(boss, delta) {
  boss.spawnAnimationElapsed += delta;

  const progress = boss.spawnAnimationElapsed / boss.spawnAnimationTime;

  if (progress >= 1.0) {
    boss.spawning = false;
    boss.mesh.position.y = 0;
    boss.state = 'idle';
  } else {
    // Fall from sky
    const startY = 200;
    const endY = 0;
    boss.mesh.position.y = startY + (endY - startY) * easeOutBounce(progress);

    // Rotate while falling
    boss.mesh.rotation.y += delta * 3;
  }
}

/**
 * Ease out bounce function for spawn animation
 */
function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Update boss phase based on health
 */
function updateBossPhase(boss, gameState) {
  const bossConfig = bossTypes[boss.bossType];
  const healthPercent = boss.health / boss.maxHealth;

  for (let i = bossConfig.phases.length - 1; i >= 0; i--) {
    const phase = bossConfig.phases[i];

    if (healthPercent <= phase.healthPercent && healthPercent > phase.minHealthPercent) {
      if (boss.currentPhase !== i) {
        // Phase transition
        transitionToPhase(boss, i, gameState);
      }
      break;
    }
  }
}

/**
 * Transition boss to new phase
 */
function transitionToPhase(boss, phaseIndex, gameState) {
  console.log(`Boss ${boss.bossType} transitioning to phase ${phaseIndex}`);

  const bossConfig = bossTypes[boss.bossType];
  const oldPhase = boss.currentPhase;
  boss.currentPhase = phaseIndex;
  boss.phaseData = bossConfig.phases[phaseIndex];

  // Brief invulnerability during transition
  boss.isInvulnerable = true;
  setTimeout(() => {
    boss.isInvulnerable = false;
  }, 500);

  // Clear active attacks
  boss.activeAttacks = [];

  // Handle phase-specific onPhaseStart behaviors
  const behaviors = boss.phaseData.behaviors;

  if (behaviors.onPhaseStart) {
    const onStart = behaviors.onPhaseStart;

    // Shield shatter effect
    if (onStart.effect === 'shieldShatter' && boss.shieldGroup) {
      boss.shieldGroup.visible = false;
      boss.shieldActive = false;
    }

    // Armor break effect
    if (onStart.effect === 'armorBreak') {
      // Visual: Make boss darker/battle-worn
      boss.mesh.material.roughness = 0.8;
    }

    // Spawn clones
    if (onStart.effect === 'spawnClones') {
      spawnBossClones(boss, onStart.cloneCount, onStart.cloneHealth, gameState);
    }

    // Spawn phantom clones
    if (onStart.effect === 'spawnPhantomClones') {
      spawnPhantomClones(boss, onStart.cloneCount, onStart.cloneHealth, gameState);
    }

    // Deploy weapon platforms
    if (onStart.effect === 'deployPlatforms') {
      deployWeaponPlatforms(boss, onStart, gameState);
    }

    // Recall platforms
    if (onStart.effect === 'recallPlatforms') {
      recallWeaponPlatforms(boss, gameState);
    }

    // Summon minions
    if (onStart.summonMinions) {
      const minions = BossAttacks.spawnBossMinions(
        {
          bossPosition: boss.mesh.position,
          minionType: onStart.summonMinions.minionType,
          count: onStart.summonMinions.count,
          level: boss.level,
          bossId: boss.id,
        },
        (type, level, pos) => spawnMinionForBoss(type, level, pos, gameState)
      );

      boss.minions.push(...minions);
    }
  }

  // Color shift
  if (boss.phaseData.colorShift) {
    boss.mesh.material.color.setHex(boss.phaseData.colorShift);
    boss.mesh.material.emissive.setHex(boss.phaseData.colorShift);
  }

  // Update maintain distance
  boss.maintainDistance = boss.phaseData.maintainDistance || null;

  // Trigger UI phase transition effect
  if (gameState.bossUIManager) {
    gameState.bossUIManager.showPhaseTransition(boss, phaseIndex);
  }
}

/**
 * Update boss visual elements
 */
function updateBossVisuals(boss, gameState, delta) {
  // Rotate boss to face player
  if (gameState && gameState.playerCone) {
    boss.mesh.lookAt(gameState.playerCone.position);
    boss.mesh.rotation.x = 0;
    boss.mesh.rotation.z = 0;
  }

  // Update shield rotation
  if (boss.shieldGroup && boss.shieldActive) {
    boss.shieldGroup.rotation.y += delta * 2;
  }

  // Update ghost fragments
  if (boss.fragmentGroup) {
    boss.fragmentGroup.children.forEach((fragment, i) => {
      fragment.userData.orbitAngle += delta;
      const radius = fragment.userData.orbitRadius;
      const angle = fragment.userData.orbitAngle;

      fragment.position.set(
        Math.cos(angle) * radius,
        10 + Math.sin(fragment.userData.orbitAngle * 2) * 5,
        Math.sin(angle) * radius
      );

      fragment.rotation.x += delta * 2;
      fragment.rotation.y += delta * 3;
    });
  }

  // Update crown (lose spikes as health decreases)
  if (boss.crown) {
    const healthPercent = boss.health / boss.maxHealth;
    boss.crown.scale.y = Math.max(0.3, healthPercent);
  }
}

/**
 * Update boss AI and execute behaviors
 */
function updateBossAI(boss, gameState, delta) {
  const { playerCone } = gameState;
  if (!playerCone) return;

  const behaviors = boss.phaseData.behaviors;
  const bossPos = boss.mesh.position;
  const playerPos = playerCone.position;
  const distance = bossPos.distanceTo(playerPos);

  // Movement AI
  updateBossMovement(boss, playerPos, distance, delta);

  // Attack patterns
  if (boss.attackCooldown <= 0) {
    executeAttackPattern(boss, gameState);
  }

  // Special mechanics
  updateSpecialMechanics(boss, gameState, delta);
}

/**
 * Update boss movement
 */
function updateBossMovement(boss, playerPos, distance, delta) {
  const phaseData = boss.phaseData;
  const moveSpeed = boss.baseSpeed * (phaseData.moveSpeedMultiplier || 1.0);

  // Stationary bosses (Void Core Phase 2)
  if (phaseData.moveSpeedMultiplier === 0) {
    return;
  }

  const bossPos = boss.mesh.position;

  // Maintain distance (ranged bosses)
  if (boss.maintainDistance) {
    if (distance < boss.maintainDistance - 20) {
      // Move away from player
      const direction = new THREE.Vector3().subVectors(bossPos, playerPos).normalize();
      boss.mesh.position.add(direction.multiplyScalar(moveSpeed * delta * 60));
    } else if (distance > boss.maintainDistance + 20) {
      // Move toward player
      const direction = new THREE.Vector3().subVectors(playerPos, bossPos).normalize();
      boss.mesh.position.add(direction.multiplyScalar(moveSpeed * delta * 60));
    }
    // Otherwise, strafe around player
    else if (phaseData.behaviors.erraticMovement) {
      const strafeSpeed = phaseData.behaviors.erraticMovement.strafingSpeed || 1.0;
      const angle = boss.stateTimer * strafeSpeed;
      const offset = new THREE.Vector3(
        Math.cos(angle) * boss.maintainDistance,
        0,
        Math.sin(angle) * boss.maintainDistance
      );

      boss.mesh.position.set(
        playerPos.x + offset.x,
        bossPos.y,
        playerPos.z + offset.z
      );
    }
  }
  // Chase player (melee bosses)
  else if (distance > 30) {
    const direction = new THREE.Vector3().subVectors(playerPos, bossPos).normalize();
    boss.mesh.position.add(direction.multiplyScalar(moveSpeed * delta * 60));
  }
}

/**
 * Execute attack pattern based on boss type and phase
 */
function executeAttackPattern(boss, gameState) {
  const behaviors = boss.phaseData.behaviors;
  const bossType = boss.bossType;

  // Boss-specific attack logic
  switch (bossType) {
    case 'box':
      executeBoxKingAttack(boss, behaviors, gameState);
      break;
    case 'shooter':
      executeArtilleryTowerAttack(boss, behaviors, gameState);
      break;
    case 'tank':
      executeJuggernautAttack(boss, behaviors, gameState);
      break;
    case 'berserker':
      executePhantomBladeAttack(boss, behaviors, gameState);
      break;
    case 'magnetic':
      executeVoidCoreAttack(boss, behaviors, gameState);
      break;
    case 'elite':
      executeWarlordAttack(boss, behaviors, gameState);
      break;
    case 'phantom':
      executeShadeMonarchAttack(boss, behaviors, gameState);
      break;
  }
}

/**
 * Execute Box King attacks
 */
function executeBoxKingAttack(boss, behaviors, gameState) {
  // Charge attack
  if (behaviors.chargeAttack && behaviors.chargeAttack.enabled) {
    const chargeData = behaviors.chargeAttack;

    // Create telegraph warning
    const playerPos = gameState.playerCone.position.clone();
    const warning = BossAttacks.createGroundWarning(
      gameState.scene,
      playerPos,
      30,
      chargeData.telegraphDuration,
      0xff0000
    );

    boss.activeWarnings.push(warning);

    // Execute charge after telegraph
    setTimeout(() => {
      if (boss.isActive) {
        executeChargeAttack(boss, playerPos, chargeData, gameState);
      }
    }, chargeData.telegraphDuration * 1000);

    boss.attackCooldown = chargeData.cooldown;
  }

  // Summon minions
  if (behaviors.summonMinions && behaviors.summonMinions.enabled) {
    if (Math.random() < 0.5) { // 50% chance
      const summonData = behaviors.summonMinions;
      const count = summonData.count[0] + Math.floor(Math.random() * (summonData.count[1] - summonData.count[0] + 1));

      const minions = BossAttacks.spawnBossMinions(
        {
          bossPosition: boss.mesh.position,
          minionType: summonData.minionType,
          count,
          level: boss.level,
          bossId: boss.id,
        },
        (type, level, pos) => spawnMinionForBoss(type, level, pos, gameState)
      );

      boss.minions.push(...minions);
      boss.attackCooldown = summonData.cooldown;
    }
  }
}

// Note: Additional boss attack implementations will be added similarly
// For brevity, I'm including stubs that can be expanded

function executeArtilleryTowerAttack(boss, behaviors, gameState) {
  // Rotate through attack patterns
  // Implementation follows similar pattern to Box King
  boss.attackCooldown = 6.0;
}

function executeJuggernautAttack(boss, behaviors, gameState) {
  // Ground slam or shoulder charge
  boss.attackCooldown = 8.0;
}

function executePhantomBladeAttack(boss, behaviors, gameState) {
  // Dash attack pattern
  boss.attackCooldown = 5.0;
}

function executeVoidCoreAttack(boss, behaviors, gameState) {
  // Orbital projectiles and gravity zones
  boss.attackCooldown = 5.0;
}

function executeWarlordAttack(boss, behaviors, gameState) {
  // Weapon rotation system
  boss.attackCooldown = 3.0;
}

function executeShadeMonarchAttack(boss, behaviors, gameState) {
  // Teleport and projectiles
  boss.attackCooldown = 4.0;
}

/**
 * Execute charge attack
 */
function executeChargeAttack(boss, targetPos, chargeData, gameState) {
  const direction = new THREE.Vector3().subVectors(targetPos, boss.mesh.position).normalize();

  boss.currentAttack = {
    type: 'charge',
    direction,
    speed: chargeData.chargeSpeed,
    duration: chargeData.chargeDuration,
    elapsed: 0,
    damageMultiplier: chargeData.damageMultiplier || 1.0,
  };

  // Visual: Red glow
  boss.mesh.material.emissive.setHex(0xff0000);
  boss.mesh.material.emissiveIntensity = 2.0;
}

/**
 * Update active attacks and effects
 */
function updateActiveAttacks(boss, delta) {
  // Update warnings
  boss.activeWarnings = boss.activeWarnings.filter(warning => warning.update(delta));

  // Update hazards
  boss.activeHazards = boss.activeHazards.filter(hazard => hazard.update(delta));

  // Update lasers
  boss.activeLasers = boss.activeLasers.filter(laser => laser.update(delta));

  // Update gravity zones
  boss.activeGravityZones = boss.activeGravityZones.filter(zone => zone.update(delta));

  // Update current attack
  if (boss.currentAttack) {
    boss.currentAttack.elapsed += delta;

    if (boss.currentAttack.type === 'charge') {
      // Move boss during charge
      const movement = boss.currentAttack.direction.clone().multiplyScalar(
        boss.currentAttack.speed * delta * 60
      );
      boss.mesh.position.add(movement);

      // End charge
      if (boss.currentAttack.elapsed >= boss.currentAttack.duration) {
        // Reset emissive
        const bossConfig = bossTypes[boss.bossType];
        boss.mesh.material.emissive.setHex(bossConfig.emissiveColor || bossConfig.color);
        boss.mesh.material.emissiveIntensity = bossConfig.emissiveIntensity || 0.5;

        boss.currentAttack = null;
      }
    }
  }
}

/**
 * Update special boss mechanics
 */
function updateSpecialMechanics(boss, gameState, delta) {
  // Gravity pull (Magnetic/Void Core)
  if (boss.phaseData.behaviors.gravityPull) {
    applyGravityPull(boss, gameState);
  }

  // Apply gravity zones
  boss.activeGravityZones.forEach(zone => {
    const distance = zone.position.distanceTo(gameState.playerCone.position);
    if (distance < zone.radius) {
      const pullDir = new THREE.Vector3().subVectors(zone.position, gameState.playerCone.position).normalize();
      const pullForce = pullDir.multiplyScalar(zone.pullStrength * delta * 60);

      // This would be applied to player movement in main.js
      gameState.playerCone.userData.gravityPull = pullForce;
    }
  });
}

/**
 * Apply gravity pull from boss
 */
function applyGravityPull(boss, gameState) {
  const gravityData = boss.phaseData.behaviors.gravityPull;
  const distance = boss.mesh.position.distanceTo(gameState.playerCone.position);

  if (distance < gravityData.range) {
    const pullDir = new THREE.Vector3().subVectors(boss.mesh.position, gameState.playerCone.position).normalize();
    const pullForce = pullDir.multiplyScalar(gravityData.pullStrength);

    gameState.playerCone.userData.gravityPull = pullForce;
  }
}

/**
 * Helper functions for minion spawning, clones, platforms, etc.
 */

function spawnMinionForBoss(type, level, position, gameState) {
  // Import needed - this function will be called with gameState containing spawnSpecificEnemy
  // For now, we'll disable minion spawning until properly integrated
  console.log(`[Boss] Would spawn minion: ${type} at level ${level}`);
  return null;
}

function spawnBossClones(boss, count, health, gameState) {
  // Create afterimage clones for Phantom Blade
  console.log(`Spawning ${count} clones for boss ${boss.id}`);
}

function spawnPhantomClones(boss, count, health, gameState) {
  // Create phantom clones for Shade Monarch
  console.log(`Spawning ${count} phantom clones for boss ${boss.id}`);
}

function deployWeaponPlatforms(boss, config, gameState) {
  // Deploy turret platforms for Warlord
  console.log(`Deploying ${config.platformCount} weapon platforms`);
}

function recallWeaponPlatforms(boss, gameState) {
  // Recall platforms for Warlord Phase 3
  console.log('Recalling weapon platforms');
}

/**
 * Handle boss taking damage
 * @param {Object} boss - Boss entity
 * @param {number} damage - Damage amount
 * @param {Object} gameState - Game state
 * @returns {boolean} Whether damage was applied
 */
export function bossTakeDamage(boss, damage, gameState) {
  if (boss.isInvulnerable) {
    // Phantom mechanics
    if (boss.bossType === 'phantom') {
      boss.invulnerabilityHits++;

      const hitsRequired = boss.phaseData.behaviors.invulnerability?.hitsToBreak || 5;

      if (boss.invulnerabilityHits >= hitsRequired) {
        // Become vulnerable
        boss.isInvulnerable = false;
        boss.invulnerabilityHits = 0;
        boss.mesh.material.emissiveIntensity = 2.0;

        // Set timer to return to invulnerable
        const vulnerableDuration = boss.phaseData.behaviors.invulnerability.vulnerableDuration || 3.0;
        setTimeout(() => {
          boss.isInvulnerable = true;
          boss.mesh.material.emissiveIntensity = 0.5;
        }, vulnerableDuration * 1000);
      } else {
        // Teleport away
        teleportBoss(boss, gameState);
      }

      return false;
    }

    return false;
  }

  // Apply shield reduction (Juggernaut)
  if (boss.shieldActive && boss.phaseData.behaviors.shieldMechanic) {
    // Check if hit from front
    const toPlayer = new THREE.Vector3().subVectors(
      gameState.playerCone.position,
      boss.mesh.position
    ).normalize();

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(boss.mesh.quaternion);
    const angle = forward.angleTo(toPlayer) * (180 / Math.PI);

    const shieldArc = boss.phaseData.behaviors.shieldMechanic.shieldArc || 120;

    if (angle < shieldArc / 2) {
      // Hit shield
      damage *= (1 - boss.phaseData.behaviors.shieldMechanic.frontDamageReduction);
    }
  }

  boss.health -= damage;
  boss.health = Math.max(0, boss.health);

  // Visual feedback
  boss.mesh.material.emissive.setHex(0xffffff);
  boss.mesh.material.emissiveIntensity = 2.0;

  setTimeout(() => {
    const bossConfig = bossTypes[boss.bossType];
    boss.mesh.material.emissive.setHex(bossConfig.emissiveColor || bossConfig.color);
    boss.mesh.material.emissiveIntensity = bossConfig.emissiveIntensity || 0.5;
  }, 100);

  return true;
}

/**
 * Teleport boss (Phantom mechanics)
 */
function teleportBoss(boss, gameState) {
  const teleportData = boss.phaseData.behaviors.teleport;
  if (!teleportData) return;

  const minDist = teleportData.teleportRange[0];
  const maxDist = teleportData.teleportRange[1];

  const angle = Math.random() * Math.PI * 2;
  const distance = minDist + Math.random() * (maxDist - minDist);

  const newPos = new THREE.Vector3(
    boss.mesh.position.x + Math.cos(angle) * distance,
    boss.mesh.position.y,
    boss.mesh.position.z + Math.sin(angle) * distance
  );

  boss.mesh.position.copy(newPos);

  // Leave hazard
  if (teleportData.leaveHazard) {
    const hazard = BossAttacks.createGroundHazard({
      scene: gameState.scene,
      position: newPos.clone(),
      radius: teleportData.hazardRadius,
      duration: teleportData.hazardDuration,
      damagePerSecond: teleportData.hazardDamage,
      color: 0xffffff,
    });

    boss.activeHazards.push(hazard);
  }
}

/**
 * Clean up boss (on death)
 */
export function destroyBoss(boss, scene) {
  if (boss.mesh) {
    scene.remove(boss.mesh);
    boss.mesh.geometry.dispose();
    boss.mesh.material.dispose();
  }

  // Clean up all active effects
  boss.activeWarnings.forEach(w => w.destroy());
  boss.activeHazards.forEach(h => h.destroy());
  boss.activeLasers.forEach(l => l.destroy());
  boss.activeGravityZones.forEach(z => z.destroy());

  // Clean up clones, platforms, etc.
  boss.clones.forEach(clone => {
    if (clone.mesh) {
      scene.remove(clone.mesh);
      clone.mesh.geometry.dispose();
      clone.mesh.material.dispose();
    }
  });

  boss.isActive = false;
}
