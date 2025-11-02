/**
 * Debug - Performance monitoring and debug logging system
 *
 * Provides:
 * - Frame time monitoring and FPS tracking
 * - Performance profiling with labeled timings
 * - Periodic debug snapshots of game state
 * - Stutter spike detection
 */

const Debug = {
    enabled: true,
    lastLogTime: 0,
    logInterval: 10, // seconds
    frameTimes: [],
    lastSnapshot: "",

    perf: {
        _timings: {},
        _order: [],

        start(label) {
            if (!Debug.enabled) return;
            this._timings[label] = { start: performance.now(), duration: 0 };
            if (!this._order.includes(label)) this._order.push(label);
        },

        end(label) {
            if (!Debug.enabled || !this._timings[label]) return;
            this._timings[label].duration = performance.now() - this._timings[label].start;
        },

        getResults() {
            let resultStr = "";
            this._order.forEach(label => {
                if (this._timings[label] && this._timings[label].duration > 0.1) { // Only show significant timings
                    resultStr += `${label}: ${this._timings[label].duration.toFixed(1)}ms | `;
                }
            });
            return resultStr.slice(0, -2).trim(); // Remove trailing pipe and space
        },

        reset() {
            this._timings = {};
        }
    },

    init() {
        this.lastLogTime = 0;
        this.frameTimes = [];
        this.lastSnapshot = "";
    },

    update(delta, clock) {
        if (!this.enabled) return;
        this.frameTimes.push(delta);
        if (delta > 0.2) {
            console.warn(`[PERF] Stutter spike detected: Frame took ${(delta * 1000).toFixed(0)}ms`);
        }
        const currentTime = clock.getElapsedTime();
        if (currentTime - this.lastLogTime > this.logInterval) {
            this.log(currentTime);
            this.lastLogTime = currentTime;
        }
    },

    log(currentTime, gameState) {
        if (!this.enabled || this.frameTimes.length === 0) return;

        const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.frameTimes = [];
        const fps = (1 / avgDelta).toFixed(0);
        const frameTimeMs = (avgDelta * 1000).toFixed(0);

        // Game state should be passed in, but we'll make it optional for flexibility
        if (!gameState) {
            console.log(`[DEBUG] Time: ${Math.floor(currentTime)}s | FPS: ${fps} | FrameTime: ${frameTimeMs}ms`);
            return;
        }

        const { renderer, scene, enemies, blasterShots, enemyProjectiles, skeletons, beams,
                coins, gems, relics, bossCount, playerHealth, playerStats, score, level } = gameState;

        const mem = renderer.info.memory;
        const renderInfo = renderer.info.render;
        const convertingCount = relics.filter(r => r.state === 'lowering' || r.state === 'converting').length;
        const convertingState = convertingCount > 0 ? `${convertingCount} converting` : 'none';
        const perfResults = this.perf.getResults();

        const output = `
[DEBUG] Time: ${Math.floor(currentTime)}s | FPS: ${fps} | FrameTime: ${frameTimeMs}ms
  SceneChildren: ${scene.children.length} | Geom=${mem.geometries}, Tex=${mem.textures} | DrawCalls=${renderInfo.calls}
  Enemies: ${enemies.length}, P.Shots: ${blasterShots.length}, E.Shots: ${enemyProjectiles.length}, Skeletons: ${skeletons.length}, Beams: ${beams.length}
  Coins: ${coins.length}, Gems: ${gems.length}, Relics: ${relics.length} (Converting: ${convertingState}), Bosses: ${bossCount}
  PlayerHP: ${playerHealth.toFixed(0)}/${playerStats.maxHealth} | Score: ${score} | Level: ${level}
  Perf: [ ${perfResults} ]
`;
        this.lastSnapshot = output;
        console.log(output.trim());
        renderer.info.reset();
    },

    logNow(gameState, prefix = "Immediate Log") {
        if (!gameState) {
            console.log(`[${prefix}]`);
            return;
        }

        const { clock, renderer, scene, enemies, blasterShots, enemyProjectiles, skeletons, beams,
                coins, gems, relics, bossCount, playerHealth, playerStats, score, level } = gameState;

        const currentTime = clock.getElapsedTime();
        const mem = renderer.info.memory;
        const renderInfo = renderer.info.render;
        const convertingCount = relics.filter(r => r.state === 'lowering' || r.state === 'converting').length;
        const convertingState = convertingCount > 0 ? `${convertingCount} converting` : 'none';

        const output = `
[${prefix}] Time: ${Math.floor(currentTime)}s
  SceneChildren: ${scene.children.length} | Geom=${mem.geometries}, Tex=${mem.textures} | DrawCalls=${renderInfo.calls}
  Enemies: ${enemies.length}, P.Shots: ${blasterShots.length}, E.Shots: ${enemyProjectiles.length}, Skeletons: ${skeletons.length}, Beams: ${beams.length}
  Coins: ${coins.length}, Gems: ${gems.length}, Relics: ${relics.length} (Converting: ${convertingState}), Bosses: ${bossCount}
  PlayerHP: ${playerHealth.toFixed(0)}/${playerStats.maxHealth} | Score: ${score} | Level: ${level}
  Perf: [ ${this.perf.getResults()} ]
`;
        this.lastSnapshot = output;
        console.log(output.trim());
    }
};

export default Debug;
