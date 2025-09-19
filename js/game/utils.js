const LogBuffer = {
    buffer: [],
    maxSize: 20, // Store last 20 messages
    originalWarn: console.warn,
    originalError: console.error,
    init() {
        console.warn = (...args) => {
            this.push('WARN', ...args);
            this.originalWarn.apply(console, args);
        };
        console.error = (...args) => {
            this.push('ERROR', ...args);
            this.originalError.apply(console, args);
        };
    },
    push(level, ...args) {
        const message = args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return String(arg);
        }).join(' ');
        this.buffer.push(`[${level}] ${new Date().toLocaleTimeString()}: ${message}`);
        if (this.buffer.length > this.maxSize) {
            this.buffer.shift();
        }
    },
    dump() {
        if (this.buffer.length > 0) {
            this.originalError("\n--- Recent Log Buffer (Warnings/Errors) ---");
            this.buffer.forEach(msg => this.originalWarn(msg)); // Use original to avoid re-buffering
            this.originalError("-------------------------------------------\n");
        }
    },
    reset() {
        this.buffer = [];
    }
};
LogBuffer.init();

const Debug = {
    enabled: true,
    lastLogTime: 0,
    logInterval: 10, // seconds
    frameTimes: [],
    lastSnapshot: "",
    perf: {
        _timings: {},
        _order: [],
        start(label) {
            if (!Debug.enabled) return;
            this._timings[label] = { start: performance.now(), duration: 0 };
            if (!this._order.includes(label)) this._order.push(label);
        },
        end(label) {
            if (!Debug.enabled || !this._timings[label]) return;
            this._timings[label].duration = performance.now() - this._timings[label].start;
        },
        getResults() {
            let resultStr = "";
            this._order.forEach(label => {
                if (this._timings[label] && this._timings[label].duration > 0.1) { // Only show significant timings
                    resultStr += `${label}: ${this._timings[label].duration.toFixed(1)}ms | `; 
                }
            });
            return resultStr.slice(0, -2).trim(); // Remove trailing pipe and space
        },
        reset() {
            this._timings = {};
        }
    },
    init(game) {
        this.game = game;
        this.lastLogTime = 0;
        this.frameTimes = [];
        this.lastSnapshot = "";
    },
    update(delta) {
        if (!Debug.enabled) return;
        this.frameTimes.push(delta);
        if (delta > 0.2) {
            console.warn(`[PERF] Stutter spike detected: Frame took ${(delta * 1000).toFixed(0)}ms`);
        }
        const currentTime = this.game.clock.getElapsedTime();
        if (currentTime - this.lastLogTime > this.logInterval) {
            this.log(currentTime);
            this.lastLogTime = currentTime;
        }
    },
    log(currentTime) {
        if (!this.enabled || this.frameTimes.length === 0) return;
        const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.frameTimes = [];
        const fps = (1 / avgDelta).toFixed(0);
        const frameTimeMs = (avgDelta * 1000).toFixed(0);
        const mem = this.game.renderer.info.memory;
        const renderInfo = this.game.renderer.info.render;
        const convertingCount = this.game.relics.filter(r => r.state === 'lowering' || r.state === 'converting').length;
        const convertingState = convertingCount > 0 ? `${convertingCount} converting` : 'none';
        const perfResults = this.perf.getResults();
        const output = `
[DEBUG] Time: ${Math.floor(currentTime)}s | FPS: ${fps} | FrameTime: ${frameTimeMs}ms
  SceneChildren: ${this.game.scene.children.length} | Geom=${mem.geometries}, Tex=${mem.textures} | DrawCalls=${renderInfo.calls}
  Enemies: ${this.game.enemies.length}, P.Shots: ${this.game.blasterShots.length}, E.Shots: ${this.game.enemyProjectiles.length}, Skeletons: ${this.game.skeletons.length}, Beams: ${this.game.beams.length}
  Coins: ${this.game.coins.length}, Gems: ${this.game.gems.length}, Relics: ${this.game.relics.length} (Converting: ${convertingState}), Bosses: ${this.game.bossCount}
  PlayerHP: ${this.game.playerHealth.toFixed(0)}/${this.game.player.stats.maxHealth} | Score: ${this.game.score} | Level: ${this.game.level}
  Perf: [ ${perfResults} ]
`;
        this.lastSnapshot = output;
        console.log(output.trim());
        this.game.renderer.info.reset();
    },
    logNow(prefix = "Immediate Log") {
        const currentTime = this.game.clock.getElapsedTime();
        const mem = this.game.renderer.info.memory;
        const renderInfo = this.game.renderer.info.render;
        const convertingCount = this.game.relics.filter(r => r.state === 'lowering' || r.state === 'converting').length;
        const convertingState = convertingCount > 0 ? `${convertingCount} converting` : 'none';
        const output = `
[${prefix}] Time: ${Math.floor(currentTime)}s
  SceneChildren: ${this.game.scene.children.length} | Geom=${mem.geometries}, Tex=${mem.textures} | DrawCalls=${renderInfo.calls}
  Enemies: ${this.game.enemies.length}, P.Shots: ${this.game.blasterShots.length}, E.Shots: ${this.game.enemyProjectiles.length}, Skeletons: ${this.game.skeletons.length}, Beams: ${this.game.beams.length}
  Coins: ${this.game.coins.length}, Gems: ${this.game.gems.length}, Relics: ${this.game.relics.length} (Converting: ${convertingState}), Bosses: ${this.game.bossCount}
  PlayerHP: ${this.game.playerHealth.toFixed(0)}/${this.game.player.stats.maxHealth} | Score: ${this.game.score} | Level: ${this.game.level}
  Perf: [ ${this.perf.getResults()} ]
`;
        this.lastSnapshot = output;
        console.log(output.trim());
    }
};

const AreaWarningManager = {
    warnings: [],
    maxWarnings: 20, // Max simultaneous warnings for the shader
    uniforms: {
        u_warnings: { value: [] },
        u_warningCount: { value: 0 }
    },

    init(groundMaterial, game) {
        this.game = game;
        this.warnings = [];
        this.uniforms.u_warnings.value = [];
        for (let i = 0; i < this.maxWarnings; i++) {
            this.uniforms.u_warnings.value.push({
                pos: new THREE.Vector3(),
                radius: 0,
                color: new THREE.Color(),
                intensity: 0,
                type: 0 // 0 for standard, 1 for gradient
            });
        }
        this.uniforms.u_warningCount.value = 0;

        groundMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.u_warnings = this.uniforms.u_warnings;
            shader.uniforms.u_warningCount = this.uniforms.u_warningCount;

            shader.vertexShader = 'varying vec3 vWorldPosition;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>\nvWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );

            shader.fragmentShader = 'varying vec3 vWorldPosition;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform struct Warning {\n                    vec3 pos;\n                    float radius;\n                    vec3 color;\n                    float intensity;\n                    float type;\n                } u_warnings[${this.maxWarnings}];\n                uniform int u_warningCount;\n                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                vec3 warningColor = vec3(0.0);
                float totalIntensity = 0.0;

                for (int i = 0; i < ${this.maxWarnings}; i++) {\n                    if (i >= u_warningCount) break;\n                    Warning w = u_warnings[i];\n                    float dist = distance(vWorldPosition.xz, w.pos.xz);
                    if (dist < w.radius) {
                        float currentIntensity = w.intensity;
                        if (w.type > 0.5) { // Gradient effect
                            float falloff = 1.0 - smoothstep(0.0, w.radius, dist);
                            float gradientMultiplier = 0.4 + (pow(falloff, 2.0) * 0.8);
                            currentIntensity *= gradientMultiplier;
                        }
                        warningColor += w.color * currentIntensity;
                        totalIntensity += currentIntensity;
                    }
                }
                totalIntensity = clamp(totalIntensity, 0.0, 1.0);
                gl_FragColor.rgb = mix(gl_FragColor.rgb, warningColor, totalIntensity);
                `
            );
        };
        groundMaterial.needsUpdate = true;
    },

    create(position, radius, color, duration, effectType = "standard") {
        if (this.warnings.length >= this.maxWarnings) return;

        const warning = {
            position: position.clone(),
            radius,
            color: new THREE.Color(color),
            duration,
            startTime: this.game.clock.getElapsedTime(),
            effectType,
            triggeredImpact: false
        };
        this.warnings.push(warning);

        // Spawn rising spark particles
        const particleCount = Math.floor(radius / 4);
        for (let i = 0; i < particleCount; i++) {
            const pGeometry = new THREE.SphereGeometry(0.5, 4, 4);
            const pMaterial = new THREE.MeshBasicMaterial({ color: warning.color, transparent: true });
            const particle = new THREE.Mesh(pGeometry, pMaterial);
            
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            const startPos = position.clone().add(new THREE.Vector3(Math.cos(angle) * r, 0.1, Math.sin(angle) * r));
            particle.position.copy(startPos);

            this.game.scene.add(particle);
            this.game.temporaryEffects.push({
                mesh: particle,
                startTime: this.game.clock.getElapsedTime(),
                duration: duration,
                type: 'warning_spark',
                velocity: new THREE.Vector3(0, 5 + Math.random() * 5, 0)
            });
        }
    },

    update(delta) {
        const now = this.game.clock.getElapsedTime();
        let uniformIndex = 0;

        for (let i = this.warnings.length - 1; i >= 0; i--) {
            const warning = this.warnings[i];
            const elapsed = now - warning.startTime;
            const FADE_OUT_TIME = 0.25;

            if (elapsed >= warning.duration && !warning.triggeredImpact) {
                createDebris(warning.position, warning.color, warning.radius, this.game);
                warning.triggeredImpact = true;
            }

            if (elapsed >= warning.duration + FADE_OUT_TIME) {
                this.warnings.splice(i, 1);
                continue;
            }

            if (uniformIndex < this.maxWarnings) {
                const uniform = this.uniforms.u_warnings.value[uniformIndex];
                uniform.pos.copy(warning.position);
                uniform.radius = warning.radius;
                uniform.color.copy(warning.color);
                
                const fadeInDuration = 0.1;
                let intensity = 0;
                if (elapsed < fadeInDuration) {
                    intensity = elapsed / fadeInDuration;
                } else {
                    intensity = 1.0 - ((elapsed - fadeInDuration) / (warning.duration + FADE_OUT_TIME - fadeInDuration));
                }
                uniform.intensity = Math.max(0, intensity);
                uniform.type = (warning.effectType === 'gradient') ? 1.0 : 0.0;
                
                uniformIndex++;
            }
        }
        this.uniforms.u_warningCount.value = uniformIndex;
    }
};

const AudioManager = {
    sounds: {},
    init() {
        const soundList = {
            explosion: 'https://www.soundjay.com/misc/sounds/explosion-01.wav',
            hit: 'https://www.soundjay.com/misc/sounds/hit-01.wav',
            coin: 'https://www.soundjay.com/misc/sounds/coin-01.wav',
            laser: 'https://www.soundjay.com/misc/sounds/small-laser-gun-01.wav',
            windChime: 'https://www.soundjay.com/misc/sounds/wind-chime-01.wav',
            gameOver: 'https://www.soundjay.com/misc/sounds/game-over-01.wav'
        };
        for (const name in soundList) {
            this.sounds[name] = new Audio(soundList[name]);
        }
    },
    play(name, volume = 1.0) {
        if (this.sounds[name]) {
            const sound = this.sounds[name].cloneNode();
            sound.volume = volume;
            sound.play().catch(e => {}); // Ignore play errors if context not ready
        }
    }
};
AudioManager.init();

const ErrorWatcher = {
    errors: {},
    maxReports: 5,
    report(error) {
        const key = error.message || 'Unknown error';
        if (!this.errors[key]) {
            this.errors[key] = { count: 0, firstSeen: new Date(), error: error };
        }
        this.errors[key].count++;
        if (this.errors[key].count <= this.maxReports) {
            console.error("Caught error in game loop:", error);
        } else if (this.errors[key].count === this.maxReports + 1) {
            console.warn(`Suppressing further logs for error: "${key}". First seen at ${this.errors[key].firstSeen}.`);
        }
    },
    reset() {
        this.errors = {};
    }
};

class ObjectPool {
    constructor(createFn, game, size = 20) {
        this.createFn = createFn;
        this.game = game;
        this.inactive = [];
        for (let i = 0; i < size; i++) {
            this.inactive.push(this.createFn());
        }
    }
    get() {
        let obj;
        if (this.inactive.length > 0) {
            obj = this.inactive.pop();
        } else {
            // Pool is empty, create a new one as a fallback
            obj = this.createFn();
        }
        this.game.scene.add(obj.mesh);
        obj.active = true;
        return obj;
    }
    release(obj) {
        this.game.scene.remove(obj.mesh);
        obj.active = false;
        this.inactive.push(obj);
    }
    dispose() {
        this.inactive.forEach(obj => {
            if (obj.mesh.geometry) obj.mesh.geometry.dispose();
            if (obj.mesh.material) {
                if (Array.isArray(obj.mesh.material)) {
                    obj.mesh.material.forEach(m => m.dispose());
                } else {
                    obj.mesh.material.dispose();
                }
            }
        });
        this.inactive = [];
    }
}


class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.gridWidth = Math.ceil(width / cellSize);
        this.gridHeight = Math.ceil(height / cellSize);
        this.clear();
    }
    getCellCoords(x, z) {
        const gridX = Math.floor((x + this.width / 2) / this.cellSize);
        const gridZ = Math.floor((z + this.height / 2) / this.cellSize);
        return { gridX, gridZ };
    }
    getCellIndexFromCoords(gridX, gridZ) {
        if (gridX < 0 || gridX >= this.gridWidth || gridZ < 0 || gridZ >= this.gridHeight) return -1;
        return gridZ * this.gridWidth + gridX;
    }
    clear() {
        this.grid = new Array(this.gridWidth * this.gridHeight).fill(0).map(() => []);
    }
    add(obj) {
        const { gridX, gridZ } = this.getCellCoords(obj.mesh.position.x, obj.mesh.position.z);
        const index = this.getCellIndexFromCoords(gridX, gridZ);
        if (index !== -1) this.grid[index].push(obj);
    }
    getNearby(obj) { // obj is { mesh, radius }
        const nearby = new Set();
        const position = obj.mesh.position;
        const radius = obj.radius || 0; // Use radius if provided, else 0
        const { gridX, gridZ } = this.getCellCoords(position.x, position.z);
        const cellRadius = Math.max(1, Math.ceil(radius / this.cellSize));

        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            for (let dx = -cellRadius; dx <= cellRadius; dx++) {
                const checkX = gridX + dx;
                const checkZ = gridZ + dz;
                const index = this.getCellIndexFromCoords(checkX, checkZ);
                if (index !== -1) {
                    this.grid[index].forEach(item => nearby.add(item));
                }
            }
        }
        return Array.from(nearby);
    }
}

class DamageNumberManager {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
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
        const now = this.game.clock.getElapsedTime();
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
        const now = this.game.clock.getElapsedTime();
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

function createDebris(position, color, size, game) {
    const debrisCount = 10;
    for (let i = 0; i < debrisCount; i++) {
        const debrisGeometry = new THREE.BoxGeometry(size / 5, size / 5, size / 5);
        const debrisMaterial = new THREE.MeshStandardMaterial({ color });
        const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
        debris.position.copy(position);
        game.scene.add(debris);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 50,
            Math.random() * 50,
            (Math.random() - 0.5) * 50
        );

        game.temporaryEffects.push({
            mesh: debris,
            startTime: game.clock.getElapsedTime(),
            duration: 1.0,
            type: 'debris',
            velocity: velocity
        });
    }
}

function createGravityVortex(target, particleCount, radius, color, isRelic, game) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = Math.sin(angle) * r;

        velocities[i * 3] = 0;
        velocities[i * 3 + 1] = 0;
        velocities[i * 3 + 2] = 0;

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ size: 2, vertexColors: true, transparent: true, opacity: 0.7 });
    const points = new THREE.Points(geometry, material);
    target.add(points);

    const vortex = {
        mesh: points,
        target: target,
        radius: radius,
        isRelic: isRelic
    };

    game.gravityWellEffects.push(vortex);
    return vortex;
}