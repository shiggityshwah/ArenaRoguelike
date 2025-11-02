import * as THREE from 'three';

/**
 * DamageNumberManager - Manages floating damage/heal numbers that appear above entities.
 *
 * Creates animated text sprites that float upward and fade out, with support for
 * damage stacking, critical hits, dodge indicators, and heal numbers.
 *
 * Dependencies:
 * - THREE.js for sprites and textures
 * - clock object for timing (should be injected in refactored code)
 */
class DamageNumberManager {
    constructor(scene, clock) {
        this.scene = scene;
        this.clock = clock;
        this.activeNumbers = [];
        this.pool = [];
        this.font = 'bold 24px Arial';
        this.STACK_TIME_WINDOW = 0.3; // seconds
        this.STACK_Y_OFFSET = 5;
    }

    _createPooledObject() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(20, 10, 1);
        return { sprite, canvas, context, texture };
    }

    _getFromPool() {
        let obj = this.pool.pop();
        if (!obj) {
            obj = this._createPooledObject();
        }
        this.scene.add(obj.sprite);
        return obj;
    }

    _releaseToPool(damageNumber) {
        this.scene.remove(damageNumber.pooledSprite.sprite);
        this.pool.push(damageNumber.pooledSprite);
    }

    create(targetObject, text, options = {}) {
        const color = options.isHeal ? '#44FF44' : (options.isCritical ? '#FF0000' : '#FF4444');
        const textToDisplay = options.isDodge ? 'DODGE' : (options.isHeal ? `+${text}` : String(Math.round(text)));

        // Stacking logic using userData on the THREE.Object3D
        const now = this.clock.getElapsedTime();
        if (!targetObject.userData.lastDamageNumberTime || now - targetObject.userData.lastDamageNumberTime > this.STACK_TIME_WINDOW) {
            targetObject.userData.damageNumberStackCount = 0;
        } else {
            targetObject.userData.damageNumberStackCount++;
        }
        targetObject.userData.lastDamageNumberTime = now;
        const stackOffset = targetObject.userData.damageNumberStackCount * this.STACK_Y_OFFSET;

        const pooledSprite = this._getFromPool();
        const { sprite, canvas, context, texture } = pooledSprite;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = this.font;
        context.fillStyle = options.isDodge ? '#FFFF00' : color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeStyle = 'black';
        context.lineWidth = 4;
        context.strokeText(textToDisplay, canvas.width / 2, canvas.height / 2);
        context.fillText(textToDisplay, canvas.width / 2, canvas.height / 2);
        texture.needsUpdate = true;

        const damageNumber = {
            pooledSprite,
            startTime: now,
            duration: 1.0,
            startPosition: targetObject.position.clone().add(new THREE.Vector3(0, 15 + stackOffset, 0)),
            velocity: new THREE.Vector3((Math.random() - 0.5) * 15, 30, 0),
            isCritical: !!options.isCritical
        };

        sprite.position.copy(damageNumber.startPosition);
        this.activeNumbers.push(damageNumber);
    }

    update() {
        const now = this.clock.getElapsedTime();
        this.activeNumbers = this.activeNumbers.filter(num => {
            const elapsed = now - num.startTime;
            if (elapsed >= num.duration) {
                this._releaseToPool(num);
                return false;
            }
            const t = elapsed / num.duration;
            const sprite = num.pooledSprite.sprite;
            sprite.position.x = num.startPosition.x + num.velocity.x * t;
            sprite.position.y = num.startPosition.y + num.velocity.y * t - 0.5 * 60 * t * t;
            sprite.material.opacity = 1.0 - t * t;
            if (num.isCritical) {
                sprite.position.x += (Math.random() - 0.5) * 2;
                sprite.position.y += (Math.random() - 0.5) * 2;
            }
            return true;
        });
    }
}

export default DamageNumberManager;
