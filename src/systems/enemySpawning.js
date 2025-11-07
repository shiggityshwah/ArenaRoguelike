/**
 * Enemy Spawning System
 * Handles spawning of enemies and bosses
 * Extracted from index-reference.html (lines ~2013-2142)
 *
 * EXTERNAL DEPENDENCIES (must be passed/injected):
 * - scene: THREE.Scene object for adding enemies
 * - enemies: Array of active enemy objects
 * - enemyPrototypes: Enemy configuration data (from src/config/enemyTypes.js)
 * - playerCone: Player mesh object with position
 * - enemyCounts: Object tracking count of each enemy type
 * - bossCount: Current number of bosses
 * - level: Current game level
 * - gameSpeedMultiplier: Current game speed modifier
 * - createGravityVortex: Function from effects.js
 * - MAX_BOSSES: Maximum number of bosses allowed
 * - MIN_BOX_RATIO: Minimum ratio of box enemies to maintain
 */

import * as THREE from 'three';
import { createBoss } from './bossSystem.js';
import { getRandomBossType } from '../config/bossTypes.js';
import { BOSS_WAVE_INTERVAL, MAX_ACTIVE_BOSSES, ARENA_PLAYABLE_HALF_SIZE } from '../config/constants.js';

// Enemy unlock levels
const enemyUnlockLevels = {
    shooter: 2,
    tank: 3,
    berserker: 4,
    magnetic: 5,
    elite: 6,
    phantom: 7,
    swarm: 8,
    mortar: 10  // Late-game artillery enemy
};

// Spawn weights for weighted random selection
const spawnWeights = {
    shooter: 20,
    tank: 15,
    berserker: 12,
    magnetic: 8,
    swarm: 7,
    mortar: 6,  // Between magnetic and elite
    elite: 5,
    phantom: 3
};

// Tier multipliers for enemy difficulty scaling
const TIER_MULTIPLIERS = {
    normal: { health: 1.0, scale: 1.0, damage: 1.0 },
    elite: { health: 2.5, scale: 1.5, damage: 1.5 },
    boss: { health: 5.0, scale: 2.5, damage: 2.0 }
};

/**
 * Spawns a specific enemy type
 * @param {string} type - Enemy type to spawn (box, shooter, tank, berserker, magnetic, elite, phantom, swarm)
 * @param {string} tier - Enemy tier: 'normal', 'elite', or 'boss' (default: 'normal')
 * @param {Object} dependencies - Object containing all external dependencies
 *
 * Dependencies:
 * - scene: THREE.Scene to add enemy meshes
 * - enemies: Array of active enemies
 * - enemyPrototypes: Configuration for enemy types
 * - playerCone: Player object with position
 * - enemyCounts: Object tracking enemy counts by type
 * - bossCount: Current boss count (passed as mutable object/getter)
 * - level: Current game level
 * - gameSpeedMultiplier: Speed modifier
 * - createGravityVortex: Function from effects.js
 * - gravityWellEffects: Array of gravity well effects
 */
export function spawnSpecificEnemy(type, tier = 'normal', dependencies) {
    const {
        scene,
        enemies,
        enemyPrototypes,
        playerCone,
        enemyCounts,
        getBossCount,
        setBossCount,
        level,
        gameSpeedMultiplier,
        createGravityVortex,
        gravityWellEffects
    } = dependencies;

    const proto = enemyPrototypes[type];
    if (!proto) return;

    // Get tier multipliers
    const mult = TIER_MULTIPLIERS[tier] || TIER_MULTIPLIERS.normal;

    // Calculate stats with tier multipliers
    const baseHealth = proto.baseHealth + Math.random() * proto.healthRand + (level * proto.healthLevelScale);
    const health = baseHealth * mult.health;
    const baseSpeed = proto.baseSpeed + level * proto.speedLevelScale;
    const speed = baseSpeed * gameSpeedMultiplier;
    const scale = mult.scale;

    let enemyMesh;
    if (proto.material) {
        enemyMesh = new THREE.Mesh(proto.geometry(), proto.material.clone());
    } else {
        const material = proto.getMaterial();
        enemyMesh = new THREE.Mesh(proto.geometry(10 * scale), material);
    }
    enemyMesh.scale.set(scale, scale, scale);

    // All enemies spawn at consistent Y height (matches reference implementation)
    // Tanks need extra height due to BoxGeometry being 25 units tall
    let yPosition = 5 * scale;
    if (type === 'tank') {
        yPosition = 12.5 * scale; // Half the box height to sit on ground
    }

    let x, z, attempts = 0;
    do {
        x = (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 2);
        z = (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 2);
        if (attempts++ > 100) {
            console.warn("Could not place enemy far from player after 100 attempts.");
            break;
        }
    } while (new THREE.Vector3(x, yPosition, z).distanceTo(playerCone.position) < 150);
    enemyMesh.position.set(x, yPosition, z);

    const enemyData = {
        mesh: enemyMesh,
        speed: speed,
        baseSpeed: baseSpeed,
        health: health,
        maxHealth: health,
        type: type,
        radius: (type === 'tank' ? 12.5 : 8) * scale,
        contactDamage: proto.contactDamage * mult.damage,
        isBoss: tier === 'boss', // Only 'boss' tier counts as boss
        isGeometryShared: type === 'shooter',
        hitEffectUntil: null,
        baseEmissiveIntensity: enemyMesh.material.emissiveIntensity,
        pullForces: new THREE.Vector3()
    };

    if (type === 'magnetic') {
        enemyMesh.rotation.x = Math.PI / 2;
        enemyData.gravityEffect = createGravityVortex(enemyMesh, 100, 20, 0x4169e1, true, gravityWellEffects);
    }

    if (type === 'box' || type === 'shooter' || type === 'elite' || type === 'berserker') {
        const wireframeGeometry = new THREE.WireframeGeometry(enemyMesh.geometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({ color: enemyMesh.material.color });
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        enemyMesh.add(wireframe);
        enemyData.wireframe = wireframe;
        enemyData.initialColor = enemyMesh.material.color.clone();
    }

    if (type === 'shooter' || type === 'elite') enemyData.lastShotTime = 0;
    if (type === 'phantom') {
        enemyData.teleportCount = 0;
        enemyData.teleportsBeforeVulnerable = 3;
        enemyData.isVulnerable = false;
    }

    scene.add(enemyMesh);
    enemies.push(enemyData);
    enemyCounts[type] = (enemyCounts[type] || 0) + 1;
    if (tier === 'boss') {
        const newCount = getBossCount() + 1;
        setBossCount(newCount);
    }
}

/**
 * Spawns a random boss enemy (OLD SYSTEM - enemy-based boss)
 * @param {Object} dependencies - Object containing all external dependencies
 * @deprecated Use spawnNewBoss() for true boss system
 *
 * Dependencies:
 * - All dependencies required by spawnSpecificEnemy
 * - MAX_BOSSES: Maximum number of bosses allowed
 */
export function spawnBoss(dependencies) {
    const { getBossCount, MAX_BOSSES } = dependencies;

    if (getBossCount() >= MAX_BOSSES) return;

    const bossTypes = ['tank', 'elite', 'magnetic', 'phantom'];
    const randomBossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
    spawnSpecificEnemy(randomBossType, 'boss', dependencies);
}

/**
 * Gets a weighted random enemy type based on current level
 * @param {number} currentLevel - Current game level
 * @returns {string|null} Enemy type to spawn, or null if no types available
 */
export function getWeightedRandomEnemyType(currentLevel) {
    const availableTypes = [];
    for (const type in enemyUnlockLevels) {
        if (currentLevel >= enemyUnlockLevels[type]) {
            availableTypes.push(type);
        }
    }

    if (availableTypes.length === 0) return null;

    const availableWeights = {};
    let currentTotalWeight = 0;
    for (const type of availableTypes) {
        if (spawnWeights[type]) {
            availableWeights[type] = spawnWeights[type];
            currentTotalWeight += spawnWeights[type];
        }
    }

    if (currentTotalWeight === 0) return availableTypes[0];

    let rand = Math.random() * currentTotalWeight;
    for (const type in availableWeights) {
        if (rand < availableWeights[type]) return type;
        rand -= availableWeights[type];
    }
    return availableTypes[availableTypes.length - 1]; // Fallback
}

/**
 * Spawns an enemy using weighted random selection, ensuring minimum box ratio
 * @param {Object} dependencies - Object containing all external dependencies
 *
 * Dependencies:
 * - All dependencies required by spawnSpecificEnemy
 * - enemies: Array of active enemies
 * - enemyCounts: Object tracking enemy counts by type
 * - level: Current game level
 * - MIN_BOX_RATIO: Minimum ratio of box enemies
 */
export function spawnEnemy(dependencies) {
    const {
        enemies,
        enemyCounts,
        level,
        getBossCount,
        MIN_BOX_RATIO
    } = dependencies;

    const nonBossCount = enemies.length - getBossCount();
    const boxCount = enemyCounts['box'] || 0;
    const typeToSpawn = getWeightedRandomEnemyType(level);

    if (typeToSpawn === null || nonBossCount === 0 || (boxCount / nonBossCount < MIN_BOX_RATIO)) {
        spawnSpecificEnemy('box', false, dependencies);
    } else {
        // Swarms are special - they spawn multiple entities
        if (typeToSpawn === 'swarm') {
            spawnSwarm(dependencies);
        } else {
            spawnSpecificEnemy(typeToSpawn, false, dependencies);
        }
    }
}

/**
 * Check if current wave should spawn a boss
 * @param {number} waveNumber - Current wave number
 * @returns {boolean} True if this is a boss wave
 */
export function isBossWave(waveNumber) {
    return waveNumber > 0 && waveNumber % BOSS_WAVE_INTERVAL === 0;
}

/**
 * Spawn a new-style boss (using boss system)
 * @param {Object} dependencies - Dependencies for boss spawning
 * @returns {Object|null} Created boss entity or null if failed
 *
 * Dependencies:
 * - scene: THREE.Scene
 * - level: Current player level
 * - waveNumber: Current wave number
 * - bosses: Array of active bosses
 * - bossUIManager: Boss UI manager instance
 * - bossType: (Optional) Specific boss type to spawn. If not provided, random based on level.
 */
export function spawnNewBoss(dependencies) {
    const {
        scene,
        level,
        waveNumber,
        bosses,
        bossUIManager,
        playerCone,
        bossType: specifiedBossType
    } = dependencies;

    // Check if we can spawn more bosses
    if (bosses.length >= MAX_ACTIVE_BOSSES) {
        console.log('Max bosses reached, cannot spawn more');
        return null;
    }

    // Get boss type - use specified type or get random based on player level
    const bossType = specifiedBossType || getRandomBossType(level);

    // Note: 'swarm' bosses are not handled here - they use the enemy system
    // Spawn swarm bosses via spawnBossSwarm() directly (see DebugControls.spawnBoss)
    if (bossType === 'swarm') {
        console.warn('Cannot spawn swarm boss through spawnNewBoss - use spawnBossSwarm() instead');
        return null;
    }

    // Determine spawn position (far from player)
    let spawnPosition;
    let attempts = 0;

    do {
        const x = (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 1.8);
        const z = (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 1.8);
        spawnPosition = new THREE.Vector3(x, 100, z); // Spawns high in sky

        attempts++;
        if (attempts > 100) {
            console.warn('Could not find spawn position far from player');
            spawnPosition = new THREE.Vector3(0, 100, 300);
            break;
        }
    } while (
        playerCone &&
        spawnPosition.distanceTo(playerCone.position) < 200
    );

    // Create boss using new boss system
    const boss = createBoss({
        scene,
        bossType,
        waveNumber,
        level,
        spawnPosition,
    });

    if (!boss) {
        console.error('Failed to create boss');
        return null;
    }

    // Add to bosses array
    bosses.push(boss);

    // Create health bar UI
    if (bossUIManager) {
        bossUIManager.createHealthBar(boss);
    }

    console.log(`Spawned boss: ${boss.bossType} (Wave ${waveNumber})`);

    return boss;
}

/**
 * Spawn multiple enemies for a wave start
 * @param {number} count - Number of enemies to spawn
 * @param {Object} dependencies - Dependencies for enemy spawning (same as spawnEnemy)
 * @returns {Array} Array of spawned enemies
 */
export function spawnWave(count, dependencies) {
    const spawnedEnemies = [];

    for (let i = 0; i < count; i++) {
        const enemy = spawnEnemy(dependencies);
        if (enemy) {
            spawnedEnemies.push(enemy);
        }
    }

    console.log(`Spawned wave: ${spawnedEnemies.length} enemies`);
    return spawnedEnemies;
}

/**
 * Spawn a single trickle enemy (always 'box' type)
 * @param {Object} dependencies - Dependencies for enemy spawning
 * @returns {Object|null} Spawned enemy or null if failed
 */
export function spawnTrickleEnemy(dependencies) {
    // Force spawn a 'box' enemy by calling spawnSpecificEnemy directly
    const enemy = spawnSpecificEnemy('box', 'normal', dependencies);
    return enemy;
}

/**
 * Spawns a swarm enemy (group of 4-10 small drones with flocking behavior)
 * @param {Object} dependencies - Dependencies for enemy spawning
 * @param {string} tier - Swarm tier: 'normal', 'elite', or 'boss' (default: 'normal')
 * @returns {Array} Array of spawned swarm members
 */
export function spawnSwarm(dependencies, tier = 'normal') {
    const {
        scene,
        enemies,
        enemyPrototypes,
        playerCone,
        enemyCounts,
        level,
        gameSpeedMultiplier,
        waveNumber
    } = dependencies;

    const proto = enemyPrototypes.swarm;
    if (!proto) return [];

    // Generate unique swarm ID
    const swarmId = `swarm_${Date.now()}_${Math.random()}`;

    // Determine member count and multipliers based on tier
    let memberCount;
    let mult;

    if (tier === 'boss') {
        // Boss variant: The Hivemind (20-30 members)
        memberCount = 20 + Math.floor(Math.random() * 11); // 20-30
        mult = { health: 1.5, scale: 1.5, damage: 1.6 }; // Boss swarms are tougher
    } else if (tier === 'elite') {
        // Elite swarm: More members, stronger (10-15 members)
        memberCount = 10 + Math.floor(Math.random() * 6); // 10-15
        mult = TIER_MULTIPLIERS.elite; // 2.5x health, 1.5x scale/damage
    } else {
        // Regular swarm (4-10 members, increases slightly with level)
        const baseMemberCount = 4 + Math.floor(Math.random() * 7); // 4-10
        const levelBonus = Math.min(Math.floor(level / 5), 3); // +1 member every 5 levels, max +3
        memberCount = baseMemberCount + levelBonus;
        mult = TIER_MULTIPLIERS.normal; // 1x stats
    }

    // Calculate spawn center (far from player)
    let spawnCenter;
    let attempts = 0;
    do {
        const x = (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 2);
        const z = (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 2);
        spawnCenter = new THREE.Vector3(x, 5 * mult.scale, z); // Match enemy spawn height
        attempts++;
        if (attempts > 100) {
            console.warn("Could not place swarm far from player after 100 attempts.");
            break;
        }
    } while (spawnCenter.distanceTo(playerCone.position) < 200);

    const swarmMembers = [];
    const formationRadius = 25; // Spread members in sphere

    for (let i = 0; i < memberCount; i++) {
        // Position members in spherical formation
        const phi = Math.acos(-1 + (2 * i) / memberCount); // Golden spiral
        const theta = Math.sqrt(memberCount * Math.PI) * phi;

        const x = spawnCenter.x + formationRadius * Math.cos(theta) * Math.sin(phi);
        const y = 5 * mult.scale; // Match other enemy Y positions (scaled by tier)
        const z = spawnCenter.z + formationRadius * Math.sin(theta) * Math.sin(phi);

        // Calculate health and speed (with tier multipliers)
        const baseHealth = proto.baseHealth + Math.random() * proto.healthRand + (level * proto.healthLevelScale);
        const health = baseHealth * mult.health;
        const baseSpeed = proto.baseSpeed + level * proto.speedLevelScale;
        const speed = baseSpeed * gameSpeedMultiplier;

        // Create mesh with tier scaling
        const material = proto.material.clone();
        const geometry = proto.geometry();
        const enemyMesh = new THREE.Mesh(geometry, material);
        enemyMesh.position.set(x, y, z);
        enemyMesh.scale.set(mult.scale, mult.scale, mult.scale);

        // Boss/Elite swarms glow brighter
        if (tier === 'boss') {
            material.emissiveIntensity = 1.0;
        } else if (tier === 'elite') {
            material.emissiveIntensity = 0.9;
        }

        // Create wireframe for tech look
        const wireframeGeometry = new THREE.WireframeGeometry(enemyMesh.geometry);
        const wireframeColor = tier === 'boss' ? 0x00FFFF : (tier === 'elite' ? 0x00FF88 : 0x00FFAA);
        const wireframeMaterial = new THREE.LineBasicMaterial({ color: wireframeColor });
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        enemyMesh.add(wireframe);

        // Create enemy data with swarm properties
        const enemyData = {
            mesh: enemyMesh,
            speed: speed,
            baseSpeed: baseSpeed,
            health: health,
            maxHealth: health,
            type: 'swarm',
            radius: 5 * mult.scale,
            contactDamage: proto.contactDamage * mult.damage,
            isBoss: tier === 'boss',
            isGeometryShared: false,
            hitEffectUntil: null,
            baseEmissiveIntensity: enemyMesh.material.emissiveIntensity,
            pullForces: new THREE.Vector3(),
            wireframe: wireframe,
            initialColor: enemyMesh.material.color.clone(),

            // Swarm-specific properties
            swarmId: swarmId,
            memberIndex: i,
            isSwarmParent: i === 0, // First member tracks the group
            swarmMembers: i === 0 ? [] : null, // Only parent has member array
            isLastSwarmMember: false, // Updated when members die
            isBossSwarm: tier === 'boss', // Track if part of boss swarm

            // Flocking behavior vectors
            separationForce: new THREE.Vector3(),
            alignmentForce: new THREE.Vector3(),
            cohesionForce: new THREE.Vector3(),
            flockingVelocity: new THREE.Vector3()
        };

        scene.add(enemyMesh);
        enemies.push(enemyData);
        swarmMembers.push(enemyData);
    }

    // Link all members to parent
    if (swarmMembers.length > 0 && swarmMembers[0].swarmMembers) {
        swarmMembers[0].swarmMembers = swarmMembers;
    }

    // Update counts
    enemyCounts.swarm = (enemyCounts.swarm || 0) + 1;

    const swarmTypeNames = {
        normal: 'swarm',
        elite: 'ELITE swarm',
        boss: 'THE HIVEMIND (Boss Swarm)'
    };
    const swarmType = swarmTypeNames[tier] || 'swarm';
    console.log(`Spawned ${swarmType} with ${memberCount} members (level ${level})`);
    return swarmMembers;
}

/**
 * Spawns The Hivemind boss (mega-swarm variant)
 * @param {Object} dependencies - Dependencies for boss spawning
 * @returns {Array} Array of spawned boss swarm members
 */
export function spawnBossSwarm(dependencies) {
    const { getBossCount, setBossCount, MAX_BOSSES } = dependencies;

    if (getBossCount() >= MAX_BOSSES) {
        console.log('Max bosses reached, cannot spawn The Hivemind');
        return [];
    }

    // Spawn boss variant
    const members = spawnSwarm(dependencies, 'boss');

    // Increment boss count (only count once for the whole swarm)
    if (members.length > 0) {
        const newCount = getBossCount() + 1;
        setBossCount(newCount);
    }

    return members;
}
