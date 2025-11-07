/**
 * Wave Manager System
 * Manages wave logic, timing, and spawn style selection
 *
 * Provides three spawn styles:
 * - Directional/Encroaching: Enemies spawn along an edge and move inward
 * - Pattern/Shape: Enemies spawn in formations (circle, arc, spiral, X-shape)
 * - Trickle/Mini-Horde: Small initial group + periodic mini-hordes
 *
 * Integrates with existing enemySpawning.js functions using dependency injection
 */

import * as THREE from 'three';
import {
    spawnSpecificEnemy,
    spawnEnemy,
    isBossWave,
    spawnNewBoss,
    getWeightedRandomEnemyType
} from './enemySpawning.js';
import { ARENA_PLAYABLE_HALF_SIZE } from '../config/constants.js';

/**
 * Wave spawn style types
 */
const WAVE_STYLES = {
    DIRECTIONAL: 'directional',
    PATTERN: 'pattern',
    TRICKLE: 'trickle'
};

/**
 * Pattern formation types
 */
const PATTERN_TYPES = {
    CIRCLE: 'circle',
    ARC: 'arc',
    SPIRAL: 'spiral',
    X_SHAPE: 'x_shape'
};

/**
 * Edge directions for directional waves
 */
const EDGE_DIRECTIONS = {
    NORTH: 'north',
    SOUTH: 'south',
    EAST: 'east',
    WEST: 'west'
};

/**
 * Wave Manager Configuration
 */
const DEFAULT_CONFIG = {
    // Base enemy count for waves
    baseEnemyCount: 10,
    enemyCountPerWave: 2,

    // Trickle wave parameters
    trickleInitialCount: 8,        // Initial group size
    trickleMiniHordeSize: 3,        // Enemies per mini-horde
    trickleMiniHordeInterval: 2.5,  // Seconds between mini-hordes

    // Directional wave parameters
    directionalBandWidth: 300,      // Width of spawn band along edge
    directionalDepth: 100,          // Depth of spawn band

    // Pattern wave parameters
    patternMinDistance: 150,        // Min distance from player
    patternMaxDistance: 250,        // Max distance from player

    // Shape probabilities (must sum to 1.0)
    patternProbabilities: {
        [PATTERN_TYPES.CIRCLE]: 0.40,
        [PATTERN_TYPES.ARC]: 0.30,
        [PATTERN_TYPES.SPIRAL]: 0.20,
        [PATTERN_TYPES.X_SHAPE]: 0.10
    },

    // Wave timing
    intermissionDuration: 2.0,      // Seconds between waves
    bossIntermissionDuration: 3.0,  // Seconds before boss wave

    // Boss wave parameters
    bossWaveEnemyCount: 6           // Enemies spawned with boss
};

/**
 * Creates a Wave Manager instance
 * @param {Object} dependencies - External dependencies
 * @param {Object} config - Optional configuration overrides
 * @returns {Object} Wave Manager API
 */
export function createWaveManager(dependencies, config = {}) {
    const {
        scene,
        enemies,
        bosses,
        enemyPrototypes,
        playerCone,
        enemyCounts,
        getBossCount,
        setBossCount,
        getLevel,
        getGameSpeedMultiplier,
        createGravityVortex,
        gravityWellEffects,
        bossUIManager,
        updateWaveUI,
        MAX_BOSSES,
        MIN_BOX_RATIO
    } = dependencies;

    // Merge config with defaults
    const waveConfig = { ...DEFAULT_CONFIG, ...config };

    // Wave state
    let currentWave = 0;
    let isWaveActive = false;
    let waveStyle = null;
    let waveStartTime = 0;
    let intermissionStartTime = 0;
    let isInIntermission = false;

    // Trickle wave state
    let trickleNextSpawnTime = 0;
    let trickleSpawnsRemaining = 0;

    /**
     * Gets enemy spawn dependencies object
     */
    function getEnemyDependencies() {
        return {
            scene,
            enemies,
            enemyPrototypes,
            playerCone,
            enemyCounts,
            getBossCount,
            setBossCount,
            level: getLevel(),
            gameSpeedMultiplier: getGameSpeedMultiplier(),
            createGravityVortex: (parent, count, radius, color, isRotated) =>
                createGravityVortex(parent, count, radius, color, isRotated, gravityWellEffects),
            gravityWellEffects,
            MAX_BOSSES,
            MIN_BOX_RATIO
        };
    }

    /**
     * Gets boss spawn dependencies object
     */
    function getBossDependencies(bossType = null) {
        return {
            scene,
            level: getLevel(),
            waveNumber: currentWave,
            bosses,
            bossUIManager,
            playerCone,
            bossType
        };
    }

    /**
     * Calculates enemy count for current wave
     */
    function calculateWaveEnemyCount() {
        return waveConfig.baseEnemyCount + (currentWave * waveConfig.enemyCountPerWave);
    }

    /**
     * Randomly selects a wave style
     */
    function selectWaveStyle() {
        const rand = Math.random();

        if (rand < 0.33) {
            return WAVE_STYLES.DIRECTIONAL;
        } else if (rand < 0.66) {
            return WAVE_STYLES.PATTERN;
        } else {
            return WAVE_STYLES.TRICKLE;
        }
    }

    /**
     * Selects a random edge direction
     */
    function selectEdgeDirection() {
        const directions = Object.values(EDGE_DIRECTIONS);
        return directions[Math.floor(Math.random() * directions.length)];
    }

    /**
     * Selects a pattern type based on probabilities
     */
    function selectPatternType() {
        const rand = Math.random();
        let cumulative = 0;

        for (const [pattern, probability] of Object.entries(waveConfig.patternProbabilities)) {
            cumulative += probability;
            if (rand < cumulative) {
                return pattern;
            }
        }

        return PATTERN_TYPES.CIRCLE; // Fallback
    }

    /**
     * Gets spawn position along an edge
     * @param {string} edge - Edge direction
     * @param {number} index - Enemy index in wave
     * @param {number} total - Total enemies in wave
     */
    function getDirectionalSpawnPosition(edge, index, total) {
        const { directionalBandWidth, directionalDepth } = waveConfig;
        const spacing = directionalBandWidth / Math.max(total, 1);
        const offset = (index - total / 2) * spacing;

        // Random depth variation
        const depth = (Math.random() - 0.5) * directionalDepth;

        let x, z;

        switch (edge) {
            case EDGE_DIRECTIONS.NORTH:
                x = offset;
                z = ARENA_PLAYABLE_HALF_SIZE - depth;
                break;
            case EDGE_DIRECTIONS.SOUTH:
                x = offset;
                z = -ARENA_PLAYABLE_HALF_SIZE + depth;
                break;
            case EDGE_DIRECTIONS.EAST:
                x = ARENA_PLAYABLE_HALF_SIZE - depth;
                z = offset;
                break;
            case EDGE_DIRECTIONS.WEST:
                x = -ARENA_PLAYABLE_HALF_SIZE + depth;
                z = offset;
                break;
        }

        return new THREE.Vector3(x, 0, z);
    }

    /**
     * Gets spawn position for pattern formation
     * @param {string} patternType - Type of pattern
     * @param {number} index - Enemy index in formation
     * @param {number} total - Total enemies in formation
     */
    function getPatternSpawnPosition(patternType, index, total) {
        const { patternMinDistance, patternMaxDistance } = waveConfig;
        const playerPos = playerCone.position;

        // Random distance from player
        const distance = patternMinDistance + Math.random() * (patternMaxDistance - patternMinDistance);

        let angle, radius, x, z;

        switch (patternType) {
            case PATTERN_TYPES.CIRCLE:
                // Evenly distribute enemies in circle
                angle = (index / total) * Math.PI * 2;
                x = playerPos.x + Math.cos(angle) * distance;
                z = playerPos.z + Math.sin(angle) * distance;
                break;

            case PATTERN_TYPES.ARC:
                // 180-degree arc in front of player (random side)
                const arcStart = Math.random() * Math.PI * 2;
                angle = arcStart + (index / total) * Math.PI;
                x = playerPos.x + Math.cos(angle) * distance;
                z = playerPos.z + Math.sin(angle) * distance;
                break;

            case PATTERN_TYPES.SPIRAL:
                // Spiral outward from center
                const spiralTurns = 2;
                angle = (index / total) * Math.PI * 2 * spiralTurns;
                radius = distance * (index / total);
                x = playerPos.x + Math.cos(angle) * radius;
                z = playerPos.z + Math.sin(angle) * radius;
                break;

            case PATTERN_TYPES.X_SHAPE:
                // Two diagonal lines forming an X
                const isFirstLine = index < total / 2;
                const lineIndex = isFirstLine ? index : index - Math.floor(total / 2);
                const lineTotal = Math.floor(total / 2);
                const t = lineIndex / Math.max(lineTotal, 1);
                const spread = distance * 1.5;

                if (isFirstLine) {
                    // First diagonal (NW to SE)
                    x = playerPos.x + (t - 0.5) * spread;
                    z = playerPos.z + (t - 0.5) * spread;
                } else {
                    // Second diagonal (NE to SW)
                    x = playerPos.x + (t - 0.5) * spread;
                    z = playerPos.z - (t - 0.5) * spread;
                }
                break;
        }

        // Clamp to arena bounds
        x = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, x));
        z = Math.max(-ARENA_PLAYABLE_HALF_SIZE, Math.min(ARENA_PLAYABLE_HALF_SIZE, z));

        return new THREE.Vector3(x, 0, z);
    }

    /**
     * Spawns an enemy at a specific position
     * @param {THREE.Vector3} position - Spawn position
     * @param {Object} enemyDeps - Enemy dependencies
     */
    function spawnEnemyAtPosition(position, enemyDeps) {
        const enemyType = getWeightedRandomEnemyType(getLevel()) || 'box';

        // Temporarily override spawn logic to use our position
        const originalPlayerPos = playerCone.position.clone();

        // Move player far away temporarily to force spawn at our desired position
        playerCone.position.set(position.x, position.y, position.z);

        // Spawn enemy (it will spawn near our fake player position)
        if (enemyType === 'swarm') {
            // Swarms handle their own positioning
            spawnEnemy(enemyDeps);
        } else {
            spawnSpecificEnemy(enemyType, 'normal', enemyDeps);
        }

        // Get the just-spawned enemy and force its position
        if (enemies.length > 0) {
            const lastEnemy = enemies[enemies.length - 1];
            lastEnemy.mesh.position.set(position.x, lastEnemy.mesh.position.y, position.z);
        }

        // Restore player position
        playerCone.position.copy(originalPlayerPos);
    }

    /**
     * Spawns a directional wave
     */
    function spawnDirectionalWave() {
        const edge = selectEdgeDirection();
        const enemyCount = calculateWaveEnemyCount();
        const enemyDeps = getEnemyDependencies();

        console.log(`Starting Wave ${currentWave} (Directional: ${edge.toUpperCase()} edge, ${enemyCount} enemies)`);

        for (let i = 0; i < enemyCount; i++) {
            const position = getDirectionalSpawnPosition(edge, i, enemyCount);
            spawnEnemyAtPosition(position, enemyDeps);
        }
    }

    /**
     * Spawns a pattern wave
     */
    function spawnPatternWave() {
        const patternType = selectPatternType();
        const enemyCount = calculateWaveEnemyCount();
        const enemyDeps = getEnemyDependencies();

        console.log(`Starting Wave ${currentWave} (Pattern: ${patternType.replace('_', ' ').toUpperCase()}, ${enemyCount} enemies)`);

        for (let i = 0; i < enemyCount; i++) {
            const position = getPatternSpawnPosition(patternType, i, enemyCount);
            spawnEnemyAtPosition(position, enemyDeps);
        }
    }

    /**
     * Spawns initial group for trickle wave
     */
    function spawnTrickleWaveInitial(currentTime) {
        const enemyDeps = getEnemyDependencies();
        const totalEnemies = calculateWaveEnemyCount();

        console.log(`Starting Wave ${currentWave} (Trickle/Mini-Horde: ${waveConfig.trickleInitialCount} initial + mini-hordes)`);

        // Spawn initial group normally
        for (let i = 0; i < waveConfig.trickleInitialCount; i++) {
            spawnEnemy(enemyDeps);
        }

        // Calculate remaining spawns
        trickleSpawnsRemaining = Math.max(0, totalEnemies - waveConfig.trickleInitialCount);
        trickleNextSpawnTime = currentTime + waveConfig.trickleMiniHordeInterval;
    }

    /**
     * Updates trickle wave spawning
     */
    function updateTrickleWave(currentTime) {
        if (trickleSpawnsRemaining <= 0) return;

        if (currentTime >= trickleNextSpawnTime) {
            const enemyDeps = getEnemyDependencies();
            const spawnCount = Math.min(waveConfig.trickleMiniHordeSize, trickleSpawnsRemaining);

            // Spawn mini-horde
            for (let i = 0; i < spawnCount; i++) {
                spawnEnemy(enemyDeps);
            }

            trickleSpawnsRemaining -= spawnCount;
            trickleNextSpawnTime = currentTime + waveConfig.trickleMiniHordeInterval;

            console.log(`Trickle spawn: ${spawnCount} enemies (${trickleSpawnsRemaining} remaining)`);
        }
    }

    /**
     * Starts a boss wave
     */
    function startBossWave() {
        console.log(`Starting Wave ${currentWave} (BOSS WAVE)`);

        // Spawn boss
        const bossDeps = getBossDependencies();
        spawnNewBoss(bossDeps);

        // Spawn accompanying enemies
        const enemyDeps = getEnemyDependencies();
        for (let i = 0; i < waveConfig.bossWaveEnemyCount; i++) {
            spawnEnemy(enemyDeps);
        }
    }

    /**
     * Starts a new wave
     */
    function startNextWave(currentTime) {
        currentWave++;
        isWaveActive = true;
        isInIntermission = false;
        waveStartTime = currentTime;

        // Update wave UI
        if (updateWaveUI) {
            updateWaveUI(currentWave);
        }

        // Check if boss wave
        if (isBossWave(currentWave)) {
            waveStyle = 'boss';
            startBossWave();
        } else {
            // Select and execute wave style
            waveStyle = selectWaveStyle();

            switch (waveStyle) {
                case WAVE_STYLES.DIRECTIONAL:
                    spawnDirectionalWave();
                    break;
                case WAVE_STYLES.PATTERN:
                    spawnPatternWave();
                    break;
                case WAVE_STYLES.TRICKLE:
                    spawnTrickleWaveInitial(currentTime);
                    break;
            }
        }
    }

    /**
     * Checks if wave is complete
     */
    function checkWaveComplete(currentTime) {
        // Wave is complete when all enemies are dead AND trickle spawning is done
        const allEnemiesDead = enemies.length === 0;
        const trickleComplete = waveStyle !== WAVE_STYLES.TRICKLE || trickleSpawnsRemaining === 0;

        if (allEnemiesDead && trickleComplete) {
            console.log(`Wave ${currentWave} complete!`);
            isWaveActive = false;
            isInIntermission = true;
            intermissionStartTime = currentTime;

            // Reset trickle state
            trickleSpawnsRemaining = 0;
        }
    }

    /**
     * Updates wave manager (called each frame)
     * @param {number} deltaTime - Time since last frame (seconds)
     * @param {number} currentTime - Current elapsed time (seconds)
     */
    function update(deltaTime, currentTime) {
        if (isWaveActive) {
            // Update trickle wave spawning
            if (waveStyle === WAVE_STYLES.TRICKLE) {
                updateTrickleWave(currentTime);
            }

            // Check for wave completion
            checkWaveComplete(currentTime);
        } else if (isInIntermission) {
            // Check if intermission is over
            const intermissionDuration = waveStyle === 'boss'
                ? waveConfig.bossIntermissionDuration
                : waveConfig.intermissionDuration;

            if (currentTime - intermissionStartTime >= intermissionDuration) {
                startNextWave(currentTime);
            }
        } else {
            // First wave - start immediately
            startNextWave(currentTime);
        }
    }

    /**
     * Forces a boss wave (for debug/scripted events)
     */
    function forceBossWave(currentTime) {
        if (isWaveActive) {
            console.warn('Cannot force boss wave while wave is active');
            return;
        }

        currentWave++;
        waveStyle = 'boss';
        startBossWave();
        isWaveActive = true;
        waveStartTime = currentTime;
    }

    /**
     * Resets wave manager state
     */
    function reset() {
        currentWave = 0;
        isWaveActive = false;
        waveStyle = null;
        isInIntermission = false;
        trickleSpawnsRemaining = 0;
    }

    // Return public API
    return {
        update,
        startNextWave: (currentTime) => startNextWave(currentTime),
        forceBossWave,
        reset,
        getCurrentWaveNumber: () => currentWave,
        isWaveActive: () => isWaveActive,
        isInIntermission: () => isInIntermission,
        getWaveStyle: () => waveStyle
    };
}
