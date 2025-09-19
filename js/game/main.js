console.log("Script started");

let game;

document.addEventListener("DOMContentLoaded", () => {
    game = new Game();
});

class Game {
    constructor() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101010);

        this.ambientLight = new THREE.AmbientLight(0x9932CC, 0.3);
        this.scene.add(this.ambientLight);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Ground Plane
        this.planeGeometry = new THREE.PlaneGeometry(2000, 2000);
        this.planeMaterial = new THREE.MeshStandardMaterial({ color: 0xC2B280, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.8 });
        this.plane = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
        this.plane.rotation.x = -Math.PI / 2;
        this.plane.receiveShadow = true;
        this.scene.add(this.plane);

        // Moonlight
        this.moonlight = new THREE.DirectionalLight(0xC0C0C0, 0.3);
        this.moonlight.position.set(0, 100, 100);
        this.scene.add(this.moonlight);

        this.cameraOffset = new THREE.Vector3(0, 200, 80);

        this.player = new Player(this.scene, this);

        this.score = 0;
        this.level = 1;
        this.experience = 0;
        this.experienceToNextLevel = 5;
        this.playerHealth = this.player.stats.maxHealth;
        this.isPlayerHit = false;
        this.hitAnimationTime = 0;
        this.clock = new THREE.Clock();
        this.healthBarShakeUntil = 0;
        this.isGameOver = false;
        this.isGamePaused = false;
        this.INITIAL_ENEMY_COUNT = 10;
        this.accumulatedRegen = 0;
        this.lastRegenNumberTime = 0;

        this.gameSpeedMultiplier = 1.0;
        this.playerScaleMultiplier = 1.0;
        this.BASE_PLAYER_SPEED = 50;
        this.BASE_PLAYER_RADIUS = 1.5;
        this.BASE_ENEMY_PROJECTILE_SPEED = 2.0;
        this.BASE_OCTAHEDRON_COOLDOWN = 2.5;
        this.MAX_ENEMIES_TOTAL = 200;
        this.MAX_BOSSES = 3;
        this.MIN_BOX_RATIO = 0.6;

        this.RELIC_SPAWN_Y = 400;
        this.MAX_RELICS = 20;
        this.relicSpawnQueue = [];
        this.relicPriority = ['luck', 'crit', 'vacuum', 'speed', 'damage', 'attackSpeed']; // White > Yellow > Blue > Green > Red > Purple

        this.maxEnemies = this.INITIAL_ENEMY_COUNT;
        this.animationId;
        this.gemCounts = {};
        this.gemMax = {};
        this.enemyCounts = {};
        this.bossCount = 0;
        this.lastBossSpawnScore = 0;

        // --- Performance Systems ---
        this.spatialGrid = new SpatialGrid(2000, 2000, 100);
        this.damageNumberManager = new DamageNumberManager(this.scene, this);
        this.MAX_PLAYER_SHOTS = 100;
        this.MAX_ENEMY_SHOTS = 150;

        this.trailRenderer = new THREE.TrailRenderer(this.scene, this.camera);
        this.playerTrailMaterial = this.trailRenderer.createMaterial();

        this.MAX_RELIC_PROJECTILES = 50;

        this.objectPools = {
            relicProjectiles: new ObjectPool(() => new RelicProjectile(this.scene, this, new THREE.Vector3(), new THREE.Vector3(), new THREE.Color(0xffffff), 0, 0, 0, 0, 0), this, this.MAX_RELIC_PROJECTILES),
            blasterShots: new ObjectPool(() => new BlasterShot(this.scene, this), this, this.MAX_PLAYER_SHOTS),
            enemyProjectiles: new ObjectPool(() => new EnemyProjectile(this.scene, this, new THREE.Vector3(), new THREE.Vector3()), this, this.MAX_ENEMY_SHOTS),
        };

        this.lastShotTime = 0;

        // Game objects
        this.enemies = [];
        this.skeletons = [];
        this.coins = [];
        this.gems = [];
        this.temporaryEffects = [];
        this.blasterShots = [];
        this.enemyProjectiles = [];
        this.beams = [];
        this.relicProjectiles = [];
        this.gravityWellEffects = [];
        this.damagingAuras = [];
        this.relics = []; // Initialize relics array

        this.playerBuffs = {};
        this.playerIsBoosted = false;

        this.coinSpriteMaterial = new THREE.SpriteMaterial({ color: 0xffd700 });

        this.gemTypes = {
            damage: { color: 0xFF1493, geometry: new THREE.IcosahedronGeometry(3) },
            speed: { color: 0xFF4500, geometry: new THREE.ConeGeometry(3, 5, 4) },
            attackSpeed: { color: 0x8A2BE2, geometry: new THREE.OctahedronGeometry(3) },
            luck: { color: 0xFFFFFF, geometry: new THREE.SphereGeometry(2, 16, 16) },
            vacuum: { color: 0x00BFFF, geometry: new THREE.CylinderGeometry(2, 2, 3, 8) },
            crit: { color: 0xFFFF33, geometry: new THREE.IcosahedronGeometry(3) }
        };

        Object.keys(this.gemTypes).forEach(type => {
            this.gemCounts[type] = 0;
            this.gemMax[type] = 3;
        });

        this.enemyPrototypes = {
            box: {
                geometry: (size) => new THREE.BoxGeometry(size, size, size),
                getMaterial: () => {
                    const materialColor = new THREE.Color().setHSL(0.1 + Math.random() * 0.8, 1, 0.5);
                    return new THREE.MeshStandardMaterial({ color: materialColor, emissive: materialColor, emissiveIntensity: 0.4 });
                },
                baseHealth: 30, healthRand: 40, healthLevelScale: 10,
                baseSpeed: 20, speedLevelScale: 0.02,
                contactDamage: 10,
            },
            shooter: {
                geometry: () => new THREE.TetrahedronGeometry(8), material: new THREE.MeshStandardMaterial({ color: 0x8A2BE2, flatShading: true, emissive: 0x8A2BE2, emissiveIntensity: 0.4 }),
                baseHealth: 20, healthRand: 20, healthLevelScale: 5,
                baseSpeed: 15, speedLevelScale: 0.01,
                contactDamage: 10,
            },
            tank: { // Damage
                geometry: () => new THREE.BoxGeometry(25, 25, 25), material: new THREE.MeshStandardMaterial({ color: 0xFF1493, emissive: 0xFF1493, emissiveIntensity: 0.4 }),
                baseHealth: 120, healthRand: 80, healthLevelScale: 30,
                baseSpeed: 10, speedLevelScale: 0.01,
                contactDamage: 25
            },
            berserker: { // Speed
                geometry: () => new THREE.DodecahedronGeometry(6), material: new THREE.MeshStandardMaterial({ color: 0xFF4500, emissive: 0xFF4500, emissiveIntensity: 0.4 }),
                baseHealth: 1, healthRand: 0, healthLevelScale: 0,
                baseSpeed: 40, speedLevelScale: 0.04,
                contactDamage: 5
            },
            magnetic: {
                geometry: () => new THREE.TorusGeometry(8, 3, 8, 16), material: new THREE.MeshStandardMaterial({ color: 0x00BFFF, emissive: 0x00BFFF, emissiveIntensity: 0.4 }),
                baseHealth: 40, healthRand: 20, healthLevelScale: 8,
                baseSpeed: 15, speedLevelScale: 0.015,
                contactDamage: 10
            },
            elite: {
                geometry: () => new THREE.IcosahedronGeometry(12), material: new THREE.MeshStandardMaterial({ color: 0xFFFF33, emissive: 0xFFFF33, emissiveIntensity: 0.6 }),
                baseHealth: 500, healthRand: 100, healthLevelScale: 50,
                baseSpeed: 10, speedLevelScale: 0.01,
                contactDamage: 40,
            }
        };

        this.ui = new UI(this); // Create UI instance and pass game object

        this.init();
    }

    getAvailableEnemyTypes() {
        let types = ['box'];
        if (this.level >= 2) types.push('shooter');
        if (this.level >= 4) types.push('magnetic');
        if (this.level >= 6) types.push('berserker');
        if (this.level >= 8) types.push('tank');
        return types;
    }

    spawnEnemies() {
        if (this.enemies.length < this.maxEnemies) {
            const availableTypes = this.getAvailableEnemyTypes();
            const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            this.spawnEnemy(type);
        }
    }

    spawnEnemy(type) {
        const proto = this.enemyPrototypes[type];
        if (!proto) {
            console.error(`Unknown enemy type: ${type}`);
            return;
        }

        const size = type === 'box' ? 10 + Math.random() * 10 : 10;
        const material = proto.material || proto.getMaterial();
        const enemy = new Enemy(this.scene, this, proto.geometry(size), material);

        enemy.health = proto.baseHealth + Math.random() * proto.healthRand + this.level * proto.healthLevelScale;
        enemy.speed = proto.baseSpeed + this.level * proto.speedLevelScale;
        enemy.contactDamage = proto.contactDamage;
        enemy.radius = size / 2;
        enemy.type = type;

        const angle = Math.random() * Math.PI * 2;
        const radius = 300 + Math.random() * 300;
        const x = this.player.playerCone.position.x + Math.cos(angle) * radius;
        const z = this.player.playerCone.position.z + Math.sin(angle) * radius;
        enemy.mesh.position.set(x, 5, z);
        this.enemies.push(enemy);
        this.spatialGrid.add(enemy);
    }

    findNearestEnemy() {
        let nearestEnemy = null;
        let minDistance = this.player.stats.attackDistance;

        const nearbyEnemies = this.spatialGrid.getNearby({ mesh: this.player.playerCone });

        for (const enemy of nearbyEnemies) {
            if (enemy.health <= 0) continue;
            const distance = this.player.playerCone.position.distanceTo(enemy.mesh.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestEnemy = enemy;
            }
        }

        return nearestEnemy;
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animate.bind(this));

        if (this.isGameOver) {
            cancelAnimationFrame(this.animationId);
            return;
        }

        if (this.isGamePaused) {
            return;
        }

        const delta = this.clock.getDelta() * this.gameSpeedMultiplier;
        const now = this.clock.getElapsedTime();

        Debug.perf.start('total_frame');

        // Update player position
        this.player.updatePosition(delta);

        // Camera follows player
        this.camera.position.copy(this.player.playerCone.position).add(this.cameraOffset);
        this.camera.lookAt(this.player.playerCone.position);

        // --- Game Logic Updates ---
        Debug.perf.start('game_logic');

        // Update relics
        for (const relic of this.relics) {
            relic.update(now, delta);
        }

        // Update projectiles
        for (let i = this.blasterShots.length - 1; i >= 0; i--) {
            const shot = this.blasterShots[i];
            if (!shot.update(delta, this.enemies, this.damageNumberManager, this.spatialGrid)) {
                this.objectPools.blasterShots.release(shot);
                this.blasterShots.splice(i, 1);
            }
        }

        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.enemyProjectiles[i];
            if (!projectile.update(delta, [this.player], this.damageNumberManager, this.spatialGrid)) {
                this.enemyProjectiles.splice(i, 1);
            }
        }

        for (let i = this.relicProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.relicProjectiles[i];
            if (!projectile.update(delta, this.enemies, this.damageNumberManager, this.spatialGrid)) {
                this.relicProjectiles.splice(i, 1);
            }
        }

        // Update enemies
        this.spatialGrid.clear();
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.health <= 0) {
                // Handle enemy death
                this.score += 10;
                this.experience += 5;
                this.ui.scoreElement.classList.add('score-animated');
                setTimeout(() => this.ui.scoreElement.classList.remove('score-animated'), 300);

                if (Math.random() < 0.5) { // 50% chance to drop a coin
                    this.createCoin(enemy.mesh.position);
                }
                if (Math.random() < 0.2) { // 20% chance to drop a gem
                    this.createGem(enemy.mesh.position);
                }

                this.scene.remove(enemy.mesh);
                this.enemies.splice(i, 1);
                continue;
            }
            enemy.update(delta, this.player.playerCone.position);
            this.spatialGrid.add(enemy);

            // Enemy collision with player
            if (enemy.mesh.position.distanceTo(this.player.playerCone.position) < this.player.stats.playerRadius + enemy.radius) {
                this.playerHealth -= enemy.contactDamage;
                this.healthBarShakeUntil = now + 0.3;
                this.scene.remove(enemy.mesh);
                this.enemies.splice(i, 1);
            }
        }

        // Update UI
        this.ui.update(this.score, this.playerHealth, this.player.stats.maxHealth, this.experience, this.experienceToNextLevel);
        this.ui.updateStats(this.player.stats);

        if (now < this.healthBarShakeUntil) {
            this.ui.healthBarElement.parentElement.classList.add('health-bar-shaking');
        } else {
            this.ui.healthBarElement.parentElement.classList.remove('health-bar-shaking');
        }

        // Game over check
        if (this.playerHealth <= 0 && !this.isGameOver) {
            this.isGameOver = true;
            document.getElementById('reset-button').style.display = 'block';
            AudioManager.play('gameOver');
        }

        // Player shooting
        if (now - this.lastShotTime > this.player.stats.attackSpeed * (1 - this.player.stats.cooldownReduction)) {
            this.lastShotTime = now;
            const nearestEnemy = this.findNearestEnemy();
            if (nearestEnemy) {
                const shot = this.objectPools.blasterShots.get();
                const direction = new THREE.Vector3().subVectors(nearestEnemy.mesh.position, this.player.playerCone.position).normalize();
                shot.reset(this.player.playerCone.position, direction);
                shot.damage = this.player.stats.damage;
                shot.pierceCount = this.player.stats.pierceCount;
                shot.critChance = this.player.stats.critChance;
                shot.critMultiplier = this.player.stats.critMultiplier;
                shot.areaDamageRadius = this.player.stats.areaDamageRadius;
                this.blasterShots.push(shot);
                AudioManager.play('laser', 0.1);
            }
        }

        // Coin and gem collection
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            if (coin.position.distanceTo(this.player.playerCone.position) < this.player.stats.coinPickupRadius) {
                this.score++;
                this.scene.remove(coin);
                this.coins.splice(i, 1);
                AudioManager.play('coin', 0.1);
            }
        }

        for (let i = this.gems.length - 1; i >= 0; i--) {
            const gem = this.gems[i];
            if (gem.position.distanceTo(this.player.playerCone.position) < this.player.stats.pickupRadius) {
                const type = gem.userData.type;
                if (type) {
                    this.gemCounts[type]++;
                    const max = this.gemMax[type] || 3;
                    if (this.gemCounts[type] >= max) {
                        scheduleRelicSpawn(type, this);
                        this.gemCounts[type] = 0;
                        this.gemMax[type] = max + 1;
                    }
                    this.updateGemCounters();
                }
                this.experience++;
                this.scene.remove(gem);
                this.gems.splice(i, 1);
                if (this.experience >= this.experienceToNextLevel) {
                    this.level++;
                    document.getElementById('level').textContent = this.level;
                    this.experience = 0;
                    this.experienceToNextLevel = Math.floor(this.experienceToNextLevel * 1.5);
                    this.playerHealth = this.player.stats.maxHealth;
                    this.ui.showLevelUp();
                }
            }
        }

        

        // Temporary effects
        for (let i = this.temporaryEffects.length - 1; i >= 0; i--) {
            const effect = this.temporaryEffects[i];
            const elapsed = now - effect.startTime;
            if (elapsed >= effect.duration) {
                this.scene.remove(effect.mesh);
                this.temporaryEffects.splice(i, 1);
            } else {
                if (effect.type === 'debris') {
                    effect.mesh.position.addScaledVector(effect.velocity, delta);
                    effect.velocity.y -= 9.8 * delta; // gravity
                } else if (effect.type === 'warning_spark') {
                    effect.mesh.position.addScaledVector(effect.velocity, delta);
                    effect.mesh.material.opacity = 1.0 - (elapsed / effect.duration);
                }
            }
        }

        // Damaging auras
        for (let i = this.damagingAuras.length - 1; i >= 0; i--) {
            const aura = this.damagingAuras[i];
            const elapsed = now - aura.startTime;
            if (elapsed >= aura.duration) {
                this.scene.remove(aura.mesh);
                this.damagingAuras.splice(i, 1);
            } else {
                if (now >= aura.nextDamageTick) {
                    aura.nextDamageTick += 1.0; // Damage interval
                    const nearbyEnemies = this.spatialGrid.getNearby({ mesh: { position: aura.position }, radius: aura.radius });
                    for (const enemy of nearbyEnemies) {
                        if (enemy.health > 0) {
                            const damage = aura.damagePerSecond;
                            enemy.health -= damage;
                            this.damageNumberManager.create(enemy.mesh, damage, {});
                        }
                    }
                }
            }
        }

        // Gravity wells
        for (const well of this.gravityWellEffects) {
            const particles = well.mesh.geometry.attributes.position;
            const velocities = well.mesh.geometry.attributes.velocity;
            for (let i = 0; i < particles.count; i++) {
                const particlePos = new THREE.Vector3().fromBufferAttribute(particles, i);
                const particleVel = new THREE.Vector3().fromBufferAttribute(velocities, i);

                const direction = new THREE.Vector3().subVectors(well.target.position, particlePos).normalize();
                const distance = particlePos.distanceTo(well.target.position);
                const strength = (well.radius - distance) / well.radius;

                particleVel.addScaledVector(direction, strength * 0.1);
                particlePos.add(particleVel);

                particles.setXYZ(i, particlePos.x, particlePos.y, particlePos.z);
            }
            particles.needsUpdate = true;
        }

        // Spawn new enemies and bosses
        if (this.score > this.lastBossSpawnScore + 500) {
            this.lastBossSpawnScore = this.score;
            if (this.bossCount < this.MAX_BOSSES) {
                this.spawnEnemy('elite');
                this.bossCount++;
            }
        }

        if (this.enemies.length < this.maxEnemies) {
            this.spawnEnemies();
        }

        this.trailRenderer.update(this.camera);
        this.damageNumberManager.update();
        AreaWarningManager.update(delta);

        Debug.perf.end('game_logic');

        // --- Rendering ---
        Debug.perf.start('rendering');
        this.renderer.render(this.scene, this.camera);
        Debug.perf.end('rendering');

        Debug.perf.end('total_frame');
        Debug.update(delta);
    }

    createCoin(position) {
        const coin = new THREE.Sprite(this.coinSpriteMaterial);
        coin.position.copy(position);
        coin.position.y = 2;
        this.scene.add(coin);
        this.coins.push(coin);
    }

    createGem(position) {
        const gemTypes = Object.keys(this.gemTypes);
        const type = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        const gemInfo = this.gemTypes[type];
        const gem = new THREE.Mesh(gemInfo.geometry, new THREE.MeshStandardMaterial({ color: gemInfo.color, emissive: gemInfo.color, emissiveIntensity: 0.5 }));
        gem.position.copy(position);
        gem.position.y = 2;
        gem.userData.type = type;
        this.scene.add(gem);
        this.gems.push(gem);
    }

    updateGemCounters() {
        this.ui.updateGemCounters(this.gemCounts, this.gemMax);
    }

    init() {
        Debug.init(this);
        AreaWarningManager.init(this.planeMaterial, this);
        spawnInitialRelics(this);
        this.spawnEnemies();
        this.ui.updateStats(this.player.stats);
        this.updateGemCounters();
        this.animate();
    }
}