/**
 * Main Game File - Arena Roguelike
 *
 * This is the entry point that ties all game systems together.
 * Sets up THREE.js scene, initializes managers, creates game entities,
 * and runs the main game loop.
 *
 * Extracted and refactored from index-reference.html
 */

import * as THREE from 'three';

// ===== Config Imports =====
import {
    INITIAL_ENEMY_COUNT,
    BASE_PLAYER_SPEED,
    BASE_PLAYER_RADIUS,
    BASE_ENEMY_PROJECTILE_SPEED,
    BASE_OCTAHEDRON_COOLDOWN,
    MAX_ENEMIES_TOTAL,
    MAX_BOSSES,
    MIN_BOX_RATIO,
    RELIC_SPAWN_Y,
    MAX_RELICS,
    relicPriority,
    DEV_MODE
} from './config/constants.js';
import enemyPrototypes from './config/enemyTypes.js';
import gemTypes from './config/gemTypes.js';
import relicInfo from './config/relicInfo.js';

// ===== Manager Imports =====
import ObjectPool from './managers/ObjectPool.js';
import SpatialGrid from './managers/SpatialGrid.js';
import DamageNumberManager from './managers/DamageNumberManager.js';
import AreaWarningManager from './managers/AreaWarningManager.js';
import AudioManager from './managers/AudioManager.js';

// ===== System Imports =====
import { createPlayerStats, resetPlayerStats } from './systems/playerStats.js';
import { updateStatsUI, updateScoreUI, updateLevelUI } from './systems/ui.js';
import { createInputSystem } from './systems/input.js';
import { createCombatSystem } from './systems/combat.js';
import {
    updateExperienceBar,
    levelUp,
    showLevelUpPopup,
    hideLevelUpPopup
} from './systems/progression.js';
import {
    spawnEnemy,
    spawnBoss,
    spawnSpecificEnemy
} from './systems/enemySpawning.js';
import { createGem, handleEnemyDeath } from './systems/gems.js';
import createRelicCombatStrategies from './systems/relicCombat.js';
import { spawnRelic, spawnInitialRelics, scheduleRelicSpawn, destroyRelic } from './systems/relicSpawning.js';
import {
    createExplosion,
    createDebris,
    createGravityVortex,
    updateGravityVortexEffects,
    updateTemporaryEffects
} from './systems/effects.js';
import { createPlayerAbilitySystem, ABILITY_DEFINITIONS } from './systems/playerAbilities.js';

// ===== Utility Imports =====
import { TrailRenderer } from './utils/TrailRenderer.js';

// ===== THREE.js Scene Setup (lines ~1122-1135) =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x38222B);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);
camera.position.set(0, 200, 200);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();

// ===== Lighting Setup (lines ~1125-1255) =====
const ambientLight = new THREE.AmbientLight(0x9932CC, 0.3);
scene.add(ambientLight);

const moonlight = new THREE.DirectionalLight(0xC0C0C0, 0.3);
moonlight.position.set(0, 100, 100);
scene.add(moonlight);

// ===== Ground Plane Setup (lines ~1137-1143) =====
const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x38222B,
    side: THREE.DoubleSide,
    metalness: 0.2,
    roughness: 0.5,
    emissive: 0x38222B,
    emissiveIntensity: 0.6
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Initialize AreaWarningManager with ground material
AreaWarningManager.init(groundMaterial);

// ===== Player Setup (lines ~1259-1270) =====
const playerConeOriginalColor = new THREE.Color(0x00ff00);
const playerGeometry = new THREE.ConeGeometry(BASE_PLAYER_RADIUS, 6, 32);
const playerMaterial = new THREE.MeshStandardMaterial({
    color: playerConeOriginalColor,
    emissive: 0x00ff00,
    emissiveIntensity: 0.4,
    toneMapped: false
});
const playerCone = new THREE.Mesh(playerGeometry, playerMaterial);
playerCone.position.set(0, 2, 5);
playerCone.castShadow = true;
scene.add(playerCone);

// Add point light to player cone for glow effect
const coneLight = new THREE.PointLight(0x00ff00, 0.9, 75);
playerCone.add(coneLight);

// ===== Shared Shooter Enemy Geometry =====
const shooterGeometry = new THREE.CylinderGeometry(4, 8, 16, 8);
const shooterMaterial = new THREE.MeshStandardMaterial({
    color: 0x8A2BE2,
    emissive: 0x8A2BE2,
    emissiveIntensity: 0.4
});

// Assign shooter geometry/material to enemyPrototypes
enemyPrototypes.shooter.geometry = () => shooterGeometry;
enemyPrototypes.shooter.material = shooterMaterial;

// ===== Game State Variables =====
let score = 0;
let level = 1;
let experience = 0;
let experienceToNextLevel = 20;
let playerHealth = 100;
let maxEnemies = INITIAL_ENEMY_COUNT;
let gameSpeedMultiplier = 1.0;
let playerScaleMultiplier = 1.0;
let bossCount = 0;
let isGameOver = false;
let isGamePaused = false;
let isPlayerHit = false;
let hitAnimationTime = 0;
let healthBarShakeUntil = 0;
let playerIsBoosted = false;
let accumulatedRegen = 0;
let lastRegenNumberTime = 0;

// ===== Entity Arrays =====
const enemies = [];
const blasterShots = [];
const enemyProjectiles = [];
const beams = [];
const relics = [];
const gems = [];
const coins = [];
const skeletons = [];
const temporaryEffects = [];
const gravityWellEffects = [];
const damagingAuras = [];
const relicProjectiles = [];
const relicSpawnQueue = [];

// Ability system entity arrays
const acidGrenades = [];
const acidPools = [];
const lightningStrikes = [];

// Enemy tracking
const enemyCounts = {
    box: 0,
    shooter: 0,
    tank: 0,
    berserker: 0,
    magnetic: 0,
    elite: 0,
    phantom: 0
};

// Gem tracking for relic spawning
const gemCounts = {
    damage: { current: 0, required: 3 },
    speed: { current: 0, required: 3 },
    attackSpeed: { current: 0, required: 3 },
    luck: { current: 0, required: 3 },
    vacuum: { current: 0, required: 3 },
    crit: { current: 0, required: 3 }
};

// Set AreaWarningManager dependencies (now that arrays are initialized)
AreaWarningManager.clock = clock;
AreaWarningManager.scene = scene;
AreaWarningManager.temporaryEffects = temporaryEffects;
AreaWarningManager.createDebris = (position, color, radius) =>
    createDebris(position, color, radius, scene, temporaryEffects, clock);

// ===== Player Stats =====
const playerStats = createPlayerStats();

// ===== Player Buffs =====
const playerBuffs = {
    moveSpeedMult: 1.0,
    damageMult: 1.0,
    attackSpeedMult: 1.0
};

// ===== Initialize Managers =====
const spatialGrid = new SpatialGrid(2000, 2000, 100);
const damageNumberManager = new DamageNumberManager(scene, clock);
const trailRenderer = new TrailRenderer(scene, camera);

// Trail material for blaster shots
const trailMaterial = trailRenderer.createMaterial();
trailMaterial.uniforms.headColor.value.set(0, 1, 1, 1);
trailMaterial.uniforms.tailColor.value.set(0, 1, 1, 0);
trailMaterial.uniforms.trailWidth.value = 2;

// ===== Object Pools =====
const objectPools = {
    blasterShots: new ObjectPool(() => {
        const shotGeometry = new THREE.SphereGeometry(1, 8, 8);
        const shotMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const mesh = new THREE.Mesh(shotGeometry, shotMaterial);
        const trail = trailRenderer.createTrail(mesh, trailMaterial);
        return {
            mesh,
            trail,
            targetPoint: new THREE.Vector3(),
            initialPosition: new THREE.Vector3(),
            pierceLeft: 1,
            hitEnemies: [],
            active: false
        };
    }, 50),

    enemyProjectiles: new ObjectPool(() => {
        const projGeometry = new THREE.SphereGeometry(2, 8, 8);
        const projMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        const mesh = new THREE.Mesh(projGeometry, projMaterial);
        return {
            mesh,
            direction: new THREE.Vector3(),
            speed: BASE_ENEMY_PROJECTILE_SPEED,
            distanceTraveled: 0,
            range: 300,
            radius: 2,
            active: false
        };
    }, 100),

    relicProjectiles: new ObjectPool(() => {
        const projGeometry = new THREE.SphereGeometry(3, 8, 8);
        const projMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const mesh = new THREE.Mesh(projGeometry, projMaterial);
        return {
            mesh,
            direction: new THREE.Vector3(),
            speed: 5.0,
            damage: 0,
            distanceTraveled: 0,
            range: 300,
            splashDamage: 0,
            splashRadius: 0,
            active: false
        };
    }, 50)
};

// Make scene global for ObjectPool (temporary solution for legacy compatibility)
window.scene = scene;

// Coin sprite material
const coinTexture = new THREE.TextureLoader().load(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
);
const coinSpriteMaterial = new THREE.SpriteMaterial({
    color: 0xFFD700
});

// ===== DOM References =====
const healthBarElement = document.getElementById('health-bar');
const scoreElement = document.getElementById('score');

// ===== Camera Zoom Controls (lines ~1562-1582) =====
let targetZoom = 200;
const minZoom = 50;
const maxZoom = 400;

window.addEventListener('wheel', (event) => {
    event.preventDefault();
    targetZoom += event.deltaY * 0.1;
    targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
}, { passive: false });

// ===== Input System =====
const inputSystem = createInputSystem({ renderer, scene });

// ===== Combat System =====
const combatSystem = createCombatSystem({
    scene,
    clock,
    spatialGrid,
    objectPools,
    damageNumberManager,
    AudioManager,
    relicInfo,
    createExplosion: (pos, radius) => createExplosion(pos, radius, scene, temporaryEffects, clock),
    destroyRelic: (relicGroup, index) => {
        scene.remove(relicGroup.relic);
        relicGroup.relic.geometry.dispose();
        relicGroup.relic.material.dispose();

        if (relicGroup.aura) {
            scene.remove(relicGroup.aura);
            relicGroup.aura.geometry.dispose();
            relicGroup.aura.material.dispose();
        }

        if (relicGroup.gravityEffect) {
            const effectIndex = gravityWellEffects.indexOf(relicGroup.gravityEffect);
            if (effectIndex !== -1) {
                scene.remove(relicGroup.gravityEffect.mesh);
                gravityWellEffects.splice(effectIndex, 1);
            }
        }

        if (relicGroup.damagingAura) {
            const auraIndex = damagingAuras.indexOf(relicGroup.damagingAura);
            if (auraIndex !== -1) damagingAuras.splice(auraIndex, 1);
        }

        relics.splice(index, 1);
    }
});

// ===== Relic Combat Strategies =====
const relicCombatStrategies = createRelicCombatStrategies({
    scene,
    spatialGrid,
    relicInfo,
    objectPools,
    beams,
    relicProjectiles,
    gravityWellEffects,
    damagingAuras,
    damageNumberManager,
    AudioManager,
    AreaWarningManager,
    createGravityVortex: (parent, count, radius, color, isRotated) =>
        createGravityVortex(parent, count, radius, color, isRotated, gravityWellEffects),
    getGameSpeedMultiplier: () => gameSpeedMultiplier,
    getClock: () => clock
});

// ===== Player Ability System =====
const playerAbilitySystem = createPlayerAbilitySystem({
    scene,
    spatialGrid,
    objectPools,
    AudioManager,
    clock,
    AreaWarningManager
});

// ===== Dev Mode Hotkeys =====
if (DEV_MODE) {
    console.log('DEV MODE ENABLED: Use keys 1-4 to toggle abilities');
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Digit1') {
            if (playerAbilitySystem.isUnlocked('frostNova')) {
                console.log('Frost Nova already unlocked');
            } else {
                playerAbilitySystem.unlockAbility('frostNova');
                console.log('DEV: Unlocked Frost Nova');
            }
        } else if (e.code === 'Digit2') {
            if (playerAbilitySystem.isUnlocked('shotgunBlast')) {
                console.log('Shotgun Blast already unlocked');
            } else {
                playerAbilitySystem.unlockAbility('shotgunBlast');
                console.log('DEV: Unlocked Shotgun Blast');
            }
        } else if (e.code === 'Digit3') {
            if (playerAbilitySystem.isUnlocked('acidGrenade')) {
                console.log('Acid Grenade already unlocked');
            } else {
                playerAbilitySystem.unlockAbility('acidGrenade');
                console.log('DEV: Unlocked Acid Grenade');
            }
        } else if (e.code === 'Digit4') {
            if (playerAbilitySystem.isUnlocked('lightningStrike')) {
                console.log('Lightning Strike already unlocked');
            } else {
                playerAbilitySystem.unlockAbility('lightningStrike');
                console.log('DEV: Unlocked Lightning Strike');
            }
        }
    });

    // Make ability system available in console
    window.devAbilitySystem = playerAbilitySystem;
}

// ===== Helper Functions =====

/**
 * Updates player position based on input
 */
function updatePlayerMovement(delta) {
    const movement = new THREE.Vector2();

    // Keyboard movement
    const keyMovement = inputSystem.getKeyboardMovement();
    movement.add(keyMovement);

    // Drag movement
    if (inputSystem.isDragging()) {
        const dragDir = inputSystem.movementDirection.clone();
        movement.x += dragDir.x;
        movement.y += dragDir.y;
    }

    if (movement.length() > 0) {
        movement.normalize();
        const speed = BASE_PLAYER_SPEED * playerBuffs.moveSpeedMult;
        playerCone.position.x += movement.x * speed;
        playerCone.position.z += movement.y * speed;

        // Keep player in bounds
        playerCone.position.x = Math.max(-490, Math.min(490, playerCone.position.x));
        playerCone.position.z = Math.max(-490, Math.min(490, playerCone.position.z));

        // Rotate player to face movement direction
        const angle = Math.atan2(movement.x, movement.y);
        playerCone.rotation.y = angle;
    }
}

/**
 * Updates enemy AI and movement
 */
function updateEnemies(delta) {
    // Check if we need to spawn more enemies
    if (enemies.length < maxEnemies) {
        const enemyDependencies = {
            scene,
            enemies,
            enemyPrototypes,
            playerCone,
            enemyCounts,
            getBossCount: () => bossCount,
            setBossCount: (val) => { bossCount = val; },
            level,
            gameSpeedMultiplier,
            createGravityVortex: (parent, count, radius, color, isRotated) =>
                createGravityVortex(parent, count, radius, color, isRotated, gravityWellEffects),
            gravityWellEffects,
            MAX_BOSSES,
            MIN_BOX_RATIO
        };
        spawnEnemy(enemyDependencies);
    }

    // Update each enemy
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Check if dead
        if (enemy.health <= 0) {
            const deathDependencies = {
                scene,
                skeletons,
                coins,
                gems,
                gemTypes,
                enemyCounts,
                getBossCount: () => bossCount,
                setBossCount: (val) => { bossCount = val; },
                gravityWellEffects,
                coinSpriteMaterial,
                playerStats,
                getScore: () => score,
                setScore: (val) => { score = val; updateScoreUI(score); },
                scoreElement
            };
            handleEnemyDeath(enemy, deathDependencies);
            scene.remove(enemy.mesh);
            enemies.splice(i, 1);

            // Award experience
            experience += enemy.isBoss ? 20 : 3;
            updateExperienceBar(experience, experienceToNextLevel);

            // Check if boss was killed - show ability selection
            if (enemy.isBoss) {
                showAbilitySelectionPopup();
            }

            // Check for level up
            if (experience >= experienceToNextLevel) {
                const progressionState = {
                    level,
                    experience,
                    experienceToNextLevel,
                    gameSpeedMultiplier,
                    playerScaleMultiplier,
                    maxEnemies,
                    playerStats,
                    playerCone,
                    enemies,
                    playerHealth,
                    damageNumberManager,
                    updateStatsUI,
                    setGamePaused: (paused) => { isGamePaused = paused; }
                };
                const updates = levelUp(progressionState);
                level = updates.level;
                experience = updates.experience;
                experienceToNextLevel = updates.experienceToNextLevel;
                gameSpeedMultiplier = updates.gameSpeedMultiplier;
                playerScaleMultiplier = updates.playerScaleMultiplier;
                maxEnemies = updates.maxEnemies;
                isGamePaused = true;
            }

            continue;
        }

        // Add to spatial grid
        spatialGrid.add(enemy);

        // Reset pull forces
        enemy.pullForces.set(0, 0, 0);

        // Update hit effect
        if (enemy.hitEffectUntil && clock.getElapsedTime() > enemy.hitEffectUntil) {
            enemy.mesh.material.emissive.copy(enemy.initialColor || new THREE.Color(0x000000));
            enemy.mesh.material.emissiveIntensity = enemy.baseEmissiveIntensity;
            enemy.hitEffectUntil = null;
        }

        // Phantom vulnerability check
        if (enemy.type === 'phantom' && enemy.isVulnerable && clock.getElapsedTime() > enemy.vulnerableUntil) {
            enemy.isVulnerable = false;
            enemy.teleportCount = 0;
            enemy.mesh.material.emissive.set(0xffffff);
            enemy.mesh.material.emissiveIntensity = 0.6;
        }

        // Check if enemy is frozen
        const now = clock.getElapsedTime();
        const isFrozen = enemy.frozenUntil && now < enemy.frozenUntil;

        if (isFrozen) {
            // Apply frozen visual effect
            if (!enemy.wasFrozen) {
                enemy.wasFrozen = true;
                // Save original colors and rotation
                enemy.preFrozenColor = enemy.mesh.material.color.clone();
                enemy.preFrozenEmissive = enemy.mesh.material.emissive.clone();
                enemy.preFrozenIntensity = enemy.mesh.material.emissiveIntensity;
                enemy.frozenRotation = enemy.mesh.rotation.clone();
            }

            // Apply frost color (cyan tint)
            enemy.mesh.material.color.setHex(0x88FFFF);
            enemy.mesh.material.emissive.setHex(0x00FFFF);

            // Pulsing frost animation
            const pulseSpeed = 3;
            const pulse = Math.sin(now * pulseSpeed) * 0.5 + 0.5; // 0 to 1
            enemy.mesh.material.emissiveIntensity = 0.5 + pulse * 0.5; // 0.5 to 1.0

            // Lock rotation
            if (enemy.frozenRotation) {
                enemy.mesh.rotation.copy(enemy.frozenRotation);
            }
        } else if (enemy.wasFrozen) {
            // Restore original appearance
            enemy.wasFrozen = false;
            if (enemy.preFrozenColor) {
                enemy.mesh.material.color.copy(enemy.preFrozenColor);
            }
            if (enemy.preFrozenEmissive) {
                enemy.mesh.material.emissive.copy(enemy.preFrozenEmissive);
                enemy.mesh.material.emissiveIntensity = enemy.preFrozenIntensity;
            }
        }

        // Enemy shooting logic (skip if frozen)
        if (!isFrozen && (enemy.type === 'shooter' || enemy.type === 'elite') && enemy.lastShotTime !== undefined) {
            const now = clock.getElapsedTime();
            const shootCooldown = (enemy.type === 'shooter' ? 2.0 : 1.5) / gameSpeedMultiplier;

            if (now - enemy.lastShotTime >= shootCooldown) {
                const distance = enemy.mesh.position.distanceTo(playerCone.position);
                const range = enemy.type === 'shooter' ? 150 : 200;

                if (distance < range) {
                    enemy.lastShotTime = now;

                    // Elite enemies shoot 3 projectiles in a spread
                    if (enemy.type === 'elite') {
                        const baseDirection = new THREE.Vector3()
                            .subVectors(playerCone.position, enemy.mesh.position)
                            .normalize();

                        // Calculate spread angles: -15°, 0°, +15°
                        const spreadAngles = [-Math.PI / 12, 0, Math.PI / 12];

                        spreadAngles.forEach(angleOffset => {
                            const projectile = objectPools.enemyProjectiles.get();
                            projectile.mesh.position.copy(enemy.mesh.position);

                            // Rotate direction by angleOffset
                            const angle = Math.atan2(baseDirection.x, baseDirection.z) + angleOffset;
                            projectile.direction.set(
                                Math.sin(angle),
                                0,
                                Math.cos(angle)
                            ).normalize();

                            projectile.distanceTraveled = 0;
                            enemyProjectiles.push(projectile);
                        });
                    } else {
                        // Shooter enemies shoot single projectile
                        const projectile = objectPools.enemyProjectiles.get();
                        projectile.mesh.position.copy(enemy.mesh.position);
                        projectile.direction.subVectors(playerCone.position, enemy.mesh.position).normalize();
                        projectile.distanceTraveled = 0;
                        enemyProjectiles.push(projectile);
                    }

                    AudioManager.play('enemyShoot', 0.4);
                }
            }
        }

        // Movement AI (horizontal only - keep Y constant to prevent sinking)
        // Skip movement if frozen
        if (!isFrozen) {
            const directionToPlayer = new THREE.Vector3(
                playerCone.position.x - enemy.mesh.position.x,
                0,  // No Y movement
                playerCone.position.z - enemy.mesh.position.z
            ).normalize();

            // Add movement with pull forces
            const movement = directionToPlayer.clone().multiplyScalar(enemy.speed);
            movement.add(enemy.pullForces);

            // Store original Y position before movement
            const originalY = enemy.mesh.position.y;
            enemy.mesh.position.add(movement);
            // Restore Y position to prevent sinking/floating
            enemy.mesh.position.y = originalY;
        }

        // Magnetic enemy pulls player (skip if frozen)
        if (!isFrozen && enemy.type === 'magnetic') {
            const pullRange = 50;
            const pullStrength = 0.5;
            if (enemy.mesh.position.distanceTo(playerCone.position) < pullRange) {
                const pullDirection = new THREE.Vector3().subVectors(enemy.mesh.position, playerCone.position).normalize();
                playerCone.position.addScaledVector(pullDirection, pullStrength);
            }
        }

        // Rotate enemy to face player (only on Y-axis to prevent tilting into ground)
        // Skip rotation if frozen (rotation is locked)
        if (!isFrozen) {
            const targetPosition = new THREE.Vector3(
                playerCone.position.x,
                enemy.mesh.position.y,
                playerCone.position.z
            );
            enemy.mesh.lookAt(targetPosition);
        }
    }
}

/**
 * Updates relics (spawning and combat)
 */
function updateRelics(delta) {
    const now = clock.getElapsedTime();

    // Spawn relics from queue
    if (relicSpawnQueue.length > 0 && relics.length < MAX_RELICS) {
        // Sort queue by priority
        relicSpawnQueue.sort((a, b) => relicPriority.indexOf(a) - relicPriority.indexOf(b));

        const gemTypeToSpawn = relicSpawnQueue.shift(); // Get highest priority
        const relicDependencies = {
            scene,
            relics,
            relicInfo,
            playerCone,
            relicPriority,
            playerStats,
            level,
            RELIC_SPAWN_Y,
            MAX_RELICS,
            createGem: (gemType, position) => createGem(gemType, position, {
                scene,
                gems,
                gemTypes
            }),
            RelicCombatStrategies: relicCombatStrategies,
            relicSpawnQueue
        };
        spawnRelic(gemTypeToSpawn, true, relicDependencies);
    }

    // Check player distance to relics for state transitions
    for (const group of relics) {
        if (group.state === 'active') continue; // Skip active relics

        const distance = playerCone.position.distanceTo(group.ring.position);

        if (group.state === 'idle' || group.state === 'returning') {
            if (distance < 35) { // Player is close enough to start converting
                if (group.state !== 'lowering') {
                    group.state = 'lowering';
                    group.loweringSpeed = 0.2; // Start with a base speed
                }
            }
        } else if (group.state === 'lowering' || group.state === 'converting') {
            if (distance > 40) { // Player moved away
                group.loweringSpeed = 0; // Reset acceleration speed
                group.state = 'returning';
            }
        }
    }

    // Update relic states
    const LOWERING_ACCELERATION = 0.5; // Progress per second^2
    const CONVERSION_DURATION = 2.0;   // Seconds
    const RETURNING_SPEED = 0.3;       // Progress per second (2 seconds to return)

    for (let i = relics.length - 1; i >= 0; i--) {
        const group = relics[i];

        if (group.state === 'lowering') {
            group.loweringSpeed += LOWERING_ACCELERATION * delta;
            group.animationProgress += group.loweringSpeed * delta;
            group.animationProgress = Math.min(1, group.animationProgress);
            group.relic.position.y = group.initialY - (group.initialY - 24) * group.animationProgress;

            if (group.animationProgress >= 1) {
                group.state = 'converting';
                group.loweringSpeed = 0; // Reset for next time
            }
        } else if (group.state === 'converting') {
            group.conversionProgress += delta / CONVERSION_DURATION;
            group.conversionProgress = Math.min(1, group.conversionProgress);

            const originalColor = new THREE.Color(relicInfo[group.type].color);
            const newColor = originalColor.lerp(playerConeOriginalColor, group.conversionProgress);
            group.relic.material.color.set(newColor);
            group.relic.material.emissive.set(newColor);

            if (group.conversionProgress >= 1) {
                group.state = 'active';
                const strategy = relicCombatStrategies[group.type];
                if (strategy && strategy.onActivate) {
                    strategy.onActivate(group);
                }

                const flashGeometry = new THREE.SphereGeometry(group.radius * 1.5, 16, 16);
                const flashMaterial = new THREE.MeshBasicMaterial({
                    color: 0x00ff00,
                    transparent: true,
                    opacity: 0.6
                });
                const flash = new THREE.Mesh(flashGeometry, flashMaterial);
                flash.position.copy(group.relic.position);
                scene.add(flash);
                temporaryEffects.push({
                    mesh: flash,
                    startTime: clock.getElapsedTime(),
                    duration: 0.05, // 500ms
                    type: 'flash'
                });
            }
        } else if (group.state === 'returning') {
            group.animationProgress -= RETURNING_SPEED * delta;
            group.animationProgress = Math.max(0, group.animationProgress);
            group.conversionProgress -= RETURNING_SPEED * delta;
            group.conversionProgress = Math.max(0, group.conversionProgress);

            const originalColor = new THREE.Color(relicInfo[group.type].color);
            const newColor = originalColor.lerp(playerConeOriginalColor, group.conversionProgress);
            group.relic.material.color.set(newColor);
            group.relic.material.emissive.set(newColor);

            // Use the same consistent position formula
            group.relic.position.y = group.initialY - (group.initialY - 24) * group.animationProgress;

            if (group.animationProgress <= 0) {
                group.state = 'idle';
            }
        } else if (group.state === 'active') {
            // Universal active logic (health color)
            group.relic.position.y = 24;
            const healthRatio = Math.max(0, group.health / group.maxHealth);
            const color = new THREE.Color(playerConeOriginalColor).lerp(new THREE.Color(0xff0000), 1 - healthRatio);
            group.relic.material.color.set(color);
            group.relic.material.emissive.set(color);

            // Update relic combat behavior
            const strategy = relicCombatStrategies[group.type];
            if (strategy && strategy.update) {
                strategy.update(group, now, delta);
            }

            // Rotate relic
            group.relic.rotation.y += delta * 0.5;
        }
    }

    // Update relic projectiles
    for (let i = relicProjectiles.length - 1; i >= 0; i--) {
        const proj = relicProjectiles[i];
        proj.mesh.position.addScaledVector(proj.direction, proj.speed);
        proj.distanceTraveled += proj.speed;

        // Check collision with enemies
        let hit = false;
        for (const enemy of enemies) {
            if (!enemy.health || enemy.health <= 0) continue;

            if (proj.mesh.position.distanceTo(enemy.mesh.position) < enemy.radius + 3) {
                enemy.health -= proj.damage;
                damageNumberManager.create(enemy.mesh, proj.damage, { isCritical: false });

                // Splash damage
                if (proj.splashRadius > 0) {
                    createExplosion(enemy.mesh.position, proj.splashRadius, scene, temporaryEffects, clock);

                    for (const other of enemies) {
                        if (other === enemy || !other.health || other.health <= 0) continue;

                        const dist = enemy.mesh.position.distanceTo(other.mesh.position);
                        if (dist < proj.splashRadius) {
                            other.health -= proj.splashDamage;
                            damageNumberManager.create(other.mesh, proj.splashDamage, { isCritical: false });
                        }
                    }
                }

                hit = true;
                break;
            }
        }

        if (hit || proj.distanceTraveled > proj.range) {
            objectPools.relicProjectiles.release(proj);
            relicProjectiles.splice(i, 1);
        }
    }

    // Update player speed buff
    playerIsBoosted = false;
    playerBuffs.moveSpeedMult = 1.0;
    playerBuffs.damageMult = 1.0;
    playerBuffs.attackSpeedMult = 1.0;

    for (const relicGroup of relics) {
        if (relicGroup.state === 'active' && relicGroup.type === 'speed') {
            const dist = playerCone.position.distanceTo(relicGroup.relic.position);
            if (dist < relicInfo.speed.range) {
                playerIsBoosted = true;
                playerBuffs.moveSpeedMult = relicInfo.speed.buffs.moveSpeed;
                playerBuffs.damageMult = relicInfo.speed.buffs.damage;
                playerBuffs.attackSpeedMult = relicInfo.speed.buffs.attackSpeed;
                break;
            }
        }
    }
}

/**
 * Updates gems and coins (movement and collection)
 */
function updateGemsAndCoins(delta) {
    // Update gems
    for (let i = gems.length - 1; i >= 0; i--) {
        const gem = gems[i];

        // Attraction to player
        const distance = playerCone.position.distanceTo(gem.mesh.position);
        if (distance < playerStats.pickupRadius) {
            const direction = new THREE.Vector3()
                .subVectors(playerCone.position, gem.mesh.position)
                .normalize();
            gem.velocity.add(direction.multiplyScalar(0.3));
        }

        gem.mesh.position.add(gem.velocity);
        gem.velocity.multiplyScalar(0.95); // Friction
        gem.mesh.rotation.y += delta * 2;

        // Collection
        if (distance < playerStats.playerRadius + 2) {
            // Track gem collection for relic spawning
            const gemData = gemCounts[gem.type];
            if (gemData) {
                gemData.current++;

                // Update gem counter UI
                const gemCounterElement = document.getElementById(`gem-${gem.type}`);
                if (gemCounterElement) {
                    gemCounterElement.textContent = `${gemData.current}/${gemData.required}`;

                    // Check if we should spawn a relic
                    if (gemData.current >= gemData.required) {
                        scheduleRelicSpawn(gem.type, relicSpawnQueue);
                        gemData.current = 0;
                        gemData.required++;

                        // Add sparkle effect
                        gemCounterElement.classList.add('gem-sparkle');
                        setTimeout(() => {
                            gemCounterElement.classList.remove('gem-sparkle');
                        }, 1000);
                    }
                }
            }

            scene.remove(gem.mesh);
            gem.mesh.geometry.dispose();
            gem.mesh.material.dispose();
            gems.splice(i, 1);

            AudioManager.play('pickup', 0.6);
        }
    }

    // Update coins
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];

        // Attraction to player
        const distance = playerCone.position.distanceTo(coin.mesh.position);
        if (distance < playerStats.coinPickupRadius) {
            const direction = new THREE.Vector3()
                .subVectors(playerCone.position, coin.mesh.position)
                .normalize();
            coin.velocity.add(direction.multiplyScalar(0.5));
        }

        coin.mesh.position.add(coin.velocity);
        coin.velocity.multiplyScalar(0.9);

        // Collection
        if (distance < playerStats.playerRadius + 5) {
            scene.remove(coin.mesh);
            coins.splice(i, 1);
            score += 10;
            updateScoreUI(score);
            AudioManager.play('coin', 0.5);
        }
    }
}

/**
 * Updates skeletons and other decorative effects
 */
function updateSkeletons(delta) {
    for (let i = skeletons.length - 1; i >= 0; i--) {
        const skeleton = skeletons[i];
        const age = (Date.now() - skeleton.createdAt) / 1000;

        if (age > 10.0) {
            // Fade out over 2 seconds
            skeleton.mesh.material.opacity = Math.max(0, 1.0 - (age - 10.0) / 2.0);

            if (skeleton.mesh.material.opacity <= 0) {
                scene.remove(skeleton.mesh);
                if (!skeleton.isGeometryShared) {
                    skeleton.mesh.geometry.dispose();
                }
                skeleton.mesh.material.dispose();
                skeletons.splice(i, 1);
            }
        }
    }
}

/**
 * Updates health regeneration
 */
function updateHealthRegen(delta) {
    if (playerStats.regenRate > 0 && playerHealth < playerStats.maxHealth) {
        const healingThisFrame = playerStats.regenRate * delta;
        playerHealth = Math.min(playerStats.maxHealth, playerHealth + healingThisFrame);
        healthBarElement.style.width = (playerHealth / playerStats.maxHealth) * 100 + '%';

        accumulatedRegen += healingThisFrame;
        const now = clock.getElapsedTime();
        if (now - lastRegenNumberTime > 1.0) { // Show number every 1 second
            if (accumulatedRegen >= 1.0) {
                damageNumberManager.create(playerCone, Math.round(accumulatedRegen), { isHeal: true });
                accumulatedRegen = 0;
                lastRegenNumberTime = now;
            } else if (accumulatedRegen > 0) {
                // Reset timer even if we don't show a number to prevent infinite accumulation on very low regen
                lastRegenNumberTime = now;
            }
        }
    }
}

/**
 * Updates player hit animation
 */
function updatePlayerHitAnimation(delta) {
    if (isPlayerHit) {
        hitAnimationTime += delta;
        const flashInterval = 0.1;
        const flashCount = Math.floor(hitAnimationTime / flashInterval);

        if (flashCount % 2 === 0) {
            playerCone.material.emissive.set(0xff0000);
            playerCone.material.emissiveIntensity = 1.0;
        } else {
            playerCone.material.emissive.set(0x00ffff);
            playerCone.material.emissiveIntensity = 0.5;
        }

        if (hitAnimationTime > 0.3) {
            isPlayerHit = false;
            hitAnimationTime = 0;
            playerCone.material.emissive.set(0x00ffff);
            playerCone.material.emissiveIntensity = 0.5;
        }
    }

    // Health bar shake
    if (clock.getElapsedTime() > healthBarShakeUntil) {
        healthBarElement.parentElement.classList.remove('health-bar-shaking');
    }
}

/**
 * Updates camera position smoothly
 */
function updateCamera() {
    // Follow player
    camera.position.x = playerCone.position.x;
    camera.position.z = playerCone.position.z + targetZoom;
    camera.position.y = targetZoom;
    camera.lookAt(playerCone.position);
}

/**
 * Shows the ability selection popup after boss kill
 */
function showAbilitySelectionPopup() {
    const unownedAbilities = playerAbilitySystem.getUnownedAbilities();

    // If no more abilities to unlock, skip
    if (unownedAbilities.length === 0) {
        console.log('All abilities already unlocked!');
        return;
    }

    // Pause game
    isGamePaused = true;

    // Get overlay and options container
    const overlay = document.getElementById('ability-selection-overlay');
    const optionsContainer = document.getElementById('ability-options');

    // Clear previous options
    optionsContainer.innerHTML = '';

    // Randomly select up to 3 abilities to offer
    const offeredCount = Math.min(3, unownedAbilities.length);
    const shuffled = [...unownedAbilities].sort(() => Math.random() - 0.5);
    const offeredAbilities = shuffled.slice(0, offeredCount);

    // Create ability cards
    offeredAbilities.forEach(abilityId => {
        const def = ABILITY_DEFINITIONS[abilityId];
        const card = document.createElement('div');
        card.className = 'ability-card';
        card.innerHTML = `
            <div class="ability-icon">${def.icon}</div>
            <div class="ability-name">${def.name}</div>
            <div class="ability-description">${def.description}</div>
            <div class="ability-cooldown">Cooldown: ${def.baseCooldown}s</div>
        `;

        card.addEventListener('click', () => {
            playerAbilitySystem.unlockAbility(abilityId);
            hideAbilitySelectionPopup();
            AudioManager.play('powerup', 1.0);
        });

        optionsContainer.appendChild(card);
    });

    // Show overlay
    overlay.classList.add('visible');
}

/**
 * Hides the ability selection popup
 */
function hideAbilitySelectionPopup() {
    const overlay = document.getElementById('ability-selection-overlay');
    overlay.classList.remove('visible');
    isGamePaused = false;
}

/**
 * Checks for game over condition
 */
function checkGameOver() {
    if (playerHealth <= 0 && !isGameOver) {
        isGameOver = true;
        window.isGameOver = true; // For input system

        console.log('GAME OVER - Player died');

        const gameOverScreen = document.getElementById('game-over-screen');
        const finalScore = document.getElementById('final-score');
        const finalLevel = document.getElementById('final-level');

        if (!gameOverScreen) {
            console.error('ERROR: game-over-screen element not found!');
            return;
        }

        // Close any open overlays first
        const levelUpOverlay = document.getElementById('level-up-overlay');
        const abilityOverlay = document.getElementById('ability-selection-overlay');
        if (levelUpOverlay) levelUpOverlay.classList.remove('visible');
        if (abilityOverlay) abilityOverlay.classList.remove('visible');

        gameOverScreen.classList.add('visible');

        if (finalScore) finalScore.textContent = score;
        if (finalLevel) finalLevel.textContent = level;

        console.log('Game over screen should now be visible');
        console.log('classList:', gameOverScreen.classList.toString());
        console.log('display style:', window.getComputedStyle(gameOverScreen).display);

        AudioManager.play('gameOver', 1.0);
        inputSystem.clearKeyStates();
        inputSystem.clearDragVisuals();
    }
}

// ===== Main Animation Loop (lines ~2405-3395) =====
function animate() {
    requestAnimationFrame(animate);

    if (isGameOver) {
        renderer.render(scene, camera);
        return;
    }

    const delta = Math.min(clock.getDelta(), 0.1);

    if (!isGamePaused) {
        // Clear spatial grid
        spatialGrid.clear();

        // Update enemies first (they populate the spatial grid)
        updateEnemies(delta);

        // Update player
        updatePlayerMovement(delta);

        // Update player shooting (now enemies are in spatial grid)
        const shootingState = {
            playerCone,
            playerStats,
            blasterShots,
            playerBuffs
        };
        combatSystem.updatePlayerShooting(shootingState);

        // Update blaster shots
        combatSystem.updateBlasterShots({
            blasterShots,
            playerStats,
            playerBuffs
        });

        // Update player abilities
        const abilityState = {
            playerCone,
            playerStats,
            enemies,
            blasterShots,
            acidGrenades,
            acidPools,
            lightningStrikes,
            temporaryEffects,
            scene,
            DamageNumberManager: damageNumberManager,
            AreaWarningManager,
            isGameOver,
            isGamePaused
        };
        playerAbilitySystem.updateAbilities(abilityState);
        playerAbilitySystem.updateAcidGrenades(abilityState, delta);
        playerAbilitySystem.updateAcidPools(abilityState, delta);
        playerAbilitySystem.updateLightningStrikes(abilityState);

        // Update enemy projectiles
        const projectileState = {
            enemyProjectiles,
            playerCone,
            playerStats,
            relics,
            gameSpeedMultiplier,
            playerIsBoosted,
            healthBarElement,
            playerHealth,
            isPlayerHit,
            hitAnimationTime
        };
        combatSystem.updateEnemyProjectiles(projectileState);
        // Read back updated values
        playerHealth = projectileState.playerHealth;
        isPlayerHit = projectileState.isPlayerHit;
        hitAnimationTime = projectileState.hitAnimationTime;

        // Update player collision
        const collisionState = {
            playerCone,
            playerStats,
            relics,
            playerIsBoosted,
            healthBarElement,
            playerHealth,
            isPlayerHit,
            hitAnimationTime,
            healthBarShakeUntil
        };
        combatSystem.updatePlayerCollision(collisionState);
        // Read back updated values
        playerHealth = collisionState.playerHealth;
        isPlayerHit = collisionState.isPlayerHit;
        hitAnimationTime = collisionState.hitAnimationTime;
        healthBarShakeUntil = collisionState.healthBarShakeUntil;

        // Update beams
        combatSystem.updateBeams(beams);

        // Update relics
        updateRelics(delta);

        // Update gems and coins
        updateGemsAndCoins(delta);

        // Update skeletons
        updateSkeletons(delta);

        // Update damaging auras
        for (const aura of damagingAuras) {
            const now = clock.getElapsedTime();
            if (now - aura.lastDamageTick >= aura.damageInterval) {
                aura.lastDamageTick = now;

                const nearbyEnemies = spatialGrid.getNearby({
                    mesh: { position: aura.position },
                    radius: aura.radius
                });

                for (const enemy of nearbyEnemies) {
                    if (!enemy.health || enemy.health <= 0) continue;

                    const dist = aura.position.distanceTo(enemy.mesh.position);
                    if (dist < aura.radius) {
                        enemy.health -= aura.damage;
                        damageNumberManager.create(enemy.mesh, aura.damage, { isCritical: false });

                        // Pull effect
                        const pullDir = new THREE.Vector3()
                            .subVectors(aura.position, enemy.mesh.position)
                            .normalize()
                            .multiplyScalar(aura.pullStrength);
                        enemy.pullForces.add(pullDir);
                    }
                }
            }
        }

        // Update health regeneration
        updateHealthRegen(delta);

        // Update player hit animation
        updatePlayerHitAnimation(delta);

        // Update effects
        updateTemporaryEffects(temporaryEffects, clock, scene, delta);
        updateGravityVortexEffects(gravityWellEffects, delta);

        // Update managers
        AreaWarningManager.update(delta);
        damageNumberManager.update();
        trailRenderer.update();

        // Update camera
        updateCamera();

        // Check game over
        checkGameOver();
    }

    // Render scene
    renderer.render(scene, camera);
}

// ===== Reset Game Function (lines ~3629-3792) =====
function resetGame() {
    // Reset game state
    score = 0;
    level = 1;
    experience = 0;
    experienceToNextLevel = 20;
    playerHealth = 100;
    maxEnemies = INITIAL_ENEMY_COUNT;
    gameSpeedMultiplier = 1.0;
    playerScaleMultiplier = 1.0;
    bossCount = 0;
    isGameOver = false;
    window.isGameOver = false;
    isGamePaused = false;
    isPlayerHit = false;
    hitAnimationTime = 0;
    healthBarShakeUntil = 0;
    playerIsBoosted = false;
    accumulatedRegen = 0;
    lastRegenNumberTime = 0;

    // Reset player
    playerCone.position.set(0, 1.5, 0);
    playerCone.scale.set(1, 1, 1);
    playerCone.rotation.set(0, 0, 0);

    // Reset player material colors
    playerCone.material.color.copy(playerConeOriginalColor);
    playerCone.material.emissive.setHex(0x00ff00);
    playerCone.material.emissiveIntensity = 0.4;

    // Reset player stats
    resetPlayerStats(playerStats);
    updateStatsUI(playerStats);

    // Reset player buffs
    playerBuffs.moveSpeedMult = 1.0;
    playerBuffs.damageMult = 1.0;
    playerBuffs.attackSpeedMult = 1.0;

    // Reset UI
    updateScoreUI(score);
    updateLevelUI(level);
    updateExperienceBar(experience, experienceToNextLevel);
    healthBarElement.style.width = '100%';
    healthBarElement.parentElement.classList.remove('health-bar-shaking');
    document.getElementById('game-over-screen').classList.remove('visible');

    // Clear all entities
    for (const enemy of enemies) {
        scene.remove(enemy.mesh);
        if (enemy.wireframe) enemy.mesh.remove(enemy.wireframe);
        if (!enemy.isGeometryShared && enemy.mesh.geometry) enemy.mesh.geometry.dispose();
        if (enemy.mesh.material) enemy.mesh.material.dispose();
        if (enemy.gravityEffect) {
            scene.remove(enemy.gravityEffect.mesh);
        }
    }
    enemies.length = 0;

    for (const shot of blasterShots) {
        shot.trail.deactivate();
        objectPools.blasterShots.release(shot);
    }
    blasterShots.length = 0;

    for (const proj of enemyProjectiles) {
        objectPools.enemyProjectiles.release(proj);
    }
    enemyProjectiles.length = 0;

    for (const beam of beams) {
        scene.remove(beam.mesh);
        beam.mesh.geometry.dispose();
        beam.mesh.material.dispose();
    }
    beams.length = 0;

    for (const relicGroup of relics) {
        scene.remove(relicGroup.relic);
        relicGroup.relic.geometry.dispose();
        relicGroup.relic.material.dispose();
        if (relicGroup.aura) {
            scene.remove(relicGroup.aura);
            relicGroup.aura.geometry.dispose();
            relicGroup.aura.material.dispose();
        }
        if (relicGroup.gravityEffect) {
            scene.remove(relicGroup.gravityEffect.mesh);
        }
    }
    relics.length = 0;

    for (const gem of gems) {
        scene.remove(gem.mesh);
        gem.mesh.geometry.dispose();
        gem.mesh.material.dispose();
    }
    gems.length = 0;

    for (const coin of coins) {
        scene.remove(coin.mesh);
    }
    coins.length = 0;

    for (const skeleton of skeletons) {
        scene.remove(skeleton.mesh);
        skeleton.mesh.geometry.dispose();
        skeleton.mesh.material.dispose();
    }
    skeletons.length = 0;

    for (const effect of temporaryEffects) {
        scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        effect.mesh.material.dispose();
    }
    temporaryEffects.length = 0;

    for (const effect of gravityWellEffects) {
        scene.remove(effect.mesh);
    }
    gravityWellEffects.length = 0;

    damagingAuras.length = 0;

    for (const proj of relicProjectiles) {
        objectPools.relicProjectiles.release(proj);
    }
    relicProjectiles.length = 0;

    // Clear ability entities
    for (const grenade of acidGrenades) {
        scene.remove(grenade.mesh);
        grenade.mesh.geometry.dispose();
        grenade.mesh.material.dispose();
    }
    acidGrenades.length = 0;

    for (const pool of acidPools) {
        scene.remove(pool.mesh);
        pool.mesh.geometry.dispose();
        pool.mesh.material.dispose();
    }
    acidPools.length = 0;

    lightningStrikes.length = 0;

    // Reset abilities (optional - comment out to keep abilities between games)
    // playerAbilitySystem.devClearAbilities();

    // Reset enemy counts
    for (const key in enemyCounts) {
        enemyCounts[key] = 0;
    }

    // Reset gem counts
    for (const type in gemCounts) {
        gemCounts[type].current = 0;
        gemCounts[type].required = 3;
        const gemCounterElement = document.getElementById(`gem-${type}`);
        if (gemCounterElement) {
            gemCounterElement.textContent = `${gemCounts[type].current}/${gemCounts[type].required}`;
        }
    }

    // Reset managers
    spatialGrid.clear();
    damageNumberManager.clear();
    AreaWarningManager.warnings.length = 0;

    // Reset combat system
    combatSystem.setLastShotTime(0);

    // Reset input
    inputSystem.clearKeyStates();
    inputSystem.clearDragVisuals();

    // Reset camera
    targetZoom = 200;

    // Spawn initial enemies
    const enemyDependencies = {
        scene,
        enemies,
        enemyPrototypes,
        playerCone,
        enemyCounts,
        getBossCount: () => bossCount,
        setBossCount: (val) => { bossCount = val; },
        level,
        gameSpeedMultiplier,
        createGravityVortex: (parent, count, radius, color, isRotated) =>
            createGravityVortex(parent, count, radius, color, isRotated, gravityWellEffects),
        gravityWellEffects,
        MAX_BOSSES,
        MIN_BOX_RATIO
    };

    for (let i = 0; i < INITIAL_ENEMY_COUNT; i++) {
        spawnEnemy(enemyDependencies);
    }

    // Spawn initial relics
    const relicDependencies = {
        scene,
        relics,
        relicInfo,
        playerCone,
        relicPriority,
        playerStats,
        level,
        RELIC_SPAWN_Y,
        MAX_RELICS,
        createGem: (gemType, position) => createGem(gemType, position, {
            scene,
            gems,
            gemTypes
        }),
        RelicCombatStrategies: relicCombatStrategies,
        relicSpawnQueue
    };
    spawnInitialRelics(relicDependencies);
}

// ===== Window Resize Handler =====
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== Restart Button Handler =====
const restartButton = document.getElementById('reset-button');
if (restartButton) {
    restartButton.addEventListener('click', () => {
        resetGame();
    });
}

// ===== Initialize and Start Game =====
console.log('Arena Roguelike - Initializing...');

// Initialize UI
updateStatsUI(playerStats);
updateScoreUI(score);
updateLevelUI(level);
updateExperienceBar(experience, experienceToNextLevel);

// Initialize AudioManager
AudioManager.init();

// Initialize gem counter UI
for (const type in gemCounts) {
    const gemCounterElement = document.getElementById(`gem-${type}`);
    if (gemCounterElement) {
        gemCounterElement.textContent = `${gemCounts[type].current}/${gemCounts[type].required}`;
    }
}

// Spawn initial relics
const initialRelicDependencies = {
    scene,
    relics,
    relicInfo,
    playerCone,
    relicPriority,
    playerStats,
    level,
    RELIC_SPAWN_Y,
    MAX_RELICS,
    createGem: (gemType, position) => createGem(gemType, position, {
        scene,
        gems,
        gemTypes
    }),
    RelicCombatStrategies: relicCombatStrategies,
    relicSpawnQueue
};
spawnInitialRelics(initialRelicDependencies);

// Spawn initial enemies
const initialEnemyDependencies = {
    scene,
    enemies,
    enemyPrototypes,
    playerCone,
    enemyCounts,
    getBossCount: () => bossCount,
    setBossCount: (val) => { bossCount = val; },
    level,
    gameSpeedMultiplier,
    createGravityVortex: (parent, count, radius, color, isRotated) =>
        createGravityVortex(parent, count, radius, color, isRotated, gravityWellEffects),
    gravityWellEffects,
    MAX_BOSSES,
    MIN_BOX_RATIO
};

for (let i = 0; i < INITIAL_ENEMY_COUNT; i++) {
    spawnEnemy(initialEnemyDependencies);
}

console.log('Arena Roguelike - Ready!');

// Start the game loop
animate();
