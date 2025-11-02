// Game constants - Core configuration values for gameplay mechanics
// Extracted from index-reference.html (lines ~1599-1616)

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
