import * as THREE from 'three';

/**
 * AreaWarningManager - Manages visual warnings on the ground for incoming area attacks.
 *
 * Creates shader-based warning circles with fade-in/out effects and particle spawns.
 * Warnings are rendered directly onto the ground material using shader modifications.
 *
 * Dependencies:
 * - THREE.js for materials, shaders, and objects
 * - clock object for timing (should be injected in refactored code)
 * - scene object for adding particle effects (should be injected)
 * - temporaryEffects array for particle management (should be injected)
 * - createDebris function for impact effects (should be injected)
 */
const AreaWarningManager = {
    warnings: [],
    maxWarnings: 20, // Max simultaneous warnings for the shader
    uniforms: {
        u_warnings: { value: [] },
        u_warningCount: { value: 0 }
    },
    // Dependencies (set these after creation)
    clock: null,
    scene: null,
    temporaryEffects: null,
    createDebris: null,

    init(groundMaterial) {
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
                uniform struct Warning {
                    vec3 pos;
                    float radius;
                    vec3 color;
                    float intensity;
                    float type;
                } u_warnings[${this.maxWarnings}];
                uniform int u_warningCount;
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                vec3 warningColor = vec3(0.0);
                float totalIntensity = 0.0;

                for (int i = 0; i < ${this.maxWarnings}; i++) {
                    if (i >= u_warningCount) break;
                    Warning w = u_warnings[i];
                    float dist = distance(vWorldPosition.xz, w.pos.xz);
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
            startTime: this.clock.getElapsedTime(),
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

            this.scene.add(particle);
            this.temporaryEffects.push({
                mesh: particle,
                startTime: this.clock.getElapsedTime(),
                duration: duration,
                type: 'warning_spark',
                velocity: new THREE.Vector3(0, 5 + Math.random() * 5, 0)
            });
        }
    },

    update(delta) {
        const now = this.clock.getElapsedTime();
        let uniformIndex = 0;

        for (let i = this.warnings.length - 1; i >= 0; i--) {
            const warning = this.warnings[i];
            const elapsed = now - warning.startTime;
            const FADE_OUT_TIME = 0.25;

            if (elapsed >= warning.duration && !warning.triggeredImpact) {
                this.createDebris(warning.position, warning.color, warning.radius);
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

export default AreaWarningManager;
