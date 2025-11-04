// Game constants - Core configuration values for gameplay mechanics
// Extracted from index-reference.html (lines ~1599-1616)

// Development mode - enables ability testing hotkeys (1-4)
export const DEV_MODE = true;

export const INITIAL_ENEMY_COUNT = 10;
export const BASE_PLAYER_SPEED = 0.5;
export const BASE_PLAYER_RADIUS = 1.5;
export const BASE_ENEMY_PROJECTILE_SPEED = 2.0;
export const BASE_OCTAHEDRON_COOLDOWN = 2.5;
export const MAX_ENEMIES_TOTAL = 20;
export const MAX_BOSSES = 3;
export const MIN_BOX_RATIO = 0.6;

export const RELIC_SPAWN_Y = 400;
export const MAX_RELICS = 20;

// Relic spawn priority: White > Yellow > Blue > Green > Red > Purple
export const relicPriority = ['luck', 'crit', 'vacuum', 'speed', 'damage', 'attackSpeed'];

// Boss System Constants
export const BOSS_WAVE_INTERVAL = 5; // Boss spawns every N waves (waves 5, 10, 15, etc.)
export const BOSS_XP_REWARD = 50; // XP gained from defeating a boss
export const BOSS_UPGRADE_MIN_QUALITY = 'rare'; // Minimum upgrade quality from boss kills
export const MAX_ACTIVE_BOSSES = 1; // Only 1 boss active at a time
export const BOSS_DESPAWN_TIME = 120; // Seconds before boss despawns if not defeated (0 = never)
export const BOSS_MINION_LIMIT = 10; // Max minions a boss can have spawned at once
