/**
 * Visual effects system for explosions, debris, and particle effects
 */

import * as THREE from 'three';

/**
 * Creates an explosion visual effect at the specified position
 * @param {THREE.Vector3} position - The position to create the explosion
 * @param {number} radius - The radius of the explosion sphere
 * @param {THREE.Scene} scene - The scene to add the explosion to
 * @param {Array} temporaryEffects - Array to track temporary effects for cleanup
 * @param {THREE.Clock} clock - Clock for timing the effect duration
 *
 * Dependencies:
 * - scene: THREE.Scene object to add the explosion mesh
 * - temporaryEffects: Array that tracks temporary effect objects
 * - clock: THREE.Clock for getting elapsed time
 */
export function createExplosion(position, radius, scene, temporaryEffects, clock) {
    if (radius <= 0) return;

    const explosionGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffa500, // Orange
        transparent: true,
        opacity: 0.8
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(position);
    scene.add(explosion);

    temporaryEffects.push({
        mesh: explosion,
        startTime: clock.getElapsedTime(),
        duration: 0.3, // 300ms
        type: 'explosion'
    });
}

/**
 * Creates debris particles that scatter from a position
 * @param {THREE.Vector3} position - The position to spawn debris from
 * @param {number} color - The color of the debris (hex value)
 * @param {number} radius - Controls the spread and amount of debris
 * @param {THREE.Scene} scene - The scene to add debris to
 * @param {Array} temporaryEffects - Array to track temporary effects for cleanup
 * @param {THREE.Clock} clock - Clock for timing the effect duration
 *
 * Dependencies:
 * - scene: THREE.Scene object to add debris meshes
 * - temporaryEffects: Array that tracks temporary effect objects with velocity
 * - clock: THREE.Clock for getting elapsed time
 */
export function createDebris(position, color, radius, scene, temporaryEffects, clock) {
    const debrisCount = Math.floor(radius / 3);

    for (let i = 0; i < debrisCount; i++) {
        const debrisGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const debrisMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true
        });
        const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);

        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius * 0.5;
        debris.position.copy(position).add(
            new THREE.Vector3(
                Math.cos(angle) * r,
                0.1,
                Math.sin(angle) * r
            )
        );

        scene.add(debris);
        temporaryEffects.push({
            mesh: debris,
            startTime: clock.getElapsedTime(),
            duration: 0.5 + Math.random() * 0.5,
            type: 'debris',
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                Math.random() * 20,
                (Math.random() - 0.5) * 15
            )
        });
    }
}

/**
 * Creates a gravity vortex particle effect attached to a parent object
 * @param {THREE.Object3D} parentObject - The object to attach the vortex to
 * @param {number} particleCount - Number of particles in the vortex
 * @param {number} radius - Maximum radius of the vortex
 * @param {number} color - Color of the particles (hex value)
 * @param {boolean} isParentRotated - Whether the parent object is rotated
 * @param {Array} gravityWellEffects - Array to track gravity well effects
 * @returns {Object} The created effect object with mesh, parent, and parameters
 *
 * Dependencies:
 * - gravityWellEffects: Array that tracks active gravity well effects for animation
 *
 * The effect object structure:
 * {
 *   mesh: THREE.Points - The particle system
 *   parent: THREE.Object3D - The parent object
 *   initialRadius: number - The starting radius
 *   isRotated: boolean - Rotation state flag
 * }
 */
export function createGravityVortex(
    parentObject,
    particleCount,
    radius,
    color,
    isParentRotated = false,
    gravityWellEffects
) {
    const particlesGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3); // x: angular velocity, y: current radius, z: y-velocity

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const angle = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * (radius - 5); // Start away from center
        const y = (Math.random() - 0.5) * 10;

        positions[i3] = Math.cos(angle) * r;
        positions[i3 + 1] = y;
        positions[i3 + 2] = Math.sin(angle) * r;

        velocities[i3] = (Math.random() * 0.5 + 0.5) * 0.02; // angular speed
        velocities[i3 + 1] = r; // current radius
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.2; // y-bobbing speed
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: color,
        size: 1.5,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particles = new THREE.Points(particlesGeometry, particleMaterial);
    parentObject.add(particles);

    const effect = {
        mesh: particles,
        parent: parentObject,
        initialRadius: radius,
        isRotated: isParentRotated
    };
    gravityWellEffects.push(effect);
    return effect;
}

/**
 * Updates gravity vortex particle effects
 * @param {Array} gravityWellEffects - Array of gravity well effect objects
 * @param {number} delta - Time delta for animation
 *
 * Note: This function animates particles in a spiraling pattern toward the center.
 * It should be called every frame from the main animation loop.
 */
export function updateGravityVortexEffects(gravityWellEffects, delta) {
    for (const effect of gravityWellEffects) {
        const positions = effect.mesh.geometry.attributes.position.array;
        const velocities = effect.mesh.geometry.attributes.velocity.array;
        const particleCount = positions.length / 3;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const angularVel = velocities[i3];
            let r = velocities[i3 + 1];
            const yVel = velocities[i3 + 2];

            // Get current angle
            let angle = Math.atan2(positions[i3 + 2], positions[i3]);
            angle += angularVel;

            // Pull toward center
            r = Math.max(2, r - delta * 5);

            // Update position
            positions[i3] = Math.cos(angle) * r;
            positions[i3 + 1] += yVel * delta * 10;
            positions[i3 + 2] = Math.sin(angle) * r;

            // Y-bobbing bounds
            if (Math.abs(positions[i3 + 1]) > 5) {
                velocities[i3 + 2] *= -1;
            }

            // Reset particle if it reaches center
            if (r <= 2.5) {
                const newAngle = Math.random() * Math.PI * 2;
                const newR = 5 + Math.random() * (effect.initialRadius - 5);
                positions[i3] = Math.cos(newAngle) * newR;
                positions[i3 + 1] = (Math.random() - 0.5) * 10;
                positions[i3 + 2] = Math.sin(newAngle) * newR;
                r = newR;
            }

            velocities[i3 + 1] = r;
        }

        effect.mesh.geometry.attributes.position.needsUpdate = true;
    }
}

/**
 * Updates temporary effects (explosions, debris) and removes expired ones
 * @param {Array} temporaryEffects - Array of temporary effect objects
 * @param {THREE.Clock} clock - Clock for getting current time
 * @param {THREE.Scene} scene - Scene to remove effects from
 * @param {number} delta - Time delta for physics updates
 *
 * Note: This function handles both animation and cleanup of temporary effects.
 * Should be called every frame from the main animation loop.
 */
export function updateTemporaryEffects(temporaryEffects, clock, scene, delta) {
    const currentTime = clock.getElapsedTime();
    const gravity = -50; // Gravity constant for debris

    for (let i = temporaryEffects.length - 1; i >= 0; i--) {
        const effect = temporaryEffects[i];
        const elapsed = currentTime - effect.startTime;
        const progress = elapsed / effect.duration;

        if (progress >= 1.0) {
            // Effect has expired, clean up
            scene.remove(effect.mesh);
            effect.mesh.geometry.dispose();
            effect.mesh.material.dispose();
            temporaryEffects.splice(i, 1);
            continue;
        }

        // Update effect based on type or custom callback
        if (effect.onUpdate) {
            // Custom update function provided
            effect.onUpdate(effect, progress);
        } else if (effect.type === 'explosion') {
            // Fade out and expand
            effect.mesh.material.opacity = 0.8 * (1.0 - progress);
            const scale = 1.0 + progress * 0.5;
            effect.mesh.scale.set(scale, scale, scale);
        } else if (effect.type === 'debris') {
            // Physics for debris
            if (effect.velocity) {
                effect.velocity.y += gravity * delta;
                effect.mesh.position.add(
                    effect.velocity.clone().multiplyScalar(delta)
                );
                effect.mesh.rotation.x += delta * 10;
                effect.mesh.rotation.y += delta * 10;
            }
            // Fade out
            effect.mesh.material.opacity = 1.0 - progress;
        }
    }
}
