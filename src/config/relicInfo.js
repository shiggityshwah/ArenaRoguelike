// Relic information - Defines stats, appearance, and combat properties for relics
// Extracted from index-reference.html (lines ~1618-1639)

import * as THREE from 'three';

const relicInfo = {
    attackSpeed: { name: 'Octahedron', shape: 'octahedron', health: 500, geometry: new THREE.OctahedronGeometry(24), color: 0x8A2BE2,
        range: 200, cooldown: 2.5, damage: 120 // damage per second for beam
    },
    damage: { name: 'Cannon', shape: 'box', health: 750, geometry: new THREE.BoxGeometry(38, 38, 38), color: 0xFF1493,
        range: 180, cooldown: 3.0, damage: 300, splashDamage: 150, splashRadius: 40
    },
    speed: { name: 'Speed Booster', shape: 'tetrahedron', health: 1000, geometry: new THREE.TetrahedronGeometry(28), color: 0xFF4500,
        range: 100, // Aura range
        buffs: { moveSpeed: 1.3, attackSpeed: 1.3, damage: 1.2 },
        damageTakenMultiplier: 1.5
    },
    vacuum: { name: 'Gravity Well', shape: 'torus', health: 2500, geometry: new THREE.TorusGeometry(20, 8, 16, 100), color: 0x00BFFF,
        range: 150, pullStrength: 0.15, damageTickInterval: 0.5, baseDamage: 3
    },
    crit: { name: 'Multi-Shot', shape: 'icosahedron', health: 1500, geometry: new THREE.IcosahedronGeometry(24), color: 0xFFFF33,
        range: 250, cooldown: 2.5, damage: 175, targets: 7
    },
    luck: { name: 'Precision Striker', shape: 'sphere', health: 2000, geometry: new THREE.SphereGeometry(24, 32, 32), color: 0xFFFFFF,
        range: 200, cooldown: 5.0, duration: 3.0, damagePerSecond: 200, radius: 25
    },
    droneSwarm: { name: 'Drone Swarm', shape: 'dodecahedron', health: 1800, geometry: new THREE.DodecahedronGeometry(24), color: 0x00FFAA,
        range: 220, cooldown: 0.8, droneCount: 4, orbitRadius: 35, orbitSpeed: 90, droneDamage: 80
    }
};

export default relicInfo;
