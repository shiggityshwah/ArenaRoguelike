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
import { ARENA_PLAYABLE_HALF_SIZE } from '../config/constants.js';

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

  // Create geometry with special handling for Cube King
  let mesh;

  if (bossType === 'box' && bossConfig.hasCrown) {
    // Create Cube King with colorful faces
    const geometry = new THREE.BoxGeometry(10, 10, 10);

    // Create array of materials for each face with random box enemy colors
    const materials = [];
    for (let i = 0; i < 6; i++) {
      const faceColor = new THREE.Color().setHSL(0.1 + Math.random() * 0.8, 1, 0.5);
      materials.push(new THREE.MeshStandardMaterial({
        color: faceColor,
        emissive: faceColor,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.6,
      }));
    }

    mesh = new THREE.Mesh(geometry, materials);

    // Add golden crown on top
    const crownGroup = new THREE.Group();

    // Crown base (ring)
    const crownBaseGeometry = new THREE.CylinderGeometry(6, 7, 2, 8);
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: bossConfig.crownColor || 0xFFD700,
      emissive: bossConfig.crownColor || 0xFFD700,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
    });
    const crownBase = new THREE.Mesh(crownBaseGeometry, crownMaterial);
    crownBase.position.y = 6;
    crownGroup.add(crownBase);

    // Crown spikes (8 points around the crown)
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const spikeGeometry = new THREE.ConeGeometry(1, 4, 4);
      const spike = new THREE.Mesh(spikeGeometry, crownMaterial);
      spike.position.set(
        Math.cos(angle) * 6.5,
        9,
        Math.sin(angle) * 6.5
      );
      crownGroup.add(spike);
    }

    // Center jewel
    const jewelGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const jewelMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF0000,
      emissive: 0xFF0000,
      emissiveIntensity: 1.0,
      metalness: 0.9,
      roughness: 0.1,
    });
    const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial);
    jewel.position.y = 10;
    crownGroup.add(jewel);

    mesh.add(crownGroup);
  } else {
    // Standard boss creation
    const geometry = typeof enemyConfig.geometry === 'function'
      ? enemyConfig.geometry()
      : enemyConfig.geometry.clone();

    const material = new THREE.MeshStandardMaterial({
      color: bossConfig.color,
      emissive: bossConfig.emissiveColor || bossConfig.color,
      emissiveIntensity: bossConfig.emissiveIntensity || 0.5,
      metalness: 0.5,
      roughness: 0.5,
    });

    mesh = new THREE.Mesh(geometry, material);
  }

  // Position and scale
  mesh.position.copy(spawnPosition);
  mesh.scale.setScalar(bossConfig.scale);

  scene.add(mesh);

  // Calculate stats
  const maxHealth = calculateBossHealth(bossType, waveNumber);
  const baseSpeed = enemyConfig.baseSpeed + (level || 0) * (enemyConfig.speedLevelScale || 0.01);

  // Calculate ground Y position based on boss type
  let groundY = 10; // Default for most bosses
  if (bossType === 'box' || bossType === 'tank') {
    groundY = 5 * bossConfig.scale; // BoxGeometry sits on ground (half height of 10)
  } else if (bossType === 'shooter') {
    groundY = 8 * bossConfig.scale; // Cylinder height/2
  } else {
    groundY = 10 * bossConfig.scale; // Most geometries
  }

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
    groundY, // Store ground level for locking Y position
    isActive: false, // Will be set to true after spawning animation

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
    boss.mesh.position.y = boss.groundY;
    boss.state = 'idle';
    boss.isActive = true; // Boss is now active and can be targeted
  } else {
    // Fall from sky
    const startY = 200;
    boss.mesh.position.y = startY + (boss.groundY - startY) * easeOutBounce(progress);

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

  // Clear active attacks and reset cooldown
  boss.activeAttacks = [];
  boss.attackCooldown = 0; // Reset attack cooldown on phase transition

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
      if (Array.isArray(boss.mesh.material)) {
        boss.mesh.material.forEach(mat => mat.roughness = 0.8);
      } else {
        boss.mesh.material.roughness = 0.8;
      }
    }

    // Spawn clones
    if (onStart.effect === 'spawnClones') {
      const clones = spawnBossClones(boss, onStart.cloneCount, onStart.cloneHealth, gameState);
      boss.clones.push(...clones);
      console.log(`Spawned ${clones.length} afterimage clones for ${boss.name}`);
    }

    // Spawn phantom clones
    if (onStart.effect === 'spawnPhantomClones') {
      const clones = spawnPhantomClones(boss, onStart.cloneCount, onStart.cloneHealth, gameState);
      boss.clones.push(...clones);
      console.log(`Spawned ${clones.length} phantom clones for ${boss.name}`);
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
    if (Array.isArray(boss.mesh.material)) {
      boss.mesh.material.forEach(mat => {
        mat.color.setHex(boss.phaseData.colorShift);
        mat.emissive.setHex(boss.phaseData.colorShift);
      });
    } else {
      boss.mesh.material.color.setHex(boss.phaseData.colorShift);
      boss.mesh.material.emissive.setHex(boss.phaseData.colorShift);
    }
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
    // Still lock to ground even when stationary
    boss.mesh.position.y = boss.groundY;
    return;
  }

  const bossPos = boss.mesh.position;

  // Maintain distance (ranged bosses)
  if (boss.maintainDistance) {
    if (distance < boss.maintainDistance - 20) {
      // Move away from player
      const direction = new THREE.Vector3().subVectors(bossPos, playerPos).normalize();
      direction.y = 0; // Lock to horizontal plane
      boss.mesh.position.add(direction.multiplyScalar(moveSpeed * delta * 60));
    } else if (distance > boss.maintainDistance + 20) {
      // Move toward player
      const direction = new THREE.Vector3().subVectors(playerPos, bossPos).normalize();
      direction.y = 0; // Lock to horizontal plane
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
        boss.groundY,
        playerPos.z + offset.z
      );
    }
  }
  // Chase player (melee bosses)
  else if (distance > 30) {
    const direction = new THREE.Vector3().subVectors(playerPos, bossPos).normalize();
    direction.y = 0; // Lock to horizontal plane
    boss.mesh.position.add(direction.multiplyScalar(moveSpeed * delta * 60));
  }

  // Keep boss within arena bounds
  boss.mesh.position.x = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, boss.mesh.position.x));
  boss.mesh.position.z = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, boss.mesh.position.z));

  // Always lock Y position to ground level
  boss.mesh.position.y = boss.groundY;
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
    case 'mortar':
      executeMortarBossAttack(boss, behaviors, gameState);
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

/**
 * Execute Artillery Tower attacks - Rotates through attack patterns
 */
function executeArtilleryTowerAttack(boss, behaviors, gameState) {
  const { scene, playerCone, enemyProjectiles, objectPools } = gameState;

  // Don't attack during spawn animation or if boss/player aren't ready
  if (boss.spawning || !boss.mesh || !boss.mesh.position || !playerCone || !playerCone.position) {
    boss.attackCooldown = 1.0; // Set cooldown even on early return
    return;
  }

  // Cycle through available attack patterns
  if (!boss.currentAttackPattern) {
    boss.currentAttackPattern = 0;
  }

  const availablePatterns = [];
  if (behaviors.spreadPattern && behaviors.spreadPattern.enabled) availablePatterns.push('spreadPattern');
  if (behaviors.burstShot && behaviors.burstShot.enabled) availablePatterns.push('burstShot');
  if (behaviors.rotatingBarrage && behaviors.rotatingBarrage.enabled) availablePatterns.push('rotatingBarrage');
  if (behaviors.laserBeam && behaviors.laserBeam.enabled) availablePatterns.push('laserBeam');

  if (availablePatterns.length === 0) {
    console.warn(`Artillery Tower: No available patterns! Phase: ${boss.currentPhase}, behaviors:`, behaviors);
    boss.attackCooldown = 2.0;
    return;
  }

  console.log(`Artillery Tower attack: Pattern ${boss.currentAttackPattern}, Available:`, availablePatterns);

  const currentPattern = availablePatterns[boss.currentAttackPattern % availablePatterns.length];

  // Execute pattern
  if (currentPattern === 'spreadPattern') {
    BossAttacks.fireSpreadShot({
      scene,
      position: boss.mesh.position,
      targetPosition: playerCone.position,
      projectileCount: behaviors.spreadPattern.projectileCount,
      arcDegrees: behaviors.spreadPattern.arcDegrees,
      projectileSpeed: behaviors.spreadPattern.projectileSpeed,
      projectileColor: 0x8A2BE2,
      projectileSize: 1.5,
      damage: 25,
      projectiles: enemyProjectiles,
      projectilePool: objectPools.enemyProjectiles,
    });
    boss.attackCooldown = 2.0;
  }
  else if (currentPattern === 'burstShot') {
    // Fire 5 projectiles in a row
    for (let i = 0; i < behaviors.burstShot.projectileCount; i++) {
      setTimeout(() => {
        if (boss.isActive) {
          BossAttacks.fireSpreadShot({
            scene,
            position: boss.mesh.position,
            targetPosition: playerCone.position,
            projectileCount: 1,
            arcDegrees: 0,
            projectileSpeed: behaviors.burstShot.projectileSpeed,
            projectileColor: 0x9370DB,
            projectileSize: 1.2,
            damage: 20,
            projectiles: enemyProjectiles,
            projectilePool: objectPools.enemyProjectiles,
          });
        }
      }, i * (behaviors.burstShot.delayBetweenShots * 1000));
    }
    boss.attackCooldown = 3.0;
  }
  else if (currentPattern === 'rotatingBarrage') {
    BossAttacks.fireSpreadShot({
      scene,
      position: boss.mesh.position,
      targetPosition: playerCone.position,
      projectileCount: behaviors.rotatingBarrage.projectileCount,
      arcDegrees: 360,
      projectileSpeed: behaviors.rotatingBarrage.projectileSpeed,
      projectileColor: 0xBA55D3,
      projectileSize: 1.3,
      damage: 22,
      projectiles: enemyProjectiles,
      projectilePool: objectPools.enemyProjectiles,
    });
    boss.attackCooldown = 2.5;
  }
  else if (currentPattern === 'laserBeam') {
    // Simplified laser - just fire a tight beam of projectiles
    BossAttacks.fireSpreadShot({
      scene,
      position: boss.mesh.position,
      targetPosition: playerCone.position,
      projectileCount: 5,
      arcDegrees: 5,
      projectileSpeed: 5.0,
      projectileColor: 0xff0000,
      projectileSize: 2,
      damage: 40,
      projectiles: enemyProjectiles,
      projectilePool: objectPools.enemyProjectiles,
    });
    boss.attackCooldown = 4.0;
  }

  // Move to next pattern
  boss.currentAttackPattern = (boss.currentAttackPattern + 1) % availablePatterns.length;
}

/**
 * Execute Juggernaut attacks - Ground slam and shoulder charge
 */
function executeJuggernautAttack(boss, behaviors, gameState) {
  const { scene, playerCone } = gameState;

  // Don't attack during spawn animation
  if (boss.spawning || !boss.mesh || !boss.mesh.position || !playerCone) {
    boss.attackCooldown = 1.0;
    return;
  }

  // Alternate between ground slam and shoulder charge
  if (!boss.lastAttackType || boss.lastAttackType === 'charge') {
    // Ground slam
    if (behaviors.groundSlam && behaviors.groundSlam.enabled) {
      const slamData = behaviors.groundSlam;

      // Create ground warning
      const warning = BossAttacks.createGroundWarning(
        scene,
        boss.mesh.position,
        slamData.radius,
        slamData.telegraphDuration,
        0xff0000
      );

      boss.activeWarnings.push(warning);

      // Execute slam after telegraph
      setTimeout(() => {
        if (boss.isActive) {
          // Damage players in radius (handled in main.js)
          boss.slamDamageRadius = slamData.radius;
          boss.slamDamage = slamData.damage;
          boss.slamActive = true;

          setTimeout(() => {
            boss.slamActive = false;
          }, 200); // Brief damage window
        }
      }, slamData.telegraphDuration * 1000);

      boss.lastAttackType = 'slam';
      boss.attackCooldown = slamData.cooldown;
    }
  } else {
    // Shoulder charge
    if (behaviors.shoulderCharge && behaviors.shoulderCharge.enabled) {
      const chargeData = behaviors.shoulderCharge;

      // Telegraph
      const warning = BossAttacks.createGroundWarning(
        scene,
        playerCone.position,
        30,
        chargeData.telegraphDuration,
        0xff8800
      );

      boss.activeWarnings.push(warning);

      // Execute charge
      setTimeout(() => {
        if (boss.isActive) {
          executeChargeAttack(boss, playerCone.position.clone(), chargeData, gameState);
        }
      }, chargeData.telegraphDuration * 1000);

      boss.lastAttackType = 'charge';
      boss.attackCooldown = chargeData.cooldown;
    }
  }
}

/**
 * Execute Phantom Blade attacks - Dash attack pattern
 */
function executePhantomBladeAttack(boss, behaviors, gameState) {
  const { scene, playerCone } = gameState;

  // Don't attack during spawn animation
  if (boss.spawning || !boss.mesh || !playerCone) {
    boss.attackCooldown = 1.0;
    return;
  }

  if (behaviors.dashAttack && behaviors.dashAttack.enabled) {
    const dashData = behaviors.dashAttack;

    // Store original position
    const startPos = boss.mesh.position.clone();

    // Telegraph glow
    if (Array.isArray(boss.mesh.material)) {
      boss.mesh.material.forEach(mat => {
        mat.emissive.setHex(0xff4500);
        mat.emissiveIntensity = 3.0;
      });
    } else {
      boss.mesh.material.emissive.setHex(0xff4500);
      boss.mesh.material.emissiveIntensity = 3.0;
    }

    // Execute dash sequence
    let dashesCompleted = 0;
    const dashInterval = setInterval(() => {
      if (!boss.isActive || dashesCompleted >= dashData.dashCount) {
        clearInterval(dashInterval);

        // Reset emissive
        const bossConfig = bossTypes[boss.bossType];
        if (boss.mesh && boss.mesh.material) {
          if (Array.isArray(boss.mesh.material)) {
            boss.mesh.material.forEach(mat => {
              mat.emissive.setHex(bossConfig.emissiveColor);
              mat.emissiveIntensity = bossConfig.emissiveIntensity;
            });
          } else {
            boss.mesh.material.emissive.setHex(bossConfig.emissiveColor);
            boss.mesh.material.emissiveIntensity = bossConfig.emissiveIntensity;
          }
        }
        return;
      }

      // Dash to player position
      const targetPos = playerCone.position.clone();
      const direction = new THREE.Vector3().subVectors(targetPos, boss.mesh.position).normalize();

      // Create trail hazard
      if (dashData.trailDamage) {
        const hazard = BossAttacks.createGroundHazard({
          scene,
          position: boss.mesh.position.clone(),
          radius: 30,
          duration: dashData.trailDuration,
          damage: dashData.trailDamage,
          color: 0xff4500,
        });
        boss.activeHazards.push(hazard);
      }

      // Teleport to near target (lock to ground)
      const dashDistance = 100;
      const newPos = targetPos.clone().sub(direction.multiplyScalar(dashDistance));
      newPos.y = boss.groundY; // Lock to ground
      boss.mesh.position.copy(newPos);

      dashesCompleted++;
    }, dashData.dashDelay * 1000);

    boss.attackCooldown = dashData.cooldown;
  }
}

/**
 * Execute Void Core attacks - Orbital projectiles and gravity zones
 */
function executeVoidCoreAttack(boss, behaviors, gameState) {
  const { scene, playerCone, enemyProjectiles, objectPools } = gameState;

  // Don't attack during spawn animation
  if (boss.spawning || !boss.mesh || !playerCone) {
    boss.attackCooldown = 1.0;
    return;
  }

  // Alternate between orbital attack and gravity zones
  if (!boss.lastAttackType || boss.lastAttackType === 'gravity') {
    // Orbital projectiles
    if (behaviors.orbitAttack && behaviors.orbitAttack.enabled) {
      const orbitData = behaviors.orbitAttack;

      const orbitals = BossAttacks.createOrbitalProjectiles({
        scene,
        centerPosition: boss.mesh.position,
        orbitRadius: orbitData.orbitRadius || 80,
        projectileCount: orbitData.projectileCount || 8,
        orbitSpeed: orbitData.orbitSpeed || 2.0,
        damage: orbitData.damage || 30,
        projectileColor: 0x00BFFF, // DeepSkyBlue
        projectileSize: 2,
      });

      boss.activeOrbitals.push(...orbitals);

      // Launch after orbit duration
      setTimeout(() => {
        if (boss.isActive) {
          BossAttacks.launchOrbitalProjectiles(
            boss.activeOrbitals,
            orbitData.launchSpeed || 3.0,
            enemyProjectiles
          );
          boss.activeOrbitals = [];
        }
      }, (orbitData.orbitDuration || 2.0) * 1000);

      boss.lastAttackType = 'orbital';
      boss.attackCooldown = orbitData.cooldown || 5.0;
    }
  } else {
    // Gravity zones (Phase 2)
    if (behaviors.gravityZones && behaviors.gravityZones.enabled) {
      const zoneData = behaviors.gravityZones;

      // Create multiple gravity zones
      for (let i = 0; i < zoneData.zoneCount; i++) {
        // Random position near player
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 100;
        const zonePos = new THREE.Vector3(
          playerCone.position.x + Math.cos(angle) * distance,
          playerCone.position.y,
          playerCone.position.z + Math.sin(angle) * distance
        );

        const zone = BossAttacks.createGravityZone({
          scene,
          position: zonePos,
          radius: zoneData.radius,
          duration: zoneData.duration,
          pullStrength: zoneData.pullStrength,
          damage: zoneData.tickDamage,
          color: 0x0000ff,
        });

        boss.activeGravityZones.push(zone);
      }

      boss.lastAttackType = 'gravity';
      boss.attackCooldown = zoneData.cooldown || 8.0;
    }
  }
}

/**
 * Execute Warlord attacks - Weapon rotation system
 */
function executeWarlordAttack(boss, behaviors, gameState) {
  const { scene, playerCone, enemyProjectiles, objectPools } = gameState;

  // Don't attack during spawn animation
  if (boss.spawning || !boss.mesh || !playerCone) {
    boss.attackCooldown = 1.0;
    return;
  }

  // Phase 3: Fire all weapons simultaneously
  if (behaviors.combinedWeapons && behaviors.combinedWeapons.enabled) {
    // Fire spread shot
    if (behaviors.spreadShot) {
      BossAttacks.fireSpreadShot({
        scene,
        position: boss.mesh.position,
        targetPosition: playerCone.position,
        projectileCount: behaviors.spreadShot.projectileCount,
        arcDegrees: behaviors.spreadShot.arcDegrees,
        projectileSpeed: behaviors.spreadShot.projectileSpeed,
        projectileColor: 0xff00ff,
        projectileSize: 1.5,
        damage: 20,
        projectiles: enemyProjectiles,
        projectilePool: objectPools.enemyProjectiles,
      });
    }

    // Fire homing missiles - simplified for now
    if (behaviors.homingMissiles) {
      BossAttacks.fireSpreadShot({
        scene,
        position: boss.mesh.position,
        targetPosition: playerCone.position,
        projectileCount: behaviors.homingMissiles.missileCount,
        arcDegrees: 30,
        projectileSpeed: behaviors.homingMissiles.missileSpeed,
        projectileColor: 0xff0000,
        projectileSize: 2,
        damage: 25,
        projectiles: enemyProjectiles,
        projectilePool: objectPools.enemyProjectiles,
      });
    }

    // Fire plasma rain - simplified for now
    if (behaviors.plasmaRain) {
      BossAttacks.fireSpreadShot({
        scene,
        position: new THREE.Vector3(playerCone.position.x, playerCone.position.y + 100, playerCone.position.z),
        targetPosition: playerCone.position,
        projectileCount: behaviors.plasmaRain.projectileCount,
        arcDegrees: 360,
        projectileSpeed: behaviors.plasmaRain.fallSpeed || 3,
        projectileColor: 0x00ff00,
        projectileSize: 1.5,
        damage: 30,
        projectiles: enemyProjectiles,
        projectilePool: objectPools.enemyProjectiles,
      });
    }

    boss.attackCooldown = behaviors.combinedWeapons.cooldown;
  }
  // Phases 1 & 2: Weapon rotation
  else if (behaviors.weaponRotation && behaviors.weaponRotation.enabled) {
    // Warlord uses different behavior names than Artillery Tower
    // Map them to spreadPattern for consistency
    const mappedBehaviors = {
      spreadPattern: behaviors.spreadShot || behaviors.spreadPattern,
      burstShot: behaviors.burstShot,
      rotatingBarrage: behaviors.rotatingBarrage,
      laserBeam: behaviors.laserBeam
    };
    executeArtilleryTowerAttack(boss, mappedBehaviors, gameState);
  }
  else {
    // Fallback - just use spread shot
    if (behaviors.spreadShot && behaviors.spreadShot.enabled) {
      BossAttacks.fireSpreadShot({
        scene,
        position: boss.mesh.position,
        targetPosition: playerCone.position,
        projectileCount: behaviors.spreadShot.projectileCount || 5,
        arcDegrees: behaviors.spreadShot.arcDegrees || 45,
        projectileSpeed: behaviors.spreadShot.projectileSpeed || 3.0,
        projectileColor: 0xFFFF33,
        projectileSize: 1.5,
        damage: 20,
        projectiles: enemyProjectiles,
        projectilePool: objectPools.enemyProjectiles,
      });
      boss.attackCooldown = behaviors.spreadShot.cooldown || 2.0;
    } else {
      boss.attackCooldown = 2.0;
    }
  }
}

/**
 * Execute Shade Monarch attacks - Teleport and projectiles
 */
function executeShadeMonarchAttack(boss, behaviors, gameState) {
  const { scene, playerCone, enemyProjectiles, objectPools } = gameState;

  // Don't attack during spawn animation
  if (boss.spawning || !boss.mesh || !playerCone) {
    boss.attackCooldown = 1.0;
    return;
  }

  // Teleport attack
  if (behaviors.teleport && behaviors.teleport.enabled) {
    const teleportData = behaviors.teleport;

    // Fade out effect
    if (boss.mesh.material.opacity > 0.1) {
      boss.mesh.material.opacity -= 0.1;
    }

    setTimeout(() => {
      if (!boss.isActive) return;

      // Teleport to new position
      const minDist = teleportData.teleportRange[0];
      const maxDist = teleportData.teleportRange[1];
      const distance = minDist + Math.random() * (maxDist - minDist);
      const angle = Math.random() * Math.PI * 2;

      const oldPos = boss.mesh.position.clone();
      boss.mesh.position.set(
        playerCone.position.x + Math.cos(angle) * distance,
        boss.groundY, // Lock to ground
        playerCone.position.z + Math.sin(angle) * distance
      );

      // Leave hazard at old position
      if (teleportData.leaveHazard) {
        const hazard = BossAttacks.createGroundHazard({
          scene,
          position: oldPos,
          radius: teleportData.hazardRadius,
          duration: teleportData.hazardDuration,
          damage: teleportData.hazardDamage,
          color: 0xffffff,
        });
        boss.activeHazards.push(hazard);
      }

      // Fade back in
      boss.mesh.material.opacity = 0.4;

      // Fire projectiles on teleport
      if (behaviors.projectileOnTeleport && behaviors.projectileOnTeleport.enabled) {
        BossAttacks.fireSpreadShot({
          scene,
          position: boss.mesh.position,
          targetPosition: playerCone.position,
          projectileCount: behaviors.projectileOnTeleport.projectileCount,
          arcDegrees: behaviors.projectileOnTeleport.spreadAngle,
          projectileSpeed: behaviors.projectileOnTeleport.projectileSpeed,
          projectileColor: 0xffffff,
          projectileSize: 1.5,
          damage: 20,
          projectiles: enemyProjectiles,
          projectilePool: objectPools.enemyProjectiles,
        });
      }

      // Teleport clones too (Phase 2)
      if (teleportData.clonesAlsoTeleport && boss.clones.length > 0) {
        boss.clones.forEach((clone, i) => {
          const cloneAngle = angle + ((Math.PI * 2) / boss.clones.length) * i;
          clone.mesh.position.set(
            playerCone.position.x + Math.cos(cloneAngle) * distance,
            boss.groundY, // Lock clones to ground too
            playerCone.position.z + Math.sin(cloneAngle) * distance
          );
        });
      }
    }, 500); // Teleport delay

    boss.attackCooldown = teleportData.cooldown;
  }
}

/**
 * Execute Mortar Boss (Artillery Siege) attacks
 */
function executeMortarBossAttack(boss, behaviors, gameState) {
  const { scene, playerCone, enemyProjectiles, objectPools, AreaWarningManager, calculateLobTrajectory, MORTAR_CONFIG } = gameState;

  // Don't attack during spawn animation
  if (boss.spawning || !boss.mesh || !playerCone) {
    boss.attackCooldown = 1.0;
    return;
  }

  // Initialize attack pattern rotation
  if (!boss.mortarAttackIndex) {
    boss.mortarAttackIndex = 0;
  }

  const playerPos = playerCone.position.clone();
  const bossPos = boss.mesh.position.clone();

  // Simple mortar barrage - fire 3-5 mortars in a pattern
  const mortarCount = 3 + Math.floor(Math.random() * 3); // 3-5 mortars
  const pattern = Math.random();

  for (let i = 0; i < mortarCount; i++) {
    let impactPos;

    if (pattern < 0.33) {
      // Line pattern toward player
      const direction = new THREE.Vector3().subVectors(playerPos, bossPos).normalize();
      const distance = 50 + (i * 40);
      impactPos = bossPos.clone().add(direction.multiplyScalar(distance));
    } else if (pattern < 0.66) {
      // Circle around player
      const angle = (Math.PI * 2 / mortarCount) * i;
      const radius = 60;
      impactPos = playerPos.clone().add(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ));
    } else {
      // Random scatter near player
      const offsetX = (Math.random() - 0.5) * 120;
      const offsetZ = (Math.random() - 0.5) * 120;
      impactPos = playerPos.clone().add(new THREE.Vector3(offsetX, 0, offsetZ));
    }

    impactPos.y = 0;

    // Calculate trajectory first to get actual flight time
    const startPos = bossPos.clone();
    startPos.y = 20; // Projectile start height
    const trajectory = calculateLobTrajectory(
      startPos,
      impactPos,
      MORTAR_CONFIG.projectileFlightTime,
      MORTAR_CONFIG.gravity,
      MORTAR_CONFIG.lobApex * 1.3 // Higher arc for boss
    );

    // Create ground warning with actual flight time as duration
    AreaWarningManager.create(
      impactPos,
      MORTAR_CONFIG.explosionRadius * 1.2, // Slightly larger for boss
      0xFF4500, // Orange warning for boss
      trajectory.impactTime, // Use calculated flight time
      'gradient'
    );

    // Schedule projectile launch with small stagger for visual effect
    const launchDelay = 0.15 + (i * 0.1); // Small initial delay + stagger
    setTimeout(() => {
      if (!boss.isActive) return;

      const proj = objectPools.enemyProjectiles.get();
      proj.mesh.position.copy(bossPos);
      proj.mesh.position.y = 20; // Start higher for boss

      // Use pre-calculated velocity
      proj.velocity = trajectory.velocity.clone();
      proj.impactPosition = impactPos.clone();
      proj.damage = MORTAR_CONFIG.projectileDamage * 1.5; // More damage for boss
      proj.explosionRadius = MORTAR_CONFIG.explosionRadius * 1.2;
      proj.isLobbing = true;
      proj.isBossProjectile = true;
      proj.distanceTraveled = 0;
      proj.range = 999;

      enemyProjectiles.push(proj);
    }, launchDelay * 1000);
  }

  // Set cooldown based on phase
  const baseCooldown = boss.currentPhase === 0 ? 5.0 : 3.5;
  boss.attackCooldown = baseCooldown;
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
  if (Array.isArray(boss.mesh.material)) {
    boss.mesh.material.forEach(mat => {
      mat.emissive.setHex(0xff0000);
      mat.emissiveIntensity = 2.0;
    });
  } else {
    boss.mesh.material.emissive.setHex(0xff0000);
    boss.mesh.material.emissiveIntensity = 2.0;
  }
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
      // Move boss during charge (horizontal only)
      const movement = boss.currentAttack.direction.clone().multiplyScalar(
        boss.currentAttack.speed * delta * 60
      );
      movement.y = 0; // Lock to horizontal plane
      boss.mesh.position.add(movement);

      // Keep boss within arena bounds during charge
      boss.mesh.position.x = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, boss.mesh.position.x));
      boss.mesh.position.z = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, boss.mesh.position.z));

      boss.mesh.position.y = boss.groundY; // Ensure ground lock

      // End charge
      if (boss.currentAttack.elapsed >= boss.currentAttack.duration) {
        // Reset emissive (handle array of materials for Cube King)
        const bossConfig = bossTypes[boss.bossType];
        if (Array.isArray(boss.mesh.material)) {
          // Cube King has multiple materials, reset each face
          boss.mesh.material.forEach(mat => {
            mat.emissiveIntensity = 0.5;
          });
        } else {
          boss.mesh.material.emissive.setHex(bossConfig.emissiveColor || bossConfig.color);
          boss.mesh.material.emissiveIntensity = bossConfig.emissiveIntensity || 0.5;
        }

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
  const { spawnSpecificEnemy, scene, enemies, enemyPrototypes, playerCone, enemyCounts, getBossCount, setBossCount, gameSpeedMultiplier, createGravityVortex, gravityWellEffects } = gameState;

  if (!spawnSpecificEnemy) {
    console.warn('[Boss] spawnSpecificEnemy not available in gameState');
    return null;
  }

  // Store initial enemy count
  const initialCount = enemies.length;

  // Spawn the minion using spawnSpecificEnemy
  spawnSpecificEnemy(type, false, {
    scene,
    enemies,
    enemyPrototypes,
    playerCone,
    enemyCounts,
    getBossCount: getBossCount || (() => 0),
    setBossCount: setBossCount || (() => {}),
    level,
    gameSpeedMultiplier,
    createGravityVortex,
    gravityWellEffects
  });

  // Get the newly spawned enemy (last in array)
  if (enemies.length > initialCount) {
    const minion = enemies[enemies.length - 1];

    // Position is already set by spawnBossMinions (at y=100 to fall)
    // Don't override it, minions need to fall from sky
    // The position param already has x/z set correctly, just preserve y
    if (minion && minion.mesh && position) {
      // Only update X and Z, keep the spawn Y (100) so they fall
      minion.mesh.position.x = position.x;
      minion.mesh.position.z = position.z;
      // minion.mesh.position.y stays at spawn height (100)
      return minion;
    }
  }

  return null;
}

function spawnBossClones(boss, count, health, gameState) {
  // Create afterimage clones for Phantom Blade
  const { scene } = gameState;
  const clones = [];

  for (let i = 0; i < count; i++) {
    // Create clone geometry (same as boss but semi-transparent)
    const cloneGeometry = boss.mesh.geometry.clone();
    const cloneMaterial = new THREE.MeshStandardMaterial({
      color: boss.mesh.material.color,
      emissive: boss.mesh.material.emissive,
      emissiveIntensity: boss.mesh.material.emissiveIntensity * 0.6,
      transparent: true,
      opacity: 0.4, // Semi-transparent afterimage
      flatShading: boss.mesh.material.flatShading
    });

    const cloneMesh = new THREE.Mesh(cloneGeometry, cloneMaterial);
    cloneMesh.scale.copy(boss.mesh.scale);
    cloneMesh.position.copy(boss.mesh.position);
    cloneMesh.rotation.copy(boss.mesh.rotation);

    scene.add(cloneMesh);

    const clone = {
      mesh: cloneMesh,
      health,
      maxHealth: health,
      isClone: true,
      parentBossId: boss.id,
      radius: boss.radius,
      contactDamage: boss.contactDamage * 0.7, // Slightly weaker
      // Movement history for delayed following
      positionHistory: [],
      historyMaxLength: 30, // 0.5 seconds at 60 FPS
    };

    clones.push(clone);
  }

  return clones;
}

function spawnPhantomClones(boss, count, health, gameState) {
  // Create phantom clones for Shade Monarch (same mechanics as boss)
  const { scene } = gameState;
  const clones = [];

  for (let i = 0; i < count; i++) {
    // Create clone geometry (identical to boss)
    const cloneGeometry = boss.mesh.geometry.clone();
    const cloneMaterial = new THREE.MeshStandardMaterial({
      color: boss.mesh.material.color,
      emissive: boss.mesh.material.emissive,
      emissiveIntensity: boss.mesh.material.emissiveIntensity,
      transparent: true,
      opacity: boss.mesh.material.opacity || 0.4,
      flatShading: boss.mesh.material.flatShading
    });

    const cloneMesh = new THREE.Mesh(cloneGeometry, cloneMaterial);
    cloneMesh.scale.copy(boss.mesh.scale);

    // Position clones in circle around boss
    const angle = (Math.PI * 2 * i) / count;
    const distance = 100;
    cloneMesh.position.set(
      boss.mesh.position.x + Math.cos(angle) * distance,
      boss.mesh.position.y,
      boss.mesh.position.z + Math.sin(angle) * distance
    );

    scene.add(cloneMesh);

    const clone = {
      mesh: cloneMesh,
      health,
      maxHealth: health,
      isPhantomClone: true,
      parentBossId: boss.id,
      radius: boss.radius,
      contactDamage: boss.contactDamage,
      isInvulnerable: boss.isInvulnerable, // Shares invulnerability state
      hitsReceived: 0,
      teleportCooldown: 0,
    };

    clones.push(clone);
  }

  return clones;
}

function deployWeaponPlatforms(boss, config, gameState) {
  // Deploy turret platforms for Warlord
  const { scene } = gameState;
  const { platformCount, platformHealth, platformSpacing } = config;

  console.log(`Deploying ${platformCount} weapon platforms`);

  const platforms = [];
  const distance = 180; // Distance from boss

  for (let i = 0; i < platformCount; i++) {
    // Calculate platform position in circle around boss
    const angle = (platformSpacing * i * Math.PI) / 180;
    const position = new THREE.Vector3(
      boss.mesh.position.x + Math.cos(angle) * distance,
      boss.mesh.position.y - 10, // Slightly lower than boss
      boss.mesh.position.z + Math.sin(angle) * distance
    );

    // Create platform geometry (octahedron - matching elite enemy)
    const platformGeometry = new THREE.OctahedronGeometry(15);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080, // Gray
      emissive: 0x404040,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.3,
    });

    const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
    platformMesh.position.copy(position);
    scene.add(platformMesh);

    // Assign weapon type based on index
    const weaponTypes = ['spreadShot', 'homingMissiles', 'plasmaRain'];
    const weaponType = weaponTypes[i % weaponTypes.length];

    const platform = {
      mesh: platformMesh,
      health: platformHealth,
      maxHealth: platformHealth,
      isPlatform: true,
      parentBossId: boss.id,
      radius: 15,
      weaponType,
      lastAttackTime: 0,
      attackCooldown: 3.0,
      isActive: true,
    };

    platforms.push(platform);
  }

  boss.platforms.push(...platforms);
  console.log(`Deployed ${platforms.length} weapon platforms`);
}

function recallWeaponPlatforms(boss, gameState) {
  // Recall platforms for Warlord Phase 3
  const { scene } = gameState;

  console.log('Recalling weapon platforms');

  // Remove all platforms from scene
  boss.platforms.forEach(platform => {
    if (platform.mesh) {
      scene.remove(platform.mesh);
      platform.mesh.geometry.dispose();
      platform.mesh.material.dispose();
    }
  });

  // Clear platforms array
  boss.platforms = [];
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
  if (boss.shieldActive && boss.phaseData && boss.phaseData.behaviors && boss.phaseData.behaviors.shieldMechanic &&
      gameState && gameState.playerCone && gameState.playerCone.position && boss.mesh && boss.mesh.position) {
    const shieldMechanic = boss.phaseData.behaviors.shieldMechanic;

    // Check if hit from front
    const toPlayer = new THREE.Vector3().subVectors(
      gameState.playerCone.position,
      boss.mesh.position
    ).normalize();

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(boss.mesh.quaternion);
    const angle = forward.angleTo(toPlayer) * (180 / Math.PI);

    const shieldArc = shieldMechanic.shieldArc || 120;

    if (angle < shieldArc / 2) {
      // Hit shield
      const reduction = shieldMechanic.frontDamageReduction || 0.5;
      damage *= (1 - reduction);
    }
  }

  boss.health -= damage;
  boss.health = Math.max(0, boss.health);

  // Visual feedback - white flash on hit
  if (Array.isArray(boss.mesh.material)) {
    boss.mesh.material.forEach(mat => {
      mat.emissive.setHex(0xffffff);
      mat.emissiveIntensity = 2.0;
    });
  } else {
    boss.mesh.material.emissive.setHex(0xffffff);
    boss.mesh.material.emissiveIntensity = 2.0;
  }

  setTimeout(() => {
    const bossConfig = bossTypes[boss.bossType];
    if (Array.isArray(boss.mesh.material)) {
      boss.mesh.material.forEach(mat => {
        mat.emissive.setHex(bossConfig.emissiveColor || bossConfig.color);
        mat.emissiveIntensity = bossConfig.emissiveIntensity || 0.5;
      });
    } else {
      boss.mesh.material.emissive.setHex(bossConfig.emissiveColor || bossConfig.color);
      boss.mesh.material.emissiveIntensity = bossConfig.emissiveIntensity || 0.5;
    }
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
    boss.groundY, // Lock to ground
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

    // Dispose geometry
    boss.mesh.geometry.dispose();

    // Dispose material(s) - handle both single and array
    if (Array.isArray(boss.mesh.material)) {
      boss.mesh.material.forEach(mat => mat.dispose());
    } else {
      boss.mesh.material.dispose();
    }

    // Clean up crown child meshes for Cube King
    boss.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
      // Recursively clean up crown spikes
      child.children.forEach(grandchild => {
        if (grandchild.geometry) grandchild.geometry.dispose();
        if (grandchild.material) {
          if (Array.isArray(grandchild.material)) {
            grandchild.material.forEach(mat => mat.dispose());
          } else {
            grandchild.material.dispose();
          }
        }
      });
    });
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

      // Handle array materials for clones too
      if (Array.isArray(clone.mesh.material)) {
        clone.mesh.material.forEach(mat => mat.dispose());
      } else {
        clone.mesh.material.dispose();
      }
    }
  });

  boss.platforms.forEach(platform => {
    if (platform.mesh) {
      scene.remove(platform.mesh);
      platform.mesh.geometry.dispose();
      platform.mesh.material.dispose();
    }
  });

  boss.isActive = false;
}
