/**
 * Utility helper functions
 */

import * as THREE from 'three';

/**
 * Clamps a value between a minimum and maximum
 * @param {number} value - The value to clamp
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 * @returns {number} The clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Maximum length for trail renderer
 */
export const TRAIL_MAX_LENGTH = 8;

/**
 * Updates a trail head's geometry based on its core trail data
 * @param {Object} trailHead - Object containing trail, trailCore, and target
 * @param {THREE.Camera} camera - Camera for view-dependent trail orientation
 *
 * Note: This function requires access to the camera object from the scene
 */
export function updateTrail(trailHead, camera) {
    const trail = trailHead.trail;
    const trailCore = trailHead.trailCore;
    const vertices = trail.geometry.attributes.position.array;
    const uvs = trail.geometry.attributes.uv.array;
    const trailVertices = trailCore.vertices;
    const trailLength = trailCore.length;
    const trailWidth = trail.material.uniforms.trailWidth.value;

    if (trailLength < 2) {
        // Not enough points to form a segment, hide the geometry
        for (let i = 0; i < vertices.length; i++) {
            vertices[i] = 0;
        }
        trail.geometry.attributes.position.needsUpdate = true;
        return;
    }

    const viewVector = new THREE.Vector3();
    let lastPoint, currentPoint, direction, up, offset;
    let vertexIndex = 0;
    let uvIndex = 0;

    for (let i = 0; i < trailLength; i++) {
        currentPoint = trailVertices[i];
        lastPoint = (i > 0) ? trailVertices[i - 1] : currentPoint;

        viewVector.subVectors(camera.position, currentPoint);
        direction = new THREE.Vector3().subVectors(currentPoint, lastPoint).normalize();
        up = new THREE.Vector3().crossVectors(direction, viewVector).normalize();
        offset = up.multiplyScalar(trailWidth / 2 * (1.0 - i / trailLength)); // Taper the trail

        vertices[vertexIndex++] = currentPoint.x + offset.x;
        vertices[vertexIndex++] = currentPoint.y + offset.y;
        vertices[vertexIndex++] = currentPoint.z + offset.z;

        vertices[vertexIndex++] = currentPoint.x - offset.x;
        vertices[vertexIndex++] = currentPoint.y - offset.y;
        vertices[vertexIndex++] = currentPoint.z - offset.z;

        const uv = i / (trailLength - 1);
        uvs[uvIndex++] = uv;
        uvs[uvIndex++] = 0;

        uvs[uvIndex++] = uv;
        uvs[uvIndex++] = 1;
    }

    // Hide the rest of the geometry
    for (let i = vertexIndex; i < vertices.length; i++) {
        vertices[i] = trailVertices[trailLength - 1].x;
    }

    trail.geometry.attributes.position.needsUpdate = true;
    trail.geometry.attributes.uv.needsUpdate = true;
}

/**
 * Creates a trail mesh with buffer geometry
 * @param {THREE.ShaderMaterial} material - The material to use for the trail
 * @param {THREE.Scene} scene - The scene to add the trail to
 * @returns {THREE.Mesh} The created trail mesh
 *
 * Note: This function requires the scene object to add the trail
 */
export function createTrail(material, scene) {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(TRAIL_MAX_LENGTH * 2 * 3);
    const uvs = new Float32Array(TRAIL_MAX_LENGTH * 2 * 2);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const trail = new THREE.Mesh(geometry, material);
    trail.dynamic = true;
    trail.frustumCulled = false;
    scene.add(trail);
    return trail;
}

/**
 * Generates a random number within a range
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random number between min and max
 */
export function randomInRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Linear interpolation between two values
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Constrains a position to within bounds
 * @param {THREE.Vector3} position - The position to constrain
 * @param {number} bounds - The boundary limit (assumes square bounds)
 * @returns {THREE.Vector3} The constrained position
 */
export function constrainToBounds(position, bounds) {
    position.x = clamp(position.x, -bounds, bounds);
    position.z = clamp(position.z, -bounds, bounds);
    return position;
}
