/**
 * Input System
 * Handles keyboard, mouse, and touch input for player movement
 *
 * Dependencies:
 * - DOM: renderer.domElement, document.getElementById('spacebar-symbol'), document.body
 * - THREE.js: THREE.Vector2
 * - Game State: isGameOver flag
 */

import * as THREE from 'three';

export function createInputSystem({ renderer, scene }) {
    // ===== State =====
    const keyState = {};
    let isDragging = false;
    let dragStartPoint = null;
    const movementDirection = new THREE.Vector2();

    // Visual elements for drag
    let dragDot = null;
    let dragLine = null;

    // ===== Keyboard Input =====
    window.addEventListener('keydown', (e) => {
        keyState[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
        keyState[e.code] = false;
    });

    // ===== Spacebar Button (Touch/Mobile) =====
    const spacebarSymbol = document.getElementById('spacebar-symbol');

    // Change prompt text and size based on device
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const spacebarPromptDiv = spacebarSymbol.querySelector('div');
    if (isTouchDevice) {
        spacebarPromptDiv.textContent = 'HOLD';
        spacebarPromptDiv.style.width = '300px';
    } else {
        spacebarPromptDiv.textContent = 'Hold SPACE';
        spacebarPromptDiv.style.width = '400px';
    }

    spacebarSymbol.addEventListener('mousedown', () => {
        keyState['Space'] = true;
    });

    spacebarSymbol.addEventListener('mouseup', () => {
        keyState['Space'] = false;
    });

    spacebarSymbol.addEventListener('mouseleave', () => {
        keyState['Space'] = false;
    });

    spacebarSymbol.addEventListener('touchstart', (event) => {
        event.preventDefault(); // Prevent mouse events from being fired
        keyState['Space'] = true;
    });

    spacebarSymbol.addEventListener('touchend', () => {
        keyState['Space'] = false;
    });

    spacebarSymbol.addEventListener('touchleave', () => {
        keyState['Space'] = false;
    });

    // ===== Drag Visual Functions =====
    function createDragVisuals(x, y) {
        // Remove existing visuals
        if (dragDot) {
            scene.remove(dragDot);
            dragDot = null;
        }
        if (dragLine) {
            scene.remove(dragLine);
            dragLine = null;
        }

        // Store drag start in screen coordinates (for joystick base)
        dragStartPoint = new THREE.Vector2(x, y);

        // Create black dot in screen space (2D overlay instead of 3D)
        dragDot = document.createElement('div');
        dragDot.style.position = 'absolute';
        dragDot.style.width = '20px';
        dragDot.style.height = '20px';
        dragDot.style.background = 'black';
        dragDot.style.borderRadius = '50%';
        dragDot.style.left = `${x - 10}px`;
        dragDot.style.top = `${y - 10}px`;
        dragDot.style.pointerEvents = 'none'; // ignore clicks
        document.body.appendChild(dragDot);
    }

    function updateDragLine(endX, endY) {
        if (!dragStartPoint) return;

        // Remove old line
        if (dragLine) {
            document.body.removeChild(dragLine);
            dragLine = null;
        }

        // Create a line in screen space (simple div for now)
        dragLine = document.createElement('div');
        dragLine.style.position = 'absolute';
        dragLine.style.background = 'white';
        dragLine.style.height = '4px';
        dragLine.style.transformOrigin = '0 50%';
        dragLine.style.pointerEvents = 'none'; // So it doesn't block mouse events to the canvas

        const dx = endX - dragStartPoint.x;
        const dy = endY - dragStartPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        dragLine.style.width = `${length}px`;
        dragLine.style.left = `${dragStartPoint.x}px`;
        dragLine.style.top = `${dragStartPoint.y}px`;
        dragLine.style.transform = `rotate(${angle}deg)`;

        document.body.appendChild(dragLine);

        // Update movement direction based on drag vector
        const direction = new THREE.Vector2(dx, dy);
        if (direction.length() > 10) { // threshold
            movementDirection.set(direction.x, direction.y).normalize();
            // note: -dy because screen y is inverted relative to 3D world z
        } else {
            movementDirection.set(0, 0);
        }
    }

    function endDrag() {
        if (isDragging) {
            isDragging = false;
            movementDirection.set(0, 0);
            clearDragVisuals();
        }
    }

    function clearDragVisuals() {
        if (dragDot) {
            document.body.removeChild(dragDot);
            dragDot = null;
        }
        if (dragLine) {
            document.body.removeChild(dragLine);
            dragLine = null;
        }
        dragStartPoint = null;
    }

    // ===== Mouse Events =====
    renderer.domElement.addEventListener('mousedown', (event) => {
        // Note: requires isGameOver from game state
        if (window.isGameOver) return;
        if (event.button === 0) { // left click
            isDragging = true;
            createDragVisuals(event.clientX, event.clientY);
            event.preventDefault();
        }
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        if (window.isGameOver) return;
        if (isDragging) {
            updateDragLine(event.clientX, event.clientY);
        }
    });

    window.addEventListener('mouseup', (event) => {
        if (window.isGameOver) return;
        if (event.button === 0) {
            endDrag();
        }
    });

    // ===== Touch Events =====
    renderer.domElement.addEventListener('touchstart', (event) => {
        if (window.isGameOver) return;
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            isDragging = true;
            createDragVisuals(touch.clientX, touch.clientY);
            event.preventDefault();
        }
    });

    renderer.domElement.addEventListener('touchmove', (event) => {
        if (window.isGameOver) return;
        if (isDragging && event.touches.length === 1) {
            const touch = event.touches[0];
            updateDragLine(touch.clientX, touch.clientY);
            event.preventDefault();
        }
    });

    window.addEventListener('touchend', (event) => {
        if (window.isGameOver) return;
        endDrag();
    });

    // Prevent context menu on right click
    renderer.domElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        endDrag();
    });

    // ===== Public API =====
    return {
        keyState,
        movementDirection,
        isDragging: () => isDragging,
        endDrag,
        clearDragVisuals,

        /**
         * Get keyboard movement vector (normalized)
         * @returns {THREE.Vector2} Movement vector from WASD keys
         */
        getKeyboardMovement() {
            const movement = new THREE.Vector2();
            if (keyState['KeyW']) movement.y -= 1;
            if (keyState['KeyS']) movement.y += 1;
            if (keyState['KeyA']) movement.x -= 1;
            if (keyState['KeyD']) movement.x += 1;
            return movement;
        },

        /**
         * Check if a key is currently pressed
         * @param {string} code - Key code (e.g., 'Space', 'KeyW')
         * @returns {boolean}
         */
        isKeyPressed(code) {
            return !!keyState[code];
        },

        /**
         * Clear all key states (useful for game over/pause)
         */
        clearKeyStates() {
            for (let key in keyState) {
                delete keyState[key];
            }
        }
    };
}
