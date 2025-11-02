/**
 * Combat System
 * Handles player shooting, projectile updates, and damage calculations
 *
 * Dependencies:
 * - THREE.js
 * - Game State: enemies, blasterShots, enemyProjectiles, beams, playerCone, playerStats, playerHealth, etc.
 * - Managers: objectPools, spatialGrid, damageNumberManager, AudioManager
 * - Config: relicInfo
 * - Effects: createExplosion
 */

import * as THREE from 'three';

export function createCombatSystem({
    scene,
    clock,
    spatialGrid,
    objectPools,
    damageNumberManager,
    AudioManager,
    relicInfo,
    createExplosion,
    destroyRelic
}) {
    // ===== Constants =====
    const MAX_PLAYER_SHOTS = 1000;
    const MAX_ENEMY_SHOTS = 1000;
    const BASE_ENEMY_PROJECTILE_SPEED = 2.0;

    // ===== State (to be passed from main game loop) =====
    let lastShotTime = 0;

    // ===== Player Shooting =====
    /**
     * Auto-shoot at nearest enemy within range
     * @param {Object} gameState - Current game state
     * @param {Object} gameState.playerCone - Player mesh
     * @param {Object} gameState.playerStats - Player statistics
     * @param {Array} gameState.enemies - Array of enemies
     * @param {Array} gameState.blasterShots - Array of player shots
     * @param {Object} gameState.playerBuffs - Current player buffs
     */
    function updatePlayerShooting(gameState) {
        const {
            playerCone,
            playerStats,
            blasterShots,
            playerBuffs
        } = gameState;

        const now = clock.getElapsedTime();
        const baseCooldown = Math.max(0.05, playerStats.attackSpeed * (1 - playerStats.cooldownReduction));

        if (now - lastShotTime >= baseCooldown) {
            let nearest = null;
            let bestDistance = playerStats.attackDistance;

            // Use spatial grid to find a target
            const potentialTargets = spatialGrid.getNearby({
                mesh: playerCone,
                radius: playerStats.attackDistance
            });

            for (const enemy of potentialTargets) {
                if (!enemy.health || enemy.health <= 0) continue;
                const distance = playerCone.position.distanceTo(enemy.mesh.position);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    nearest = enemy;
                }
            }

            // If we found a valid target within range
            if (nearest) {
                lastShotTime = now;

                let origin = playerCone.position.clone();
                const target = nearest.mesh.position.clone();
                target.y = origin.y; // fire on horizontal plane
                const dir = new THREE.Vector3().subVectors(target, origin).normalize();

                if (blasterShots.length < MAX_PLAYER_SHOTS) {
                    const shot = objectPools.blasterShots.get();
                    shot.mesh.position.copy(origin);
                    shot.trail.activate();
                    shot.targetPoint = origin.clone().addScaledVector(dir, 1000);
                    shot.initialPosition = origin.clone();
                    shot.pierceLeft = playerStats.pierceCount;
                    shot.hitEnemies.length = 0;
                    blasterShots.push(shot);
                    AudioManager.play('laser', 0.5);
                }
            }
        }
    }

    // ===== Player Shot Update =====
    /**
     * Update player blaster shots - movement and collision
     * @param {Object} gameState - Current game state
     */
    function updateBlasterShots(gameState) {
        const {
            blasterShots,
            playerStats,
            playerBuffs
        } = gameState;

        for (let i = blasterShots.length - 1; i >= 0; i--) {
            const shot = blasterShots[i];
            const direction = new THREE.Vector3().subVectors(shot.targetPoint, shot.mesh.position).normalize();
            shot.mesh.position.addScaledVector(direction, playerStats.projectileSpeed);
            spatialGrid.add({ mesh: shot.mesh, radius: 2 });

            let shotConsumed = false;

            // Collision detection with enemies
            const nearbyEnemies = spatialGrid.getNearby({ mesh: shot.mesh, radius: 2 });
            for (const enemy of nearbyEnemies) {
                // Guard clauses: ensure enemy is valid, alive, not already hit by this shot, and in range
                if (!enemy.health || enemy.health <= 0 || shot.hitEnemies.includes(enemy)) continue;

                if (shot.mesh.position.distanceTo(enemy.mesh.position) < (shot.mesh.geometry.parameters.radius + enemy.radius)) {
                    // Handle phantom enemy special behavior
                    if (enemy.type === 'phantom' && !enemy.isVulnerable) {
                        enemy.teleportCount++;
                        if (enemy.teleportCount >= enemy.teleportsBeforeVulnerable) {
                            enemy.isVulnerable = true;
                            enemy.vulnerableUntil = clock.getElapsedTime() + 2.0;
                            enemy.mesh.material.emissive.set(0xffffff);
                            enemy.mesh.material.emissiveIntensity = 2;
                        } else {
                            const angle = Math.random() * Math.PI * 2;
                            const distance = 50 + Math.random() * 50;
                            enemy.mesh.position.x += Math.cos(angle) * distance;
                            enemy.mesh.position.z += Math.sin(angle) * distance;
                        }
                        AudioManager.play('windChime', 0.6);
                        shot.pierceLeft = 0; // Consume shot
                    } else {
                        shot.pierceLeft--;
                        shot.hitEnemies.push(enemy);

                        let currentDamage = playerStats.damage * playerBuffs.damageMult;
                        let isCritical = false;
                        if (Math.random() < playerStats.critChance) {
                            currentDamage *= playerStats.critMultiplier;
                            isCritical = true;
                        }

                        enemy.health -= currentDamage;
                        damageNumberManager.create(enemy.mesh, currentDamage, { isCritical });

                        // Area Damage
                        if (playerStats.areaDamageRadius > 0) {
                            createExplosion(enemy.mesh.position, playerStats.areaDamageRadius);
                            const areaDamage = currentDamage * 0.5; // AoE does 50% of primary hit damage

                            // Use spatial grid to find victims for AoE damage
                            const aoeVictims = spatialGrid.getNearby({
                                mesh: { position: enemy.mesh.position },
                                radius: playerStats.areaDamageRadius
                            });

                            for (const otherEnemy of aoeVictims) {
                                // Skip if it's not a valid enemy, the one that triggered the explosion, or already hit by this shot
                                if (!otherEnemy.health || otherEnemy === enemy || shot.hitEnemies.includes(otherEnemy)) continue;

                                // Final distance check for accuracy
                                if (enemy.mesh.position.distanceTo(otherEnemy.mesh.position) < playerStats.areaDamageRadius + otherEnemy.radius) {
                                    otherEnemy.health -= areaDamage;
                                    damageNumberManager.create(otherEnemy.mesh, areaDamage, { isCritical: false });
                                }
                            }
                        }

                        if (enemy.health > 0) {
                            // Hit effects for non-lethal hit
                            enemy.mesh.material.emissive.set(0xffffff);
                            enemy.mesh.material.emissiveIntensity = 1;
                            enemy.hitEffectUntil = clock.getElapsedTime() + 0.1;
                            AudioManager.play('hit', 0.3);
                        }
                    }

                    if (shot.pierceLeft <= 0) {
                        shot.trail.deactivate();
                        objectPools.blasterShots.release(shot);
                        blasterShots.splice(i, 1);
                        shotConsumed = true;
                        break;
                    }
                }
            }

            if (shotConsumed) continue;

            // Remove shots that traveled too far
            if (shot.active && shot.mesh.position.distanceTo(shot.initialPosition) > playerStats.attackDistance + 50) {
                shot.trail.deactivate();
                objectPools.blasterShots.release(shot);
                blasterShots.splice(i, 1);
            }
        }
    }

    // ===== Enemy Projectile Update =====
    /**
     * Update enemy projectiles - movement and collision
     * @param {Object} gameState - Current game state
     */
    function updateEnemyProjectiles(gameState) {
        const {
            enemyProjectiles,
            playerCone,
            playerStats,
            relics,
            gameSpeedMultiplier,
            playerIsBoosted,
            healthBarElement
        } = gameState;

        let playerHealth = gameState.playerHealth;
        let isPlayerHit = gameState.isPlayerHit;
        let hitAnimationTime = gameState.hitAnimationTime;

        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            const projectile = enemyProjectiles[i];
            let projectileConsumed = false;
            const travelDistance = BASE_ENEMY_PROJECTILE_SPEED * gameSpeedMultiplier;
            projectile.mesh.position.addScaledVector(projectile.direction, travelDistance);
            spatialGrid.add(projectile);
            projectile.distanceTraveled += travelDistance;

            // Collision with player
            if (projectile.mesh.position.distanceTo(playerCone.position) < playerStats.playerRadius) {
                objectPools.enemyProjectiles.release(projectile);
                enemyProjectiles.splice(i, 1);

                if (Math.random() < playerStats.dodgeChance) {
                    // DODGE!
                    damageNumberManager.create(playerCone, '', { isDodge: true });
                    AudioManager.play('hit', 0.2);
                } else {
                    let damageTaken = 5 * (50 / (50 + playerStats.armor));
                    if (playerIsBoosted) damageTaken *= relicInfo.speed.damageTakenMultiplier;
                    playerHealth -= damageTaken;
                    healthBarElement.style.width = (playerHealth / playerStats.maxHealth) * 100 + '%';
                    damageNumberManager.create(playerCone, damageTaken, {});
                    isPlayerHit = true;
                    hitAnimationTime = 0;
                    AudioManager.play('hit', 0.8);
                }

                // Update game state
                gameState.playerHealth = playerHealth;
                gameState.isPlayerHit = isPlayerHit;
                gameState.hitAnimationTime = hitAnimationTime;
                continue;
            }

            // Collision with relics
            for (let k = relics.length - 1; k >= 0; k--) {
                const group = relics[k];
                if (group.state === 'active' && projectile.mesh.position.distanceTo(group.relic.position) < group.radius) {
                    group.health -= 10;
                    objectPools.enemyProjectiles.release(projectile);
                    enemyProjectiles.splice(i, 1);
                    if (group.health <= 0) {
                        destroyRelic(group, k);
                        AudioManager.play('explosion', 1.0);
                    } else {
                        AudioManager.play('hit', 0.4);
                    }
                    projectileConsumed = true;
                    break;
                }
            }

            if (projectileConsumed) continue;

            // Remove if it goes too far
            if (projectile.active && projectile.distanceTraveled > projectile.range) {
                objectPools.enemyProjectiles.release(projectile);
                enemyProjectiles.splice(i, 1);
            }
        }
    }

    // ===== Player-Enemy Collision =====
    /**
     * Handle collision between player and enemies (contact damage)
     * @param {Object} gameState - Current game state
     */
    function updatePlayerCollision(gameState) {
        const {
            playerCone,
            playerStats,
            relics,
            playerIsBoosted,
            healthBarElement
        } = gameState;

        let playerHealth = gameState.playerHealth;
        let isPlayerHit = gameState.isPlayerHit;
        let hitAnimationTime = gameState.hitAnimationTime;
        let healthBarShakeUntil = gameState.healthBarShakeUntil;

        const nearbyToPlayer = spatialGrid.getNearby({
            mesh: playerCone,
            radius: playerStats.playerRadius + 30
        });

        for (const enemy of nearbyToPlayer) {
            if (!enemy.health || enemy.health <= 0 || !enemy.radius) continue;

            if (playerCone.position.distanceTo(enemy.mesh.position) < (playerStats.playerRadius + enemy.radius)) {
                if (Math.random() < playerStats.dodgeChance) {
                    damageNumberManager.create(playerCone, '', { isDodge: true });
                    continue;
                }

                let damageTaken = enemy.contactDamage * (50 / (50 + playerStats.armor));
                if (playerIsBoosted) damageTaken *= relicInfo.speed.damageTakenMultiplier;
                playerHealth -= damageTaken;
                healthBarElement.style.width = (playerHealth / playerStats.maxHealth) * 100 + '%';
                damageNumberManager.create(playerCone, damageTaken, {});
                isPlayerHit = true;
                hitAnimationTime = 0;
                AudioManager.play('hit', 0.8);
                healthBarElement.parentElement.classList.add('health-bar-shaking');
                healthBarShakeUntil = clock.getElapsedTime() + 0.3;
                enemy.health = 0; // Mark for death
            }
        }

        // Update game state
        gameState.playerHealth = playerHealth;
        gameState.isPlayerHit = isPlayerHit;
        gameState.hitAnimationTime = hitAnimationTime;
        gameState.healthBarShakeUntil = healthBarShakeUntil;
    }

    // ===== Beam Update =====
    /**
     * Update and clean up visual beams
     * @param {Array} beams - Array of beam objects
     */
    function updateBeams(beams) {
        for (let i = beams.length - 1; i >= 0; i--) {
            const beam = beams[i];
            if (clock.getElapsedTime() - beam.creationTime > 0.1) { // Beam visible for 100ms
                scene.remove(beam.mesh);
                beam.mesh.geometry.dispose();
                beam.mesh.material.dispose();
                beams.splice(i, 1);
            }
        }
    }

    // ===== Damage Calculation Helpers =====
    /**
     * Calculate damage with armor reduction
     * @param {number} baseDamage - Base damage amount
     * @param {number} armor - Target armor value
     * @returns {number} - Reduced damage
     */
    function calculateArmorReduction(baseDamage, armor) {
        return baseDamage * (50 / (50 + armor));
    }

    /**
     * Calculate critical hit
     * @param {number} baseDamage - Base damage amount
     * @param {number} critChance - Critical hit chance (0-1)
     * @param {number} critMultiplier - Critical damage multiplier
     * @returns {Object} - { damage, isCritical }
     */
    function calculateCritical(baseDamage, critChance, critMultiplier) {
        const isCritical = Math.random() < critChance;
        const damage = isCritical ? baseDamage * critMultiplier : baseDamage;
        return { damage, isCritical };
    }

    // ===== Public API =====
    return {
        updatePlayerShooting,
        updateBlasterShots,
        updateEnemyProjectiles,
        updatePlayerCollision,
        updateBeams,
        calculateArmorReduction,
        calculateCritical,

        // Getters/setters for internal state
        getLastShotTime: () => lastShotTime,
        setLastShotTime: (time) => { lastShotTime = time; }
    };
}
