/**
 * Ball Collision System
 *
 * Handles collision detection and response for the ball against walls and obstacles.
 * Phase 1: Wall bounce physics
 *
 * Dependencies:
 * - THREE.js: Vector3
 * - Config: constants (arena bounds)
 */

import * as THREE from 'three';
import { ARENA_PLAYABLE_HALF_SIZE } from '../config/constants.js';

export function createBallCollisionSystem(dependencies) {
    const { tiltPhysics } = dependencies;

    // Arena bounds for collision
    const bounds = {
        minX: -ARENA_PLAYABLE_HALF_SIZE,
        maxX: ARENA_PLAYABLE_HALF_SIZE,
        minZ: -ARENA_PLAYABLE_HALF_SIZE,
        maxZ: ARENA_PLAYABLE_HALF_SIZE,
    };

    /**
     * Check and handle wall collisions
     * @returns {boolean} True if collision occurred
     */
    function checkWallCollisions() {
        const ballPos = tiltPhysics.getBallPosition();
        const ballRadius = tiltPhysics.getBallRadius();
        let collided = false;

        // Check X boundaries (East/West walls)
        if (ballPos.x + ballRadius > bounds.maxX) {
            // Hit east wall
            handleWallBounce('east', ballPos, ballRadius);
            collided = true;
        } else if (ballPos.x - ballRadius < bounds.minX) {
            // Hit west wall
            handleWallBounce('west', ballPos, ballRadius);
            collided = true;
        }

        // Check Z boundaries (North/South walls)
        if (ballPos.z + ballRadius > bounds.maxZ) {
            // Hit north wall
            handleWallBounce('north', ballPos, ballRadius);
            collided = true;
        } else if (ballPos.z - ballRadius < bounds.minZ) {
            // Hit south wall
            handleWallBounce('south', ballPos, ballRadius);
            collided = true;
        }

        return collided;
    }

    /**
     * Handle bounce against a wall
     * @param {string} wall - Wall identifier ('north', 'south', 'east', 'west')
     * @param {THREE.Vector3} ballPos - Ball position
     * @param {number} ballRadius - Ball radius
     */
    function handleWallBounce(wall, ballPos, ballRadius) {
        let surfaceNormal;
        const correctedPos = ballPos.clone();

        switch (wall) {
            case 'east':
                // East wall (positive X), normal points inward (-X)
                surfaceNormal = new THREE.Vector3(-1, 0, 0);
                correctedPos.x = bounds.maxX - ballRadius;
                break;

            case 'west':
                // West wall (negative X), normal points inward (+X)
                surfaceNormal = new THREE.Vector3(1, 0, 0);
                correctedPos.x = bounds.minX + ballRadius;
                break;

            case 'north':
                // North wall (positive Z), normal points inward (-Z)
                surfaceNormal = new THREE.Vector3(0, 0, -1);
                correctedPos.z = bounds.maxZ - ballRadius;
                break;

            case 'south':
                // South wall (negative Z), normal points inward (+Z)
                surfaceNormal = new THREE.Vector3(0, 0, 1);
                correctedPos.z = bounds.minZ + ballRadius;
                break;

            default:
                return;
        }

        // Correct position to prevent clipping into wall
        tiltPhysics.setBallPosition(correctedPos);

        // Apply bounce
        tiltPhysics.applyBounce(surfaceNormal);
    }

    /**
     * Check collision with enemies (for bouncing off them)
     * @param {Array} enemies - Array of enemy objects
     * @returns {boolean} True if collision occurred
     */
    function checkEnemyCollisions(enemies) {
        if (!enemies || enemies.length === 0) return false;

        const ballPos = tiltPhysics.getBallPosition();
        const ballRadius = tiltPhysics.getBallRadius();
        let collided = false;

        for (const enemy of enemies) {
            if (!enemy.mesh) continue;

            const enemyPos = enemy.mesh.position;
            const distance = ballPos.distanceTo(enemyPos);
            const collisionDistance = ballRadius + (enemy.radius || 10);

            if (distance < collisionDistance) {
                // Collision detected
                handleEnemyBounce(ballPos, enemyPos, ballRadius, enemy.radius || 10);
                collided = true;
                break; // Only handle one collision per frame
            }
        }

        return collided;
    }

    /**
     * Handle bounce against an enemy
     * @param {THREE.Vector3} ballPos - Ball position
     * @param {THREE.Vector3} enemyPos - Enemy position
     * @param {number} ballRadius - Ball radius
     * @param {number} enemyRadius - Enemy radius
     */
    function handleEnemyBounce(ballPos, enemyPos, ballRadius, enemyRadius) {
        // Calculate collision normal (from enemy to ball)
        const normal = new THREE.Vector3()
            .subVectors(ballPos, enemyPos)
            .normalize();

        // Correct ball position to prevent overlap
        const correctedPos = enemyPos.clone()
            .add(normal.clone().multiplyScalar(ballRadius + enemyRadius));
        correctedPos.y = ballRadius; // Keep on ground

        tiltPhysics.setBallPosition(correctedPos);

        // Apply bounce
        tiltPhysics.applyBounce(normal);
    }

    /**
     * Update collision system (called each frame)
     * @param {Object} gameState - Game state containing enemies, relics, etc.
     */
    function update(gameState) {
        // Check wall collisions
        checkWallCollisions();

        // Check enemy collisions (ball bounces off enemies)
        if (gameState.enemies) {
            checkEnemyCollisions(gameState.enemies);
        }

        // Note: Relics, gems, coins don't cause bounces - ball passes through
        // Contact damage and collection are handled by existing systems
    }

    // ===== Public API =====
    return {
        update,
        checkWallCollisions,
        checkEnemyCollisions,
        handleWallBounce,
        handleEnemyBounce,
    };
}
