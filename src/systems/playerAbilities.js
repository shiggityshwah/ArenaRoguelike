/**
 * Player Abilities System
 *
 * Manages special abilities unlocked by killing bosses:
 * - Frost Nova: Freeze enemies in radius
 * - Shotgun Blast: Cone spread of projectiles
 * - Acid Grenade: DoT pool on ground
 * - Lightning Strike: Targeted AoE damage
 *
 * All abilities auto-trigger when cooldowns expire and are affected by cooldownReduction stat.
 */

import * as THREE from 'three';

/**
 * Ability metadata definitions
 */
export const ABILITY_DEFINITIONS = {
    frostNova: {
        id: 'frostNova',
        name: 'Frost Nova',
        description: 'Radiates a freezing wave that immobilizes all enemies within range for 3 seconds',
        baseCooldown: 10.0,
        radius: 60,
        freezeDuration: 3.0,
        color: 0x00FFFF,
        icon: '❄️'
    },
    shotgunBlast: {
        id: 'shotgunBlast',
        name: 'Shotgun Blast',
        description: 'Fires 8 projectiles in a cone spread, each dealing 50% damage',
        baseCooldown: 5.0,
        projectileCount: 8,
        spreadAngle: Math.PI / 4, // 45 degrees
        damageMultiplier: 0.5,
        color: 0xFFAA00,
        icon: '💥'
    },
    acidGrenade: {
        id: 'acidGrenade',
        name: 'Acid Grenade',
        description: 'Lobs a grenade at the nearest enemy, creating a pool of acid that deals damage over time',
        baseCooldown: 12.0,
        poolRadius: 30,
        poolDuration: 6.0,
        damagePerSecond: 25,
        grenadeSpeed: 60,  // Increased from 2.5 to make grenade fly properly
        color: 0x00FF00,
        icon: '🧪'
    },
    lightningStrike: {
        id: 'lightningStrike',
        name: 'Lightning Strike',
        description: 'Calls down a lightning bolt on a random enemy, dealing massive AoE damage',
        baseCooldown: 8.0,
        range: 100,
        damage: 300,
        aoeRadius: 25,
        telegraphDuration: 0.5,
        color: 0x8888FF,
        icon: '⚡'
    }
};

/**
 * Creates the player ability system
 */
export function createPlayerAbilitySystem(dependencies) {
    const { scene, spatialGrid, objectPools, AudioManager, clock } = dependencies;

    // Track unlocked abilities and their cooldowns
    const unlockedAbilities = [];
    const abilityCooldowns = {}; // abilityId -> last activation timestamp

    // Initialize all cooldowns to 0 (ready immediately)
    Object.keys(ABILITY_DEFINITIONS).forEach(id => {
        abilityCooldowns[id] = 0;
    });

    /**
     * Check if an ability is unlocked
     */
    function isUnlocked(abilityId) {
        return unlockedAbilities.includes(abilityId);
    }

    /**
     * Unlock a new ability
     */
    function unlockAbility(abilityId) {
        if (!ABILITY_DEFINITIONS[abilityId]) {
            console.warn(`Unknown ability: ${abilityId}`);
            return;
        }
        if (!isUnlocked(abilityId)) {
            unlockedAbilities.push(abilityId);
            console.log(`Unlocked ability: ${ABILITY_DEFINITIONS[abilityId].name}`);
        }
    }

    /**
     * Get all unowned abilities (for boss kill selection)
     */
    function getUnownedAbilities() {
        return Object.keys(ABILITY_DEFINITIONS).filter(id => !isUnlocked(id));
    }

    /**
     * Check if ability is off cooldown
     */
    function isAbilityReady(abilityId, playerStats) {
        const def = ABILITY_DEFINITIONS[abilityId];
        const now = clock.getElapsedTime();
        const effectiveCooldown = def.baseCooldown * (1 - (playerStats.cooldownReduction || 0));
        const timeSinceLastUse = now - (abilityCooldowns[abilityId] || 0);
        return timeSinceLastUse >= effectiveCooldown;
    }

    /**
     * Mark ability as used
     */
    function markAbilityUsed(abilityId) {
        abilityCooldowns[abilityId] = clock.getElapsedTime();
    }

    /**
     * FROST NOVA - Freeze all enemies in radius
     */
    function triggerFrostNova(gameState) {
        const def = ABILITY_DEFINITIONS.frostNova;
        const { playerCone, enemies } = gameState;
        const now = clock.getElapsedTime();

        // Get all enemies in radius
        const nearbyEnemies = spatialGrid.getNearby({
            mesh: playerCone,
            radius: def.radius
        });

        let frozenCount = 0;
        nearbyEnemies.forEach(enemy => {
            const dx = enemy.mesh.position.x - playerCone.position.x;
            const dz = enemy.mesh.position.z - playerCone.position.z;
            const distSq = dx * dx + dz * dz;

            if (distSq <= def.radius * def.radius) {
                // Freeze the enemy (visual effect is handled in main update loop)
                enemy.frozenUntil = now + def.freezeDuration;
                frozenCount++;
            }
        });

        // Create visual effect
        createFrostNovaEffect(gameState, def, playerCone.position);

        // Play sound
        if (AudioManager && AudioManager.play) {
            AudioManager.play('explosion', 0.3);
        }

        markAbilityUsed('frostNova');
        console.log(`Frost Nova! Froze ${frozenCount} enemies`);
    }

    /**
     * SHOTGUN BLAST - Fire cone spread of projectiles
     */
    function triggerShotgunBlast(gameState) {
        const def = ABILITY_DEFINITIONS.shotgunBlast;
        const { playerCone, playerStats, blasterShots, enemies } = gameState;

        // Find nearest enemy to aim shotgun toward
        let targetDirection = new THREE.Vector3(0, 0, 1); // Default forward if no enemies
        let nearestDist = Infinity;

        const nearbyEnemies = spatialGrid.getNearby({
            mesh: playerCone,
            radius: playerStats.attackDistance
        });

        nearbyEnemies.forEach(enemy => {
            const dist = playerCone.position.distanceTo(enemy.mesh.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                targetDirection = new THREE.Vector3()
                    .subVectors(enemy.mesh.position, playerCone.position)
                    .normalize();
                targetDirection.y = 0; // Keep horizontal
            }
        });

        // Calculate base angle from target direction
        const baseAngle = Math.atan2(targetDirection.x, targetDirection.z);

        // Fire projectiles in spread
        for (let i = 0; i < def.projectileCount; i++) {
            // Calculate angle offset for this projectile
            const angleOffset = (i / (def.projectileCount - 1) - 0.5) * def.spreadAngle;
            const shotAngle = baseAngle + angleOffset;

            // Create projectile direction
            const direction = new THREE.Vector3(
                Math.sin(shotAngle),
                0,
                Math.cos(shotAngle)
            ).normalize();

            // Get projectile from pool
            const shot = objectPools.blasterShots.get();
            const origin = playerCone.position.clone();
            origin.y = 1.5;
            shot.mesh.position.copy(origin);

            // Set target point in the direction of the spread
            shot.initialPosition.copy(origin);
            shot.targetPoint.copy(origin).addScaledVector(direction, 1000);

            // Shotgun pellets don't pierce
            shot.pierceLeft = 0;
            shot.hitEnemies.length = 0; // Clear hit list

            // Visual styling (orange/yellow)
            shot.mesh.material.color.setHex(def.color);

            // Activate trail
            if (shot.trail) {
                shot.trail.activate();
            }

            blasterShots.push(shot);
        }

        // Play sound
        if (AudioManager && AudioManager.play) {
            AudioManager.play('shoot', 0.5);
        }

        markAbilityUsed('shotgunBlast');
    }

    /**
     * ACID GRENADE - Lob grenade at nearest enemy or forward
     */
    function triggerAcidGrenade(gameState) {
        const def = ABILITY_DEFINITIONS.acidGrenade;
        const { playerCone, enemies, acidGrenades } = gameState;

        // Find nearest enemy
        let nearestEnemy = null;
        let nearestDistSq = Infinity;

        enemies.forEach(enemy => {
            const dx = enemy.mesh.position.x - playerCone.position.x;
            const dz = enemy.mesh.position.z - playerCone.position.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestEnemy = enemy;
            }
        });

        // Create grenade projectile
        const grenadeGeometry = new THREE.SphereGeometry(3);
        const grenadeMaterial = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.8
        });
        const grenadeMesh = new THREE.Mesh(grenadeGeometry, grenadeMaterial);
        grenadeMesh.position.copy(playerCone.position);
        grenadeMesh.position.y = 1.5;
        scene.add(grenadeMesh);

        // Determine throw direction and target position
        let throwDirection = new THREE.Vector3();
        let targetPos;

        if (nearestEnemy) {
            // Throw at enemy
            targetPos = nearestEnemy.mesh.position.clone();
            throwDirection.subVectors(targetPos, grenadeMesh.position);
            throwDirection.y = 0; // Keep only horizontal direction
            throwDirection.normalize();
        } else {
            // No enemy - throw forward 30 units in a random direction
            const randomAngle = Math.random() * Math.PI * 2;
            throwDirection.set(Math.sin(randomAngle), 0, Math.cos(randomAngle));
            targetPos = grenadeMesh.position.clone().add(
                throwDirection.clone().multiplyScalar(30)
            );
        }

        // Create grenade object with explicit horizontal velocity
        const grenade = {
            mesh: grenadeMesh,
            targetPos: targetPos,
            startPos: playerCone.position.clone(),
            velocity: new THREE.Vector3(),
            age: 0,
            speed: def.grenadeSpeed
        };

        // Set velocity: horizontal direction * speed + upward arc
        grenade.velocity.x = throwDirection.x * def.grenadeSpeed;
        grenade.velocity.y = 8.0; // Arc upward (increased for better trajectory)
        grenade.velocity.z = throwDirection.z * def.grenadeSpeed;

        acidGrenades.push(grenade);

        markAbilityUsed('acidGrenade');
    }

    /**
     * LIGHTNING STRIKE - Strike random enemy in range (requires enemy target)
     */
    function triggerLightningStrike(gameState) {
        const def = ABILITY_DEFINITIONS.lightningStrike;
        const { playerCone, enemies, lightningStrikes, AreaWarningManager } = gameState;
        const now = clock.getElapsedTime();

        // Use enemies array directly instead of spatial grid to avoid stale data
        // Filter for enemies in range and with valid health
        const inRangeEnemies = enemies.filter(enemy => {
            // Must have valid mesh and health
            if (!enemy || !enemy.mesh || !enemy.mesh.position || enemy.health <= 0) {
                return false;
            }

            const dx = enemy.mesh.position.x - playerCone.position.x;
            const dz = enemy.mesh.position.z - playerCone.position.z;
            const distSq = dx * dx + dz * dz;
            const dist = Math.sqrt(distSq);

            // Must be in range and at least 10 units away (avoid targeting at player position)
            return dist <= def.range && dist >= 10;
        });

        // Don't cast if no valid targets - abort without using cooldown
        if (inRangeEnemies.length === 0) {
            console.log('Lightning Strike: No valid enemies in range (10-100 units)');
            return;
        }

        // Pick random target
        const target = inRangeEnemies[Math.floor(Math.random() * inRangeEnemies.length)];

        const strikePos = target.mesh.position.clone();

        // Debug: Log strike position vs player position
        const distToPlayer = strikePos.distanceTo(playerCone.position);
        console.log(`Lightning Strike: Targeting ${target.type} enemy at distance ${distToPlayer.toFixed(1)} from player (HP: ${target.health.toFixed(0)})`);
        console.log(`  Player pos: (${playerCone.position.x.toFixed(1)}, ${playerCone.position.z.toFixed(1)})`);
        console.log(`  Strike pos: (${strikePos.x.toFixed(1)}, ${strikePos.z.toFixed(1)})`);

        // Create telegraph warning
        if (AreaWarningManager) {
            AreaWarningManager.create(
                strikePos,
                def.aoeRadius,
                0xFFFF00,
                def.telegraphDuration,
                'gradient'
            );
        }

        // Schedule lightning strike
        lightningStrikes.push({
            position: strikePos,
            triggerTime: now + def.telegraphDuration,
            damage: def.damage,
            aoeRadius: def.aoeRadius
        });

        markAbilityUsed('lightningStrike');
    }

    /**
     * Create frost nova visual effect
     */
    function createFrostNovaEffect(gameState, def, position) {
        const { temporaryEffects } = gameState;
        const now = clock.getElapsedTime();

        // Create expanding frost disc (filled circle that expands outward)
        const discGeometry = new THREE.CircleGeometry(def.radius, 64);
        const discMaterial = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const discMesh = new THREE.Mesh(discGeometry, discMaterial);
        discMesh.position.copy(position);
        discMesh.position.y = 0.5;
        discMesh.rotation.x = -Math.PI / 2; // Lay flat on ground
        discMesh.scale.set(0, 0, 1); // Start with zero size
        scene.add(discMesh);

        temporaryEffects.push({
            mesh: discMesh,
            startTime: now,
            duration: 0.6,
            type: 'frostNova',
            onUpdate: (effect, progress) => {
                // Expand from player position to full size
                const scale = progress; // Scale from 0.0 to 1.0
                discMesh.scale.set(scale, scale, 1);
                // Fade out as it expands
                discMesh.material.opacity = 0.5 * (1 - progress * 0.6);
                // Pulse the emissive intensity
                discMesh.material.emissiveIntensity = 0.8 * (1 - progress * 0.5);
            }
        });
    }

    /**
     * Update all active abilities
     */
    function updateAbilities(gameState) {
        const { playerStats, isGameOver, isGamePaused } = gameState;

        if (isGameOver || isGamePaused) return;

        // Check each unlocked ability
        unlockedAbilities.forEach(abilityId => {
            if (isAbilityReady(abilityId, playerStats)) {
                // Trigger ability
                switch (abilityId) {
                    case 'frostNova':
                        triggerFrostNova(gameState);
                        break;
                    case 'shotgunBlast':
                        triggerShotgunBlast(gameState);
                        break;
                    case 'acidGrenade':
                        triggerAcidGrenade(gameState);
                        break;
                    case 'lightningStrike':
                        triggerLightningStrike(gameState);
                        break;
                }
            }
        });
    }

    /**
     * Update acid grenade projectiles
     */
    function updateAcidGrenades(gameState, delta) {
        const { acidGrenades, acidPools, scene } = gameState;
        const def = ABILITY_DEFINITIONS.acidGrenade;
        const now = clock.getElapsedTime();

        for (let i = acidGrenades.length - 1; i >= 0; i--) {
            const grenade = acidGrenades[i];

            // Update position
            grenade.mesh.position.add(
                grenade.velocity.clone().multiplyScalar(delta)
            );

            // Apply gravity
            grenade.velocity.y -= 9.8 * delta;

            // Rotate for effect
            grenade.mesh.rotation.x += delta * 5;
            grenade.mesh.rotation.y += delta * 3;

            grenade.age += delta;

            // Check if hit ground or reached target
            const distToTarget = grenade.mesh.position.distanceTo(grenade.targetPos);
            if (grenade.mesh.position.y <= 0.5 || distToTarget < 10 || grenade.age > 3) {
                // Create acid pool
                const poolGeometry = new THREE.CylinderGeometry(def.poolRadius, def.poolRadius, 1, 32);
                const poolMaterial = new THREE.MeshStandardMaterial({
                    color: def.color,
                    emissive: def.color,
                    emissiveIntensity: 0.7,
                    transparent: true,
                    opacity: 0.7
                });
                const poolMesh = new THREE.Mesh(poolGeometry, poolMaterial);
                poolMesh.position.x = grenade.mesh.position.x;
                poolMesh.position.z = grenade.mesh.position.z;
                poolMesh.position.y = 0.5;
                scene.add(poolMesh);

                acidPools.push({
                    mesh: poolMesh,
                    position: new THREE.Vector2(poolMesh.position.x, poolMesh.position.z),
                    radius: def.poolRadius,
                    damagePerSecond: def.damagePerSecond,
                    startTime: now,
                    duration: def.poolDuration
                });

                // Remove grenade
                scene.remove(grenade.mesh);
                grenade.mesh.geometry.dispose();
                grenade.mesh.material.dispose();
                acidGrenades.splice(i, 1);

                // Play sound
                if (AudioManager && AudioManager.play) {
                    AudioManager.play('explosion', 0.4);
                }
            }
        }
    }

    /**
     * Update acid pools
     */
    function updateAcidPools(gameState, delta) {
        const { acidPools, enemies, scene, DamageNumberManager, playerStats } = gameState;
        const now = clock.getElapsedTime();

        for (let i = acidPools.length - 1; i >= 0; i--) {
            const pool = acidPools[i];
            const age = now - pool.startTime;

            // Remove if expired
            if (age > pool.duration) {
                scene.remove(pool.mesh);
                pool.mesh.geometry.dispose();
                pool.mesh.material.dispose();
                acidPools.splice(i, 1);
                continue;
            }

            // Pulse opacity
            pool.mesh.material.opacity = 0.7 + 0.3 * Math.sin(now * 3);

            // Damage enemies in pool
            enemies.forEach(enemy => {
                const dx = enemy.mesh.position.x - pool.position.x;
                const dz = enemy.mesh.position.z - pool.position.y;
                const distSq = dx * dx + dz * dz;

                if (distSq <= pool.radius * pool.radius) {
                    // Apply damage (once per 0.5 seconds per enemy)
                    if (!enemy.lastAcidDamage || now - enemy.lastAcidDamage > 0.5) {
                        const damage = pool.damagePerSecond * 0.5;
                        enemy.health -= damage;
                        enemy.lastAcidDamage = now;

                        // Visual feedback
                        enemy.hitEffectUntil = now + 0.1;
                        enemy.mesh.material.emissive.setHex(0x00FF00);
                        enemy.mesh.material.emissiveIntensity = 1.0;

                        // Damage number
                        if (DamageNumberManager) {
                            DamageNumberManager.create(enemy.mesh, Math.round(damage), { isCritical: false });
                        }
                    }
                }
            });
        }
    }

    /**
     * Update lightning strikes
     */
    function updateLightningStrikes(gameState) {
        const { lightningStrikes, enemies, scene, DamageNumberManager, playerStats, temporaryEffects } = gameState;
        const now = clock.getElapsedTime();
        const def = ABILITY_DEFINITIONS.lightningStrike;

        for (let i = lightningStrikes.length - 1; i >= 0; i--) {
            const strike = lightningStrikes[i];

            if (now >= strike.triggerTime) {
                // Execute lightning strike
                console.log(`Lightning Strike executing at: (${strike.position.x.toFixed(1)}, ${strike.position.z.toFixed(1)})`);

                // Create lightning bolt visual (tall cylinder falling from sky)
                const boltGeometry = new THREE.CylinderGeometry(2, 5, 200, 8);
                const boltMaterial = new THREE.MeshStandardMaterial({
                    color: def.color,
                    emissive: def.color,
                    emissiveIntensity: 2.0,
                    transparent: true,
                    opacity: 0.8
                });
                const boltMesh = new THREE.Mesh(boltGeometry, boltMaterial);
                boltMesh.position.copy(strike.position);
                boltMesh.position.y = 100; // Center of cylinder at 100, so extends from 0 to 200
                scene.add(boltMesh);

                temporaryEffects.push({
                    mesh: boltMesh,
                    startTime: now,
                    duration: 0.2,
                    type: 'lightning'
                });

                // Apply damage to enemies in AoE
                enemies.forEach(enemy => {
                    const dx = enemy.mesh.position.x - strike.position.x;
                    const dz = enemy.mesh.position.z - strike.position.z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq <= strike.aoeRadius * strike.aoeRadius) {
                        const dist = Math.sqrt(distSq);
                        const damageFalloff = 1 - (dist / strike.aoeRadius) * 0.5; // 50% falloff at edge
                        const damage = strike.damage * damageFalloff;

                        enemy.health -= damage;

                        // Visual feedback
                        enemy.hitEffectUntil = now + 0.2;
                        enemy.mesh.material.emissive.setHex(0xFFFFFF);
                        enemy.mesh.material.emissiveIntensity = 2.0;

                        // Damage number
                        if (DamageNumberManager) {
                            DamageNumberManager.create(enemy.mesh, Math.round(damage), { isCritical: false });
                        }
                    }
                });

                // Play sound
                if (AudioManager && AudioManager.play) {
                    AudioManager.play('explosion', 0.7);
                }

                lightningStrikes.splice(i, 1);
            }
        }
    }

    return {
        updateAbilities,
        updateAcidGrenades,
        updateAcidPools,
        updateLightningStrikes,
        unlockAbility,
        isUnlocked,
        getUnownedAbilities,
        getUnlockedAbilities: () => [...unlockedAbilities],
        isAbilityReady,
        abilityCooldowns,
        // Dev mode functions
        devGrantAbility: unlockAbility,
        devClearAbilities: () => { unlockedAbilities.length = 0; }
    };
}
