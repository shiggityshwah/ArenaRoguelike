// Gem types configuration - Defines geometry and colors for collectible gems
// Extracted from index-reference.html (lines ~1951-1958)

import * as THREE from 'three';

const gemTypes = {
    damage: { color: 0xFF1493, geometry: new THREE.IcosahedronGeometry(3) },
    speed: { color: 0xFF4500, geometry: new THREE.ConeGeometry(3, 5, 4) },
    attackSpeed: { color: 0x8A2BE2, geometry: new THREE.OctahedronGeometry(3) },
    luck: { color: 0xFFFFFF, geometry: new THREE.SphereGeometry(2, 16, 16) },
    vacuum: { color: 0x00BFFF, geometry: new THREE.CylinderGeometry(2, 2, 3, 8) },
    crit: { color: 0xFFFF33, geometry: new THREE.IcosahedronGeometry(3) }
};

export default gemTypes;
