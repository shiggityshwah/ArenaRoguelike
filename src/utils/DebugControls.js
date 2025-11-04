/**
 * Debug Controls Module
 *
 * Provides functions to manipulate game state for testing and debugging.
 * Used by the DebugPanel UI to control all aspects of the game.
 */

import * as THREE from 'three';
import { spawnSpecificEnemy, spawnNewBoss } from '../systems/enemySpawning.js';
import { spawnRelic, destroyRelic } from '../systems/relicSpawning.js';
import { createGem } from '../systems/gems.js';
import { ABILITY_DEFINITIONS } from '../systems/playerAbilities.js';

export class DebugControls {
    constructor(gameState) {
        this.gameState = gameState;
    }

    // ===== PLAYER STATS CONTROL =====

    /**
     * Set a player stat to a specific value
     */
    setPlayerStat(statName, value) {
        if (this.gameState.playerStats.hasOwnProperty(statName)) {
            this.gameState.playerStats[statName] = value;
            console.log(`Set ${statName} to ${value}`);

            // Update UI if stats changed
            if (this.gameState.updateStatsUI) {
                this.gameState.updateStatsUI(this.gameState);
            }

            return true;
        }
        console.warn(`Unknown stat: ${statName}`);
        return false;
    }

    /**
     * Get current value of a player stat
     */
    getPlayerStat(statName) {
        return this.gameState.playerStats[statName];
    }

    /**
     * Apply preset stat configurations
     */
    applyPreset(presetName) {
        const presets = {
            godMode: {
                damage: 1000,
                attackSpeed: 0.05,
                maxHealth: 10000,
                armor: 500,
                critChance: 1.0,
                critMultiplier: 5.0,
                regenRate: 50,
                dodgeChance: 0.9,
                pierceCount: 10,
                areaDamageRadius: 100,
                attackDistance: 300,
                projectileSpeed: 10,
                pickupRadius: 200,
                coinPickupRadius: 300,
                luck: 10,
                cooldownReduction: 0.9,
                playerRadius: 3
            },
            weak: {
                damage: 5,
                attackSpeed: 2.0,
                maxHealth: 30,
                armor: 0,
                critChance: 0,
                critMultiplier: 1.0,
                regenRate: 0,
                dodgeChance: 0,
                pierceCount: 1,
                areaDamageRadius: 0,
                attackDistance: 50,
                projectileSpeed: 1,
                pickupRadius: 10,
                coinPickupRadius: 50,
                luck: 0.1,
                cooldownReduction: 0,
                playerRadius: 1
            },
            balanced: {
                damage: 50,
                attackSpeed: 0.35,
                maxHealth: 200,
                armor: 25,
                critChance: 0.15,
                critMultiplier: 2.5,
                regenRate: 2,
                dodgeChance: 0.1,
                pierceCount: 2,
                areaDamageRadius: 15,
                attackDistance: 120,
                projectileSpeed: 4,
                pickupRadius: 30,
                coinPickupRadius: 150,
                luck: 1.5,
                cooldownReduction: 0.2,
                playerRadius: 1.8
            }
        };

        if (presets[presetName]) {
            Object.assign(this.gameState.playerStats, presets[presetName]);
            console.log(`Applied preset: ${presetName}`);

            if (this.gameState.updateStatsUI) {
                this.gameState.updateStatsUI(this.gameState);
            }
            return true;
        }
        return false;
    }

    /**
     * Reset player stats to defaults
     */
    resetPlayerStats() {
        const defaults = {
            attackDistance: 100,
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
            attackSpeed: 0.5,
            pickupRadius: 15,
            playerRadius: 1.5,
            coinPickupRadius: 115,
            luck: 0.5,
            cooldownReduction: 0
        };

        Object.assign(this.gameState.playerStats, defaults);
        console.log('Player stats reset to defaults');

        if (this.gameState.updateStatsUI) {
            this.gameState.updateStatsUI(this.gameState);
        }
    }

    // ===== ENEMY SPAWN CONTROL =====

    /**
     * Spawn a specific enemy type
     */
    spawnEnemy(type, isBoss = false, quantity = 1, level = null) {
        const actualLevel = level !== null ? level : this.gameState.level;

        for (let i = 0; i < quantity; i++) {
            spawnSpecificEnemy(type, isBoss, {
                scene: this.gameState.scene,
                enemies: this.gameState.enemies,
                enemyPrototypes: this.gameState.enemyPrototypes,
                playerCone: this.gameState.playerCone,
                enemyCounts: this.gameState.enemyCounts,
                getBossCount: () => this.gameState.bossCount,
                setBossCount: (count) => { this.gameState.bossCount = count; },
                level: actualLevel,
                gameSpeedMultiplier: this.gameState.gameSpeedMultiplier,
                createGravityVortex: this.gameState.createGravityVortex,
                gravityWellEffects: this.gameState.gravityWellEffects
            });
        }

        console.log(`Spawned ${quantity}x ${type} ${isBoss ? '(boss)' : ''}`);
    }

    /**
     * Clear all enemies
     */
    clearAllEnemies() {
        const { enemies, scene } = this.gameState;

        while (enemies.length > 0) {
            const enemy = enemies.pop();
            scene.remove(enemy.mesh);

            // Clear gravity effects if magnetic enemy
            if (enemy.gravityEffect) {
                scene.remove(enemy.gravityEffect.mesh);
            }
        }

        // Reset enemy counts
        for (const type in this.gameState.enemyCounts) {
            this.gameState.enemyCounts[type] = 0;
        }

        this.gameState.bossCount = 0;
        console.log('All enemies cleared');
    }

    /**
     * Set whether enemies auto-spawn
     */
    setAutoSpawn(enabled) {
        this.gameState.autoSpawnEnabled = enabled;
        console.log(`Auto-spawn ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set maximum number of enemies
     */
    setMaxEnemies(max) {
        this.gameState.maxEnemies = Math.max(1, Math.min(200, max));
        console.log(`Max enemies set to ${this.gameState.maxEnemies}`);
    }

    // ===== RELIC CONTROL =====

    /**
     * Spawn a relic of a specific type
     */
    spawnRelicType(relicType, state = 'idle', nearPlayer = false) {
        let spawnPosition;

        if (nearPlayer) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 50;
            spawnPosition = new THREE.Vector3(
                this.gameState.playerCone.position.x + Math.cos(angle) * distance,
                100,
                this.gameState.playerCone.position.z + Math.sin(angle) * distance
            );
        } else {
            spawnPosition = new THREE.Vector3(
                (Math.random() - 0.5) * 900,
                100,
                (Math.random() - 0.5) * 900
            );
        }

        const relic = spawnRelic({
            relicType,
            spawnPosition,
            scene: this.gameState.scene,
            relics: this.gameState.relics,
            relicInfo: this.gameState.relicInfo,
            gravityWellEffects: this.gameState.gravityWellEffects,
            createGravityVortex: this.gameState.createGravityVortex
        });

        // Set initial state
        if (relic && state !== 'idle') {
            relic.state = state;
            if (state === 'active') {
                relic.side = 'enemy';
            } else if (state === 'converted') {
                relic.side = 'player';
            }
        }

        console.log(`Spawned ${relicType} relic (${state})`);
        return relic;
    }

    /**
     * Convert all relics to a specific side
     */
    convertAllRelics(toPlayer = true) {
        const { relics } = this.gameState;

        for (const relic of relics) {
            if (toPlayer) {
                relic.state = 'converted';
                relic.side = 'player';
            } else {
                relic.state = 'active';
                relic.side = 'enemy';
            }
        }

        console.log(`Converted all relics to ${toPlayer ? 'player' : 'enemy'}`);
    }

    /**
     * Destroy all relics
     */
    destroyAllRelics() {
        const { relics, scene } = this.gameState;

        while (relics.length > 0) {
            const relic = relics.pop();
            destroyRelic(relic, scene, this.gameState.gravityWellEffects);
        }

        console.log('All relics destroyed');
    }

    /**
     * Set maximum number of relics
     */
    setMaxRelics(max) {
        this.gameState.maxRelics = Math.max(1, Math.min(50, max));
        console.log(`Max relics set to ${this.gameState.maxRelics}`);
    }

    // ===== GEM & COIN CONTROL =====

    /**
     * Spawn gems of a specific type
     */
    spawnGems(gemType, quantity = 1, autoCollect = false) {
        const { scene, gems, playerCone, gemTypes } = this.gameState;

        for (let i = 0; i < quantity; i++) {
            let position;

            if (autoCollect) {
                // Spawn at player position for instant collection
                position = playerCone.position.clone();
            } else {
                // Spawn near player
                const angle = Math.random() * Math.PI * 2;
                const distance = 20 + Math.random() * 30;
                position = new THREE.Vector3(
                    playerCone.position.x + Math.cos(angle) * distance,
                    5,
                    playerCone.position.z + Math.sin(angle) * distance
                );
            }

            createGem({
                position,
                type: gemType,
                scene,
                gems,
                gemTypes
            });
        }

        console.log(`Spawned ${quantity}x ${gemType} gems`);
    }

    /**
     * Spawn XP coins
     */
    spawnCoins(amount = 10, autoCollect = false) {
        const { scene, coins, playerCone } = this.gameState;

        for (let i = 0; i < amount; i++) {
            let position;

            if (autoCollect) {
                position = playerCone.position.clone();
            } else {
                const angle = Math.random() * Math.PI * 2;
                const distance = 15 + Math.random() * 25;
                position = new THREE.Vector3(
                    playerCone.position.x + Math.cos(angle) * distance,
                    5,
                    playerCone.position.z + Math.sin(angle) * distance
                );
            }

            // Create coin (golden octahedron)
            const coinGeometry = new THREE.OctahedronGeometry(2);
            const coinMaterial = new THREE.MeshStandardMaterial({
                color: 0xffd700,
                emissive: 0xffd700,
                emissiveIntensity: 0.5,
                metalness: 0.8,
                roughness: 0.2
            });
            const coinMesh = new THREE.Mesh(coinGeometry, coinMaterial);
            coinMesh.position.copy(position);
            scene.add(coinMesh);

            coins.push({
                mesh: coinMesh,
                radius: 3,
                value: 1
            });
        }

        console.log(`Spawned ${amount} XP coins`);
    }

    // ===== ABILITY CONTROL =====

    /**
     * Unlock an ability
     */
    unlockAbility(abilityId) {
        const { abilitySystem } = this.gameState;

        if (!abilitySystem) {
            console.warn('Ability system not initialized');
            return false;
        }

        if (ABILITY_DEFINITIONS[abilityId]) {
            abilitySystem.unlockAbility(abilityId);
            console.log(`Unlocked ability: ${ABILITY_DEFINITIONS[abilityId].name}`);
            return true;
        }

        console.warn(`Unknown ability: ${abilityId}`);
        return false;
    }

    /**
     * Lock an ability
     */
    lockAbility(abilityId) {
        const { abilitySystem } = this.gameState;

        if (!abilitySystem) {
            console.warn('Ability system not initialized');
            return false;
        }

        abilitySystem.lockAbility(abilityId);
        console.log(`Locked ability: ${abilityId}`);
        return true;
    }

    /**
     * Reset ability cooldown
     */
    resetAbilityCooldown(abilityId) {
        const { abilitySystem } = this.gameState;

        if (!abilitySystem) {
            console.warn('Ability system not initialized');
            return false;
        }

        abilitySystem.resetCooldown(abilityId);
        console.log(`Reset cooldown for: ${abilityId}`);
        return true;
    }

    /**
     * Unlock all abilities
     */
    unlockAllAbilities() {
        const { abilitySystem } = this.gameState;

        if (!abilitySystem) {
            console.warn('Ability system not initialized');
            return false;
        }

        for (const abilityId in ABILITY_DEFINITIONS) {
            abilitySystem.unlockAbility(abilityId);
        }

        console.log('Unlocked all abilities');
        return true;
    }

    /**
     * Lock all abilities
     */
    lockAllAbilities() {
        const { abilitySystem } = this.gameState;

        if (!abilitySystem) {
            console.warn('Ability system not initialized');
            return false;
        }

        for (const abilityId in ABILITY_DEFINITIONS) {
            abilitySystem.lockAbility(abilityId);
        }

        console.log('Locked all abilities');
        return true;
    }

    // ===== GAME STATE CONTROL =====

    /**
     * Set player level
     */
    setLevel(level) {
        this.gameState.level = Math.max(1, Math.min(100, level));
        console.log(`Level set to ${this.gameState.level}`);

        if (this.gameState.updateLevelUI) {
            this.gameState.updateLevelUI(this.gameState);
        }
    }

    /**
     * Add experience points
     */
    addExperience(amount) {
        this.gameState.experience += amount;
        console.log(`Added ${amount} XP (total: ${this.gameState.experience})`);

        if (this.gameState.updateExperienceBar) {
            this.gameState.updateExperienceBar(this.gameState);
        }
    }

    /**
     * Set player health
     */
    setHealth(health) {
        const maxHealth = this.gameState.playerStats.maxHealth;
        this.gameState.playerHealth = Math.max(0, Math.min(maxHealth, health));
        console.log(`Health set to ${this.gameState.playerHealth}/${maxHealth}`);
    }

    /**
     * Heal player to full health
     */
    healPlayer() {
        this.gameState.playerHealth = this.gameState.playerStats.maxHealth;
        console.log('Player healed to full health');
    }

    /**
     * Set score
     */
    setScore(score) {
        this.gameState.score = Math.max(0, score);
        console.log(`Score set to ${this.gameState.score}`);

        if (this.gameState.updateScoreUI) {
            this.gameState.updateScoreUI(this.gameState);
        }
    }

    /**
     * Set wave number
     */
    setWave(waveNumber) {
        this.gameState.waveNumber = Math.max(0, waveNumber);
        console.log(`Wave set to ${this.gameState.waveNumber}`);
    }

    /**
     * Set game speed multiplier
     */
    setGameSpeed(multiplier) {
        this.gameState.gameSpeedMultiplier = Math.max(0.1, Math.min(5.0, multiplier));
        console.log(`Game speed set to ${this.gameState.gameSpeedMultiplier}x`);
    }

    /**
     * Trigger level up
     */
    triggerLevelUp() {
        if (this.gameState.levelUp) {
            this.gameState.levelUp(this.gameState);
            console.log('Level up triggered');
        }
    }

    /**
     * Clear current wave
     */
    clearWave() {
        this.clearAllEnemies();

        // Clear all bosses
        const { bosses, scene, bossUIManager } = this.gameState;
        while (bosses && bosses.length > 0) {
            const boss = bosses.pop();
            if (boss.mesh) {
                scene.remove(boss.mesh);
            }
            if (bossUIManager) {
                bossUIManager.removeHealthBar(boss.id);
            }
        }

        console.log('Wave cleared');
    }

    /**
     * Set max level (99)
     */
    setMaxLevel() {
        this.setLevel(99);
        this.gameState.experience = 0;
        this.gameState.experienceToNextLevel = 99 * 5;
        console.log('Set to max level (99)');
    }

    // ===== BOSS CONTROL =====

    /**
     * Spawn a specific boss type
     */
    spawnBoss(bossType) {
        const { scene, level, waveNumber, bosses, bossUIManager, playerCone } = this.gameState;

        const boss = spawnNewBoss({
            scene,
            level,
            waveNumber,
            bosses,
            bossUIManager,
            playerCone,
            bossType
        });

        if (boss) {
            console.log(`Spawned boss: ${bossType}`);
        }

        return boss;
    }
}

export default DebugControls;
