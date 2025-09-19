const relicInfo = {
    attackSpeed: { name: 'Octahedron', shape: 'octahedron', health: 500, geometry: new THREE.OctahedronGeometry(24), color: 0x8A2BE2,
        range: 200, cooldown: 2.5, damage: 120 // damage per second for beam
    },
    damage: { name: 'Cannon', shape: 'box', health: 750, geometry: new THREE.BoxGeometry(38, 38, 38), color: 0xFF1493,
        range: 180, cooldown: 3.0, damage: 300, splashDamage: 150, splashRadius: 40
    },
    speed: { name: 'Speed Booster', shape: 'tetrahedron', health: 1000, geometry: new THREE.TetrahedronGeometry(28), color: 0xFF4500,
        range: 100, // Aura range
        buffs: { moveSpeed: 1.3, attackSpeed: 1.3, damage: 1.2 },
        damageTakenMultiplier: 1.5
    },
    vacuum: { name: 'Gravity Well', shape: 'torus', health: 2500, geometry: new THREE.TorusGeometry(20, 8, 16, 100), color: 0x00BFFF,
        range: 150, pullStrength: 0.15, damageTickInterval: 0.5, baseDamage: 3
    },
    crit: { name: 'Multi-Shot', shape: 'icosahedron', health: 1500, geometry: new THREE.IcosahedronGeometry(24), color: 0xFFFF33,
        range: 250, cooldown: 2.5, damage: 175, targets: 7
    },
    luck: { name: 'Precision Striker', shape: 'sphere', health: 2000, geometry: new THREE.SphereGeometry(24, 32, 32), color: 0xFFFFFF,
        range: 200, cooldown: 5.0, duration: 3.0, damagePerSecond: 200, radius: 25
    }
};

const RelicCombatStrategies = {
    attackSpeed: { // Purple Beam
        update(relic, now, delta) {
            const info = relicInfo.attackSpeed;
            if (now - relic.lastActionTime < (info.cooldown / relic.game.gameSpeedMultiplier)) return;

            let nearestEnemy = null;
            let minDistance = info.range;

            const potentialTargets = relic.game.spatialGrid.getNearby({
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
                relic.game.scene.add(beam);
                relic.game.beams.push({ mesh: beam, creationTime: now, start, end, damage: info.damage });

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
                        relic.game.damageNumberManager.create(enemy.mesh, info.damage, { isCritical: false });
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
            if (now - relic.lastActionTime < (info.cooldown / relic.game.gameSpeedMultiplier)) return;

            let nearestEnemy = null;
            let minDistance = info.range;

            const potentialTargets = relic.game.spatialGrid.getNearby({ mesh: { position: relic.relic.position }, radius: minDistance });
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
                const p = relic.game.objectPools.relicProjectiles.get();
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
                relic.game.relicProjectiles.push(p);
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
            relic.nextDamageTick = relic.game.clock.getElapsedTime() + info.damageTickInterval;
            relic.warningTriggered = false;
            relic.gravityEffect = createGravityVortex(relic.relic, 200, info.range * 0.8, info.color, true, relic.game);
        },
        update(relic, now, delta) {
            const info = relicInfo.vacuum;
            const WARNING_LEAD_TIME = 0.25;

            if (!relic.warningTriggered && now >= relic.nextDamageTick - WARNING_LEAD_TIME) {
                AreaWarningManager.create(relic.relic.position, info.range, info.color, WARNING_LEAD_TIME, 'gradient');
                relic.warningTriggered = true;
            }

            const potentialTargets = relic.game.spatialGrid.getNearby({
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
                        relic.game.damageNumberManager.create(enemy.mesh, damage, {});
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
                const effectIndex = relic.game.gravityWellEffects.indexOf(relic.gravityEffect);
                if (effectIndex > -1) {
                    relic.game.gravityWellEffects.splice(effectIndex, 1);
                }
                relic.gravityEffect = null;
            }
        }
    },
    crit: { // Yellow Multi-shot
        update(relic, now, delta) {
            const info = relicInfo.crit;
            if (now - relic.lastActionTime < (info.cooldown / relic.game.gameSpeedMultiplier)) return;

            const potentialTargets = relic.game.spatialGrid.getNearby({ mesh: { position: relic.relic.position }, radius: info.range });
            const validTargets = potentialTargets.filter(e => e.health > 0);

            if (validTargets.length > 0) {
                relic.lastActionTime = now;
                validTargets.sort((a, b) => relic.relic.position.distanceTo(a.mesh.position) - relic.relic.position.distanceTo(b.mesh.position));
                const targetsToShoot = validTargets.slice(0, info.targets);

                for (const target of targetsToShoot) {
                    const p = relic.game.objectPools.relicProjectiles.get();
                    p.mesh.material.color.set(info.color);
                    p.mesh.position.copy(relic.relic.position);
                    p.direction = new THREE.Vector3().subVectors(target.mesh.position, relic.relic.position).normalize();
                    p.speed = 5;
                    p.range = info.range;
                    p.damage = info.damage;
                    p.distanceTraveled = 0;
                    p.type = 'yellow_multishot';
                    relic.game.relicProjectiles.push(p);
                }
            }
        }
    },
    luck: { // White Aura Strike
        update(relic, now, delta) {
            const info = relicInfo.luck;
            if (now - relic.lastActionTime < (info.cooldown / relic.game.gameSpeedMultiplier)) return;

            const potentialTargets = relic.game.spatialGrid.getNearby({ mesh: { position: relic.relic.position }, radius: info.range });

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
                relic.game.scene.add(auraMesh);

                const AURA_DAMAGE_INTERVAL = 1.0;

                relic.game.damagingAuras.push({
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
    }
};

class Relic {
    constructor(scene, game, type, info) {
        this.scene = scene;
        this.game = game;
        this.type = type;
        this.info = info;
        this.relic = null;
        this.ring = null;
        this.light = null;
        this.health = info.health;
        this.maxHealth = info.health;
        this.radius = 24;
        this.state = 'idle';
        this.lastActionTime = 0;
        this.animationProgress = 0;
        this.initialY = this.game.RELIC_SPAWN_Y;
        this.conversionProgress = 0;
        this.lastDamageTick = 0;
        this.loweringSpeed = 0;
        this.nextDamageTick = 0;
        this.warningTriggered = false;

        this.createMesh();
    }

    createMesh() {
        const relicMaterial = new THREE.MeshStandardMaterial({ color: this.info.color, flatShading: true, emissive: this.info.color, emissiveIntensity: 0.5 });
        this.relic = new THREE.Mesh(this.info.geometry, relicMaterial);
        this.relic.castShadow = false;

        this.ring = new THREE.Mesh(
            new THREE.RingGeometry(25, 27, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
        );
        this.ring.rotation.x = -Math.PI / 2;

        this.light = new THREE.PointLight(this.info.color, 2, 200);
        this.light.castShadow = false;

        this.scene.add(this.relic);
        this.scene.add(this.ring);
        this.scene.add(this.light);
    }

    update(now, delta) {
        if (this.state === 'idle' && this.relic.position.distanceTo(this.game.player.playerCone.position) < this.radius) {
            this.state = 'lowering';
            this.loweringSpeed = 50;
        }

        if (this.state === 'lowering') {
            this.relic.position.y -= this.loweringSpeed * delta;
            this.ring.position.y = this.relic.position.y;
            if (this.relic.position.y <= 5) {
                this.relic.position.y = 5;
                this.state = 'converting';
                this.conversionProgress = 0;
            }
        }

        if (this.state === 'converting') {
            const CONVERSION_TIME = 3; // seconds
            this.conversionProgress += delta;
            const progress = this.conversionProgress / CONVERSION_TIME;
            this.ring.material.opacity = 0.5 * (1 - progress);
            this.relic.rotation.y += delta * 2;

            if (this.conversionProgress >= CONVERSION_TIME) {
                this.game.gemCounts[this.type] = (this.game.gemCounts[this.type] || 0) + 1;
                this.game.updateGemCounters();
                this.state = 'converted';
                if (RelicCombatStrategies[this.type] && RelicCombatStrategies[this.type].onActivate) {
                    RelicCombatStrategies[this.type].onActivate(this);
                }
            }
        }

        if (this.state === 'converted') {
            if (RelicCombatStrategies[this.type] && RelicCombatStrategies[this.type].update) {
                RelicCombatStrategies[this.type].update(this, now, delta);
            }
        }

        this.light.position.copy(this.relic.position);
        this.light.position.y += 10;
    }

    spawn(position) {
        this.relic.position.copy(position);
        this.ring.position.set(position.x, 0.1, position.z);
        this.light.position.copy(position);
        this.light.position.y += 10;
    }
}

function spawnRelic(gemType, nearPlayer = true, game) {
    if (game.relics.length >= game.MAX_RELICS) {
        game.relicSpawnQueue.push(gemType);
        return;
    }

    const info = relicInfo[gemType];
    if (!info) {
        console.error(`Invalid relic type to spawn: ${gemType}`);
        return;
    }

    const relic = new Relic(game.scene, game, gemType, info);

    const minDistance = 100;
    const radius = 24; // Use a common radius for spacing check

    let position;
    let tooClose;
    let attempts = 0;

    do {
        tooClose = false;
        // Spawn near player, but not too close
        const spawnRadius = 200 + Math.random() * 200;
        const spawnAngle = Math.random() * Math.PI * 2;
        position = new THREE.Vector3(
            game.player.playerCone.position.x + Math.cos(spawnAngle) * spawnRadius,
            game.RELIC_SPAWN_Y,
            game.player.playerCone.position.z + Math.sin(spawnAngle) * spawnRadius
        );

        // Clamp to world bounds
        position.x = Math.max(-980, Math.min(980, position.x));
        position.z = Math.max(-980, Math.min(980, position.z));


        for (const group of game.relics) {
            const requiredSpacing = minDistance + radius * 2;
            if (position.distanceTo(group.relic.position) < requiredSpacing) {
                tooClose = true;
                break;
            }
        }

        attempts++;
        if (attempts > 50) {
            console.warn(`Could not place relic of type ${gemType} after 50 attempts`);
            // Fallback to random placement
            position = new THREE.Vector3((Math.random() - 0.5) * 980, 120, (Math.random() - 0.5) * 980);
            break;
        }
    } while (tooClose);

    relic.spawn(position);
    game.relics.push(relic);
}

function spawnInitialRelics(game) {
    spawnRelic('attackSpeed', true, game);
    spawnRelic('damage', true, game);
}

function scheduleRelicSpawn(gemType, game) {
    game.relicSpawnQueue.push(gemType);
}



function scheduleRelicSpawn(gemType, game) {
    game.relicSpawnQueue.push(gemType);
}
