# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArenaRoguelike is a browser-based 3D roguelike game built with Three.js. The game features wave-based arena combat where the player collects gems, levels up, and activates relics that provide various combat abilities.

The codebase has been refactored from a single-file HTML application (~3900 lines) into a modular ES6 structure with clear separation of concerns.

## Development

**Running the game:**

The game requires a local HTTP server (ES6 modules don't work with `file://` protocol):

```bash
# Python 3
python -m http.server 8000

# Then open http://localhost:8000
```

Alternatively, use Node's `http-server` or PHP's built-in server. See README.md for details.

**Testing:**

Open the browser's developer console (F12) to view logs and errors. The game has a built-in debug system that can be enabled by changing `display: none` to `display: block` on the `#debug-info` CSS rule in `styles.css`.

## Project Structure

```
ArenaRoguelike/
├── index.html              # Entry point HTML
├── index-reference.html    # Original single-file version (for reference)
├── styles.css              # All CSS styles
└── src/
    ├── main.js            # Game initialization and main loop
    ├── config/            # Static configuration and data
    │   ├── constants.js   # Game constants (spawn rates, limits, etc.)
    │   ├── enemyTypes.js  # Enemy type definitions
    │   ├── gemTypes.js    # Gem type definitions with geometries
    │   └── relicInfo.js   # Relic configuration (health, damage, etc.)
    ├── managers/          # Resource management systems
    │   ├── AreaWarningManager.js  # Ground warning shader system
    │   ├── AudioManager.js        # Sound effects manager
    │   ├── DamageNumberManager.js # Floating damage numbers
    │   ├── ErrorWatcher.js        # Error logging and throttling
    │   ├── ObjectPool.js          # Object pooling for projectiles
    │   └── SpatialGrid.js         # Spatial partitioning for collisions
    ├── systems/           # Game logic systems
    │   ├── combat.js          # Player/enemy shooting and collision
    │   ├── effects.js         # Visual effects (explosions, debris, vortex)
    │   ├── enemySpawning.js   # Enemy spawning and boss logic
    │   ├── gems.js            # Gem creation and enemy death handling
    │   ├── input.js           # Keyboard, mouse, and touch input
    │   ├── playerStats.js     # Player statistics object
    │   ├── progression.js     # Leveling, XP, and upgrade system
    │   ├── relicCombat.js     # Combat strategies for each relic type
    │   ├── relicSpawning.js   # Relic spawning and lifecycle
    │   └── ui.js              # UI update functions
    └── utils/             # Utility functions
        ├── Debug.js           # Performance monitoring and debug logging
        ├── helpers.js         # General helper functions (clamp, lerp, etc.)
        ├── LogBuffer.js       # Console message buffering
        └── TrailRenderer.js   # Trail/ribbon mesh system
```

## Module Architecture

### Dependency Injection Pattern

Most systems use a **factory function pattern** that accepts dependencies and returns an API object:

```javascript
// Example: Combat system
export function createCombatSystem(dependencies) {
  const { scene, clock, spatialGrid, AudioManager } = dependencies;

  return {
    updatePlayerShooting(gameState) { /* ... */ },
    updateBlasterShots(gameState) { /* ... */ }
  };
}
```

This makes modules:
- **Testable**: Easy to mock dependencies
- **Modular**: No hard-coded globals
- **Maintainable**: Clear dependency documentation

### Import Organization

Files follow a consistent import structure:

1. External dependencies (THREE.js)
2. Config imports
3. Manager imports
4. System imports
5. Utility imports

### Export Patterns

- **Config files**: Default exports (objects)
- **Managers**: Class exports (ObjectPool, SpatialGrid, DamageNumberManager) or singleton objects (AudioManager, ErrorWatcher)
- **Systems**: Named function exports
- **Utils**: Named function exports or class exports

## Core Systems

### Game State (src/main.js)

The main file manages all global game state:
- **Core vars**: `score`, `level`, `experience`, `playerHealth`, `isGameOver`, `isGamePaused`
- **Player**: `playerCone` (THREE.Mesh), `playerStats` (object), `playerBuffs` (object)
- **Entity arrays**: `enemies[]`, `relics[]`, `coins[]`, `gems[]`, `blasterShots[]`, `enemyProjectiles[]`, `relicProjectiles[]`, `beams[]`, `temporaryEffects[]`, `skeletons[]`
- **Managers**: Initialized instances of ObjectPool, SpatialGrid, DamageNumberManager, etc.

### Main Game Loop (src/main.js: animate function)

The `animate()` function runs at 60 FPS via `requestAnimationFrame`:

1. **Pre-update**: Check pause/game-over state, reset debug timers
2. **Player**: Movement (WASD/drag), shooting logic
3. **Projectiles**: Update player shots, enemy shots, relic projectiles
4. **Enemies**: AI, movement, shooting, collision
5. **Relics**: State transitions, combat strategies
6. **Effects**: Explosions, debris, trails, damage numbers, area warnings
7. **Pickups**: Gem/coin attraction and collection
8. **Cleanup**: Skeletons, expired effects
9. **Camera**: Follow player with zoom controls
10. **Render**: THREE.js scene rendering
11. **Game Over**: Check player death, show restart button

### Relic System (src/systems/relicCombat.js, relicSpawning.js)

**Six relic types**, each with unique geometry, color, and combat strategy:

- `attackSpeed` (purple): Beam weapon that continuously damages
- `damage` (red): Cannon with splash damage projectiles
- `speed` (green): Buff aura (increases player move/attack speed/damage)
- `vacuum` (blue): Gravity well that pulls and damages enemies
- `crit` (yellow): Multi-shot targeting multiple enemies
- `luck` (white): Damaging aura strike on strongest enemy

**Relic states:**
- `idle`: Falling from sky, invulnerable
- `active`: Enemy-controlled, attacks player
- `converting`: Player is capturing (stand nearby)
- `converted`: Player-controlled, attacks enemies
- `returning`: Converting back to enemy control when player leaves

**RelicCombatStrategies** object defines:
- `update(relic, now, delta)`: Called each frame for active/converted relics
- `onActivate(relic)`: Called when relic becomes active (setup visuals)

### Enemy System (src/systems/enemySpawning.js, src/config/enemyTypes.js)

**Seven enemy types** with level-scaling health/speed:

- `box`: Basic enemy with random colors
- `shooter`: Fires projectiles at player
- `tank`: High health, high damage (red/damage gem themed)
- `berserker`: Fast, low health (orange/speed gem themed)
- `magnetic`: Pulls player toward it (blue/vacuum gem themed)
- `elite`: Strong all-rounder (yellow/crit gem themed)
- `phantom`: Toggles invulnerability phases (white/luck themed)

**Enemy spawning:**
- `spawnEnemy()`: Smart spawning with box ratio maintenance
- `getWeightedRandomEnemyType(level)`: Level-based weighted selection
- `spawnBoss()`: Random boss at 2.5× scale with 5× health
- Enemy unlock levels restrict which types spawn at low levels

### Combat System (src/systems/combat.js)

**Player shooting:**
- Auto-targets nearest enemy
- Cooldown based on `attackSpeed` stat (reduced by buffs)
- Projectiles from ObjectPool with trail effects
- Critical hit chance/multiplier

**Collision detection:**
- Uses SpatialGrid for O(n) instead of O(n²)
- Projectiles check nearby enemies via `spatialGrid.getNearby()`
- Contact damage checks player distance to all enemies

**Damage calculation:**
- Armor reduction: `damage * (50 / (50 + armor))`
- Critical hits: `baseDamage * critMultiplier`
- AoE damage: Spatial query for enemies within radius
- Pierce: Track hit enemies per projectile

### Progression System (src/systems/progression.js)

**Leveling:**
- Collect coins to gain experience
- XP required increases each level: `experienceToNextLevel = level * 5`
- Level up triggers popup with 3 upgrade options
- Game speed and player size scale with level

**Upgrades:**
- 12 stat types: damage, attackSpeed, maxHealth, critChance, regenRate, armor, pierceCount, areaDamageRadius, luck, dodgeChance, pickupRadius, cooldownReduction
- Quality tiers: common (white), uncommon (green), rare (blue), epic (purple), legendary (orange)
- Value scaling based on luck stat
- Color-coded circular buttons in bottom-right

**Skip mechanic:**
- Hold skip button for 2 seconds to decline upgrade and resume

### Input System (src/systems/input.js)

**Keyboard:** WASD movement, SPACE to shoot, tracked in `keyState` object

**Mouse/Touch drag:**
- Creates visual dot and line on screen
- Updates `movementDirection` Vector2
- Works alongside keyboard (adds to WASD)

**Mobile spacebar button:**
- Displayed on touch devices
- Hold to shoot

## Performance Optimizations

- **SpatialGrid**: Reduces collision checks from O(n²) to O(n)
- **ObjectPool**: Reuses projectile meshes to reduce GC pressure
- **Shared geometries**: Enemies of same type share geometry instances
- **Spatial queries**: Only check nearby entities for collisions/effects
- **Debug system**: Tracks frame timing and performance breakdown

## Common Modifications

### Adding a new enemy type

1. **Add to `src/config/enemyTypes.js`:**
   ```javascript
   newType: {
       geometry: () => new THREE.IcosahedronGeometry(10),
       material: new THREE.MeshStandardMaterial({ color: 0xFF00FF }),
       baseHealth: 50,
       healthRand: 20,
       healthLevelScale: 10,
       baseSpeed: 0.15,
       speedLevelScale: 0.015,
       contactDamage: 15
   }
   ```

2. **Add to spawn weights in `src/systems/enemySpawning.js`:**
   - Update `spawnWeights` array
   - Add to `enemyUnlockLevels` if should unlock at specific level

3. **Add special behavior in `src/main.js: updateEnemies()` if needed**

### Adding a new relic type

1. **Add to `src/config/relicInfo.js`:**
   ```javascript
   newType: {
       name: 'Display Name',
       health: 600,
       geometry: new THREE.IcosahedronGeometry(24),
       color: 0xFF00FF,
       range: 200,
       cooldown: 2.0,
       damage: 150
   }
   ```

2. **Add to `src/config/gemTypes.js`** (matching color/shape)

3. **Add strategy to `src/systems/relicCombat.js`:**
   ```javascript
   newType: {
       update(relic, now, delta) { /* combat logic */ },
       onActivate(relic) { /* optional setup */ }
   }
   ```

4. **Update `relicPriority` array in `src/config/constants.js`** (spawn order)

### Adding a new upgrade

1. **Add stat to `src/systems/playerStats.js: createPlayerStats()` if new**

2. **Add upgrade option in `src/systems/progression.js: getUpgradeOptions()`:**
   - Add case to the upgrade generation logic
   - Define min/max values and quality scaling

3. **Handle upgrade in `applyUpgrade()`:**
   - Apply stat change to `playerStats`
   - Update UI with `updateStatsUI()`

### Balancing

Key balance values by file:

- **`src/systems/playerStats.js`**: Base player stats (damage, health, speed, etc.)
- **`src/config/enemyTypes.js`**: Enemy health/speed/damage scaling
- **`src/config/relicInfo.js`**: Relic range, cooldown, damage values
- **`src/config/constants.js`**: Enemy spawn limits, relic limits, spawn heights
- **`src/systems/progression.js`**: Upgrade value ranges, quality thresholds

## Debugging

**Enable debug overlay:**
Edit `styles.css`, line ~237:
```css
#debug-info {
  display: block; /* Change from 'none' to 'block' */
}
```

**Performance monitoring:**
Debug system tracks:
- FPS and frame time
- Entity counts (enemies, projectiles, effects)
- Scene statistics (draw calls, geometries, textures)
- Per-system timing breakdown

**Console logging:**
- `LogBuffer` captures last 20 warnings/errors
- `ErrorWatcher` throttles duplicate error logs
- Call `Debug.logNow()` to force immediate debug output

## Integration Notes

When modifying the game:

1. **Respect dependency injection**: Pass dependencies as parameters rather than accessing globals
2. **Update JSDoc comments**: Keep function documentation current
3. **Test with debug overlay**: Monitor performance impact of changes
4. **Check original file**: `index-reference.html` contains the original single-file version for reference

## Original Line References

Most module files include comments noting which lines they were extracted from in `index-reference.html`, making it easy to cross-reference the original implementation.
