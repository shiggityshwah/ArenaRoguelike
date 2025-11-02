// Enemy prototypes configuration - Defines base stats and appearance for all enemy types
// Extracted from index-reference.html (lines ~1964-2011)

import * as THREE from 'three';

const enemyPrototypes = {
    box: {
        geometry: (size) => new THREE.BoxGeometry(size, size, size),
        getMaterial: () => {
            const materialColor = new THREE.Color().setHSL(0.1 + Math.random() * 0.8, 1, 0.5);
            return new THREE.MeshStandardMaterial({ color: materialColor, emissive: materialColor, emissiveIntensity: 0.4 });
        },
        baseHealth: 30, healthRand: 40, healthLevelScale: 10,
        baseSpeed: 0.2, speedLevelScale: 0.02,
        contactDamage: 10,
    },
    shooter: {
        // These will be overridden in main.js with shared geometry/material for performance
        geometry: null,
        material: null,
        baseHealth: 20, healthRand: 20, healthLevelScale: 5,
        baseSpeed: 0.1, speedLevelScale: 0.01,
        contactDamage: 10,
    },
    tank: { // Damage
        geometry: () => new THREE.BoxGeometry(25, 25, 25), material: new THREE.MeshStandardMaterial({ color: 0xFF1493, emissive: 0xFF1493, emissiveIntensity: 0.4 }),
        baseHealth: 120, healthRand: 80, healthLevelScale: 30,
        baseSpeed: 0.1, speedLevelScale: 0.01,
        contactDamage: 25
    },
    berserker: { // Speed
        geometry: () => new THREE.DodecahedronGeometry(6), material: new THREE.MeshStandardMaterial({ color: 0xFF4500, emissive: 0xFF4500, emissiveIntensity: 0.4 }),
        baseHealth: 1, healthRand: 0, healthLevelScale: 0,
        baseSpeed: 0.4, speedLevelScale: 0.04,
        contactDamage: 5
    },
    magnetic: {
        geometry: () => new THREE.TorusGeometry(8, 3, 8, 16), material: new THREE.MeshStandardMaterial({ color: 0x00BFFF, emissive: 0x00BFFF, emissiveIntensity: 0.4 }),
        baseHealth: 40, healthRand: 20, healthLevelScale: 8,
        baseSpeed: 0.15, speedLevelScale: 0.015,
        contactDamage: 10
    },
    elite: {
        geometry: () => new THREE.IcosahedronGeometry(12), material: new THREE.MeshStandardMaterial({ color: 0xFFFF33, emissive: 0xFFFF33, emissiveIntensity: 0.6 }),
        baseHealth: 250, healthRand: 50, healthLevelScale: 20,
        baseSpeed: 0.18, speedLevelScale: 0.01,
        contactDamage: 15
    },
    phantom: {
        geometry: () => new THREE.OctahedronGeometry(10), material: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.4, emissive: 0xFFFFFF, emissiveIntensity: 0.6 }),
        baseHealth: 1, healthRand: 0, healthLevelScale: 0, // Takes 1 hit when vulnerable
        baseSpeed: 0.2, speedLevelScale: 0.02,
        contactDamage: 10,
    }
};

export default enemyPrototypes;
