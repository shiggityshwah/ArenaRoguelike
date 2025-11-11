/**
 * Physics Constants for Tilt-Based Ball Movement System
 *
 * Phase 1: Core Tilt + Ball Physics
 * All parameters exposed for tuning via debug panel
 */

// ===== Tilt Parameters =====
export const TILT_CONFIG = {
    // Maximum ground tilt angle in degrees
    maxTiltAngle: 15.0,

    // Speed of tilt application (interpolation multiplier)
    tiltSpeed: 1.0,

    // Speed of return to neutral (faster than tilt)
    returnSpeed: 2.0,

    // Tilt magnitude modifiers for keyboard
    keyboardHalfTilt: 0.5,      // WASD alone
    keyboardFullTilt: 1.0,      // WASD + Shift
    keyboardQuarterTilt: 0.25,  // WASD + Space
};

// ===== Ball Physics Parameters =====
export const BALL_CONFIG = {
    // Ball size
    radius: 17.5,

    // Gravity strength (acceleration from tilt)
    gravityStrength: 1.5,

    // Friction coefficients
    lowFriction: 0.05,          // When velocity > threshold
    highFriction: 0.35,         // When velocity < threshold
    frictionThreshold: 2.0,     // Speed threshold for friction switch

    // Velocity limits
    maxSpeed: 10.0,             // Maximum ball velocity (0 = unlimited)

    // Visual properties
    metalness: 0.8,
    roughness: 0.3,
    color: 0xE0E0E0,            // Light silver/marble
};

// ===== Collision Parameters =====
export const COLLISION_CONFIG = {
    // Bounce physics
    bounceRetention: 0.5,       // Velocity retained on bounce (0.4-0.6)
    minBounceSpeed: 0.5,        // Minimum speed to bounce (below this, stop)
};

// ===== Camera Parameters =====
export const CAMERA_CONFIG = {
    // Camera tilt follow
    cameraTiltFactor: 0.4,      // Camera tilt follow amount (0=none, 1=full)
};

// ===== Debug/Testing Parameters =====
export const DEBUG_PHYSICS = {
    // Enable physics debug visualizations
    showVelocityVector: false,
    showTiltDirection: false,
    showCollisionNormals: false,
};

/**
 * Get all tunable physics parameters as a flat object
 * Used by debug panel for slider generation
 */
export function getAllPhysicsParams() {
    return {
        // Tilt
        'tilt.maxTiltAngle': { value: TILT_CONFIG.maxTiltAngle, min: 5, max: 25, step: 0.5 },
        'tilt.tiltSpeed': { value: TILT_CONFIG.tiltSpeed, min: 0.1, max: 2.0, step: 0.1 },
        'tilt.returnSpeed': { value: TILT_CONFIG.returnSpeed, min: 0.1, max: 3.0, step: 0.1 },

        // Ball Physics
        'ball.radius': { value: BALL_CONFIG.radius, min: 5, max: 30, step: 0.5 },
        'ball.gravityStrength': { value: BALL_CONFIG.gravityStrength, min: 0.1, max: 5.0, step: 0.1 },
        'ball.lowFriction': { value: BALL_CONFIG.lowFriction, min: 0.01, max: 0.2, step: 0.01 },
        'ball.highFriction': { value: BALL_CONFIG.highFriction, min: 0.2, max: 0.5, step: 0.01 },
        'ball.frictionThreshold': { value: BALL_CONFIG.frictionThreshold, min: 0.5, max: 5.0, step: 0.1 },
        'ball.maxSpeed': { value: BALL_CONFIG.maxSpeed, min: 0, max: 20, step: 0.5 },

        // Collision
        'collision.bounceRetention': { value: COLLISION_CONFIG.bounceRetention, min: 0.1, max: 0.9, step: 0.05 },
        'collision.minBounceSpeed': { value: COLLISION_CONFIG.minBounceSpeed, min: 0.1, max: 2.0, step: 0.1 },

        // Camera
        'camera.cameraTiltFactor': { value: CAMERA_CONFIG.cameraTiltFactor, min: 0.0, max: 1.0, step: 0.05 },
    };
}

/**
 * Set a physics parameter by path
 * @param {string} path - Dot notation path (e.g., 'ball.gravityStrength')
 * @param {number} value - New value
 */
export function setPhysicsParam(path, value) {
    const parts = path.split('.');
    const config = parts[0];
    const param = parts[1];

    switch (config) {
        case 'tilt':
            if (TILT_CONFIG.hasOwnProperty(param)) {
                TILT_CONFIG[param] = value;
            }
            break;
        case 'ball':
            if (BALL_CONFIG.hasOwnProperty(param)) {
                BALL_CONFIG[param] = value;
            }
            break;
        case 'collision':
            if (COLLISION_CONFIG.hasOwnProperty(param)) {
                COLLISION_CONFIG[param] = value;
            }
            break;
        case 'camera':
            if (CAMERA_CONFIG.hasOwnProperty(param)) {
                CAMERA_CONFIG[param] = value;
            }
            break;
    }
}
