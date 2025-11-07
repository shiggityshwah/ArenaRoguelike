/**
 * Gem System
 * Handles gem creation and enemy death rewards
 * Extracted from index-reference.html (lines ~2149-2264)
 *
 * EXTERNAL DEPENDENCIES (must be passed/injected):
 * - scene: THREE.Scene object for adding gems/coins/skeletons
 * - gems: Array of active gem objects
 * - coins: Array of active coin objects
 * - skeletons: Array of skeleton effects
 * - gemTypes: Gem configuration data (from src/config/gemTypes.js)
 * - enemyCounts: Object tracking count of each enemy type
 * - bossCount: Current number of bosses
 * - gravityWellEffects: Array of active gravity well effects
 * - coinSpriteMaterial: Material for coin sprites
 * - playerStats: Player statistics object (for luck)
 */

import * as THREE from 'three';

// Enemy to gem type mapping
const enemyGemMapping = {
    shooter: 'attackSpeed', // Purple
    tank: 'damage',         // Red
    berserker: 'speed',     // Green
    magnetic: 'vacuum',     // Blue
    elite: 'crit',          // Yellow
    phantom: 'luck',        // White
    swarm: 'tech',          // Cyan
    mortar: 'mortar'        // Military Green
};

/**
 * Creates a gem at the specified position
 * @param {string} gemType - Type of gem to create (damage, speed, attackSpeed, luck, vacuum, crit)
 * @param {THREE.Vector3} position - Position to spawn the gem
 * @param {Object} dependencies - Object containing all external dependencies
 *
 * Dependencies:
 * - scene: THREE.Scene to add gem meshes
 * - gems: Array of active gems
 * - gemTypes: Configuration for gem types
 */
export function createGem(gemType, position, dependencies) {
    const { scene, gems, gemTypes } = dependencies;

    const gemInfo = gemTypes[gemType];
    if (!gemInfo) {
        console.warn(`Attempted to create invalid gem type: ${gemType}`);
        return;
    }

    const gem = new THREE.Mesh(gemInfo.geometry, new THREE.MeshStandardMaterial({ color: gemInfo.color, flatShading: true, emissive: gemInfo.color, emissiveIntensity: 1.0, toneMapped: false }));

    const wireframeGeometry = new THREE.WireframeGeometry(gem.geometry);
    const wireframeColor = new THREE.Color(gemInfo.color).lerp(new THREE.Color(0xffffff), 0.7);
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: wireframeColor, transparent: true, opacity: 0.8 });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    gem.add(wireframe);

    gem.position.copy(position).add(new THREE.Vector3(Math.random() * 10 - 5, 0, Math.random() * 10 - 5));
    gem.position.y = 2;
    scene.add(gem);
    gems.push({ mesh: gem, type: gemType, velocity: new THREE.Vector3() });
}

/**
 * Handles enemy death - cleanup, skeleton creation, and reward drops
 * @param {Object} enemy - The enemy object that died
 * @param {Object} dependencies - Object containing all external dependencies
 *
 * Dependencies:
 * - scene: THREE.Scene to add/remove objects
 * - skeletons: Array to track skeleton effects
 * - coins: Array of active coins
 * - gems: Array of active gems
 * - gemTypes: Configuration for gem types
 * - enemyCounts: Object tracking enemy counts by type
 * - bossCount: Current boss count (passed as mutable object/getter)
 * - gravityWellEffects: Array of gravity well effects
 * - coinSpriteMaterial: Material for coin sprites
 * - playerStats: Player statistics (for luck)
 * - score: Current score (passed as mutable object/getter)
 * - scoreElement: DOM element for displaying score
 */
export function handleEnemyDeath(enemy, dependencies) {
    const {
        scene,
        skeletons,
        coins,
        gems,
        gemTypes,
        enemyCounts,
        getBossCount,
        setBossCount,
        gravityWellEffects,
        coinSpriteMaterial,
        playerStats,
        getScore,
        setScore,
        scoreElement
    } = dependencies;

    if (enemy.gravityEffect) {
        enemy.mesh.remove(enemy.gravityEffect.mesh);
        enemy.gravityEffect.mesh.geometry.dispose();
        enemy.gravityEffect.mesh.material.dispose();
        const effectIndex = gravityWellEffects.indexOf(enemy.gravityEffect);
        if (effectIndex > -1) {
            gravityWellEffects.splice(effectIndex, 1);
        }
    }

    // --- Add Skeleton ---
    const skeletonGeometry = enemy.mesh.geometry; // No need to clone for wireframe
    const skeletonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true });
    const skeleton = new THREE.Mesh(skeletonGeometry, skeletonMaterial);
    skeleton.position.copy(enemy.mesh.position);
    skeleton.quaternion.copy(enemy.mesh.quaternion);
    skeleton.scale.copy(enemy.mesh.scale); // Important for bosses
    scene.add(skeleton);
    skeletons.push({mesh: skeleton, createdAt: Date.now(), isGeometryShared: enemy.isGeometryShared});

    // --- Resource Cleanup for the original enemy ---
    if (enemy.wireframe) {
        enemy.mesh.remove(enemy.wireframe);
        enemy.wireframe.geometry.dispose();
        enemy.wireframe.material.dispose();
    }
    // All enemy materials are unique clones or new instances, so they can be disposed.
    // Handle both single material and array of materials (e.g., Cube King)
    if (enemy.mesh.material) {
        if (Array.isArray(enemy.mesh.material)) {
            enemy.mesh.material.forEach(mat => mat.dispose());
        } else {
            enemy.mesh.material.dispose();
        }
    }

    enemyCounts[enemy.type]--;

    const gemType = enemyGemMapping[enemy.type];

    // Swarm members: only drop rewards if this is the last member
    const shouldDropRewards = !enemy.swarmId || enemy.isLastSwarmMember;

    // Handle boss swarm: decrement boss count when last member dies
    if (enemy.isBossSwarm && enemy.isLastSwarmMember) {
        const newBossCount = getBossCount() - 1;
        setBossCount(newBossCount);
    }

    if (shouldDropRewards) {
        if (enemy.isBoss || (enemy.isBossSwarm && enemy.isLastSwarmMember)) {
            // Don't double-decrement boss count
            if (!enemy.isBossSwarm) {
                const newBossCount = getBossCount() - 1;
                setBossCount(newBossCount);
            }

            // Drop a big XP coin
            const coin = new THREE.Sprite(coinSpriteMaterial.clone());
            coin.scale.set(6, 6, 1);
            coin.position.copy(enemy.mesh.position);
            coin.position.y = 2;
            scene.add(coin);
            coins.push({ mesh: coin, gold: 15, velocity: new THREE.Vector3() });

            // Bosses drop 2 of their own gem type
            if (gemType) {
                for (let i = 0; i < 2; i++) {
                    createGem(gemType, enemy.mesh.position, dependencies);
                }
            }
            // And one other random gem
            const allGemTypes = Object.keys(gemTypes);
            const otherGemTypes = allGemTypes.filter(t => t !== gemType);
            if (otherGemTypes.length > 0) {
                const randomGemType = otherGemTypes[Math.floor(Math.random() * otherGemTypes.length)];
                createGem(randomGemType, enemy.mesh.position, dependencies);
            }
        } else {
            // Normal enemies drop one XP coin
            const goldAmount = Math.floor(Math.random() * 5) + 1;
            const coin = new THREE.Sprite(coinSpriteMaterial.clone());
            coin.scale.set(3, 3, 1);
            coin.position.copy(enemy.mesh.position);
            coin.position.y = 2;
            scene.add(coin);
            coins.push({ mesh: coin, gold: goldAmount, velocity: new THREE.Vector3() });

            // And have a chance to drop a specific gem (if not a 'box' enemy)
            if (gemType) {
                const dropChance = playerStats.luck; // 50% base luck = 50% chance.
                if (Math.random() < dropChance) {
                    const gemInfo = gemTypes[gemType]; // Define gemInfo for this scope
                    const gem = new THREE.Mesh(gemInfo.geometry, new THREE.MeshStandardMaterial({ color: gemInfo.color, flatShading: true, emissive: gemInfo.color, emissiveIntensity: 1.0, toneMapped: false }));

                    const wireframeGeometry = new THREE.WireframeGeometry(gem.geometry);
                    const wireframeColor = new THREE.Color(gemInfo.color).lerp(new THREE.Color(0xffffff), 0.5);
                    const wireframeMaterial = new THREE.LineBasicMaterial({ color: wireframeColor, transparent: true, opacity: 0.8 });
                    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
                    gem.add(wireframe);

                    gem.position.copy(enemy.mesh.position);
                    gem.position.y = 2;
                    scene.add(gem);
                    gems.push({ mesh: gem, type: gemType, velocity: new THREE.Vector3() });
                }
            }
        }

        const newScore = getScore() + 1;
        setScore(newScore);
        scoreElement.textContent = newScore;
    }
}
