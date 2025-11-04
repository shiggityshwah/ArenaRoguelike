/**
 * Boss Testing Utilities
 *
 * Provides debug tools for testing bosses:
 * - Keyboard shortcuts to spawn bosses
 * - Debug UI panel
 * - Boss manipulation commands
 * - Wave control
 */

import { spawnNewBoss } from '../systems/enemySpawning.js';
import { destroyBoss } from '../systems/bossSystem.js';

export class BossTester {
    constructor(gameState) {
        this.gameState = gameState;
        this.enabled = false;
        this.debugPanel = null;
        this.bossHealthMultiplier = 1.0;
        this.testMode = false; // When true, bosses have reduced health

        this.bossTypes = ['box', 'shooter', 'tank', 'berserker', 'magnetic', 'elite', 'phantom'];
        this.bossNames = {
            box: 'Cube King',
            shooter: 'Artillery Tower',
            tank: 'Juggernaut',
            berserker: 'Phantom Blade',
            magnetic: 'Void Core',
            elite: 'Warlord',
            phantom: 'Shade Monarch'
        };
    }

    /**
     * Initialize boss testing system
     */
    init() {
        this.createDebugPanel();
        this.setupKeyboardShortcuts();
        this.updateDebugPanel();
        console.log('Boss Testing System initialized!');
        console.log('Press T to toggle boss testing UI');
        console.log('Press B + 1-7 to spawn specific boss types');
        console.log('Press K to kill current boss');
        console.log('Press N to skip to next boss wave');
    }

    /**
     * Create debug UI panel
     */
    createDebugPanel() {
        // Create panel container
        const panel = document.createElement('div');
        panel.id = 'boss-test-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.85);
            color: #00ff00;
            padding: 15px;
            border: 2px solid #00ff00;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 10000;
            min-width: 300px;
            max-height: 80vh;
            overflow-y: auto;
            display: none;
        `;

        // Create panel content
        panel.innerHTML = `
            <div style="margin-bottom: 10px; font-size: 14px; font-weight: bold; color: #ffff00;">
                🎮 BOSS TESTING PANEL
            </div>

            <div style="margin-bottom: 15px; padding: 8px; background: rgba(255,255,0,0.1); border-radius: 4px;">
                <div id="boss-test-wave-info">Wave: 0</div>
                <div id="boss-test-boss-info">No active boss</div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="margin-bottom: 8px; font-weight: bold; color: #ffff00;">Quick Spawn:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    ${this.bossTypes.map((type, i) => `
                        <button id="spawn-${type}" style="
                            background: #333;
                            color: #00ff00;
                            border: 1px solid #00ff00;
                            padding: 5px;
                            cursor: pointer;
                            border-radius: 3px;
                            font-family: inherit;
                            font-size: 11px;
                        ">
                            ${i + 1}. ${this.bossNames[type]}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="margin-bottom: 8px; font-weight: bold; color: #ffff00;">Wave Control:</div>
                <button id="next-boss-wave" style="
                    background: #333;
                    color: #00ffff;
                    border: 1px solid #00ffff;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 3px;
                    width: 100%;
                    font-family: inherit;
                    margin-bottom: 5px;
                ">
                    Skip to Next Boss Wave
                </button>
                <button id="clear-wave" style="
                    background: #333;
                    color: #ff00ff;
                    border: 1px solid #ff00ff;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 3px;
                    width: 100%;
                    font-family: inherit;
                ">
                    Clear All Enemies
                </button>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="margin-bottom: 8px; font-weight: bold; color: #ffff00;">Boss Control:</div>
                <button id="kill-boss" style="
                    background: #333;
                    color: #ff0000;
                    border: 1px solid #ff0000;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 3px;
                    width: 100%;
                    font-family: inherit;
                    margin-bottom: 5px;
                ">
                    Kill Current Boss
                </button>
                <div style="margin-top: 10px;">
                    <label style="display: block; margin-bottom: 5px;">
                        Boss Health: <span id="health-mult-value">100%</span>
                    </label>
                    <input type="range" id="health-multiplier"
                        min="0.1" max="5.0" step="0.1" value="1.0"
                        style="width: 100%;">
                    <div style="font-size: 10px; color: #888; margin-top: 3px;">
                        (0.1x to 5.0x normal health)
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="test-mode" style="margin-right: 8px;">
                    <span>Test Mode (25% health for quick testing)</span>
                </label>
            </div>

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #00ff00; font-size: 11px; color: #888;">
                <div style="margin-bottom: 5px; font-weight: bold; color: #ffff00;">Keyboard Shortcuts:</div>
                <div>T - Toggle this panel</div>
                <div>B + 1-7 - Spawn boss type</div>
                <div>K - Kill current boss</div>
                <div>N - Next boss wave</div>
            </div>
        `;

        document.body.appendChild(panel);
        this.debugPanel = panel;

        // Setup button event listeners
        this.setupButtonListeners();
    }

    /**
     * Setup button event listeners
     */
    setupButtonListeners() {
        // Boss spawn buttons
        this.bossTypes.forEach(type => {
            const btn = document.getElementById(`spawn-${type}`);
            if (btn) {
                btn.addEventListener('click', () => this.spawnBoss(type));
            }
        });

        // Wave control buttons
        const nextWaveBtn = document.getElementById('next-boss-wave');
        if (nextWaveBtn) {
            nextWaveBtn.addEventListener('click', () => this.skipToNextBossWave());
        }

        const clearWaveBtn = document.getElementById('clear-wave');
        if (clearWaveBtn) {
            clearWaveBtn.addEventListener('click', () => this.clearAllEnemies());
        }

        // Boss control buttons
        const killBtn = document.getElementById('kill-boss');
        if (killBtn) {
            killBtn.addEventListener('click', () => this.killCurrentBoss());
        }

        // Health multiplier slider
        const healthSlider = document.getElementById('health-multiplier');
        if (healthSlider) {
            healthSlider.addEventListener('input', (e) => {
                this.bossHealthMultiplier = parseFloat(e.target.value);
                const valueDisplay = document.getElementById('health-mult-value');
                if (valueDisplay) {
                    valueDisplay.textContent = `${Math.round(this.bossHealthMultiplier * 100)}%`;
                }
            });
        }

        // Test mode checkbox
        const testModeCheckbox = document.getElementById('test-mode');
        if (testModeCheckbox) {
            testModeCheckbox.addEventListener('change', (e) => {
                this.testMode = e.target.checked;
                if (this.testMode) {
                    console.log('Test mode enabled - bosses will spawn with 25% health');
                } else {
                    console.log('Test mode disabled - bosses will spawn with normal health');
                }
            });
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        let bKeyPressed = false;

        document.addEventListener('keydown', (e) => {
            // Toggle panel with T
            if (e.key === 't' || e.key === 'T') {
                if (!this.isInputFocused()) {
                    this.togglePanel();
                }
            }

            // B key for boss spawning
            if (e.key === 'b' || e.key === 'B') {
                if (!this.isInputFocused()) {
                    bKeyPressed = true;
                }
            }

            // Number keys 1-7 when B is pressed
            if (bKeyPressed && !this.isInputFocused()) {
                const num = parseInt(e.key);
                if (num >= 1 && num <= 7) {
                    const bossType = this.bossTypes[num - 1];
                    this.spawnBoss(bossType);
                    bKeyPressed = false;
                }
            }

            // K to kill boss
            if (e.key === 'k' || e.key === 'K') {
                if (!this.isInputFocused()) {
                    this.killCurrentBoss();
                }
            }

            // N for next boss wave
            if (e.key === 'n' || e.key === 'N') {
                if (!this.isInputFocused()) {
                    this.skipToNextBossWave();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'b' || e.key === 'B') {
                bKeyPressed = false;
            }
        });
    }

    /**
     * Check if an input element is focused
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
    }

    /**
     * Toggle debug panel visibility
     */
    togglePanel() {
        if (this.debugPanel) {
            const isVisible = this.debugPanel.style.display !== 'none';
            this.debugPanel.style.display = isVisible ? 'none' : 'block';
            console.log(`Boss testing panel ${isVisible ? 'hidden' : 'shown'}`);
        }
    }

    /**
     * Spawn a specific boss type
     */
    spawnBoss(bossType) {
        const { scene, level, bosses, bossUIManager, playerCone } = this.gameState;

        // Clear existing bosses first
        if (bosses.length > 0) {
            console.log('Clearing existing boss...');
            this.killCurrentBoss();
        }

        console.log(`Spawning boss: ${this.bossNames[bossType]} (${bossType})`);

        const waveNumber = this.gameState.waveNumber || 1;

        const boss = spawnNewBoss({
            scene,
            level,
            waveNumber,
            bosses,
            bossUIManager,
            playerCone,
            bossType // Pass the specific boss type to spawn
        });

        if (boss) {
            // Apply health multiplier
            if (this.testMode) {
                boss.health = boss.maxHealth * 0.25;
                boss.maxHealth = boss.maxHealth * 0.25;
                console.log(`Test mode: Boss health set to 25% (${boss.health} HP)`);
            } else if (this.bossHealthMultiplier !== 1.0) {
                boss.health *= this.bossHealthMultiplier;
                boss.maxHealth *= this.bossHealthMultiplier;
                console.log(`Boss health multiplier: ${this.bossHealthMultiplier}x (${boss.health} HP)`);
            }

            // Force update health bar
            if (bossUIManager) {
                const healthBar = bossUIManager.activeHealthBars.get(boss.id);
                if (healthBar) {
                    healthBar.forceUpdate();
                }
            }

            this.updateDebugPanel();
        }
    }

    /**
     * Kill current boss instantly
     */
    killCurrentBoss() {
        const { bosses, scene, bossUIManager } = this.gameState;

        if (bosses.length === 0) {
            console.log('No active boss to kill');
            return;
        }

        const boss = bosses[0];
        console.log(`Killing boss: ${boss.bossType}`);

        boss.health = 0;
        destroyBoss(boss, scene);
        bossUIManager.removeHealthBar(boss.id);
        bosses.splice(0, 1);

        console.log('Boss killed');
        this.updateDebugPanel();
    }

    /**
     * Skip to next boss wave
     */
    skipToNextBossWave() {
        const currentWave = this.gameState.waveNumber || 0;
        const BOSS_WAVE_INTERVAL = 5;
        const nextBossWave = Math.ceil((currentWave + 1) / BOSS_WAVE_INTERVAL) * BOSS_WAVE_INTERVAL;

        console.log(`Skipping from wave ${currentWave} to wave ${nextBossWave}`);

        // Clear all enemies and bosses
        this.clearAllEnemies();

        // Set wave number to one before boss wave (so it triggers on next update)
        this.gameState.waveNumber = nextBossWave - 1;

        console.log(`Wave set to ${this.gameState.waveNumber}. Boss will spawn when enemies/bosses are cleared.`);
        this.updateDebugPanel();
    }

    /**
     * Clear all enemies and bosses
     */
    clearAllEnemies() {
        const { enemies, bosses, scene, bossUIManager } = this.gameState;

        // Kill all enemies
        while (enemies.length > 0) {
            const enemy = enemies.pop();
            scene.remove(enemy.mesh);
        }

        // Kill all bosses
        while (bosses.length > 0) {
            const boss = bosses.pop();
            destroyBoss(boss, scene);
            bossUIManager.removeHealthBar(boss.id);
        }

        console.log('All enemies and bosses cleared');
        this.updateDebugPanel();
    }

    /**
     * Update debug panel info
     */
    updateDebugPanel() {
        const waveInfo = document.getElementById('boss-test-wave-info');
        const bossInfo = document.getElementById('boss-test-boss-info');

        if (waveInfo) {
            const currentWave = this.gameState.waveNumber || 0;
            const BOSS_WAVE_INTERVAL = 5;
            const nextBossWave = Math.ceil((currentWave + 1) / BOSS_WAVE_INTERVAL) * BOSS_WAVE_INTERVAL;
            waveInfo.textContent = `Wave: ${currentWave} (Next boss: Wave ${nextBossWave})`;
        }

        if (bossInfo) {
            const { bosses } = this.gameState;
            if (bosses && bosses.length > 0) {
                const boss = bosses[0];
                const healthPercent = Math.round((boss.health / boss.maxHealth) * 100);
                bossInfo.innerHTML = `
                    <div style="color: #ffff00;">Active: ${this.bossNames[boss.bossType]}</div>
                    <div>Health: ${Math.round(boss.health)} / ${Math.round(boss.maxHealth)} (${healthPercent}%)</div>
                    <div>Phase: ${boss.currentPhase + 1} / ${boss.phaseData ? boss.phaseData.name : 'Unknown'}</div>
                `;
            } else {
                bossInfo.textContent = 'No active boss';
            }
        }
    }

    /**
     * Update method - call this in your main game loop
     */
    update() {
        // Update panel info periodically
        if (this.debugPanel && this.debugPanel.style.display !== 'none') {
            this.updateDebugPanel();
        }
    }
}

export default BossTester;
