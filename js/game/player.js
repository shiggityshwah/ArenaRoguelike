class Player {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.playerConeOriginalColor = new THREE.Color(0x00ff00);
        this.playerCone = new THREE.Mesh(
            new THREE.ConeGeometry(1.5, 6, 32),
            new THREE.MeshStandardMaterial({ color: this.playerConeOriginalColor, emissive: 0x00ff00, emissiveIntensity: 1, toneMapped: false })
        );
        this.playerCone.position.set(0, 3, 5);
        this.scene.add(this.playerCone);

        this.coneLight = new THREE.PointLight(0x00ff00, 1, 10);
        this.playerCone.add(this.coneLight);

        this.stats = {
            attackDistance: 500,
            projectileSpeed: 3,
            damage: 30,
            areaDamageRadius: 0,
            pierceCount: 1,
            critChance: 0.05,
            critMultiplier: 2,
            maxHealth: 100,
            armor: 0,
            regenRate: 0,
            dodgeChance: 0,
            attackSpeed: 0.5, // Cooldown in seconds
            pickupRadius: 15,
            playerRadius: 1.5,
            coinPickupRadius: 115,
            luck: 0.5,
            cooldownReduction: 0
        };

        this.keyState = {};
        this.isDragging = false;
        this.dragStartPoint = null;
        this.movementDirection = new THREE.Vector2();
        this.dragDot = null;
        this.dragLine = null;
        this.initialPinchDistance = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => { 
            this.keyState[e.code] = true; 
        });
        window.addEventListener('keyup', (e) => { 
            this.keyState[e.code] = false; 
        });

        this.game.renderer.domElement.addEventListener('mousedown', (event) => {
            if (this.game.isGameOver) return;
            if (event.button === 0) {
                this.isDragging = true;
                this.createDragVisuals(event.clientX, event.clientY);
                event.preventDefault();
            }
        });

        this.game.renderer.domElement.addEventListener('mousemove', (event) => {
            if (this.game.isGameOver) return;
            if (this.isDragging) {
                this.updateDragLine(event.clientX, event.clientY);
            }
        });

        window.addEventListener('mouseup', (event) => {
            if (this.game.isGameOver) return;
            if (event.button === 0) {
                this.endDrag();
            }
        });

        this.game.renderer.domElement.addEventListener('touchstart', (event) => {
            if (this.game.isGameOver) return;
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                this.isDragging = true;
                this.createDragVisuals(touch.clientX, touch.clientY);
                event.preventDefault();
            }
        });

        this.game.renderer.domElement.addEventListener('touchmove', (event) => {
            if (this.game.isGameOver) return;
            if (this.isDragging && event.touches.length === 1) {
                const touch = event.touches[0];
                this.updateDragLine(touch.clientX, touch.clientY);
                event.preventDefault();
            }
        });

        window.addEventListener('touchend', (event) => {
            if (this.game.isGameOver) return;
            this.endDrag();
        });

        this.game.renderer.domElement.addEventListener('touchstart', (event) => {
            if (event.touches.length === 2) {
                this.initialPinchDistance = Math.hypot(
                    event.touches[0].pageX - event.touches[1].pageX,
                    event.touches[0].pageY - event.touches[1].pageY
                );
            }
        });

        this.game.renderer.domElement.addEventListener('touchmove', (event) => {
            if (event.touches.length === 2) {
                const currentPinchDistance = Math.hypot(
                    event.touches[0].pageX - event.touches[1].pageX,
                    event.touches[0].pageY - event.touches[1].pageY
                );

                const zoomFactor = currentPinchDistance / this.initialPinchDistance;
                this.game.cameraOffset.multiplyScalar(1 / zoomFactor);

                const minZoom = 20;
                const maxZoom = 400;
                if (this.game.cameraOffset.length() < minZoom) {
                    this.game.cameraOffset.setLength(minZoom);
                }
                if (this.game.cameraOffset.length() > maxZoom) {
                    this.game.cameraOffset.setLength(maxZoom);
                }

                this.initialPinchDistance = currentPinchDistance;
            }
        });

        this.game.renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.endDrag();
        });

        window.addEventListener('wheel', (event) => {
            const zoomFactor = 1.1;
            if (event.deltaY < 0) {
                this.game.cameraOffset.multiplyScalar(1 / zoomFactor);
            } else {
                this.game.cameraOffset.multiplyScalar(zoomFactor);
            }
            const minZoom = 20;
            const maxZoom = 400;
            if (this.game.cameraOffset.length() < minZoom) {
                this.game.cameraOffset.setLength(minZoom);
            }
            if (this.game.cameraOffset.length() > maxZoom) {
                this.game.cameraOffset.setLength(maxZoom);
            }
        });
    }

    createDragVisuals(x, y) {
        if (this.dragDot) {
            document.body.removeChild(this.dragDot);
            this.dragDot = null;
        }
        if (this.dragLine) {
            document.body.removeChild(this.dragLine);
            this.dragLine = null;
        }

        this.dragStartPoint = new THREE.Vector2(x, y);

        this.dragDot = document.createElement('div');
        this.dragDot.style.position = 'absolute';
        this.dragDot.style.width = '20px';
        this.dragDot.style.height = '20px';
        this.dragDot.style.background = 'black';
        this.dragDot.style.borderRadius = '50%';
        this.dragDot.style.left = `${x - 10}px`;
        this.dragDot.style.top = `${y - 10}px`;
        this.dragDot.style.pointerEvents = 'none';
        document.body.appendChild(this.dragDot);
    }

    updateDragLine(endX, endY) {
        if (!this.dragStartPoint) return;

        if (this.dragLine) {
            document.body.removeChild(this.dragLine);
            this.dragLine = null;
        }

        this.dragLine = document.createElement('div');
        this.dragLine.style.position = 'absolute';
        this.dragLine.style.background = 'white';
        this.dragLine.style.height = '4px';
        this.dragLine.style.transformOrigin = '0 50%';
        this.dragLine.style.pointerEvents = 'none';

        const dx = endX - this.dragStartPoint.x;
        const dy = endY - this.dragStartPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        this.dragLine.style.width = `${length}px`;
        this.dragLine.style.left = `${this.dragStartPoint.x}px`;
        this.dragLine.style.top = `${this.dragStartPoint.y}px`;
        this.dragLine.style.transform = `rotate(${angle}deg)`;

        document.body.appendChild(this.dragLine);

        const direction = new THREE.Vector2(dx, dy);
        if (direction.length() > 10) {
            this.movementDirection.set(direction.x, direction.y).normalize();
        } else {
            this.movementDirection.set(0, 0);
        }
    }

    endDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.movementDirection.set(0, 0);
            this.clearDragVisuals();
        }
    }

    clearDragVisuals() {
        if (this.dragDot) {
            document.body.removeChild(this.dragDot);
            this.dragDot = null;
        }
        if (this.dragLine) {
            document.body.removeChild(this.dragLine);
            this.dragLine = null;
        }
        this.dragStartPoint = null;
    }

    updatePosition(delta) {
        const coneSpeed = this.game.BASE_PLAYER_SPEED * this.game.gameSpeedMultiplier;
        let keyboardMovement = new THREE.Vector2();
        if (this.keyState['KeyW']) keyboardMovement.y -= 1;
        if (this.keyState['KeyS']) keyboardMovement.y += 1;
        if (this.keyState['KeyA']) keyboardMovement.x -= 1;
        if (this.keyState['KeyD']) keyboardMovement.x += 1;

        if (keyboardMovement.length() > 0) {
            keyboardMovement.normalize();
            this.playerCone.position.x += keyboardMovement.x * coneSpeed * delta;
            this.playerCone.position.z += keyboardMovement.y * coneSpeed * delta;
        } else if (this.movementDirection.length() > 0) {
            this.playerCone.position.x += this.movementDirection.x * coneSpeed * delta;
            this.playerCone.position.z += this.movementDirection.y * coneSpeed * delta;
        }

        const bounds = 980;
        this.playerCone.position.x = Math.max(-bounds, Math.min(bounds, this.playerCone.position.x));
        this.playerCone.position.z = Math.max(-bounds, Math.min(bounds, this.playerCone.position.z));
    }
}