/**
 * UI System
 * Handles updating game UI elements
 * Extracted from index-reference.html (lines ~1291-1303)
 *
 * EXTERNAL DEPENDENCIES (via DOM):
 * - HTML elements with IDs: stat-attack-speed, stat-damage, stat-luck, stat-pickup-radius,
 *   stat-crit-chance, stat-armor, stat-regen, stat-dodge, stat-pierce, stat-aoe
 */

/**
 * Updates the stats UI panel with current player stats
 * @param {Object} playerStats - The player stats object containing all combat properties
 *
 * Dependencies:
 * - playerStats.attackSpeed: Attack cooldown in seconds
 * - playerStats.cooldownReduction: Cooldown reduction percentage (0-1)
 * - playerStats.damage: Base damage value
 * - playerStats.luck: Luck value (0-1+)
 * - playerStats.pickupRadius: Pickup radius in units
 * - playerStats.critChance: Critical hit chance (0-1)
 * - playerStats.armor: Armor value
 * - playerStats.regenRate: Health regeneration per second
 * - playerStats.dodgeChance: Dodge chance (0-1)
 * - playerStats.pierceCount: Number of enemies projectile can pierce
 * - playerStats.areaDamageRadius: Area of effect damage radius
 */
export function updateStatsUI(playerStats) {
    const effectiveCooldown = playerStats.attackSpeed * (1 - playerStats.cooldownReduction);
    document.getElementById('stat-attack-speed').textContent = (1 / effectiveCooldown).toFixed(2);
    document.getElementById('stat-damage').textContent = playerStats.damage;
    document.getElementById('stat-luck').textContent = (playerStats.luck * 100).toFixed(0);
    document.getElementById('stat-pickup-radius').textContent = playerStats.pickupRadius;
    document.getElementById('stat-crit-chance').textContent = (playerStats.critChance * 100).toFixed(0);
    document.getElementById('stat-armor').textContent = playerStats.armor;
    document.getElementById('stat-regen').textContent = playerStats.regenRate.toFixed(1);
    document.getElementById('stat-dodge').textContent = (playerStats.dodgeChance * 100).toFixed(0);
    document.getElementById('stat-pierce').textContent = playerStats.pierceCount;
    document.getElementById('stat-aoe').textContent = playerStats.AOERadius;
}

/**
 * Updates the score display
 * @param {number} score - Current score value
 *
 * Dependencies:
 * - HTML element with ID: score
 */
export function updateScoreUI(score) {
    document.getElementById('score').textContent = score;
}

/**
 * Updates the level display
 * @param {number} level - Current level value
 *
 * Dependencies:
 * - HTML element with ID: level
 */
export function updateLevelUI(level) {
    document.getElementById('level').textContent = level;
}

/**
 * Updates the wave number display
 * @param {number} wave - Current wave number
 *
 * Dependencies:
 * - HTML element with ID: wave
 */
export function updateWaveUI(wave) {
    document.getElementById('wave').textContent = wave;
}
