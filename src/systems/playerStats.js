/**
 * Player Stats System
 * Factory function for creating and managing player statistics
 * Extracted from index-reference.html (lines ~1271-1289)
 *
 * DEPENDENCIES: None - pure data object
 */

/**
 * Creates a new player stats object with default values
 * @returns {Object} Player stats object with all combat and movement properties
 */
export function createPlayerStats() {
    return {
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
        attackSpeed: 0.5, // Cooldown in seconds
        pickupRadius: 15,
        playerRadius: 1.5,
        coinPickupRadius: 115,
        luck: 0.5,
        cooldownReduction: 0
    };
}

/**
 * Resets player stats to default values (in-place mutation)
 * @param {Object} playerStats - The player stats object to reset
 */
export function resetPlayerStats(playerStats) {
    const defaults = createPlayerStats();
    Object.assign(playerStats, defaults);
}
