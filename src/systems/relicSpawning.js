/**
 * Relic Spawning System
 * Handles spawning, scheduling, and destruction of relics
 * Extracted from index-reference.html (lines ~1148-1250, 1960-1962, 2370-2402)
 *
 * EXTERNAL DEPENDENCIES (must be passed/injected):
 * - scene: THREE.Scene object for adding/removing relics
 * - relics: Array of active relic objects
 * - relicInfo: Relic configuration data (from src/config/relicInfo.js)
 * - relicSpawnQueue: Array to queue pending relic spawns
 * - playerCone: Player mesh object with position
 * - RelicCombatStrategies: Combat strategies for relics
 * - createGem: Function from gems.js to create gem drops
 * - gravityWellEffects: Array of active gravity well effects
 * - MAX_RELICS: Maximum number of relics allowed
 * - RELIC_SPAWN_Y: Y position for spawning relics
 */

import * as THREE from 'three';
import { ARENA_PLAYABLE_HALF_SIZE } from '../config/constants.js';

/**
 * Spawns a relic of the specified type
 * @param {string} gemType - Type of relic to spawn (attackSpeed, damage, speed, vacuum, crit, luck)
 * @param {boolean} nearPlayer - Whether to spawn near the player (default: true)
 * @param {Object} dependencies - Object containing all external dependencies
 *
 * Dependencies:
 * - relics: Array of active relic objects
 * - relicSpawnQueue: Queue for pending spawns when at max capacity
 * - relicInfo: Configuration for relic types
 * - scene: THREE.Scene to add relic meshes
 * - playerCone: Player object with position
 * - MAX_RELICS: Maximum allowed relics
 * - RELIC_SPAWN_Y: Y coordinate for spawning
 */
export function spawnRelic(gemType, nearPlayer = true, dependencies) {
    const {
        relics,
        relicSpawnQueue,
        relicInfo,
        scene,
        playerCone,
        MAX_RELICS,
        RELIC_SPAWN_Y
    } = dependencies;

    if (relics.length >= MAX_RELICS) {
        relicSpawnQueue.push(gemType);
        return;
    }

    const info = relicInfo[gemType];
    if (!info) {
        console.error(`Invalid relic type to spawn: ${gemType}`);
        return;
    }

    const minDistance = 100;
    const radius = 24; // Use a common radius for spacing check

    let position;
    let tooClose;
    let attempts = 0;

    do {
        tooClose = false;
        // Spawn near player, but not too close
        // Initial relics spawn closer (80-180), regular relics spawn further (200-400)
        const spawnRadius = nearPlayer
            ? 80 + Math.random() * 100
            : 200 + Math.random() * 200;
        const spawnAngle = Math.random() * Math.PI * 2;
        position = new THREE.Vector3(
            playerCone.position.x + Math.cos(spawnAngle) * spawnRadius,
            RELIC_SPAWN_Y,
            playerCone.position.z + Math.sin(spawnAngle) * spawnRadius
        );

        // Clamp to world bounds
        position.x = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, position.x));
        position.z = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, position.z));


        for (const group of relics) {
            const requiredSpacing = minDistance + radius * 2;
            if (position.distanceTo(group.relic.position) < requiredSpacing) {
                tooClose = true;
                break;
            }
        }

        attempts++;
        if (attempts > 20) {
            // Fallback to random placement after 20 attempts to avoid lag
            position = new THREE.Vector3(
                (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 2),
                RELIC_SPAWN_Y,
                (Math.random() - 0.5) * (ARENA_PLAYABLE_HALF_SIZE * 2)
            );
            break;
        }
    } while (tooClose);

    const relicMaterial = new THREE.MeshStandardMaterial({
        color: info.color,
        flatShading: true,
        emissive: info.color,
        emissiveIntensity: 0.4,
        toneMapped: false
    });
    const relic = new THREE.Mesh(info.geometry, relicMaterial);
    relic.position.copy(position);

    // Add point light to relic for glow
    const relicLight = new THREE.PointLight(info.color, 2, 100);
    relicLight.position.set(0, 5, 0);
    relic.add(relicLight);
    if (gemType === 'vacuum') {
        relic.rotation.x = Math.PI / 2;
    } else if (gemType === 'speed') {
        // Rotate tetrahedron to sit flat on one of its faces
        relic.rotation.x = -0.955; // ~54.7 degrees in radians
    }
    relic.castShadow = false;
    scene.add(relic);

    // Create multi-layered summoning circle
    const ringGroup = new THREE.Group();

    // Outer ring - main circle (always visible)
    const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(25, 27, 64),
        new THREE.MeshBasicMaterial({
            color: 0xffffff, // Bright white
            transparent: true,
            opacity: 1.0, // Full opacity when idle
            side: THREE.DoubleSide
        })
    );
    outerRing.rotation.x = -Math.PI / 2;
    ringGroup.add(outerRing);

    // Inner ring - pulsing glow (hidden initially)
    const innerRing = new THREE.Mesh(
        new THREE.RingGeometry(20, 22, 64),
        new THREE.MeshBasicMaterial({
            color: 0xffffff, // Bright white
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.05;
    innerRing.visible = false; // Actually hide it
    ringGroup.add(innerRing);

    // Runic patterns (smaller circles, hidden initially)
    const runeCircles = [];
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const runeCircle = new THREE.Mesh(
            new THREE.CircleGeometry(2, 16),
            new THREE.MeshBasicMaterial({
                color: 0xffffff, // Bright white
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            })
        );
        runeCircle.rotation.x = -Math.PI / 2;
        runeCircle.position.set(
            Math.cos(angle) * 23.5,
            0.1,
            Math.sin(angle) * 23.5
        );
        runeCircle.visible = false; // Actually hide it
        ringGroup.add(runeCircle);
        runeCircles.push(runeCircle);
    }

    ringGroup.position.set(relic.position.x, 0.1, relic.position.z);
    scene.add(ringGroup);

    // Create particle system for mystical effect
    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = [];

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 20;
        particlePositions[i * 3] = Math.cos(angle) * radius;
        particlePositions[i * 3 + 1] = Math.random() * 5;
        particlePositions[i * 3 + 2] = Math.sin(angle) * radius;

        particleVelocities.push({
            angle: angle,
            radius: radius,
            verticalSpeed: 0.5 + Math.random() * 1.0,
            orbitSpeed: 0.5 + Math.random() * 0.5
        });
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: info.color, // Match relic color
        size: 2,
        transparent: true,
        opacity: 0, // Hidden initially
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.position.set(relic.position.x, 0, relic.position.z);
    particleSystem.visible = false; // Actually hide it initially
    scene.add(particleSystem);

    const light = new THREE.PointLight(info.color, 2, 200);
    light.position.copy(relic.position);
    light.position.y += 10;
    light.castShadow = false;
    scene.add(light);

    const initialY = RELIC_SPAWN_Y;
    relics.push({
        relic, // was octahedron
        ring: ringGroup, // Now a group with multiple elements
        ringOuterMesh: outerRing,
        ringInnerMesh: innerRing,
        runeCircles: runeCircles, // Array of rune meshes
        particles: particleSystem,
        particleVelocities: particleVelocities,
        light,
        type: gemType,
        health: info.health,
        maxHealth: info.health,
        radius: 24, // All relics have same interaction radius for now
        state: 'idle',
        lastActionTime: 0, // was lastShotTime
        animationProgress: 0,
        initialY: initialY,
        conversionProgress: 0,
        lastDamageTick: 0, // For blue relic
        loweringSpeed: 0,
        nextDamageTick: 0,
        warningTriggered: false
    });
}

/**
 * Spawns initial relics at game start
 * @param {Object} dependencies - Object containing all external dependencies
 *
 * Dependencies:
 * - All dependencies required by spawnRelic
 */
export function spawnInitialRelics(dependencies) {
    spawnRelic('attackSpeed', true, dependencies);
    spawnRelic('attackSpeed', true, dependencies);
}

/**
 * Schedules a relic spawn by adding it to the queue
 * @param {string} gemType - Type of relic to schedule
 * @param {Array} relicSpawnQueue - Queue to add the spawn to
 */
export function scheduleRelicSpawn(gemType, relicSpawnQueue) {
    relicSpawnQueue.push(gemType);
}

/**
 * Destroys a relic and cleans up its resources
 * @param {Object} group - The relic object to destroy
 * @param {number} index - Index of the relic in the relics array
 * @param {Object} dependencies - Object containing all external dependencies
 *
 * Dependencies:
 * - scene: THREE.Scene to remove meshes from
 * - relics: Array of active relics
 * - RelicCombatStrategies: Combat strategies with onDeactivate methods
 * - createGem: Function to create gem drops
 * - gravityWellEffects: Array of active gravity well effects
 */
export function destroyRelic(group, index, dependencies) {
    const {
        scene,
        relics,
        RelicCombatStrategies,
        createGem,
        gravityWellEffects
    } = dependencies;

    // --- Gem Drop ---
    // Relics always drop one gem of their type upon destruction.
    if (group.type) {
        createGem(group.type, group.relic.position);
    }
    const strategy = RelicCombatStrategies[group.type];
    if (strategy && strategy.onDeactivate) {
        strategy.onDeactivate(group);
    }
    if (group.gravityEffect) {
        group.relic.remove(group.gravityEffect.mesh);
        group.gravityEffect.mesh.geometry.dispose();
        group.gravityEffect.mesh.material.dispose();
        const effectIndex = gravityWellEffects.indexOf(group.gravityEffect);
        if (effectIndex > -1) {
            gravityWellEffects.splice(effectIndex, 1);
        }
    }
    if (group.auraVisual) {
        group.relic.remove(group.auraVisual);
        group.auraVisual.geometry.dispose();
        group.auraVisual.material.dispose();
        group.auraVisual = null;
    }
    group.relic.material.dispose();

    // Clean up ring group and all its children
    group.ring.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    scene.remove(group.ring);

    // Clean up particles
    if (group.particles) {
        group.particles.geometry.dispose();
        group.particles.material.dispose();
        scene.remove(group.particles);
    }

    scene.remove(group.relic);
    scene.remove(group.light);
    relics.splice(index, 1);
}
