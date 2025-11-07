/**
 * Boss Type Configurations
 *
 * Defines unique boss variants for each enemy type with:
 * - Visual properties and scale multipliers
 * - Phase thresholds and mechanics
 * - Attack patterns and cooldowns
 * - Special abilities and behaviors
 */

import * as THREE from 'three';

/**
 * Boss type definitions
 * Each boss extends the corresponding enemy type with enhanced mechanics
 */
const bossTypes = {
  /**
   * THE CUBE KING - Box Boss
   * Royal commander that summons minions and charges at the player
   */
  box: {
    name: 'The Cube King',
    baseName: 'box',
    scale: 3.0,
    baseHealth: 1000,
    healthScaling: 0.15, // +15% per wave
    contactDamage: 10,

    // Visual properties
    color: 0xDAA520, // Goldenrod
    emissiveColor: 0xFFD700, // Gold
    emissiveIntensity: 0.8,

    // Crown decoration
    hasCrown: true,
    crownColor: 0xFFD700,

    // Phases
    phases: [
      {
        name: 'Royal Command',
        healthPercent: 1.0,
        minHealthPercent: 0.5,
        moveSpeedMultiplier: 1.0,
        behaviors: {
          summonMinions: {
            enabled: true,
            cooldown: 8.0,
            minionType: 'box',
            count: [2, 3], // Random between 2-3
          },
          chargeAttack: {
            enabled: true,
            cooldown: 12.0,
            chargeSpeed: 2.5,
            chargeDuration: 1.0,
            telegraphDuration: 0.8,
            damageMultiplier: 1.5,
          },
        },
      },
      {
        name: 'Desperate Monarch',
        healthPercent: 0.5,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 1.5,
        behaviors: {
          summonMinions: {
            enabled: true,
            cooldown: 10.0,
            minionType: 'box',
            count: [3, 4],
            onPhaseStart: 4, // Summon 4 immediately
          },
          chargeAttack: {
            enabled: true,
            cooldown: 5.0,
            chargeSpeed: 3.0,
            chargeDuration: 1.2,
            telegraphDuration: 0.6,
            damageMultiplier: 2.0,
          },
          royalSeal: {
            enabled: true,
            onChargeEnd: true, // Leave hazard after charge
            duration: 5.0,
            radius: 40,
            damagePerSecond: 15,
          },
        },
      },
    ],
  },

  /**
   * THE ARTILLERY TOWER - Shooter Boss
   * Multi-phase ranged attacker with rotating weapon systems
   */
  shooter: {
    name: 'The Artillery Tower',
    baseName: 'shooter',
    scale: 3.0,
    baseHealth: 800,
    healthScaling: 0.15,
    contactDamage: 8,

    color: 0x8A2BE2, // BlueViolet
    emissiveColor: 0x9370DB, // MediumPurple
    emissiveIntensity: 0.7,

    // Tower-specific visuals
    hasCannons: true,
    cannonCount: 6,

    phases: [
      {
        name: 'Suppressive Fire',
        healthPercent: 1.0,
        minHealthPercent: 0.4,
        attackPatternRotation: true,
        patternCooldown: 6.0,
        maintainDistance: 200,

        behaviors: {
          burstShot: {
            enabled: true,
            projectileCount: 5,
            delayBetweenShots: 0.2,
            projectileSpeed: 3.0,
          },
          spreadPattern: {
            enabled: true,
            projectileCount: 5,
            arcDegrees: 45,
            projectileSpeed: 2.5,
          },
          rotatingBarrage: {
            enabled: true,
            projectileCount: 8,
            rotationSpeed: 180, // degrees per second
            projectileSpeed: 2.8,
          },
        },
      },
      {
        name: 'Overcharged Mode',
        healthPercent: 0.4,
        minHealthPercent: 0.0,
        attackPatternRotation: true,
        patternCooldown: 5.0,
        maintainDistance: 250,
        colorShift: 0xFF1493, // Deep pink

        behaviors: {
          burstShot: { enabled: true, projectileCount: 7, delayBetweenShots: 0.15, projectileSpeed: 3.5 },
          spreadPattern: { enabled: true, projectileCount: 7, arcDegrees: 60, projectileSpeed: 3.0 },
          rotatingBarrage: { enabled: true, projectileCount: 12, rotationSpeed: 240, projectileSpeed: 3.2 },
          laserBeam: {
            enabled: true,
            cooldown: 8.0,
            chargeDuration: 2.0,
            fireDuration: 1.0,
            damage: 80,
            width: 10,
            range: 400,
          },
          summonMinions: {
            enabled: true,
            healthThreshold: 0.2,
            minionType: 'shooter',
            count: 2,
            onceOnly: true,
          },
        },
      },
    ],
  },

  /**
   * THE JUGGERNAUT - Tank Boss
   * Three-phase heavily armored boss with shield mechanics
   */
  tank: {
    name: 'The Juggernaut',
    baseName: 'tank',
    scale: 3.5,
    baseHealth: 2500,
    healthScaling: 0.15,
    contactDamage: 15,

    color: 0xDC143C, // Crimson
    emissiveColor: 0xFF0000,
    emissiveIntensity: 0.6,

    // Armor visuals
    hasArmor: true,
    hasShield: true,

    phases: [
      {
        name: 'Armored Advance',
        healthPercent: 1.0,
        minHealthPercent: 0.6,
        moveSpeedMultiplier: 0.7,

        behaviors: {
          shieldMechanic: {
            enabled: true,
            frontDamageReduction: 0.5, // 50% damage reduction from front
            shieldArc: 120, // degrees
          },
          groundSlam: {
            enabled: true,
            cooldown: 10.0,
            telegraphDuration: 1.5,
            radius: 150,
            damage: 50,
          },
          immunities: {
            knockback: true,
            freeze: true,
          },
        },
      },
      {
        name: 'Shattered Defense',
        healthPercent: 0.6,
        minHealthPercent: 0.3,
        moveSpeedMultiplier: 1.0,

        behaviors: {
          shieldMechanic: { enabled: false }, // Shield breaks
          onPhaseStart: {
            effect: 'shieldShatter',
            summonMinions: { minionType: 'tank', count: 2 },
          },
          groundSlam: {
            enabled: true,
            cooldown: 8.0,
            telegraphDuration: 1.2,
            radius: 150,
            damage: 60,
          },
          shoulderCharge: {
            enabled: true,
            cooldown: 6.0,
            telegraphDuration: 0.8,
            chargeSpeed: 4.0,
            chargeDuration: 1.5,
            damage: 45,
            stunDuration: 1.0,
          },
        },
      },
      {
        name: 'Berserker Rage',
        healthPercent: 0.3,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 1.4,
        contactDamage: 40,

        behaviors: {
          onPhaseStart: {
            effect: 'armorBreak',
          },
          groundSlam: {
            enabled: true,
            cooldown: 6.0,
            telegraphDuration: 1.0,
            radius: 200,
            damage: 70,
          },
          shoulderCharge: {
            enabled: true,
            cooldown: 4.0,
            telegraphDuration: 0.5,
            chargeSpeed: 5.0,
            chargeDuration: 2.0,
            damage: 55,
            stunDuration: 1.5,
          },
        },
      },
    ],
  },

  /**
   * THE PHANTOM BLADE - Berserker Boss
   * Ultra-fast glass cannon with afterimage clones
   */
  berserker: {
    name: 'The Phantom Blade',
    baseName: 'berserker',
    scale: 2.5,
    baseHealth: 400,
    healthScaling: 0.12,
    contactDamage: 12,

    color: 0xFF4500, // OrangeRed
    emissiveColor: 0xFF6347, // Tomato
    emissiveIntensity: 1.0,

    // Visual effects
    hasAfterimage: true,
    afterimageCount: 5,
    hasLightningEffects: true,

    phases: [
      {
        name: 'Rapid Assault',
        healthPercent: 1.0,
        minHealthPercent: 0.5,
        moveSpeedMultiplier: 2.0,

        behaviors: {
          dashAttack: {
            enabled: true,
            dashCount: 3,
            dashSpeed: 8.0,
            dashDelay: 0.15,
            telegraphDuration: 0.5,
            trailDamage: 20,
            trailDuration: 0.8,
            cooldown: 5.0,
          },
        },
      },
      {
        name: 'Phantom Step',
        healthPercent: 0.5,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 2.2,

        behaviors: {
          onPhaseStart: {
            effect: 'spawnClones',
            cloneCount: 2,
            cloneHealth: 150,
            cloneDelay: 0.5, // seconds behind boss movement
          },
          dashAttack: {
            enabled: true,
            dashCount: 5,
            dashSpeed: 9.0,
            dashDelay: 0.12,
            telegraphDuration: 0.4,
            trailDamage: 25,
            trailDuration: 1.0,
            cooldown: 4.0,
          },
          cloneMimic: {
            enabled: true,
            allClonesDash: true,
          },
        },
      },
    ],
  },

  /**
   * THE VOID CORE - Magnetic Boss
   * Gravity manipulation with singularity mechanics
   */
  magnetic: {
    name: 'The Void Core',
    baseName: 'magnetic',
    scale: 3.0,
    baseHealth: 1200,
    healthScaling: 0.15,
    contactDamage: 10,

    color: 0x00BFFF, // DeepSkyBlue
    emissiveColor: 0x1E90FF, // DodgerBlue
    emissiveIntensity: 0.9,

    // Black hole visuals
    hasVortex: true,
    vortexParticleCount: 500,
    hasDistortionShader: true,

    phases: [
      {
        name: 'Gravity Well',
        healthPercent: 1.0,
        minHealthPercent: 0.5,
        moveSpeedMultiplier: 0.8,

        behaviors: {
          gravityPull: {
            enabled: true,
            range: 100,
            pullStrength: 0.3, // Reduced from 1.0
          },
          orbitAttack: {
            enabled: true,
            cooldown: 5.0,
            projectileCount: 8,
            orbitRadius: 80,
            orbitDuration: 2.0,
            projectileSpeed: 3.5,
          },
        },
      },
      {
        name: 'Singularity',
        healthPercent: 0.5,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 0.0, // Becomes stationary
        colorShift: 0x4B0082, // Indigo (purple-black)

        behaviors: {
          gravityPull: {
            enabled: true,
            range: 150,
            pullStrength: 0.5, // Reduced from 1.5
          },
          gravityZones: {
            enabled: true,
            zoneCount: 3,
            zoneDuration: 8.0,
            zoneRadius: 50,
            zonePullStrength: 0.7, // Reduced from 2.0
            respawnInterval: 10.0,
          },
          blackHoleBurst: {
            enabled: true,
            cooldown: 10.0,
            telegraphDuration: 2.0,
            pullDuration: 2.0,
            pullStrength: 1.0, // Reduced from 3.0
            explosionRadius: 120,
            explosionDamage: 60,
            knockbackStrength: 5.0,
          },
          orbitAttack: {
            enabled: true,
            cooldown: 4.0,
            projectileCount: 12,
            orbitRadius: 100,
            orbitDuration: 1.5,
            projectileSpeed: 4.0,
          },
          summonMinions: {
            enabled: true,
            healthThreshold: 0.25,
            minionType: 'magnetic',
            count: 1,
            onceOnly: true,
          },
        },
      },
    ],
  },

  /**
   * THE WARLORD - Elite Boss
   * Multi-weapon tactical boss with spawnable turret platforms
   */
  elite: {
    name: 'The Warlord',
    baseName: 'elite',
    scale: 3.0,
    baseHealth: 1800,
    healthScaling: 0.15,
    contactDamage: 12,

    color: 0xFFFF33, // Yellow
    emissiveColor: 0xFFD700, // Gold
    emissiveIntensity: 0.8,

    // Multi-colored relic patterns
    hasRelicPatterns: true,
    hasWeaponPlatforms: true,

    phases: [
      {
        name: 'Tactical Assault',
        healthPercent: 1.0,
        minHealthPercent: 0.6,
        moveSpeedMultiplier: 1.0,
        maintainDistance: 180,

        behaviors: {
          weaponRotation: {
            enabled: true,
            rotationInterval: 15.0,
            weapons: ['spreadShot', 'homingMissiles', 'plasmaRain'],
          },
          spreadShot: {
            enabled: true,
            projectileCount: 5,
            arcDegrees: 45,
            projectileSpeed: 3.0,
            cooldown: 2.0,
          },
          homingMissiles: {
            enabled: true,
            missileCount: 3,
            missileSpeed: 2.0,
            homingStrength: 0.8,
            cooldown: 3.0,
          },
          plasmaRain: {
            enabled: true,
            projectileCount: 8,
            targetRadius: 60,
            fallSpeed: 4.0,
            telegraphDuration: 1.0,
            cooldown: 4.0,
          },
        },
      },
      {
        name: 'Adaptive Warfare',
        healthPercent: 0.6,
        minHealthPercent: 0.3,
        moveSpeedMultiplier: 1.2,
        maintainDistance: 200,

        behaviors: {
          onPhaseStart: {
            effect: 'deployPlatforms',
            platformCount: 3,
            platformHealth: 150,
            platformSpacing: 120, // degrees apart
          },
          weaponRotation: {
            enabled: true,
            rotationInterval: 10.0,
            weapons: ['spreadShot', 'homingMissiles', 'plasmaRain'],
            randomSelection: true,
          },
          platforms: {
            enabled: true,
            respawnInterval: 20.0,
            weapons: {
              platform1: 'spreadShot',
              platform2: 'homingMissiles',
              platform3: 'plasmaRain',
            },
          },
          spreadShot: { enabled: true, projectileCount: 5, arcDegrees: 45, projectileSpeed: 3.5, cooldown: 2.5 },
          homingMissiles: { enabled: true, missileCount: 4, missileSpeed: 2.5, homingStrength: 1.0, cooldown: 3.5 },
          plasmaRain: { enabled: true, projectileCount: 10, targetRadius: 70, fallSpeed: 5.0, telegraphDuration: 0.8, cooldown: 4.5 },
        },
      },
      {
        name: 'Overwhelming Force',
        healthPercent: 0.3,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 1.5,
        maintainDistance: 150,
        colorShift: 0xFF00FF, // Rainbow effect (handled in rendering)

        behaviors: {
          onPhaseStart: {
            effect: 'recallPlatforms',
            summonMinions: { minionType: 'elite', count: 2 },
          },
          combinedWeapons: {
            enabled: true,
            cooldown: 5.0,
            fireAllSimultaneously: true,
          },
          spreadShot: { enabled: true, projectileCount: 7, arcDegrees: 60, projectileSpeed: 4.0 },
          homingMissiles: { enabled: true, missileCount: 5, missileSpeed: 3.0, homingStrength: 1.2 },
          plasmaRain: { enabled: true, projectileCount: 12, targetRadius: 80, fallSpeed: 6.0, telegraphDuration: 0.6 },
          erraticMovement: {
            enabled: true,
            strafingSpeed: 2.0,
            changeDirectionInterval: 1.5,
          },
        },
      },
    ],
  },

  /**
   * THE SHADE MONARCH - Phantom Boss
   * Enhanced invulnerability mechanics with clone spawning
   */
  phantom: {
    name: 'The Shade Monarch',
    baseName: 'phantom',
    scale: 3.0,
    baseHealth: 600,
    healthScaling: 0.12,
    contactDamage: 10,

    color: 0xFFFFFF, // White
    emissiveColor: 0xF0F8FF, // AliceBlue
    emissiveIntensity: 1.0,
    opacity: 0.4,

    // Ghost effects
    hasGhostTrail: true,
    hasFragments: true,
    fragmentCount: 12,

    phases: [
      {
        name: 'Ethereal Dance',
        healthPercent: 1.0,
        minHealthPercent: 0.5,
        moveSpeedMultiplier: 1.2,

        behaviors: {
          invulnerability: {
            enabled: true,
            hitsToBreak: 5,
            vulnerableDuration: 3.0,
            glowWhenVulnerable: true,
          },
          teleport: {
            enabled: true,
            cooldown: 4.0,
            teleportRange: [80, 150],
            leaveHazard: true,
            hazardDuration: 5.0,
            hazardRadius: 30,
            hazardDamage: 12,
          },
          projectileOnTeleport: {
            enabled: true,
            projectileCount: 3,
            spreadAngle: 120,
            projectileSpeed: 2.5,
          },
        },
      },
      {
        name: 'Shadow Realm',
        healthPercent: 0.5,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 1.3,

        behaviors: {
          onPhaseStart: {
            effect: 'spawnPhantomClones',
            cloneCount: 3,
            cloneHealth: 200,
          },
          invulnerability: {
            enabled: true,
            hitsToBreak: 7,
            vulnerableDuration: 3.0,
            glowWhenVulnerable: true,
            affectsClones: true, // All become vulnerable together
          },
          teleport: {
            enabled: true,
            cooldown: 3.0,
            teleportRange: [100, 180],
            leaveHazard: true,
            hazardDuration: 6.0,
            hazardRadius: 35,
            hazardDamage: 15,
            clonesAlsoTeleport: true,
          },
          projectileOnTeleport: {
            enabled: true,
            projectileCount: 4,
            spreadAngle: 90,
            projectileSpeed: 3.0,
          },
          cloneRespawn: {
            enabled: true,
            respawnInterval: 25.0,
          },
          crownMarker: {
            enabled: true, // Visual indicator of real boss
          },
        },
      },
    ],
  },

  /**
   * THE HIVEMIND - Swarm Boss
   * Mega-swarm of 20-30+ drones with coordinated flocking
   * Note: Swarm bosses spawn multiple entities, handled specially in enemySpawning.js
   */
  swarm: {
    name: 'The Hivemind',
    baseName: 'swarm',
    scale: 1.5, // Slightly larger individual drones
    baseHealth: 1200, // Total health distributed across all members
    healthScaling: 0.12, // +12% per wave
    contactDamage: 8, // Higher than regular swarm members

    // Visual properties
    color: 0x00FFAA,
    emissiveColor: 0x00FFFF,
    emissiveIntensity: 1.0,

    // Boss-specific swarm properties
    memberCount: [20, 30], // Spawn 20-30 members
    memberHealthMultiplier: 1.5, // Each member has more health
    formationTightness: 0.7, // Tighter formation than regular swarms

    // Phases
    phases: [
      {
        name: 'Synchronized Assault',
        healthPercent: 1.0,
        minHealthPercent: 0.5,
        moveSpeedMultiplier: 1.0,
        behaviors: {
          swarmFormation: {
            enabled: true,
            pattern: 'sphere', // Members orbit in 3D sphere
            rotationSpeed: 1.0,
          },
        },
      },
      {
        name: 'Desperate Swarm',
        healthPercent: 0.5,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 1.3,
        colorShift: 0xFF0000, // Turn red when low health
        behaviors: {
          swarmFormation: {
            enabled: true,
            pattern: 'aggressive', // Break formation, rush player
            rotationSpeed: 2.0,
          },
        },
      },
    ],
  },
  mortar: {
    name: 'Cold-blooded Mortar',
    baseName: 'mortar',
    scale: 4.0,
    baseHealth: 2500,
    healthScaling: 0.15,
    contactDamage: 30,

    color: 0x4B7F52,
    emissiveColor: 0x6B9F62,
    emissiveIntensity: 1.2,

    phases: [
      {
        name: 'Strategic Bombardment',
        healthPercent: 1.0,
        minHealthPercent: 0.5,
        moveSpeedMultiplier: 0.8, // Mobile but slow
        maintainDistance: 220, // Kite away from player

        behaviors: {
          lineBarrage: {
            enabled: true,
            cooldown: 8.0,
            projectileCount: 5,
            lineSpacing: 40,
            staggerDelay: 0.2,
          },
          vShapeBarrage: {
            enabled: true,
            cooldown: 9.0,
            projectileCount: 7,
            vAngle: 60,
          },
          spreadBarrage: {
            enabled: true,
            cooldown: 10.0,
            projectileCount: 7,
            arcDegrees: 90,
          },
        },
      },
      {
        name: 'Desperate Salvo',
        healthPercent: 0.5,
        minHealthPercent: 0.0,
        moveSpeedMultiplier: 1.0, // Faster when panicking
        maintainDistance: 250, // Kite further away
        colorShift: 0xFF0000, // Shift to red when low health

        behaviors: {
          circleBarrage: {
            enabled: true,
            cooldown: 12.0,
            projectileCount: 12,
            radius: 80,
          },
          spiralBarrage: {
            enabled: true,
            cooldown: 11.0,
            projectileCount: 15,
            angleStep: 30,
            radialStep: 20,
          },
          crossBarrage: {
            enabled: true,
            cooldown: 9.0,
            armLength: 100,
            projectilesPerArm: 3,
          },
          randomScatter: {
            enabled: true,
            cooldown: 7.0,
            projectileCount: 10,
            maxRadius: 100,
            minSpacing: 30,
          },
        },
      },
    ],
  },
};

/**
 * Boss unlock levels - determines when each boss type becomes available
 */
export const bossUnlockLevels = {
  box: 1,
  shooter: 2,
  tank: 3,
  berserker: 4,
  magnetic: 5,
  elite: 6,
  phantom: 7,
  swarm: 8,
  mortar: 10,
};

/**
 * Get available boss types based on current player level
 * @param {number} level - Current player level
 * @returns {string[]} Array of unlocked boss type names
 */
export function getAvailableBossTypes(level) {
  return Object.keys(bossUnlockLevels).filter(
    (bossType) => bossUnlockLevels[bossType] <= level && bossType !== 'swarm' && bossType !== 'mortar' // Swarm and mortar excluded (use special spawn systems)
  );
}

/**
 * Get a random unlocked boss type
 * @param {number} level - Current player level
 * @returns {string} Boss type name
 */
export function getRandomBossType(level) {
  const available = getAvailableBossTypes(level);
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Calculate boss health for current wave
 * @param {string} bossType - Boss type name
 * @param {number} waveNumber - Current wave number
 * @returns {number} Calculated boss health
 */
export function calculateBossHealth(bossType, waveNumber) {
  const boss = bossTypes[bossType];
  return Math.floor(boss.baseHealth * (1 + waveNumber * boss.healthScaling));
}

export default bossTypes;
