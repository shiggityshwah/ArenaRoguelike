/**
 * Relic Combat Strategies System
 * Contains combat behavior logic for each relic type
 * Extracted from index-reference.html (lines ~1641-1904)
 *
 * EXTERNAL DEPENDENCIES (must be passed/injected):
 * - scene: THREE.Scene object for adding visual effects
 * - spatialGrid: SpatialGrid instance for enemy proximity queries
 * - relicInfo: Relic configuration data (from src/config/relicInfo.js)
 * - objectPools: Object containing pooled objects (relicProjectiles)
 * - gameSpeedMultiplier: Current game speed modifier
 * - clock: THREE.Clock for timing
 * - beams: Array of active beam effects
 * - relicProjectiles: Array of active relic projectiles
 * - gravityWellEffects: Array of active gravity well effects
 * - damagingAuras: Array of active damaging aura effects
 * - damageNumberManager: Manager for displaying damage numbers
 * - AudioManager: Audio playback manager
 * - AreaWarningManager: Manager for area warning indicators
 * - createGravityVortex: Function from effects.js
 */

import * as THREE from 'three';

/**
 * RelicCombatStrategies
 *
 * Each strategy defines how a relic type behaves in combat:
 * - update(relic, now, delta): Called every frame to handle combat logic
 * - onActivate(relic): Called when relic becomes active (optional)
 * - onDeactivate(relic): Called when relic is destroyed (optional)
 *
 * @param {Object} dependencies - Object containing all external dependencies
 * @returns {Object} Strategy object with methods for each relic type
 */
export default function createRelicCombatStrategies(dependencies) {
    const {
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
        createGravityVortex,
        getGameSpeedMultiplier,
        getClock
    } = dependencies;

    return {
        attackSpeed: { // Purple Beam
            update(relic, now, delta) {
                const info = relicInfo.attackSpeed;
                const gameSpeedMultiplier = getGameSpeedMultiplier();
                if (now - relic.lastActionTime < (info.cooldown / gameSpeedMultiplier)) return;

                let nearestEnemy = null;
                let minDistance = info.range;

                const potentialTargets = spatialGrid.getNearby({
                    mesh: { position: relic.relic.position },
                    radius: minDistance
                });

                for (const enemy of potentialTargets) {
                    if (!enemy.health || enemy.health <= 0) continue;
                    const distance = relic.relic.position.distanceTo(enemy.mesh.position);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }

                if (nearestEnemy) {
                    relic.lastActionTime = now;

                    const start = relic.relic.position.clone();
                    start.y -= relic.radius * relic.relic.scale.y;
                    const beamDirection = new THREE.Vector3().subVectors(nearestEnemy.mesh.position, start).normalize();
                    const beamLength = 1000;
                    const end = start.clone().addScaledVector(beamDirection, beamLength);

                    const beamThickness = 1.0;
                    const distance = start.distanceTo(end);
                    const beamGeometry = new THREE.CylinderGeometry(beamThickness, beamThickness, distance, 8);
                    const beamMaterial = new THREE.MeshStandardMaterial({
                        color: 0x00ff00,
                        emissive: 0x00ff00,
                        emissiveIntensity: 3,
                        transparent: true,
                        opacity: 0.7,
                        metalness: 0,
                        roughness: 1
                    });
                    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
                    beam.position.copy(start).lerp(end, 0.5);
                    const upVector = new THREE.Vector3(0, 1, 0);
                    beam.quaternion.setFromUnitVectors(upVector, beamDirection);
                    scene.add(beam);
                    beams.push({ mesh: beam, creationTime: now, start, end, damage: info.damage });

                    const segDir = new THREE.Vector3().subVectors(end, start);
                    const segLenSq = segDir.lengthSq();
                    for (const enemy of potentialTargets) {
                        if (!enemy.health || enemy.health <= 0) continue;
                        const enemyPos = enemy.mesh.position.clone();
                        const t = Math.max(0, Math.min(1, enemyPos.clone().sub(start).dot(segDir) / segLenSq));
                        const closestPoint = start.clone().addScaledVector(segDir, t);
                        const distToBeam = enemyPos.distanceTo(closestPoint);
                        if (distToBeam < (enemy.radius + beamThickness)) {
                            enemy.health -= info.damage;
                            damageNumberManager.create(enemy.mesh, info.damage, { isCritical: false });
                            if (enemy.health > 0) {
                                AudioManager.play('hit', 0.3);
                            }
                        }
                    }
                }
            }
        },
        damage: { // Red Cannon
            update(relic, now, delta) {
                const info = relicInfo.damage;
                const gameSpeedMultiplier = getGameSpeedMultiplier();
                if (now - relic.lastActionTime < (info.cooldown / gameSpeedMultiplier)) return;

                let nearestEnemy = null;
                let minDistance = info.range;

                const potentialTargets = spatialGrid.getNearby({ mesh: { position: relic.relic.position }, radius: minDistance });
                for (const enemy of potentialTargets) {
                    if (!enemy.health || enemy.health <= 0) continue;
                    const distance = relic.relic.position.distanceTo(enemy.mesh.position);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }

                if (nearestEnemy) {
                    relic.lastActionTime = now;
                    const p = objectPools.relicProjectiles.get();
                    p.mesh.material.color.set(info.color);
                    p.mesh.position.copy(relic.relic.position);
                    p.direction = new THREE.Vector3().subVectors(nearestEnemy.mesh.position, relic.relic.position).normalize();
                    p.speed = 4;
                    p.range = info.range;
                    p.damage = info.damage;
                    p.distanceTraveled = 0;
                    p.type = 'red_cannon';
                    p.splashDamage = info.splashDamage;
                    p.splashRadius = info.splashRadius;
                    relicProjectiles.push(p);
                }
            }
        },
        speed: { // Green Buff
            onActivate(relic) {
                const info = relicInfo[relic.type];
                if (!info || !info.range) return;

                const auraGeometry = new THREE.SphereGeometry(info.range, 32, 32);
                const auraMaterial = new THREE.MeshBasicMaterial({
                    color: info.color,
                    transparent: true,
                    opacity: 0.15,
                    depthWrite: false
                });
                const aura = new THREE.Mesh(auraGeometry, auraMaterial);
                relic.relic.add(aura);
                relic.auraVisual = aura;
            },
            update(relic, now, delta) {
                // Buff logic is handled globally at the start of the animate loop.
            },
            onDeactivate(relic) {
                if (relic.auraVisual) {
                    relic.relic.remove(relic.auraVisual);
                    relic.auraVisual.geometry.dispose();
                    relic.auraVisual.material.dispose();
                    relic.auraVisual = null;
                }
            }
        },
        vacuum: { // Blue Gravity Well
            onActivate(relic) {
                const info = relicInfo.vacuum;
                const clock = getClock();
                relic.nextDamageTick = clock.getElapsedTime() + info.damageTickInterval;
                relic.warningTriggered = false;
                relic.gravityEffect = createGravityVortex(relic.relic, 200, info.range * 0.8, info.color, true, gravityWellEffects);
            },
            update(relic, now, delta) {
                const info = relicInfo.vacuum;
                const WARNING_LEAD_TIME = 0.25;

                if (!relic.warningTriggered && now >= relic.nextDamageTick - WARNING_LEAD_TIME) {
                    AreaWarningManager.create(relic.relic.position, info.range, info.color, WARNING_LEAD_TIME, 'gradient');
                    relic.warningTriggered = true;
                }

                const potentialTargets = spatialGrid.getNearby({
                    mesh: { position: relic.relic.position },
                    radius: info.range
                });
                for (const enemy of potentialTargets) {
                    if (!enemy.health || enemy.health <= 0) continue;

                    const distance = relic.relic.position.distanceTo(enemy.mesh.position);
                    if (distance < info.range && distance > 35) {
                        const pullDirection = new THREE.Vector3().subVectors(relic.relic.position, enemy.mesh.position).normalize();
                        const proximityFactor = 1.0 - (distance / info.range);
                        const pullStrength = info.pullStrength * Math.pow(proximityFactor, 2);
                        if (!enemy.pullForces) enemy.pullForces = new THREE.Vector3();
                        enemy.pullForces.addScaledVector(pullDirection, pullStrength);
                    }
                }

                if (now >= relic.nextDamageTick) {
                    for (const enemy of potentialTargets) {
                          if (!enemy.health || enemy.health <= 0) continue;
                          const distance = relic.relic.position.distanceTo(enemy.mesh.position);
                          if (distance < info.range) {
                              const proximityFactor = (info.range - distance) / info.range;
                              const damage = info.baseDamage * Math.pow(2, proximityFactor * 3);
                              enemy.health -= damage;
                              damageNumberManager.create(enemy.mesh, damage, {});
                          }
                      }
                    relic.nextDamageTick = now + info.damageTickInterval;
                    relic.warningTriggered = false;
                }
            },
            onDeactivate(relic) {
                if (relic.gravityEffect) {
                    relic.relic.remove(relic.gravityEffect.mesh);
                    relic.gravityEffect.mesh.geometry.dispose();
                    relic.gravityEffect.mesh.material.dispose();
                    const effectIndex = gravityWellEffects.indexOf(relic.gravityEffect);
                    if (effectIndex > -1) {
                        gravityWellEffects.splice(effectIndex, 1);
                    }
                    relic.gravityEffect = null;
                }
            }
        },
        crit: { // Yellow Multi-shot
            update(relic, now, delta) {
                const info = relicInfo.crit;
                const gameSpeedMultiplier = getGameSpeedMultiplier();
                if (now - relic.lastActionTime < (info.cooldown / gameSpeedMultiplier)) return;

                const potentialTargets = spatialGrid.getNearby({ mesh: { position: relic.relic.position }, radius: info.range });
                const validTargets = potentialTargets.filter(e => e.health > 0);

                if (validTargets.length > 0) {
                    relic.lastActionTime = now;
                    validTargets.sort((a, b) => relic.relic.position.distanceTo(a.mesh.position) - relic.relic.position.distanceTo(b.mesh.position));
                    const targetsToShoot = validTargets.slice(0, info.targets);

                    for (const target of targetsToShoot) {
                        const p = objectPools.relicProjectiles.get();
                        p.mesh.material.color.set(info.color);
                        p.mesh.position.copy(relic.relic.position);
                        p.direction = new THREE.Vector3().subVectors(target.mesh.position, relic.relic.position).normalize();
                        p.speed = 5;
                        p.range = info.range;
                        p.damage = info.damage;
                        p.distanceTraveled = 0;
                        p.type = 'yellow_multishot';
                        relicProjectiles.push(p);
                    }
                }
            }
        },
        luck: { // White Aura Strike
            update(relic, now, delta) {
                const info = relicInfo.luck;
                const gameSpeedMultiplier = getGameSpeedMultiplier();
                if (now - relic.lastActionTime < (info.cooldown / gameSpeedMultiplier)) return;

                const potentialTargets = spatialGrid.getNearby({ mesh: { position: relic.relic.position }, radius: info.range });

                let strongestEnemy = null;
                let maxHealth = -1;
                for (const enemy of potentialTargets) {
                    if (enemy.health > 0 && enemy.health > maxHealth) {
                        maxHealth = enemy.health;
                        strongestEnemy = enemy;
                    }
                }

                if (strongestEnemy) {
                    relic.lastActionTime = now;
                    const auraGeometry = new THREE.CylinderGeometry(info.radius, info.radius, 10, 32, 1, true);
                    const auraMaterial = new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, wireframe: true });
                    const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
                    auraMesh.position.copy(strongestEnemy.mesh.position);
                    auraMesh.position.y = 5;
                    scene.add(auraMesh);

                    const AURA_DAMAGE_INTERVAL = 1.0;

                    damagingAuras.push({
                        mesh: auraMesh,
                        position: auraMesh.position.clone(),
                        startTime: now,
                        lastDamageTime: now - 1,
                        duration: info.duration,
                        radius: info.radius,
                        damagePerSecond: info.damagePerSecond,
                        nextDamageTick: now + AURA_DAMAGE_INTERVAL,
                        warningTriggered: false
                    });
                }
            }
        },
        droneSwarm: { // Cyan Drone Swarm
            onActivate(relic) {
                const info = relicInfo.droneSwarm;
                relic.drones = [];

                const angleStep = (Math.PI * 2) / info.droneCount;

                for (let i = 0; i < info.droneCount; i++) {
                    const droneGeometry = new THREE.TetrahedronGeometry(4);
                    const droneMaterial = new THREE.MeshStandardMaterial({
                        color: info.color,
                        emissive: info.color,
                        emissiveIntensity: 0.8,
                        metalness: 0.7,
                        roughness: 0.3
                    });
                    const drone = new THREE.Mesh(droneGeometry, droneMaterial);

                    // Initialize orbit angle
                    drone.userData.orbitAngle = angleStep * i;
                    drone.userData.lastShotTime = 0;

                    scene.add(drone);
                    relic.drones.push(drone);
                }
            },
            update(relic, now, delta) {
                const info = relicInfo.droneSwarm;
                const gameSpeedMultiplier = getGameSpeedMultiplier();
                const rotationRadians = (info.orbitSpeed * Math.PI * delta) / 180;

                if (!relic.drones) return;

                // Update each drone's orbit and shooting
                relic.drones.forEach((drone) => {
                    // Rotate orbit
                    drone.userData.orbitAngle += rotationRadians;
                    const angle = drone.userData.orbitAngle;

                    // Position on circle around relic
                    drone.position.set(
                        relic.relic.position.x + Math.cos(angle) * info.orbitRadius,
                        relic.relic.position.y,
                        relic.relic.position.z + Math.sin(angle) * info.orbitRadius
                    );

                    // Rotate drone to face forward in orbit
                    drone.rotation.y = angle + Math.PI / 2;

                    // Individual drone shooting logic
                    if (now - drone.userData.lastShotTime >= info.cooldown / gameSpeedMultiplier) {
                        const potentialTargets = spatialGrid.getNearby({
                            mesh: { position: drone.position },
                            radius: info.range
                        });

                        // Find nearest enemy to THIS drone
                        let nearestEnemy = null;
                        let minDistance = info.range;
                        for (const enemy of potentialTargets) {
                            if (!enemy.health || enemy.health <= 0) continue;
                            const distance = drone.position.distanceTo(enemy.mesh.position);
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestEnemy = enemy;
                            }
                        }

                        if (nearestEnemy) {
                            drone.userData.lastShotTime = now;

                            // Create projectile from drone position
                            const p = objectPools.relicProjectiles.get();
                            p.mesh.material.color.set(info.color);
                            p.mesh.position.copy(drone.position);
                            p.direction = new THREE.Vector3()
                                .subVectors(nearestEnemy.mesh.position, drone.position)
                                .normalize();
                            p.speed = 5;
                            p.range = info.range;
                            p.damage = info.droneDamage;
                            p.distanceTraveled = 0;
                            p.type = 'drone_shot';
                            relicProjectiles.push(p);
                        }
                    }
                });
            },
            onDeactivate(relic) {
                if (relic.drones) {
                    relic.drones.forEach(drone => {
                        scene.remove(drone);
                        drone.geometry.dispose();
                        drone.material.dispose();
                    });
                    relic.drones = [];
                }
            }
        }
    };
}
