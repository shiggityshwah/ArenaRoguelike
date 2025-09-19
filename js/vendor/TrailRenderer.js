/**
 * @author WestLangley / https://github.com/WestLangley
 * @author Mark Niebur / https://github.com/markniebur
 *
 * A full port of the three.js TrailRenderer to a non-module format,
 * with corrections to generate a visible ribbon mesh.
 */
THREE.TrailRenderer = function(scene, camera) {
    var _this = this;
    var _scene = scene;
    var _camera = camera;
    var _trailHeads = [];
    var _lastCameraPosition = new THREE.Vector3();

    var TRAIL_MAX_LENGTH = 8;

    function updateTrail(trailHead, camera) {
        var trail = trailHead.trail;
        var trailCore = trailHead.trailCore;
        var vertices = trail.geometry.attributes.position.array;
        var uvs = trail.geometry.attributes.uv.array;
        var trailVertices = trailCore.vertices;
        var trailLength = trailCore.length;
        var trailWidth = trail.material.uniforms.trailWidth.value;

        if (trailLength < 2) {
            // Not enough points to form a segment, hide the geometry
            for (var i = 0; i < vertices.length; i++) {
                vertices[i] = 0;
            }
            trail.geometry.attributes.position.needsUpdate = true;
            return;
        }

        var viewVector = new THREE.Vector3();
        var lastPoint, currentPoint, direction, up, offset;
        var vertexIndex = 0;
        var uvIndex = 0;

        for (var i = 0; i < trailLength; i++) {
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

            var uv = i / (trailLength - 1);
            uvs[uvIndex++] = uv;
            uvs[uvIndex++] = 0;

            uvs[uvIndex++] = uv;
            uvs[uvIndex++] = 1;
        }

        // Hide the rest of the geometry
        for (var i = vertexIndex; i < vertices.length; i++) {
            vertices[i] = trailVertices[trailLength - 1].x;
        }

        trail.geometry.attributes.position.needsUpdate = true;
        trail.geometry.attributes.uv.needsUpdate = true;
    }

    this.createMaterial = function() {
        return new THREE.ShaderMaterial({
            uniforms: {
                headColor: { value: new THREE.Vector4(1.0, 0.0, 0.0, 1.0) },
                tailColor: { value: new THREE.Vector4(1.0, 0.0, 0.0, 0.0) },
                trailWidth: { value: 1.0 }
            },
            vertexShader: [
                'varying vec2 vUv;',
                'void main() {',
                '\tvUv = uv;',
                '\tgl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform vec4 headColor;',
                'uniform vec4 tailColor;',
                'varying vec2 vUv;',
                'void main() {',
                '\tvec4 color = mix(headColor, tailColor, vUv.x);',
                '\tgl_FragColor = color;',
                '}'
            ].join('\n'),
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
    };

    function createTrail(material) {
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array(TRAIL_MAX_LENGTH * 2 * 3);
        var uvs = new Float32Array(TRAIL_MAX_LENGTH * 2 * 2);

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        var trail = new THREE.Mesh(geometry, material);
        trail.dynamic = true;
        trail.frustumCulled = false;
        _scene.add(trail);
        return trail;
    }

    this.createTrail = function(target, material) {
        var trail = createTrail(material);
        var trailCore = new THREE.TrailRenderer.Trail(target, TRAIL_MAX_LENGTH);
        var trailHead = { trail: trail, trailCore: trailCore, target: target };
        _trailHeads.push(trailHead);
        return trailCore;
    };

                    this.update = function(camera) {
        var cameraHasMoved = !_lastCameraPosition.equals(camera.position);
        _lastCameraPosition.copy(camera.position);

        for (var i = 0; i < _trailHeads.length; i++) {
            var trailHead = _trailHeads[i];
            trailHead.trailCore.update();
            // ALWAYS update geometry if the trail has points, to handle fade-out.
            if (trailHead.trailCore.length > 0) {
                                        updateTrail(trailHead);
            }
        }
    };

    this.dispose = function() {
        for (var i = 0; i < _trailHeads.length; i++) {
            var trailHead = _trailHeads[i];
            _scene.remove(trailHead.trail);
            trailHead.trail.geometry.dispose();
        }
        _trailHeads = [];
    };
};

THREE.TrailRenderer.Trail = function(target, trailLength) {
    this.target = target;
    this.trailLength = trailLength ? trailLength : 50;
    this.vertices = [];
    this.length = 0;

    for (var i = 0; i < this.trailLength; i++) {
        this.vertices[i] = new THREE.Vector3();
    }

    this.active = false;
};

THREE.TrailRenderer.Trail.prototype.update = function() {
    if (!this.active) {
        // If inactive, shrink the trail length until it's gone.
        if (this.length > 0) {
            this.length -= 2; // Shrink faster than it grows
            if (this.length < 0) this.length = 0;
        }
        return; // Don't add new points
    }

    // Shift vertices
    for (var i = this.length - 1; i > 0; i--) {
        this.vertices[i].copy(this.vertices[i - 1]);
    }

    // Add new vertex
    this.vertices[0].copy(this.target.position);

    if (this.length < this.trailLength) {
        this.length++;
    }
};

THREE.TrailRenderer.Trail.prototype.activate = function() {
    this.active = true;
    for (var i = 0; i < this.trailLength; i++) {
        this.vertices[i].copy(this.target.position);
    }
    this.length = 1;
};

THREE.TrailRenderer.Trail.prototype.deactivate = function() {
    this.active = false;
};