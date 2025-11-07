// Game constants - Core configuration values for gameplay mechanics
// Extracted from index-reference.html (lines ~1599-1616)

// Development mode - enables ability testing hotkeys (1-4)
export const DEV_MODE = true;

// Arena size constants
export const ARENA_SIZE = 2000; // Total arena width/length
export const ARENA_HALF_SIZE = 1000; // Half arena size (for -X to +X calculations)
export const ARENA_PLAYABLE_HALF_SIZE = 980; // Slightly smaller than arena to account for wall thickness
export const WALL_HEIGHT = 100;
export const WALL_THICKNESS = 40;

export const INITIAL_ENEMY_COUNT = 10;
export const BASE_PLAYER_SPEED = 0.5;
export const BASE_PLAYER_RADIUS = 1.5;
export const BASE_ENEMY_PROJECTILE_SPEED = 2.0;
export const BASE_OCTAHEDRON_COOLDOWN = 2.5;
export const MAX_ENEMIES_TOTAL = 20;
export const MAX_BOSSES = 3;
export const MIN_BOX_RATIO = 0.6;

// Wave + Trickle Spawn System Constants
export const WAVE_INITIAL_SPAWN_COUNT = 8;  // Enemies spawned at wave start
export const TRICKLE_SPAWN_INTERVAL = 2.5;  // Seconds between trickle spawns
export const TRICKLE_DURING_BOSS = true;    // Enable trickle during boss fights
export const BOSS_WAVE_ENEMY_COUNT = 4;     // Enemies spawned with boss

export const RELIC_SPAWN_Y = 400;
export const MAX_RELICS = 20;

// Relic spawn priority: White > Yellow > Blue > Green > Cyan > Military Green > Red > Purple
export const relicPriority = ['luck', 'crit', 'vacuum', 'speed', 'droneSwarm', 'adaptiveTargeting', 'damage', 'attackSpeed'];

// Boss System Constants
export const BOSS_WAVE_INTERVAL = 5; // Boss spawns every N waves (waves 5, 10, 15, etc.)
export const BOSS_XP_REWARD = 50; // XP gained from defeated a boss
export const BOSS_UPGRADE_MIN_QUALITY = 'rare'; // Minimum upgrade quality from boss kills
export const MAX_ACTIVE_BOSSES = 1; // Only 1 boss active at a time
export const BOSS_DESPAWN_TIME = 120; // Seconds before boss despawns if not defeated (0 = never)
export const BOSS_MINION_LIMIT = 10; // Max minions a boss can have spawned at once

// Mortar Enemy Configuration
export const MORTAR_CONFIG = {
    shootRange: 280,              // Maximum shooting distance
    shootCooldown: 4.0,            // Seconds between shots
    projectileFlightTime: 1.0,     // Time projectile takes to reach target (halved for 2x speed)
    warningDuration: 2.6,          // Ground warning time before impact (doubled)
    explosionRadius: 35,           // AoE damage radius
    projectileDamage: 30,          // Base damage on impact
    lobApex: 150,                  // Maximum height of arc (increased from 60)
    gravity: -30,                  // Gravity acceleration for arc physics (increased from -20)
};
