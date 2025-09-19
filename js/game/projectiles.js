class Projectile {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.mesh = null;
        this.direction = new THREE.Vector3();
        this.speed = 0;
        this.range = 0;
        this.distanceTraveled = 0;
        this.active = false;
    }

    reset(startPosition, direction) {
        this.mesh.position.copy(startPosition);
        this.direction.copy(direction);
        this.distanceTraveled = 0;
        this.active = true;
        this.pierceCount = 1;
        this.hitEnemies = [];
    }

    update(delta, enemies, damageNumberManager, spatialGrid) {
        if (!this.active) return false;

        const travelDistance = this.speed * delta;
        this.mesh.position.addScaledVector(this.direction, travelDistance);
        this.distanceTraveled += travelDistance;

        if (this.distanceTraveled > this.range) {
            this.active = false;
            return false;
        }

        const nearbyEnemies = spatialGrid.getNearby({ mesh: this.mesh, radius: 10 });

        for (const enemy of nearbyEnemies) {
            if (enemy.health > 0 && !this.hitEnemies.includes(enemy)) {
                if (this.mesh.position.distanceTo(enemy.mesh.position) < enemy.radius) {
                    const isCritical = Math.random() < this.critChance;
                    const damage = isCritical ? this.damage * this.critMultiplier : this.damage;
                    enemy.health -= damage;
                    damageNumberManager.create(enemy.mesh, damage, { isCritical });

                    this.hitEnemies.push(enemy);
                    this.pierceCount--;

                    if (this.pierceCount <= 0) {
                        this.active = false;
                        return false;
                    }
                }
            }
        }

        return true;
    }
}

class BlasterShot extends Projectile {
    constructor(scene, game) {
        super(scene, game);
        this.speed = 150;
        this.range = 500;
        this.damage = 30;
        this.critChance = 0.05;
        this.critMultiplier = 2;
        this.pierceCount = 1;
        this.hitEnemies = [];

        this.createMesh();
    }

    createMesh() {
        const geometry = new THREE.SphereGeometry(0.8, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
    }
}

class EnemyProjectile extends Projectile {
    constructor(scene, game, startPosition, direction) {
        super(scene, game, startPosition, direction, 2, 100);
        this.damage = 10; // Example damage
    }

    createMesh(startPosition) {
        const geometry = new THREE.SphereGeometry(1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPosition);
        this.scene.add(this.mesh);
    }
}

class RelicProjectile extends Projectile {
    constructor(scene, game, startPosition, direction, color, speed, range, damage, splashDamage, splashRadius) {
        super(scene, game, startPosition, direction, speed, range);
        this.damage = damage;
        this.splashDamage = splashDamage;
        this.splashRadius = splashRadius;
        this.color = color;
    }

    createMesh(startPosition) {
        const geometry = new THREE.SphereGeometry(1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPosition);
        this.scene.add(this.mesh);
    }
}
