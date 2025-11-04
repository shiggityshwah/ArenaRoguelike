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
    },
    chainLightning: {
        id: 'chainLightning',
        name: 'Chain Lightning',
        description: 'Strikes nearest enemy, then chains to 5 additional enemies with diminishing damage',
        baseCooldown: 7.0,
        initialRange: 120,
        chainRange: 40,
        baseDamage: 150,
        chainCount: 5,
        damageMultipliers: [1.0, 0.75, 0.5, 0.35, 0.25, 0.20],
        color: 0x9D00FF,
        icon: '⚡'
    },
    timeWarp: {
        id: 'timeWarp',
        name: 'Time Warp',
        description: 'Creates a zone that slows all enemies by 70% for 4 seconds',
        baseCooldown: 12.0,
        radius: 70,
        slowEffect: 0.7, // 70% slow = 0.3x speed
        duration: 4.0,
        color: 0xFF1493,
        icon: '⏰'
    },
    meteorStrike: {
        id: 'meteorStrike',
        name: 'Meteor Strike',
        description: 'Summons 3 meteors at random locations, each dealing massive damage',
        baseCooldown: 18.0,
        meteorCount: 3,
        spawnRange: 150,
        impactRadius: 35,
        damage: 400,
        telegraphDuration: 1.5,
        color: 0xFF4500,
        icon: '☄️'
    },
    spiritWolves: {
        id: 'spiritWolves',
        name: 'Spirit Wolves',
        description: 'Summons 2 spirit wolves that chase and bite enemies for 8 seconds',
        baseCooldown: 14.0,
        wolfCount: 2,
        damage: 30,
        attackSpeed: 1.5,
        moveSpeed: 0.3,
        duration: 8.0,
        maxKills: 3,
        attackRange: 10,
        color: 0x20B2AA,
        icon: '🐺'
    },
    shieldBurst: {
        id: 'shieldBurst',
        name: 'Shield Burst',
        description: 'Grants a shield that absorbs 50 damage; explodes for 200 damage if broken',
        baseCooldown: 10.0,
        shieldHP: 50,
        duration: 3.0,
        explosionDamage: 200,
        explosionRadius: 40,
        color: 0xFFD700,
        icon: '🛡️'
    },
    voidRift: {
        id: 'voidRift',
        name: 'Void Rift',
        description: 'Creates a rift that pulls enemies inward and deals damage over time',
        baseCooldown: 13.0,
        radius: 50,
        duration: 5.0,
        damagePerSecond: 40,
        pullStrength: 0.2,
        color: 0x4B0082,
        icon: '🕳️'
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
     * CHAIN LIGHTNING - Chain damage between nearby enemies
     */
    function triggerChainLightning(gameState) {
        const def = ABILITY_DEFINITIONS.chainLightning;
        const { playerCone, enemies, DamageNumberManager, temporaryEffects } = gameState;
        const now = clock.getElapsedTime();

        // Find nearest enemy to player
        let nearestEnemy = null;
        let nearestDistSq = def.initialRange * def.initialRange;

        enemies.forEach(enemy => {
            if (!enemy || !enemy.mesh || enemy.health <= 0) return;

            const dx = enemy.mesh.position.x - playerCone.position.x;
            const dz = enemy.mesh.position.z - playerCone.position.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestEnemy = enemy;
            }
        });

        // Don't cast if no enemies in range
        if (!nearestEnemy) {
            console.log('Chain Lightning: No enemies in range');
            return;
        }

        // Chain lightning logic
        const chainedEnemies = [nearestEnemy];
        const hitEnemies = new Set([nearestEnemy]);
        let currentTarget = nearestEnemy;

        // Apply damage to first target
        const initialDamage = def.baseDamage * def.damageMultipliers[0];
        currentTarget.health -= initialDamage;
        if (DamageNumberManager) {
            DamageNumberManager.create(currentTarget.mesh, Math.round(initialDamage), { isCritical: false });
        }

        // Create lightning bolt from player to first target
        createChainLightningBolt(playerCone.position, currentTarget.mesh.position, def.color, temporaryEffects, now);

        // Chain to additional targets
        for (let i = 1; i <= def.chainCount; i++) {
            let nextTarget = null;
            let nearestChainDistSq = def.chainRange * def.chainRange;

            // Find nearest unchained enemy to current target
            enemies.forEach(enemy => {
                if (!enemy || !enemy.mesh || enemy.health <= 0) return;
                if (hitEnemies.has(enemy)) return; // Already hit

                const dx = enemy.mesh.position.x - currentTarget.mesh.position.x;
                const dz = enemy.mesh.position.z - currentTarget.mesh.position.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < nearestChainDistSq) {
                    nearestChainDistSq = distSq;
                    nextTarget = enemy;
                }
            });

            if (!nextTarget) break; // No more targets to chain to

            // Apply diminishing damage
            const chainDamage = def.baseDamage * def.damageMultipliers[i];
            nextTarget.health -= chainDamage;
            if (DamageNumberManager) {
                DamageNumberManager.create(nextTarget.mesh, Math.round(chainDamage), { isCritical: false });
            }

            // Create lightning bolt visual between targets
            createChainLightningBolt(currentTarget.mesh.position, nextTarget.mesh.position, def.color, temporaryEffects, now);

            chainedEnemies.push(nextTarget);
            hitEnemies.add(nextTarget);
            currentTarget = nextTarget;
        }

        // Play sound
        if (AudioManager && AudioManager.play) {
            AudioManager.play('shoot', 0.7);
        }

        markAbilityUsed('chainLightning');
        console.log(`Chain Lightning! Hit ${chainedEnemies.length} enemies`);
    }

    /**
     * TIME WARP - Create slow field
     */
    function triggerTimeWarp(gameState) {
        const def = ABILITY_DEFINITIONS.timeWarp;
        const { playerCone, timeWarps } = gameState;
        const now = clock.getElapsedTime();

        // Create time warp zone at player position
        const warpGeometry = new THREE.CylinderGeometry(def.radius, def.radius, 2, 32);
        const warpMaterial = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const warpMesh = new THREE.Mesh(warpGeometry, warpMaterial);
        warpMesh.position.copy(playerCone.position);
        warpMesh.position.y = 1;
        scene.add(warpMesh);

        timeWarps.push({
            mesh: warpMesh,
            position: new THREE.Vector2(playerCone.position.x, playerCone.position.z),
            radius: def.radius,
            slowEffect: def.slowEffect,
            startTime: now,
            duration: def.duration,
            affectedEnemies: new Set()
        });

        // Play sound
        if (AudioManager && AudioManager.play) {
            AudioManager.play('explosion', 0.4);
        }

        markAbilityUsed('timeWarp');
        console.log('Time Warp activated!');
    }

    /**
     * METEOR STRIKE - Spawn multiple meteors
     */
    function triggerMeteorStrike(gameState) {
        const def = ABILITY_DEFINITIONS.meteorStrike;
        const { playerCone, meteorStrikes, AreaWarningManager } = gameState;
        const now = clock.getElapsedTime();

        // Spawn meteors at random positions
        for (let i = 0; i < def.meteorCount; i++) {
            // Random position within range
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * def.spawnRange;
            const impactPos = new THREE.Vector3(
                playerCone.position.x + Math.cos(angle) * distance,
                0,
                playerCone.position.z + Math.sin(angle) * distance
            );

            // Create telegraph warning
            if (AreaWarningManager) {
                AreaWarningManager.create(
                    impactPos,
                    def.impactRadius,
                    0xFFFF00,
                    def.telegraphDuration,
                    'gradient'
                );
            }

            // Create falling meteor mesh
            const meteorGeometry = new THREE.SphereGeometry(8, 8, 8);
            const meteorMaterial = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 2.0
            });
            const meteorMesh = new THREE.Mesh(meteorGeometry, meteorMaterial);
            meteorMesh.position.copy(impactPos);
            meteorMesh.position.y = 450; // Start high in the sky (slightly higher than relic spawn at 400)
            scene.add(meteorMesh);

            // Add trail effect (cone pointing upward behind the falling meteor)
            const trailGeometry = new THREE.ConeGeometry(5, 40, 8);
            const trailMaterial = new THREE.MeshStandardMaterial({
                color: 0xFF6600,
                emissive: 0xFF6600,
                emissiveIntensity: 2.0,
                transparent: true,
                opacity: 0.7
            });
            const trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
            trailMesh.position.y = 25; // Position above meteor (trail extends upward)
            trailMesh.rotation.x = 0; // Cone points down by default, we want it pointing up
            trailMesh.rotation.z = Math.PI; // Flip to point upward
            meteorMesh.add(trailMesh);

            // Schedule meteor impact
            meteorStrikes.push({
                mesh: meteorMesh,
                impactPosition: impactPos.clone(),
                fallStartTime: now + def.telegraphDuration,
                fallDuration: 1.2, // Time to fall from sky (longer for higher spawn)
                damage: def.damage,
                impactRadius: def.impactRadius,
                hasImpacted: false
            });
        }

        markAbilityUsed('meteorStrike');
        console.log(`Meteor Strike! ${def.meteorCount} meteors incoming`);
    }

    /**
     * SPIRIT WOLVES - Summon wolf companions
     */
    function triggerSpiritWolves(gameState) {
        const def = ABILITY_DEFINITIONS.spiritWolves;
        const { playerCone, spiritWolves } = gameState;
        const now = clock.getElapsedTime();

        // Spawn wolves
        for (let i = 0; i < def.wolfCount; i++) {
            // Create wolf mesh (cone shape for now, pointing down)
            const wolfGeometry = new THREE.ConeGeometry(4, 8, 8);
            const wolfMaterial = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 0.7,
                transparent: true,
                opacity: 0.8
            });
            const wolfMesh = new THREE.Mesh(wolfGeometry, wolfMaterial);

            // Spawn slightly offset from player
            const angle = (i / def.wolfCount) * Math.PI * 2;
            wolfMesh.position.set(
                playerCone.position.x + Math.cos(angle) * 15,
                2,
                playerCone.position.z + Math.sin(angle) * 15
            );
            wolfMesh.rotation.x = Math.PI; // Point cone downward
            scene.add(wolfMesh);

            spiritWolves.push({
                mesh: wolfMesh,
                speed: def.moveSpeed,
                damage: def.damage,
                attackCooldown: def.attackSpeed,
                lastAttackTime: 0,
                spawnTime: now,
                duration: def.duration,
                kills: 0,
                maxKills: def.maxKills,
                attackRange: def.attackRange
            });
        }

        // Play sound
        if (AudioManager && AudioManager.play) {
            AudioManager.play('shoot', 0.5);
        }

        markAbilityUsed('spiritWolves');
        console.log(`Summoned ${def.wolfCount} spirit wolves!`);
    }

    /**
     * SHIELD BURST - Grant player shield
     */
    function triggerShieldBurst(gameState) {
        const def = ABILITY_DEFINITIONS.shieldBurst;
        const { playerCone, playerShield } = gameState;
        const now = clock.getElapsedTime();

        // Remove existing shield if present
        if (playerShield.active && playerShield.mesh) {
            scene.remove(playerShield.mesh);
            playerShield.mesh.geometry.dispose();
            playerShield.mesh.material.dispose();
        }

        // Create shield visual (hexagonal ring around player)
        const shieldGeometry = new THREE.TorusGeometry(12, 2, 6, 6);
        const shieldMaterial = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const shieldMesh = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shieldMesh.position.copy(playerCone.position);
        shieldMesh.rotation.x = Math.PI / 2; // Horizontal
        scene.add(shieldMesh);

        // Update shield state
        playerShield.active = true;
        playerShield.mesh = shieldMesh;
        playerShield.hp = def.shieldHP;
        playerShield.maxHP = def.shieldHP;
        playerShield.startTime = now;
        playerShield.duration = def.duration;
        playerShield.explosionDamage = def.explosionDamage;
        playerShield.explosionRadius = def.explosionRadius;

        // Play sound
        if (AudioManager && AudioManager.play) {
            AudioManager.play('shoot', 0.6);
        }

        markAbilityUsed('shieldBurst');
        console.log('Shield Burst activated!');
    }

    /**
     * VOID RIFT - Create pulling damage zone
     */
    function triggerVoidRift(gameState) {
        const def = ABILITY_DEFINITIONS.voidRift;
        const { playerCone, voidRifts } = gameState;
        const now = clock.getElapsedTime();

        // Create rift visual (swirling vortex)
        const riftGeometry = new THREE.CylinderGeometry(def.radius, def.radius * 0.5, 3, 32);
        const riftMaterial = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const riftMesh = new THREE.Mesh(riftGeometry, riftMaterial);
        riftMesh.position.copy(playerCone.position);
        riftMesh.position.y = 1;
        scene.add(riftMesh);

        voidRifts.push({
            mesh: riftMesh,
            position: new THREE.Vector2(playerCone.position.x, playerCone.position.z),
            radius: def.radius,
            damagePerSecond: def.damagePerSecond,
            pullStrength: def.pullStrength,
            startTime: now,
            duration: def.duration,
            lastDamageTick: now
        });

        // Play sound
        if (AudioManager && AudioManager.play) {
            AudioManager.play('explosion', 0.5);
        }

        markAbilityUsed('voidRift');
        console.log('Void Rift created!');
    }

    /**
     * Create chain lightning bolt visual (using cylinder for visibility)
     */
    function createChainLightningBolt(startPos, endPos, color, temporaryEffects, now) {
        // Calculate direction and distance
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const distance = direction.length();
        direction.normalize();

        // Create cylinder bolt (more visible than thin line)
        const boltGeometry = new THREE.CylinderGeometry(0.5, 0.5, distance, 8);
        const boltMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.8
        });
        const boltMesh = new THREE.Mesh(boltGeometry, boltMaterial);

        // Position and orient the cylinder
        const midpoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
        boltMesh.position.copy(midpoint);

        // Orient cylinder to point from start to end
        boltMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction
        );

        scene.add(boltMesh);

        temporaryEffects.push({
            mesh: boltMesh,
            startTime: now,
            duration: 0.3,
            type: 'chainLightning',
            onUpdate: (effect, progress) => {
                boltMesh.material.opacity = 0.8 * (1 - progress);
                boltMesh.material.emissiveIntensity = 2.0 * (1 - progress);
            }
        });
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
                    case 'chainLightning':
                        triggerChainLightning(gameState);
                        break;
                    case 'timeWarp':
                        triggerTimeWarp(gameState);
                        break;
                    case 'meteorStrike':
                        triggerMeteorStrike(gameState);
                        break;
                    case 'spiritWolves':
                        triggerSpiritWolves(gameState);
                        break;
                    case 'shieldBurst':
                        triggerShieldBurst(gameState);
                        break;
                    case 'voidRift':
                        triggerVoidRift(gameState);
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

    /**
     * Update spirit wolves
     */
    function updateSpiritWolves(gameState, delta) {
        const { spiritWolves, enemies, scene, DamageNumberManager } = gameState;
        const now = clock.getElapsedTime();

        for (let i = spiritWolves.length - 1; i >= 0; i--) {
            const wolf = spiritWolves[i];
            const age = now - wolf.spawnTime;

            // Remove if expired or max kills reached
            if (age > wolf.duration || wolf.kills >= wolf.maxKills) {
                scene.remove(wolf.mesh);
                wolf.mesh.geometry.dispose();
                wolf.mesh.material.dispose();
                spiritWolves.splice(i, 1);
                continue;
            }

            // Find nearest enemy
            let nearestEnemy = null;
            let nearestDistSq = 80 * 80; // 80 unit search range

            enemies.forEach(enemy => {
                if (!enemy || !enemy.mesh || enemy.health <= 0) return;

                const dx = enemy.mesh.position.x - wolf.mesh.position.x;
                const dz = enemy.mesh.position.z - wolf.mesh.position.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < nearestDistSq) {
                    nearestDistSq = distSq;
                    nearestEnemy = enemy;
                }
            });

            if (nearestEnemy) {
                // Move toward enemy
                const direction = new THREE.Vector3(
                    nearestEnemy.mesh.position.x - wolf.mesh.position.x,
                    0,
                    nearestEnemy.mesh.position.z - wolf.mesh.position.z
                ).normalize();

                wolf.mesh.position.add(direction.multiplyScalar(wolf.speed));

                // Face enemy
                wolf.mesh.lookAt(new THREE.Vector3(
                    nearestEnemy.mesh.position.x,
                    wolf.mesh.position.y,
                    nearestEnemy.mesh.position.z
                ));

                // Attack if in range
                const distToEnemy = Math.sqrt(nearestDistSq);
                if (distToEnemy < wolf.attackRange && now - wolf.lastAttackTime >= wolf.attackCooldown) {
                    nearestEnemy.health -= wolf.damage;
                    wolf.lastAttackTime = now;

                    // Track kills
                    if (nearestEnemy.health <= 0) {
                        wolf.kills++;
                    }

                    // Visual feedback
                    nearestEnemy.hitEffectUntil = now + 0.1;
                    nearestEnemy.mesh.material.emissive.setHex(0x20B2AA);
                    nearestEnemy.mesh.material.emissiveIntensity = 1.0;

                    // Damage number
                    if (DamageNumberManager) {
                        DamageNumberManager.create(nearestEnemy.mesh, Math.round(wolf.damage), { isCritical: false });
                    }
                }
            }

            // Animate wolf (bob up and down)
            wolf.mesh.position.y = 2 + Math.sin(now * 5) * 0.5;
        }
    }

    /**
     * Update shield burst
     */
    function updateShieldBurst(gameState, delta) {
        const { playerShield, playerCone, enemies, scene, DamageNumberManager, temporaryEffects } = gameState;
        const now = clock.getElapsedTime();

        if (!playerShield.active) return;

        const age = now - playerShield.startTime;

        // Remove if expired
        if (age > playerShield.duration) {
            scene.remove(playerShield.mesh);
            playerShield.mesh.geometry.dispose();
            playerShield.mesh.material.dispose();
            playerShield.active = false;
            playerShield.mesh = null;
            console.log('Shield expired naturally');
            return;
        }

        // Update shield position to follow player
        playerShield.mesh.position.copy(playerCone.position);

        // Animate shield (rotate)
        playerShield.mesh.rotation.z += delta * 2;

        // Pulse opacity based on HP
        const hpRatio = playerShield.hp / playerShield.maxHP;
        playerShield.mesh.material.opacity = 0.6 * hpRatio;
        playerShield.mesh.material.emissiveIntensity = 1.0 * hpRatio;

        // Check if shield is broken (HP reaches 0)
        if (playerShield.hp <= 0) {
            // Trigger explosion
            const def = ABILITY_DEFINITIONS.shieldBurst;

            // Deal damage to nearby enemies
            enemies.forEach(enemy => {
                if (!enemy || !enemy.mesh || enemy.health <= 0) return;

                const dx = enemy.mesh.position.x - playerCone.position.x;
                const dz = enemy.mesh.position.z - playerCone.position.z;
                const distSq = dx * dx + dz * dz;

                if (distSq <= def.explosionRadius * def.explosionRadius) {
                    enemy.health -= def.explosionDamage;

                    // Visual feedback
                    enemy.hitEffectUntil = now + 0.2;
                    enemy.mesh.material.emissive.setHex(0xFFD700);
                    enemy.mesh.material.emissiveIntensity = 2.0;

                    // Damage number
                    if (DamageNumberManager) {
                        DamageNumberManager.create(enemy.mesh, Math.round(def.explosionDamage), { isCritical: false });
                    }
                }
            });

            // Create explosion visual
            const explosionGeometry = new THREE.SphereGeometry(def.explosionRadius, 16, 16);
            const explosionMaterial = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 2.0,
                transparent: true,
                opacity: 0.8
            });
            const explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
            explosionMesh.position.copy(playerCone.position);
            scene.add(explosionMesh);

            temporaryEffects.push({
                mesh: explosionMesh,
                startTime: now,
                duration: 0.3,
                type: 'explosion'
            });

            // Play sound
            if (AudioManager && AudioManager.play) {
                AudioManager.play('explosion', 0.8);
            }

            // Remove shield
            scene.remove(playerShield.mesh);
            playerShield.mesh.geometry.dispose();
            playerShield.mesh.material.dispose();
            playerShield.active = false;
            playerShield.mesh = null;

            console.log('Shield burst! Exploded for ' + def.explosionDamage + ' damage');
        }
    }

    /**
     * Update meteor strikes (animate falling and impact)
     */
    function updateMeteorStrikes(gameState) {
        const { meteorStrikes, enemies, scene, DamageNumberManager, temporaryEffects } = gameState;
        const now = clock.getElapsedTime();
        const def = ABILITY_DEFINITIONS.meteorStrike;

        for (let i = meteorStrikes.length - 1; i >= 0; i--) {
            const meteor = meteorStrikes[i];

            // Animate falling
            if (now >= meteor.fallStartTime && !meteor.hasImpacted) {
                const fallProgress = (now - meteor.fallStartTime) / meteor.fallDuration;

                if (fallProgress >= 1.0) {
                    // Impact!
                    meteor.hasImpacted = true;
                    meteor.mesh.position.y = 0;

                    // Create explosion visual
                    const explosionGeometry = new THREE.SphereGeometry(meteor.impactRadius, 16, 16);
                    const explosionMaterial = new THREE.MeshStandardMaterial({
                        color: def.color,
                        emissive: def.color,
                        emissiveIntensity: 2.0,
                        transparent: true,
                        opacity: 0.8
                    });
                    const explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
                    explosionMesh.position.copy(meteor.impactPosition);
                    explosionMesh.position.y = meteor.impactRadius / 2;
                    scene.add(explosionMesh);

                    temporaryEffects.push({
                        mesh: explosionMesh,
                        startTime: now,
                        duration: 0.3,
                        type: 'explosion'
                    });

                    // Apply damage to enemies in AoE
                    enemies.forEach(enemy => {
                        if (!enemy || !enemy.mesh || enemy.health <= 0) return;

                        const dx = enemy.mesh.position.x - meteor.impactPosition.x;
                        const dz = enemy.mesh.position.z - meteor.impactPosition.z;
                        const distSq = dx * dx + dz * dz;

                        if (distSq <= meteor.impactRadius * meteor.impactRadius) {
                            enemy.health -= meteor.damage;

                            // Visual feedback
                            enemy.hitEffectUntil = now + 0.2;
                            enemy.mesh.material.emissive.setHex(0xFF4500);
                            enemy.mesh.material.emissiveIntensity = 2.0;

                            // Damage number
                            if (DamageNumberManager) {
                                DamageNumberManager.create(enemy.mesh, Math.round(meteor.damage), { isCritical: false });
                            }
                        }
                    });

                    // Play sound
                    if (AudioManager && AudioManager.play) {
                        AudioManager.play('explosion', 0.9);
                    }

                    // Clean up meteor mesh
                    scene.remove(meteor.mesh);
                    meteor.mesh.geometry.dispose();
                    meteor.mesh.material.dispose();
                    // Dispose trail too
                    if (meteor.mesh.children.length > 0) {
                        meteor.mesh.children.forEach(child => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) child.material.dispose();
                        });
                    }

                    meteorStrikes.splice(i, 1);
                    console.log('Meteor impact at: (' + meteor.impactPosition.x.toFixed(1) + ', ' + meteor.impactPosition.z.toFixed(1) + ')');
                } else {
                    // Animate falling (ease in - accelerate)
                    const easedProgress = fallProgress * fallProgress; // Quadratic ease in
                    meteor.mesh.position.y = 450 * (1 - easedProgress);

                    // Keep fixed rotation - no spinning
                }
            }
        }
    }

    /**
     * Update void rifts
     */
    function updateVoidRifts(gameState, delta) {
        const { voidRifts, enemies, scene, DamageNumberManager } = gameState;
        const now = clock.getElapsedTime();

        for (let i = voidRifts.length - 1; i >= 0; i--) {
            const rift = voidRifts[i];
            const age = now - rift.startTime;

            // Remove if expired
            if (age > rift.duration) {
                scene.remove(rift.mesh);
                rift.mesh.geometry.dispose();
                rift.mesh.material.dispose();
                voidRifts.splice(i, 1);
                continue;
            }

            // Animate rift (rotate and pulse)
            rift.mesh.rotation.y += delta * 3;
            rift.mesh.material.opacity = 0.5 + 0.2 * Math.sin(now * 4);

            // Apply pull and damage to enemies in radius
            enemies.forEach(enemy => {
                if (!enemy || !enemy.mesh || enemy.health <= 0) return;

                const dx = enemy.mesh.position.x - rift.position.x;
                const dz = enemy.mesh.position.z - rift.position.y;
                const distSq = dx * dx + dz * dz;

                if (distSq <= rift.radius * rift.radius) {
                    // Pull toward center
                    const pullDirection = new THREE.Vector3(
                        rift.position.x - enemy.mesh.position.x,
                        0,
                        rift.position.y - enemy.mesh.position.z
                    ).normalize().multiplyScalar(rift.pullStrength);

                    enemy.pullForces.add(pullDirection);

                    // Apply damage (0.5s tick interval)
                    if (now - rift.lastDamageTick >= 0.5) {
                        const damage = rift.damagePerSecond * 0.5;
                        enemy.health -= damage;

                        // Visual feedback
                        enemy.hitEffectUntil = now + 0.1;
                        enemy.mesh.material.emissive.setHex(0x4B0082);
                        enemy.mesh.material.emissiveIntensity = 1.0;

                        // Damage number
                        if (DamageNumberManager) {
                            DamageNumberManager.create(enemy.mesh, Math.round(damage), { isCritical: false });
                        }
                    }
                }
            });

            // Update damage tick timer
            if (now - rift.lastDamageTick >= 0.5) {
                rift.lastDamageTick = now;
            }
        }
    }

    /**
     * Update time warps
     */
    function updateTimeWarps(gameState, delta) {
        const { timeWarps, enemies, scene } = gameState;
        const now = clock.getElapsedTime();

        for (let i = timeWarps.length - 1; i >= 0; i--) {
            const warp = timeWarps[i];
            const age = now - warp.startTime;

            // Remove if expired
            if (age > warp.duration) {
                // Restore speed to any affected enemies
                warp.affectedEnemies.forEach(enemy => {
                    if (enemy && enemy.originalSpeed !== undefined) {
                        enemy.speed = enemy.originalSpeed;
                        delete enemy.originalSpeed;
                        delete enemy.inTimeWarp;
                    }
                });

                scene.remove(warp.mesh);
                warp.mesh.geometry.dispose();
                warp.mesh.material.dispose();
                timeWarps.splice(i, 1);
                continue;
            }

            // Animate warp (pulse opacity)
            warp.mesh.material.opacity = 0.3 + 0.2 * Math.sin(now * 3);

            // Apply slow effect to enemies in radius
            enemies.forEach(enemy => {
                if (!enemy || !enemy.mesh || enemy.health <= 0) return;

                const dx = enemy.mesh.position.x - warp.position.x;
                const dz = enemy.mesh.position.z - warp.position.y;
                const distSq = dx * dx + dz * dz;

                const inRange = distSq <= warp.radius * warp.radius;

                if (inRange && !warp.affectedEnemies.has(enemy)) {
                    // Enemy entered warp
                    enemy.originalSpeed = enemy.speed;
                    enemy.speed = enemy.originalSpeed * (1 - warp.slowEffect);
                    enemy.inTimeWarp = true;
                    warp.affectedEnemies.add(enemy);
                } else if (!inRange && warp.affectedEnemies.has(enemy)) {
                    // Enemy left warp
                    if (enemy.originalSpeed !== undefined) {
                        enemy.speed = enemy.originalSpeed;
                        delete enemy.originalSpeed;
                        delete enemy.inTimeWarp;
                    }
                    warp.affectedEnemies.delete(enemy);
                }
            });
        }
    }

    return {
        updateAbilities,
        updateAcidGrenades,
        updateAcidPools,
        updateLightningStrikes,
        updateSpiritWolves,
        updateShieldBurst,
        updateMeteorStrikes,
        updateVoidRifts,
        updateTimeWarps,
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
