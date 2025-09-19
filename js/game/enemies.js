class Enemy {
    constructor(scene, game, geometry, material) {
        this.scene = scene;
        this.game = game;
        this.mesh = new THREE.Mesh(geometry, material);
        this.health = 0;
        this.speed = 0;
        this.contactDamage = 0;
        this.radius = 0;
        this.pullForces = new THREE.Vector3();
        this.scene.add(this.mesh);
    }

    update(delta, playerPosition) {
        if (this.health <= 0) {
            return false; // Signal to remove from array
        }

        const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(direction, this.speed * delta);
        this.mesh.position.add(this.pullForces);
        this.pullForces.set(0, 0, 0);

        return true;
    }
}
