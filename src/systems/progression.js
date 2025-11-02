/**
 * Progression System
 * Handles player leveling, experience, and upgrade system
 * Extracted from index-reference.html (lines ~3397-3627)
 *
 * EXTERNAL DEPENDENCIES:
 * - THREE: Three.js library for color interpolation
 * - playerStats: Player statistics object
 * - playerCone: THREE.Mesh of the player
 * - enemies: Array of active enemies
 * - damageNumberManager: Manager for damage number popups
 * - BASE_PLAYER_RADIUS: Constant for base player size
 * - INITIAL_ENEMY_COUNT: Initial enemy spawn count
 * - MAX_ENEMIES_TOTAL: Maximum number of enemies
 * - HTML elements: experience-bar, level, level-up-overlay, upgrade-options
 */

import * as THREE from 'three';
import { BASE_PLAYER_RADIUS, INITIAL_ENEMY_COUNT, MAX_ENEMIES_TOTAL } from '../config/constants.js';

// Stat upgrade pool configuration
const statUpgradePool = {
    common: ['damage', 'attackSpeed', 'maxHealth', 'critChance', 'regenRate', 'armor', 'pierceCount', 'areaDamageRadius', 'luck', 'dodgeChance', 'pickupRadius']
};

// Quality tier definitions for upgrade visuals
const qualityTiers = {
    common:   { color: '#9e9e9e', boxShadow: 'none' },
    uncommon: { color: '#4caf50', boxShadow: 'none' },
    rare:     { color: '#2196f3', boxShadow: '0 0 12px rgba(33, 150, 243, 0.7)' },
    epic:     { color: '#9c27b0', boxShadow: '0 0 18px rgba(156, 39, 176, 0.9), 0 0 8px rgba(156, 39, 176, 0.9)' },
    legendary:{ color: '#ffc107', boxShadow: '0 0 25px rgba(255, 193, 7, 1), 0 0 12px rgba(255, 193, 7, 1)' }
};

// Skip button hold state
let skipButtonHoldStart = 0;
let skipButtonHoldTimer = null;
let skipButtonAnimationId = null;
const SKIP_HOLD_DURATION = 2000;

/**
 * Updates the experience bar visual
 * @param {number} experience - Current experience points
 * @param {number} experienceToNextLevel - Experience needed for next level
 *
 * Dependencies:
 * - HTML element with ID: experience-bar
 */
export function updateExperienceBar(experience, experienceToNextLevel) {
    const experienceBarElement = document.getElementById('experience-bar');
    const percentage = (experience / experienceToNextLevel) * 100;
    experienceBarElement.style.width = percentage + '%';
}

/**
 * Handles level up logic - increases level, adjusts difficulty, shows upgrade popup
 * @param {Object} state - Game state object
 * @returns {Object} Updated state object
 *
 * State properties:
 * - level: Current player level
 * - experience: Current experience points
 * - experienceToNextLevel: Experience needed for next level
 * - gameSpeedMultiplier: Game speed scaling factor
 * - playerScaleMultiplier: Player size scaling factor
 * - maxEnemies: Maximum number of enemies allowed
 * - playerStats: Player statistics object
 * - playerCone: THREE.Mesh of the player
 * - enemies: Array of active enemy objects
 */
export function levelUp(state) {
    const {
        level,
        experience,
        experienceToNextLevel,
        gameSpeedMultiplier,
        playerScaleMultiplier,
        playerStats,
        playerCone,
        enemies
    } = state;

    // Increment level
    const newLevel = level + 1;
    document.getElementById('level').textContent = newLevel;

    // Update experience
    const newExperience = experience - experienceToNextLevel;
    const newExperienceToNextLevel = Math.floor(experienceToNextLevel * 1.2 + 5);
    updateExperienceBar(newExperience, newExperienceToNextLevel);

    // Game Speed & Player Growth Scaling
    const speedIncreaseFactor = Math.max(1.03, 1.15 - (newLevel - 2) * 0.02);
    const newGameSpeedMultiplier = Math.min(8.0, gameSpeedMultiplier * speedIncreaseFactor);

    const scaleIncreaseFactor = Math.max(1.01, 1.10 - (newLevel - 2) * 0.01);
    const newPlayerScaleMultiplier = Math.min(4.0, playerScaleMultiplier * scaleIncreaseFactor);

    playerCone.scale.set(newPlayerScaleMultiplier, newPlayerScaleMultiplier, newPlayerScaleMultiplier);
    playerStats.playerRadius = BASE_PLAYER_RADIUS * newPlayerScaleMultiplier;

    // Apply automatic damage bonus
    playerStats.damage += 3;

    // Update all existing enemies with the new speed
    for (const enemy of enemies) {
        enemy.speed = enemy.baseSpeed * newGameSpeedMultiplier;
    }

    // Show upgrade popup
    showLevelUpPopup(state);

    // Increase max enemies with level
    const newMaxEnemies = Math.min(MAX_ENEMIES_TOTAL, INITIAL_ENEMY_COUNT + (newLevel - 1) * 2);

    // Return updated state
    return {
        level: newLevel,
        experience: newExperience,
        experienceToNextLevel: newExperienceToNextLevel,
        gameSpeedMultiplier: newGameSpeedMultiplier,
        playerScaleMultiplier: newPlayerScaleMultiplier,
        maxEnemies: newMaxEnemies
    };
}

/**
 * Determines upgrade quality tier based on normalized value (luck-adjusted)
 * @param {number} normalizedValue - Value between 0 and 1
 * @returns {string} Quality tier name (common, uncommon, rare, epic, legendary)
 */
export function getQuality(normalizedValue) {
    if (normalizedValue < 0.2) return 'common';
    if (normalizedValue < 0.4) return 'uncommon';
    if (normalizedValue < 0.65) return 'rare';
    if (normalizedValue < 0.85) return 'epic';
    return 'legendary';
}

/**
 * Generates random upgrade options for level up
 * @param {number} count - Number of upgrade options to generate
 * @param {Object} playerStats - Player statistics object (for luck calculation)
 * @returns {Array<Object>} Array of upgrade option objects
 *
 * Each option object contains:
 * - stat: Stat name (string)
 * - value: Upgrade value (number)
 * - text: Display text (string)
 * - quality: Quality tier (string)
 */
export function getUpgradeOptions(count, playerStats) {
    const options = [];
    const availableStats = [...statUpgradePool.common];

    // Shuffle available stats
    for (let i = availableStats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableStats[i], availableStats[j]] = [availableStats[j], availableStats[i]];
    }

    for (let i = 0; i < count && i < availableStats.length; i++) {
        const stat = availableStats[i];
        let value, text, quality;
        const luckFactor = Math.max(Math.random(), Math.random() + playerStats.luck - 0.5);
        const normalizedValue = Math.min(luckFactor, 1);

        switch (stat) {
            case 'damage':
                value = 3 + Math.floor(normalizedValue * 9);
                text = `+${value} DMG`;
                break;
            case 'attackSpeed':
                value = 1 - (0.05 + normalizedValue * 0.15); // 0.95 to 0.80
                text = `+${((1/value - 1) * 100).toFixed(0)}% ASPD`;
                break;
            case 'maxHealth':
                value = 5 + Math.floor(normalizedValue * 15);
                text = `+${value} HP`;
                break;
            case 'critChance':
                value = 0.01 + normalizedValue * 0.04;
                text = `+${(value * 100).toFixed(0)}% Crit`;
                break;
            case 'regenRate':
                value = 0.1 + normalizedValue * 0.4;
                text = `+${value.toFixed(1)} HP/s`;
                break;
            case 'armor':
                value = 2 + Math.floor(normalizedValue * 6);
                text = `+${value} Armor`;
                break;
            case 'pierceCount':
                value = 1 + Math.floor(normalizedValue * 1);
                text = `+${value} Pierce`;
                break;
            case 'areaDamageRadius':
                value = 5 + Math.floor(normalizedValue * 10);
                text = `+${value} AoE`;
                break;
            case 'luck':
                value = 0.02 + normalizedValue * 0.08;
                text = `+${(value * 100).toFixed(0)}% Luck`;
                break;
            case 'dodgeChance':
                value = 0.02 + normalizedValue * 0.04;
                text = `+${(value * 100).toFixed(0)}% Dodge`;
                break;
            case 'pickupRadius':
                value = 3 + Math.floor(normalizedValue * 7);
                text = `+${value} Pickup`;
                break;
        }
        quality = getQuality(normalizedValue);
        options.push({ stat, value, text, quality });
    }
    return options;
}

/**
 * Applies an upgrade option to player stats
 * @param {Object} option - Upgrade option object
 * @param {Object} dependencies - Object containing dependencies
 *
 * Dependencies:
 * - playerStats: Player statistics object
 * - playerHealth: Current player health (mutable)
 * - damageNumberManager: Manager for damage number popups
 * - playerCone: THREE.Mesh of the player (for damage number positioning)
 * - updateStatsUI: Function to update the stats UI
 */
export function applyUpgrade(option, dependencies) {
    const { playerStats, damageNumberManager, playerCone, updateStatsUI } = dependencies;
    let playerHealth = dependencies.playerHealth;

    switch (option.stat) {
        case 'damage':
            playerStats.damage += option.value;
            break;
        case 'attackSpeed':
            playerStats.attackSpeed = Math.max(0.05, playerStats.attackSpeed * option.value);
            break;
        case 'maxHealth':
            playerStats.maxHealth += option.value;
            damageNumberManager.create(playerCone, option.value, { isHeal: true });
            playerHealth += option.value;
            dependencies.playerHealth = playerHealth; // Update reference
            break;
        case 'critChance':
            playerStats.critChance = Math.min(0.75, playerStats.critChance + option.value);
            break;
        case 'regenRate':
            playerStats.regenRate = Math.min(5.0, playerStats.regenRate + option.value);
            break;
        case 'armor':
            playerStats.armor = Math.min(200, playerStats.armor + option.value);
            break;
        case 'pierceCount':
            playerStats.pierceCount = Math.min(8, playerStats.pierceCount + option.value);
            break;
        case 'areaDamageRadius':
            playerStats.areaDamageRadius = Math.min(100, playerStats.areaDamageRadius + option.value);
            break;
        case 'luck':
            playerStats.luck = Math.min(1.5, playerStats.luck + option.value);
            break;
        case 'dodgeChance':
            playerStats.dodgeChance = Math.min(0.6, playerStats.dodgeChance + option.value);
            break;
        case 'pickupRadius':
            playerStats.pickupRadius += option.value;
            playerStats.coinPickupRadius += option.value * 2;
            break;
    }
    updateStatsUI(playerStats);
}

/**
 * Hides the level up popup and resumes game
 * @param {Object} state - Game state object (containing setGamePaused callback)
 */
export function hideLevelUpPopup(state) {
    document.getElementById('level-up-overlay').classList.remove('visible');

    // Cleanup skip button state
    clearTimeout(skipButtonHoldTimer);
    cancelAnimationFrame(skipButtonAnimationId);
    skipButtonHoldStart = 0;
    skipButtonHoldTimer = null;
    skipButtonAnimationId = null;

    // Resume game
    if (state.setGamePaused) state.setGamePaused(false);
}

/**
 * Shows the level up popup with upgrade options
 * @param {Object} state - Game state object
 *
 * State properties:
 * - playerStats: Player statistics object
 * - playerHealth: Current player health (for maxHealth upgrade)
 * - damageNumberManager: Manager for damage number popups
 * - playerCone: THREE.Mesh of the player
 * - updateStatsUI: Function to update the stats UI
 *
 * Returns updated state with isGamePaused set to true
 */
export function showLevelUpPopup(state) {
    const { playerStats, setGamePaused } = state;

    // Pause game
    if (setGamePaused) setGamePaused(true);

    const options = getUpgradeOptions(3, playerStats);
    const optionsContainer = document.getElementById('upgrade-options');
    optionsContainer.innerHTML = ''; // Clear previous options

    options.forEach(option => {
        const button = document.createElement('div');
        button.className = 'upgrade-button';
        const qualityInfo = qualityTiers[option.quality];
        button.style.backgroundColor = qualityInfo.color;
        button.style.boxShadow = qualityInfo.boxShadow;

        button.innerHTML = `<span class="stat-name">${option.stat.toUpperCase()}</span><span class="stat-value">${option.text}</span>`;

        const onSelect = () => {
            applyUpgrade(option, state);
            hideLevelUpPopup(state);
        };
        button.addEventListener('click', onSelect);
        button.addEventListener('touchend', (e) => { e.preventDefault(); onSelect(); });

        optionsContainer.appendChild(button);
    });

    // Skip Button
    const skipContainer = document.createElement('div');
    skipContainer.id = 'skip-button-container';
    const skipProgress = document.createElement('div');
    skipProgress.id = 'skip-button-progress';
    skipContainer.appendChild(skipProgress);
    optionsContainer.appendChild(skipContainer);

    function skipButtonHoldLoop() {
        if (!skipButtonHoldStart) return;
        const elapsed = performance.now() - skipButtonHoldStart;
        const progress = Math.min(elapsed / SKIP_HOLD_DURATION, 1);
        skipProgress.style.width = `${(1 - progress) * 100}%`;
        const color = new THREE.Color(0x00ff00).lerp(new THREE.Color(0xff0000), progress);
        skipProgress.style.backgroundColor = `#${color.getHexString()}`;
        if (progress < 1) skipButtonAnimationId = requestAnimationFrame(skipButtonHoldLoop);
    }

    const startHold = (e) => {
        e.preventDefault();
        skipButtonHoldStart = performance.now();
        skipButtonHoldLoop();
        skipButtonHoldTimer = setTimeout(() => {
            hideLevelUpPopup(state);
        }, SKIP_HOLD_DURATION);
    };
    const endHold = (e) => {
        e.preventDefault();
        clearTimeout(skipButtonHoldTimer);
        cancelAnimationFrame(skipButtonAnimationId);
        skipButtonHoldStart = 0;
        skipProgress.style.width = '100%';
        skipProgress.style.backgroundColor = '#00ff00';
    };

    skipContainer.addEventListener('mousedown', startHold);
    skipContainer.addEventListener('mouseup', endHold);
    skipContainer.addEventListener('mouseleave', endHold);
    skipContainer.addEventListener('touchstart', startHold);
    skipContainer.addEventListener('touchend', endHold);

    document.getElementById('level-up-overlay').classList.add('visible');
}
