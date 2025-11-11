/**
 * Tilt Physics System
 *
 * Handles ground tilt mechanics and ball physics for marble-style movement.
 * Phase 1: Core tilt + ball physics implementation
 *
 * Dependencies:
 * - THREE.js: Vector2, Vector3, Quaternion
 * - Config: physicsConstants
 */

import * as THREE from 'three';
import { TILT_CONFIG, BALL_CONFIG, COLLISION_CONFIG } from '../config/physicsConstants.js';

export function createTiltPhysicsSystem(dependencies) {
    const { scene, groundPlane } = dependencies;

    // ===== Tilt State =====
    const tiltState = {
        angle: 0,                           // Current tilt angle in degrees
        targetAngle: 0,                     // Target tilt angle
        direction: new THREE.Vector2(0, 0), // Tilt direction (normalized)
        targetDirection: new THREE.Vector2(0, 0),
    };

    // ===== Ball State =====
    const ballState = {
        position: new THREE.Vector3(0, BALL_CONFIG.radius, 0),
        velocity: new THREE.Vector2(0, 0),  // 2D velocity on XZ plane
        rotation: new THREE.Quaternion(),   // Visual rotation
        angularVelocity: new THREE.Vector3(0, 0, 0),
    };

    // Create ball mesh
    const ballMesh = createBallMesh();
    scene.add(ballMesh);

    /**
     * Create the ball mesh
     */
    function createBallMesh() {
        const geometry = new THREE.SphereGeometry(BALL_CONFIG.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: BALL_CONFIG.color,
            metalness: BALL_CONFIG.metalness,
            roughness: BALL_CONFIG.roughness,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.copy(ballState.position);

        return mesh;
    }

    /**
     * Update tilt state based on input
     * @param {Object} inputVector - {x, y, magnitude} from input system
     * @param {number} delta - Frame delta time
     */
    function updateTilt(inputVector, delta) {
        // Calculate target tilt
        if (inputVector.magnitude > 0) {
            // Input active - calculate target tilt
            const scaledMagnitude = inputVector.magnitude * getTiltScale(inputVector.modifiers);
            tiltState.targetAngle = TILT_CONFIG.maxTiltAngle * scaledMagnitude;
            tiltState.targetDirection.set(inputVector.x, inputVector.y).normalize();
        } else {
            // No input - return to neutral
            tiltState.targetAngle = 0;
            // Keep direction for smooth interpolation
        }

        // Interpolate current tilt toward target
        const interpSpeed = (tiltState.targetAngle > 0) ? TILT_CONFIG.tiltSpeed : TILT_CONFIG.returnSpeed;
        const lerpFactor = Math.min(1.0, interpSpeed * delta * 10); // Scale by 10 for reasonable speed

        tiltState.angle = THREE.MathUtils.lerp(tiltState.angle, tiltState.targetAngle, lerpFactor);

        if (tiltState.targetAngle > 0) {
            tiltState.direction.lerp(tiltState.targetDirection, lerpFactor);
        }

        // Apply tilt to ground plane
        applyTiltToGround();
    }

    /**
     * Get tilt scale based on modifiers (shift/space)
     */
    function getTiltScale(modifiers = {}) {
        if (modifiers.shift) return TILT_CONFIG.keyboardFullTilt;
        if (modifiers.space) return TILT_CONFIG.keyboardQuarterTilt;
        return TILT_CONFIG.keyboardHalfTilt;
    }

    /**
     * Apply current tilt to ground plane mesh
     */
    function applyTiltToGround() {
        if (!groundPlane) return;

        const angleRad = tiltState.angle * (Math.PI / 180);

        // Calculate rotation axis perpendicular to tilt direction
        // Tilt direction is in XZ plane, rotation axis is perpendicular in XZ
        const rotationAxis = new THREE.Vector3(
            -tiltState.direction.y,  // Perpendicular X
            0,
            tiltState.direction.x    // Perpendicular Z
        ).normalize();

        // Apply rotation
        groundPlane.rotation.set(0, 0, 0); // Reset first
        groundPlane.rotateOnAxis(rotationAxis, angleRad);
    }

    /**
     * Update ball physics
     * @param {number} delta - Frame delta time
     */
    function updateBallPhysics(delta) {
        // 1. Calculate gravity force from current tilt
        const gravityForce = calculateGravityFromTilt();

        // 2. Update velocity
        ballState.velocity.x += gravityForce.x * delta;
        ballState.velocity.y += gravityForce.y * delta;

        // 3. Apply friction
        applyFriction(delta);

        // 4. Clamp to max speed (optional)
        if (BALL_CONFIG.maxSpeed > 0) {
            const speed = ballState.velocity.length();
            if (speed > BALL_CONFIG.maxSpeed) {
                ballState.velocity.normalize().multiplyScalar(BALL_CONFIG.maxSpeed);
            }
        }

        // 5. Update position
        ballState.position.x += ballState.velocity.x * delta * 60; // Scale by 60 for units/second
        ballState.position.z += ballState.velocity.y * delta * 60; // velocity.y is Z axis

        // 6. Update visual rotation
        updateBallRotation(delta);

        // 7. Update mesh position
        ballMesh.position.copy(ballState.position);
        ballMesh.quaternion.copy(ballState.rotation);
    }

    /**
     * Calculate gravity force from current tilt
     * @returns {THREE.Vector2} Gravity force vector
     */
    function calculateGravityFromTilt() {
        const angleRad = tiltState.angle * (Math.PI / 180);
        const gravityMagnitude = Math.sin(angleRad) * BALL_CONFIG.gravityStrength;

        return new THREE.Vector2(
            tiltState.direction.x * gravityMagnitude,
            tiltState.direction.y * gravityMagnitude
        );
    }

    /**
     * Apply threshold-based friction
     * @param {number} delta - Frame delta time
     */
    function applyFriction(delta) {
        const speed = ballState.velocity.length();

        if (speed < 0.01) {
            // Stop completely if very slow
            ballState.velocity.set(0, 0);
            return;
        }

        // Choose friction based on speed threshold
        const friction = (speed > BALL_CONFIG.frictionThreshold)
            ? BALL_CONFIG.lowFriction
            : BALL_CONFIG.highFriction;

        // Apply friction
        const frictionMultiplier = Math.max(0, 1.0 - friction * delta * 10);
        ballState.velocity.multiplyScalar(frictionMultiplier);
    }

    /**
     * Update ball visual rotation based on velocity
     * @param {number} delta - Frame delta time
     */
    function updateBallRotation(delta) {
        const speed = ballState.velocity.length();

        if (speed < 0.1) {
            // Not rolling, don't update rotation
            return;
        }

        // Calculate rotation axis perpendicular to velocity
        // Velocity is in XZ plane (velocity.x = X, velocity.y = Z)
        const velocityDir3D = new THREE.Vector3(
            ballState.velocity.x,
            0,
            ballState.velocity.y
        ).normalize();

        // Rotation axis is perpendicular to velocity (cross with up vector)
        const rotationAxis = new THREE.Vector3(0, 1, 0).cross(velocityDir3D).normalize();

        // Angular velocity = linear velocity / radius
        const angularSpeed = speed / BALL_CONFIG.radius;

        // Create rotation quaternion for this frame
        const rotationDelta = new THREE.Quaternion();
        rotationDelta.setFromAxisAngle(rotationAxis, angularSpeed * delta * 60);

        // Apply rotation
        ballState.rotation.multiplyQuaternions(rotationDelta, ballState.rotation);
        ballState.rotation.normalize();
    }

    /**
     * Apply bounce to ball velocity
     * @param {THREE.Vector3} surfaceNormal - Surface normal (3D)
     */
    function applyBounce(surfaceNormal) {
        // Convert velocity to 3D for reflection
        const velocity3D = new THREE.Vector3(
            ballState.velocity.x,
            0,
            ballState.velocity.y
        );

        // Reflect velocity across surface normal
        const reflectedVelocity = velocity3D.reflect(surfaceNormal);

        // Apply energy loss
        reflectedVelocity.multiplyScalar(COLLISION_CONFIG.bounceRetention);

        // Convert back to 2D
        ballState.velocity.set(reflectedVelocity.x, reflectedVelocity.z);

        // Stop if too slow
        if (ballState.velocity.length() < COLLISION_CONFIG.minBounceSpeed) {
            ballState.velocity.set(0, 0);
        }
    }

    /**
     * Set ball position (for respawn, etc.)
     * @param {THREE.Vector3} position - New position
     */
    function setBallPosition(position) {
        ballState.position.copy(position);
        ballState.position.y = BALL_CONFIG.radius; // Ensure on ground
        ballState.velocity.set(0, 0);
        ballMesh.position.copy(ballState.position);
    }

    /**
     * Reset ball state
     */
    function resetBall() {
        ballState.position.set(0, BALL_CONFIG.radius, 0);
        ballState.velocity.set(0, 0);
        ballState.rotation.set(0, 0, 0, 1);
        ballMesh.position.copy(ballState.position);
        ballMesh.quaternion.copy(ballState.rotation);
    }

    /**
     * Update ball radius (for debug tuning)
     */
    function updateBallRadius(newRadius) {
        BALL_CONFIG.radius = newRadius;

        // Update geometry
        ballMesh.geometry.dispose();
        ballMesh.geometry = new THREE.SphereGeometry(newRadius, 32, 32);

        // Update position Y
        ballState.position.y = newRadius;
        ballMesh.position.y = newRadius;
    }

    // ===== Public API =====
    return {
        // State accessors
        getBallPosition: () => ballState.position.clone(),
        getBallVelocity: () => ballState.velocity.clone(),
        getBallRadius: () => BALL_CONFIG.radius,
        getBallMesh: () => ballMesh,
        getTiltAngle: () => tiltState.angle,
        getTiltDirection: () => tiltState.direction.clone(),

        // Update functions
        updateTilt,
        updateBallPhysics,
        applyBounce,

        // Utility functions
        setBallPosition,
        resetBall,
        updateBallRadius,

        // State objects (for direct access if needed)
        tiltState,
        ballState,
    };
}
