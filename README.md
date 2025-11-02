# Arena Roguelike

A browser-based 3D roguelike game built with Three.js featuring wave-based arena combat, gem collection, and relic abilities.

## Quick Start

### Option 1: Using Python (Recommended)
```bash
# Python 3
python -m http.server 8000

# Then open: http://localhost:8000
```

### Option 2: Using Node.js
```bash
# Install http-server globally if not already installed
npm install -g http-server

# Run server
http-server

# Then open: http://localhost:8080
```

### Option 3: Using PHP
```bash
php -S localhost:8000

# Then open: http://localhost:8000
```

**Note:** ES6 modules require a local server. Opening `index.html` directly with `file://` protocol will not work.

## Project Structure

```
ArenaRoguelike/
├── index.html              # Main HTML file (entry point)
├── index-reference.html    # Original single-file version (for reference)
├── styles.css              # All game styles
├── CLAUDE.md              # Development documentation
├── README.md              # This file
└── src/
    ├── main.js            # Game initialization and main loop
    ├── config/            # Configuration and data
    │   ├── constants.js
    │   ├── enemyTypes.js
    │   ├── gemTypes.js
    │   └── relicInfo.js
    ├── managers/          # Game managers
    │   ├── AreaWarningManager.js
    │   ├── AudioManager.js
    │   ├── DamageNumberManager.js
    │   ├── ErrorWatcher.js
    │   ├── ObjectPool.js
    │   └── SpatialGrid.js
    ├── systems/           # Game systems
    │   ├── combat.js
    │   ├── effects.js
    │   ├── enemySpawning.js
    │   ├── gems.js
    │   ├── input.js
    │   ├── playerStats.js
    │   ├── progression.js
    │   ├── relicCombat.js
    │   ├── relicSpawning.js
    │   └── ui.js
    └── utils/             # Utility functions
        ├── Debug.js
        ├── helpers.js
        ├── LogBuffer.js
        └── TrailRenderer.js
```

## Controls

### Desktop
- **WASD**: Move player
- **Mouse Position**: Aim direction
- **Hold SPACE**: Shoot

### Mobile/Touch
- **Drag**: Move player
- **Tap Position**: Aim direction
- **Hold Button**: Shoot

## Gameplay

1. **Survive waves of enemies** while collecting experience orbs
2. **Level up** to choose powerful upgrades
3. **Collect gems** for permanent stat boosts
4. **Capture relics** by standing near them - they fight for you when converted
5. **Defeat bosses** for massive rewards

### Code Quality Tools

The game includes built-in debugging tools:
- Set `#debug-info { display: block; }` in styles.css to enable debug overlay
- Performance monitoring and FPS tracking
- Error watching and logging

### Module Organization

The codebase follows a modular architecture:
- **Config modules**: Static data and constants
- **Managers**: Systems that manage game resources (pooling, spatial queries, etc.)
- **Systems**: Game logic (combat, progression, spawning, etc.)
- **Utils**: Reusable helper functions

All modules use ES6 imports/exports and dependency injection for better testability.
