/**
 * @author WestLangley / https://github.com/WestLangley
 * @author Mark Niebur / https://github.com/markniebur
 *
 * A full port of the three.js TrailRenderer to a non-module format,
 * with corrections to generate a visible ribbon mesh.
 *
 * Creates dynamic trail effects for moving objects by generating
 * a ribbon mesh that follows the object's path.
 */

import * as THREE from 'three';

class TrailRenderer {
    constructor(scene, camera) {
        this._scene = scene;
        this._camera = camera;
        this._trailHeads = [];
        this._lastCameraPosition = new THREE.Vector3();
        this.TRAIL_MAX_LENGTH = 8;
    }

    createMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                headColor: { value: new THREE.Vector4(1.0, 0.0, 0.0, 1.0) },
                tailColor: { value: new THREE.Vector4(1.0, 0.0, 0.0, 0.0) },
                trailWidth: { value: 1.0 }
            },
            vertexShader: [
                'varying vec2 vUv;',
                'void main() {',
                '	vUv = uv;',
                '	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform vec4 headColor;',
                'uniform vec4 tailColor;',
                'varying vec2 vUv;',
                'void main() {',
                '	vec4 color = mix(headColor, tailColor, vUv.x);',
                '	gl_FragColor = color;',
                '}'
            ].join('\n'),
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
    }

    _createTrail(material) {
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array(this.TRAIL_MAX_LENGTH * 2 * 3);
        const uvs = new Float32Array(this.TRAIL_MAX_LENGTH * 2 * 2);

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        const trail = new THREE.Mesh(geometry, material);
        trail.dynamic = true;
        trail.frustumCulled = false;
        this._scene.add(trail);
        return trail;
    }

    createTrail(target, material) {
        const trail = this._createTrail(material);
        const trailCore = new Trail(target, this.TRAIL_MAX_LENGTH);
        const trailHead = { trail: trail, trailCore: trailCore, target: target };
        this._trailHeads.push(trailHead);
        return trailCore;
    }

    _updateTrail(trailHead) {
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

            viewVector.subVectors(this._camera.position, currentPoint);
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

    update() {
        const cameraHasMoved = !this._lastCameraPosition.equals(this._camera.position);
        this._lastCameraPosition.copy(this._camera.position);

        for (let i = 0; i < this._trailHeads.length; i++) {
            const trailHead = this._trailHeads[i];
            trailHead.trailCore.update();
            // ALWAYS update geometry if the trail has points, to handle fade-out.
            if (trailHead.trailCore.length > 0) {
                this._updateTrail(trailHead);
            }
        }
    }

    dispose() {
        for (let i = 0; i < this._trailHeads.length; i++) {
            const trailHead = this._trailHeads[i];
            this._scene.remove(trailHead.trail);
            trailHead.trail.geometry.dispose();
        }
        this._trailHeads = [];
    }
}

class Trail {
    constructor(target, trailLength) {
        this.target = target;
        this.trailLength = trailLength ? trailLength : 50;
        this.vertices = [];
        this.length = 0;

        for (let i = 0; i < this.trailLength; i++) {
            this.vertices[i] = new THREE.Vector3();
        }

        this.active = false;
    }

    update() {
        if (!this.active) {
            // If inactive, shrink the trail length until it's gone.
            if (this.length > 0) {
                this.length -= 2; // Shrink faster than it grows
                if (this.length < 0) this.length = 0;
            }
            return; // Don't add new points
        }

        // Shift vertices
        for (let i = this.length - 1; i > 0; i--) {
            this.vertices[i].copy(this.vertices[i - 1]);
        }

        // Add new vertex
        this.vertices[0].copy(this.target.position);

        if (this.length < this.trailLength) {
            this.length++;
        }
    }

    activate() {
        this.active = true;
        for (let i = 0; i < this.trailLength; i++) {
            this.vertices[i].copy(this.target.position);
        }
        this.length = 1;
    }

    deactivate() {
        this.active = false;
    }
}

export { TrailRenderer, Trail };
