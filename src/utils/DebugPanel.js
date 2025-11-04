/**
 * Debug Panel System
 *
 * Comprehensive modular debug/testing panel with collapsible sections.
 * Extends the boss testing panel into a full-featured debug suite.
 */

import { DebugControls } from './DebugControls.js';
import { ABILITY_DEFINITIONS } from '../systems/playerAbilities.js';

export class DebugPanel {
    constructor(gameState) {
        this.gameState = gameState;
        this.controls = new DebugControls(gameState);
        this.panel = null;
        this.isVisible = false;
        this.expandedPanels = new Set(['boss']); // Default: boss panel expanded

        // Diagnostic refresh interval
        this.diagnosticsInterval = null;
    }

    /**
     * Initialize the debug panel
     */
    init() {
        this.createPanelContainer();
        this.createAllPanels();
        this.setupKeyboardShortcuts();
        this.setupUpdateLoop();

        console.log('🔧 Debug Panel System initialized!');
        console.log('Press T to toggle debug panel');
    }

    /**
     * Create main panel container
     */
    createPanelContainer() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.95);
            color: #00ff00;
            padding: 10px;
            border: 2px solid #00ff00;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            z-index: 10000;
            min-width: 320px;
            max-width: 400px;
            max-height: 90vh;
            overflow-y: auto;
            overflow-x: hidden;
            display: none;
        `;

        // Add scrollbar styling
        const style = document.createElement('style');
        style.textContent = `
            #debug-panel::-webkit-scrollbar {
                width: 8px;
            }
            #debug-panel::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
            }
            #debug-panel::-webkit-scrollbar-thumb {
                background: #00ff00;
                border-radius: 4px;
            }
            #debug-panel::-webkit-scrollbar-thumb:hover {
                background: #00ff00;
            }
            .debug-panel-section {
                margin-bottom: 8px;
                border: 1px solid #006600;
                border-radius: 4px;
                overflow: hidden;
            }
            .debug-panel-header {
                background: rgba(0, 255, 0, 0.1);
                padding: 8px;
                cursor: pointer;
                user-select: none;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .debug-panel-header:hover {
                background: rgba(0, 255, 0, 0.2);
            }
            .debug-panel-content {
                padding: 10px;
                display: none;
            }
            .debug-panel-content.expanded {
                display: block;
            }
            .debug-btn {
                background: #1a1a1a;
                color: #00ff00;
                border: 1px solid #00ff00;
                padding: 6px 10px;
                cursor: pointer;
                border-radius: 3px;
                font-family: inherit;
                font-size: 10px;
                margin: 2px;
            }
            .debug-btn:hover {
                background: #003300;
            }
            .debug-btn:active {
                background: #00ff00;
                color: #000;
            }
            .debug-input {
                background: #1a1a1a;
                color: #00ff00;
                border: 1px solid #006600;
                padding: 4px;
                border-radius: 3px;
                font-family: inherit;
                font-size: 10px;
                width: 100%;
                margin: 2px 0;
            }
            .debug-slider {
                width: 100%;
                margin: 5px 0;
            }
            .debug-label {
                display: flex;
                justify-content: space-between;
                margin: 4px 0;
                font-size: 10px;
            }
            .debug-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4px;
                margin: 5px 0;
            }
            .debug-checkbox {
                margin-right: 5px;
            }
        `;
        document.head.appendChild(style);

        // Panel header
        panel.innerHTML = `
            <div style="text-align: center; font-size: 14px; font-weight: bold; color: #ffff00; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #00ff00;">
                🔧 DEBUG PANEL
            </div>
            <div id="debug-panels-container"></div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #006600; font-size: 10px; color: #888;">
                <strong style="color: #ffff00;">Shortcuts:</strong> T=Toggle | Ctrl+1-9=Jump | Esc=Close
            </div>
        `;

        document.body.appendChild(panel);
        this.panel = panel;
    }

    /**
     * Create all panel sections
     */
    createAllPanels() {
        const container = document.getElementById('debug-panels-container');

        // Create each panel
        this.createPlayerStatsPanel(container);
        this.createEnemySpawnPanel(container);
        this.createRelicPanel(container);
        this.createGemPanel(container);
        this.createAbilityPanel(container);
        this.createGameStatePanel(container);
        this.createBossPanel(container);
        this.createDiagnosticsPanel(container);
    }

    /**
     * Create a collapsible panel section
     */
    createPanelSection(container, id, title, icon, content) {
        const section = document.createElement('div');
        section.className = 'debug-panel-section';
        section.id = `debug-section-${id}`;

        const isExpanded = this.expandedPanels.has(id);

        section.innerHTML = `
            <div class="debug-panel-header" data-panel-id="${id}">
                <span>${icon} ${title}</span>
                <span style="color: #ffff00;">${isExpanded ? '▼' : '▶'}</span>
            </div>
            <div class="debug-panel-content ${isExpanded ? 'expanded' : ''}" id="debug-content-${id}">
                ${content}
            </div>
        `;

        container.appendChild(section);

        // Setup toggle handler
        const header = section.querySelector('.debug-panel-header');
        header.addEventListener('click', () => this.togglePanel(id));
    }

    /**
     * Toggle panel expanded/collapsed state
     */
    togglePanel(panelId) {
        const content = document.getElementById(`debug-content-${panelId}`);
        const header = document.querySelector(`[data-panel-id="${panelId}"]`);
        const arrow = header.querySelector('span:last-child');

        if (this.expandedPanels.has(panelId)) {
            this.expandedPanels.delete(panelId);
            content.classList.remove('expanded');
            arrow.textContent = '▶';
        } else {
            this.expandedPanels.add(panelId);
            content.classList.add('expanded');
            arrow.textContent = '▼';
        }
    }

    /**
     * Create Player Stats Panel
     */
    createPlayerStatsPanel(container) {
        const stats = [
            { name: 'damage', min: 0, max: 1000, step: 1 },
            { name: 'attackSpeed', min: 0.01, max: 2, step: 0.01 },
            { name: 'maxHealth', min: 10, max: 10000, step: 10 },
            { name: 'armor', min: 0, max: 500, step: 1 },
            { name: 'critChance', min: 0, max: 1, step: 0.01 },
            { name: 'critMultiplier', min: 1, max: 10, step: 0.1 },
            { name: 'regenRate', min: 0, max: 100, step: 0.5 },
            { name: 'dodgeChance', min: 0, max: 1, step: 0.01 },
            { name: 'pierceCount', min: 1, max: 20, step: 1 },
            { name: 'areaDamageRadius', min: 0, max: 200, step: 5 },
            { name: 'attackDistance', min: 50, max: 500, step: 10 },
            { name: 'projectileSpeed', min: 1, max: 20, step: 0.5 },
            { name: 'pickupRadius', min: 10, max: 300, step: 5 },
            { name: 'coinPickupRadius', min: 50, max: 500, step: 10 },
            { name: 'luck', min: 0, max: 10, step: 0.1 },
            { name: 'cooldownReduction', min: 0, max: 0.95, step: 0.05 },
            { name: 'playerRadius', min: 0.5, max: 5, step: 0.1 }
        ];

        let slidersHTML = '';
        for (const stat of stats) {
            const currentValue = this.gameState.playerStats[stat.name];
            slidersHTML += `
                <div class="debug-label">
                    <span>${stat.name}:</span>
                    <span id="stat-${stat.name}-value">${currentValue.toFixed(2)}</span>
                </div>
                <input type="range" class="debug-slider"
                    id="stat-${stat.name}"
                    min="${stat.min}" max="${stat.max}" step="${stat.step}"
                    value="${currentValue}">
            `;
        }

        const content = `
            <div style="margin-bottom: 10px;">
                <strong style="color: #ffff00;">Presets:</strong>
                <div class="debug-grid">
                    <button class="debug-btn" id="preset-godMode">God Mode</button>
                    <button class="debug-btn" id="preset-weak">Weak</button>
                    <button class="debug-btn" id="preset-balanced">Balanced</button>
                    <button class="debug-btn" id="preset-reset">Reset</button>
                </div>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                ${slidersHTML}
            </div>
        `;

        this.createPanelSection(container, 'player-stats', 'Player Stats', '⭐', content);

        // Setup event listeners
        for (const stat of stats) {
            const slider = document.getElementById(`stat-${stat.name}`);
            const valueDisplay = document.getElementById(`stat-${stat.name}-value`);

            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.controls.setPlayerStat(stat.name, value);
                valueDisplay.textContent = value.toFixed(2);
            });
        }

        // Preset buttons
        document.getElementById('preset-godMode').addEventListener('click', () => {
            this.controls.applyPreset('godMode');
            this.refreshPlayerStatSliders();
        });
        document.getElementById('preset-weak').addEventListener('click', () => {
            this.controls.applyPreset('weak');
            this.refreshPlayerStatSliders();
        });
        document.getElementById('preset-balanced').addEventListener('click', () => {
            this.controls.applyPreset('balanced');
            this.refreshPlayerStatSliders();
        });
        document.getElementById('preset-reset').addEventListener('click', () => {
            this.controls.resetPlayerStats();
            this.refreshPlayerStatSliders();
        });
    }

    /**
     * Refresh player stat sliders to match current values
     */
    refreshPlayerStatSliders() {
        const stats = Object.keys(this.gameState.playerStats);
        for (const stat of stats) {
            const slider = document.getElementById(`stat-${stat}`);
            const valueDisplay = document.getElementById(`stat-${stat}-value`);
            if (slider && valueDisplay) {
                const value = this.gameState.playerStats[stat];
                slider.value = value;
                valueDisplay.textContent = value.toFixed(2);
            }
        }
    }

    /**
     * Create Enemy Spawn Panel
     */
    createEnemySpawnPanel(container) {
        const enemyTypes = ['box', 'shooter', 'tank', 'berserker', 'magnetic', 'elite', 'phantom'];

        const content = `
            <div style="margin-bottom: 10px;">
                <strong style="color: #ffff00;">Spawn Enemy:</strong>
                <div class="debug-grid">
                    ${enemyTypes.map(type => `
                        <button class="debug-btn" id="spawn-enemy-${type}">${type}</button>
                    `).join('')}
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <label class="debug-label">
                    <input type="checkbox" class="debug-checkbox" id="spawn-as-boss">
                    <span>Spawn as Boss (2.5x scale, 5x HP)</span>
                </label>
                <div class="debug-label">
                    <span>Quantity:</span>
                    <span id="spawn-quantity-value">1</span>
                </div>
                <input type="range" class="debug-slider" id="spawn-quantity" min="1" max="10" step="1" value="1">
            </div>
            <div style="margin-bottom: 10px;">
                <strong style="color: #ffff00;">Spawn Control:</strong>
                <label class="debug-label">
                    <input type="checkbox" class="debug-checkbox" id="auto-spawn-toggle" checked>
                    <span>Auto-spawn ON</span>
                </label>
                <div class="debug-label">
                    <span>Max Enemies:</span>
                    <span id="max-enemies-value">${this.gameState.maxEnemies}</span>
                </div>
                <input type="range" class="debug-slider" id="max-enemies" min="1" max="100" step="1" value="${this.gameState.maxEnemies}">
                <button class="debug-btn" id="clear-all-enemies" style="width: 100%; margin-top: 5px;">Clear All Enemies</button>
            </div>
        `;

        this.createPanelSection(container, 'enemy-spawn', 'Enemy Spawn', '🎯', content);

        // Setup event listeners
        for (const type of enemyTypes) {
            document.getElementById(`spawn-enemy-${type}`).addEventListener('click', () => {
                const isBoss = document.getElementById('spawn-as-boss').checked;
                const quantity = parseInt(document.getElementById('spawn-quantity').value);
                this.controls.spawnEnemy(type, isBoss, quantity);
            });
        }

        document.getElementById('spawn-quantity').addEventListener('input', (e) => {
            document.getElementById('spawn-quantity-value').textContent = e.target.value;
        });

        document.getElementById('auto-spawn-toggle').addEventListener('change', (e) => {
            this.controls.setAutoSpawn(e.target.checked);
            e.target.nextElementSibling.textContent = e.target.checked ? 'Auto-spawn ON' : 'Auto-spawn OFF';
        });

        document.getElementById('max-enemies').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.controls.setMaxEnemies(value);
            document.getElementById('max-enemies-value').textContent = value;
        });

        document.getElementById('clear-all-enemies').addEventListener('click', () => {
            this.controls.clearAllEnemies();
        });
    }

    /**
     * Create Relic Control Panel
     */
    createRelicPanel(container) {
        const relicTypes = ['attackSpeed', 'damage', 'speed', 'vacuum', 'crit', 'luck'];
        const states = ['idle', 'active', 'converting', 'converted', 'returning'];

        const content = `
            <div style="margin-bottom: 10px;">
                <strong style="color: #ffff00;">Spawn Relic:</strong>
                <div class="debug-grid">
                    ${relicTypes.map(type => `
                        <button class="debug-btn" id="spawn-relic-${type}">${type}</button>
                    `).join('')}
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">
                    <strong>State:</strong>
                </label>
                <select class="debug-input" id="relic-state">
                    ${states.map(state => `<option value="${state}">${state}</option>`).join('')}
                </select>
                <label class="debug-label" style="margin-top: 5px;">
                    <input type="checkbox" class="debug-checkbox" id="spawn-near-player">
                    <span>Spawn near player</span>
                </label>
            </div>
            <div style="margin-bottom: 10px;">
                <strong style="color: #ffff00;">Quick Actions:</strong>
                <button class="debug-btn" id="convert-relics-player" style="width: 100%; margin: 2px 0;">Convert All to Player</button>
                <button class="debug-btn" id="convert-relics-enemy" style="width: 100%; margin: 2px 0;">Convert All to Enemy</button>
                <button class="debug-btn" id="destroy-all-relics" style="width: 100%; margin: 2px 0;">Destroy All Relics</button>
            </div>
        `;

        this.createPanelSection(container, 'relic-control', 'Relic Control', '🔮', content);

        // Setup event listeners
        for (const type of relicTypes) {
            document.getElementById(`spawn-relic-${type}`).addEventListener('click', () => {
                const state = document.getElementById('relic-state').value;
                const nearPlayer = document.getElementById('spawn-near-player').checked;
                this.controls.spawnRelicType(type, state, nearPlayer);
            });
        }

        document.getElementById('convert-relics-player').addEventListener('click', () => {
            this.controls.convertAllRelics(true);
        });

        document.getElementById('convert-relics-enemy').addEventListener('click', () => {
            this.controls.convertAllRelics(false);
        });

        document.getElementById('destroy-all-relics').addEventListener('click', () => {
            this.controls.destroyAllRelics();
        });
    }

    /**
     * Create Gem & Coins Panel
     */
    createGemPanel(container) {
        const gemTypes = ['damage', 'speed', 'attackSpeed', 'luck', 'vacuum', 'crit'];

        const content = `
            <div style="margin-bottom: 10px;">
                <strong style="color: #ffff00;">Spawn Gems:</strong>
                <div class="debug-grid">
                    ${gemTypes.map(type => `
                        <button class="debug-btn" id="spawn-gem-${type}">${type}</button>
                    `).join('')}
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div class="debug-label">
                    <span>Quantity:</span>
                    <span id="gem-quantity-value">10</span>
                </div>
                <input type="range" class="debug-slider" id="gem-quantity" min="1" max="100" step="1" value="10">
                <label class="debug-label">
                    <input type="checkbox" class="debug-checkbox" id="gem-auto-collect">
                    <span>Auto-collect (spawn at player)</span>
                </label>
            </div>
            <div>
                <strong style="color: #ffff00;">XP Coins:</strong>
                <button class="debug-btn" id="spawn-coins" style="width: 100%; margin-top: 5px;">Spawn Coins</button>
                <div class="debug-label">
                    <span>Amount:</span>
                    <span id="coin-amount-value">10</span>
                </div>
                <input type="range" class="debug-slider" id="coin-amount" min="1" max="100" step="1" value="10">
            </div>
        `;

        this.createPanelSection(container, 'gem-coins', 'Gems & Coins', '💎', content);

        // Setup event listeners
        for (const type of gemTypes) {
            document.getElementById(`spawn-gem-${type}`).addEventListener('click', () => {
                const quantity = parseInt(document.getElementById('gem-quantity').value);
                const autoCollect = document.getElementById('gem-auto-collect').checked;
                this.controls.spawnGems(type, quantity, autoCollect);
            });
        }

        document.getElementById('gem-quantity').addEventListener('input', (e) => {
            document.getElementById('gem-quantity-value').textContent = e.target.value;
        });

        document.getElementById('coin-amount').addEventListener('input', (e) => {
            document.getElementById('coin-amount-value').textContent = e.target.value;
        });

        document.getElementById('spawn-coins').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('coin-amount').value);
            const autoCollect = document.getElementById('gem-auto-collect').checked;
            this.controls.spawnCoins(amount, autoCollect);
        });
    }

    /**
     * Create Abilities Panel
     */
    createAbilityPanel(container) {
        const abilities = Object.keys(ABILITY_DEFINITIONS);

        const content = `
            <div style="margin-bottom: 10px;">
                <div class="debug-grid">
                    <button class="debug-btn" id="unlock-all-abilities">Unlock All</button>
                    <button class="debug-btn" id="lock-all-abilities">Lock All</button>
                </div>
            </div>
            <div style="max-height: 250px; overflow-y: auto;">
                ${abilities.map(abilityId => {
                    const ability = ABILITY_DEFINITIONS[abilityId];
                    return `
                        <div style="margin-bottom: 10px; padding: 8px; background: rgba(0, 255, 0, 0.05); border-radius: 4px;">
                            <div style="font-weight: bold; color: #ffff00; margin-bottom: 5px;">
                                ${ability.icon} ${ability.name}
                            </div>
                            <div class="debug-grid">
                                <button class="debug-btn" id="ability-unlock-${abilityId}">Unlock</button>
                                <button class="debug-btn" id="ability-lock-${abilityId}">Lock</button>
                            </div>
                            <button class="debug-btn" id="ability-reset-${abilityId}" style="width: 100%; margin-top: 3px;">
                                Reset Cooldown
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        this.createPanelSection(container, 'abilities', 'Abilities', '🔥', content);

        // Setup event listeners
        document.getElementById('unlock-all-abilities').addEventListener('click', () => {
            this.controls.unlockAllAbilities();
        });

        document.getElementById('lock-all-abilities').addEventListener('click', () => {
            this.controls.lockAllAbilities();
        });

        for (const abilityId of abilities) {
            document.getElementById(`ability-unlock-${abilityId}`).addEventListener('click', () => {
                this.controls.unlockAbility(abilityId);
            });

            document.getElementById(`ability-lock-${abilityId}`).addEventListener('click', () => {
                this.controls.lockAbility(abilityId);
            });

            document.getElementById(`ability-reset-${abilityId}`).addEventListener('click', () => {
                this.controls.resetAbilityCooldown(abilityId);
            });
        }
    }

    /**
     * Create Game State Panel
     */
    createGameStatePanel(container) {
        const content = `
            <div style="margin-bottom: 10px;">
                <div class="debug-label">
                    <span>Level:</span>
                    <span id="game-level-value">${this.gameState.level}</span>
                </div>
                <input type="range" class="debug-slider" id="game-level" min="1" max="99" step="1" value="${this.gameState.level}">
            </div>
            <div style="margin-bottom: 10px;">
                <div class="debug-label">
                    <span>Experience:</span>
                    <span id="game-exp-value">${this.gameState.experience}</span>
                </div>
                <input type="range" class="debug-slider" id="game-exp" min="0" max="500" step="1" value="${this.gameState.experience}">
            </div>
            <div style="margin-bottom: 10px;">
                <div class="debug-label">
                    <span>Health:</span>
                    <span id="game-health-value">${Math.round(this.gameState.playerHealth)}</span>
                </div>
                <input type="range" class="debug-slider" id="game-health" min="0" max="${this.gameState.playerStats.maxHealth}" step="1" value="${this.gameState.playerHealth}">
            </div>
            <div style="margin-bottom: 10px;">
                <div class="debug-label">
                    <span>Wave:</span>
                    <span id="game-wave-value">${this.gameState.waveNumber}</span>
                </div>
                <input type="range" class="debug-slider" id="game-wave" min="0" max="100" step="1" value="${this.gameState.waveNumber}">
            </div>
            <div style="margin-bottom: 10px;">
                <div class="debug-label">
                    <span>Game Speed:</span>
                    <span id="game-speed-value">${this.gameState.gameSpeedMultiplier.toFixed(1)}x</span>
                </div>
                <input type="range" class="debug-slider" id="game-speed" min="0.1" max="5.0" step="0.1" value="${this.gameState.gameSpeedMultiplier}">
            </div>
            <div>
                <strong style="color: #ffff00;">Quick Actions:</strong>
                <div class="debug-grid">
                    <button class="debug-btn" id="game-heal">Full Heal</button>
                    <button class="debug-btn" id="game-max-level">Max Level</button>
                    <button class="debug-btn" id="game-clear-wave">Clear Wave</button>
                    <button class="debug-btn" id="game-level-up">Level Up</button>
                </div>
            </div>
        `;

        this.createPanelSection(container, 'game-state', 'Game State', '🎮', content);

        // Setup event listeners
        document.getElementById('game-level').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.controls.setLevel(value);
            document.getElementById('game-level-value').textContent = value;
        });

        document.getElementById('game-exp').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.gameState.experience = value;
            document.getElementById('game-exp-value').textContent = value;
        });

        document.getElementById('game-health').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.controls.setHealth(value);
            document.getElementById('game-health-value').textContent = value;
        });

        document.getElementById('game-wave').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.controls.setWave(value);
            document.getElementById('game-wave-value').textContent = value;
        });

        document.getElementById('game-speed').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.controls.setGameSpeed(value);
            document.getElementById('game-speed-value').textContent = value.toFixed(1) + 'x';
        });

        document.getElementById('game-heal').addEventListener('click', () => {
            this.controls.healPlayer();
            const healthSlider = document.getElementById('game-health');
            const healthValue = document.getElementById('game-health-value');
            healthSlider.value = this.gameState.playerHealth;
            healthValue.textContent = Math.round(this.gameState.playerHealth);
        });

        document.getElementById('game-max-level').addEventListener('click', () => {
            this.controls.setMaxLevel();
            document.getElementById('game-level').value = 99;
            document.getElementById('game-level-value').textContent = '99';
        });

        document.getElementById('game-clear-wave').addEventListener('click', () => {
            this.controls.clearWave();
        });

        document.getElementById('game-level-up').addEventListener('click', () => {
            this.controls.triggerLevelUp();
        });
    }

    /**
     * Create Boss Panel (integrated from BossTesting.js)
     */
    createBossPanel(container) {
        const bossTypes = ['box', 'shooter', 'tank', 'berserker', 'magnetic', 'elite', 'phantom'];
        const bossNames = {
            box: 'Cube King',
            shooter: 'Artillery Tower',
            tank: 'Juggernaut',
            berserker: 'Phantom Blade',
            magnetic: 'Void Core',
            elite: 'Warlord',
            phantom: 'Shade Monarch'
        };

        const content = `
            <div style="margin-bottom: 10px; padding: 6px; background: rgba(255,255,0,0.1); border-radius: 4px; font-size: 10px;">
                <div id="boss-wave-info">Wave: ${this.gameState.waveNumber || 0}</div>
                <div id="boss-active-info">No active boss</div>
            </div>
            <div style="margin-bottom: 10px;">
                <strong style="color: #ffff00;">Quick Spawn:</strong>
                <div class="debug-grid">
                    ${bossTypes.map((type, i) => `
                        <button class="debug-btn" id="spawn-boss-${type}">
                            ${i + 1}. ${bossNames[type]}
                        </button>
                    `).join('')}
                </div>
            </div>
            <div>
                <button class="debug-btn" id="boss-kill" style="width: 100%; margin-bottom: 5px; color: #ff0000; border-color: #ff0000;">
                    Kill Current Boss
                </button>
                <button class="debug-btn" id="boss-next-wave" style="width: 100%; margin-bottom: 5px; color: #00ffff; border-color: #00ffff;">
                    Skip to Next Boss Wave
                </button>
            </div>
        `;

        this.createPanelSection(container, 'boss', 'Boss Control', '👑', content);

        // Setup event listeners
        for (const type of bossTypes) {
            document.getElementById(`spawn-boss-${type}`).addEventListener('click', () => {
                this.controls.spawnBoss(type);
            });
        }

        document.getElementById('boss-kill').addEventListener('click', () => {
            this.killCurrentBoss();
        });

        document.getElementById('boss-next-wave').addEventListener('click', () => {
            this.skipToNextBossWave();
        });
    }

    /**
     * Kill current boss (from BossTesting)
     */
    killCurrentBoss() {
        const { bosses, scene, bossUIManager } = this.gameState;

        if (!bosses || bosses.length === 0) {
            console.log('No active boss to kill');
            return;
        }

        const boss = bosses[0];
        console.log(`Killing boss: ${boss.bossType}`);

        boss.health = 0;

        // Import destroyBoss dynamically if needed
        if (this.gameState.destroyBoss) {
            this.gameState.destroyBoss(boss, scene);
        } else {
            scene.remove(boss.mesh);
        }

        if (bossUIManager) {
            bossUIManager.removeHealthBar(boss.id);
        }

        bosses.splice(0, 1);
        console.log('Boss killed');
    }

    /**
     * Skip to next boss wave (from BossTesting)
     */
    skipToNextBossWave() {
        const currentWave = this.gameState.waveNumber || 0;
        const BOSS_WAVE_INTERVAL = 5;
        const nextBossWave = Math.ceil((currentWave + 1) / BOSS_WAVE_INTERVAL) * BOSS_WAVE_INTERVAL;

        console.log(`Skipping from wave ${currentWave} to wave ${nextBossWave}`);

        this.controls.clearWave();
        this.gameState.waveNumber = nextBossWave - 1;

        console.log(`Wave set to ${this.gameState.waveNumber}. Boss will spawn when wave clears.`);
    }

    /**
     * Create Diagnostics Panel
     */
    createDiagnosticsPanel(container) {
        const content = `
            <div style="font-size: 10px;">
                <div class="debug-label">
                    <span>Enemies:</span>
                    <span id="diag-enemies">0</span>
                </div>
                <div class="debug-label">
                    <span>Bosses:</span>
                    <span id="diag-bosses">0</span>
                </div>
                <div class="debug-label">
                    <span>Projectiles:</span>
                    <span id="diag-projectiles">0</span>
                </div>
                <div class="debug-label">
                    <span>Relics:</span>
                    <span id="diag-relics">0</span>
                </div>
                <div class="debug-label">
                    <span>Gems:</span>
                    <span id="diag-gems">0</span>
                </div>
                <div class="debug-label">
                    <span>Coins:</span>
                    <span id="diag-coins">0</span>
                </div>
                <div class="debug-label">
                    <span>Effects:</span>
                    <span id="diag-effects">0</span>
                </div>
                <div class="debug-label" style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #006600;">
                    <span>FPS:</span>
                    <span id="diag-fps">60</span>
                </div>
            </div>
        `;

        this.createPanelSection(container, 'diagnostics', 'Diagnostics', '📊', content);
    }

    /**
     * Update diagnostics display
     */
    updateDiagnostics() {
        if (!this.isVisible || !this.expandedPanels.has('diagnostics')) return;

        const { enemies, bosses, blasterShots, enemyProjectiles, relicProjectiles, relics, gems, coins, temporaryEffects } = this.gameState;

        document.getElementById('diag-enemies').textContent = enemies ? enemies.length : 0;
        document.getElementById('diag-bosses').textContent = bosses ? bosses.length : 0;

        const projectileCount = (blasterShots ? blasterShots.length : 0) +
                               (enemyProjectiles ? enemyProjectiles.length : 0) +
                               (relicProjectiles ? relicProjectiles.length : 0);
        document.getElementById('diag-projectiles').textContent = projectileCount;

        document.getElementById('diag-relics').textContent = relics ? relics.length : 0;
        document.getElementById('diag-gems').textContent = gems ? gems.length : 0;
        document.getElementById('diag-coins').textContent = coins ? coins.length : 0;
        document.getElementById('diag-effects').textContent = temporaryEffects ? temporaryEffects.length : 0;
    }

    /**
     * Update boss panel info
     */
    updateBossPanel() {
        if (!this.isVisible) return;

        const waveInfo = document.getElementById('boss-wave-info');
        const bossInfo = document.getElementById('boss-active-info');

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
                    <div style="color: #ffff00;">Active: ${boss.name || boss.bossType}</div>
                    <div>HP: ${Math.round(boss.health)} / ${Math.round(boss.maxHealth)} (${healthPercent}%)</div>
                `;
            } else {
                bossInfo.textContent = 'No active boss';
            }
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if input is focused
            if (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.isContentEditable) {
                return;
            }

            // T - Toggle panel
            if (e.key === 't' || e.key === 'T') {
                this.toggle();
            }

            // Esc - Close panel
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }

            // Ctrl + Number - Jump to panel
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                const panelIndex = parseInt(e.key) - 1;
                const panels = ['player-stats', 'enemy-spawn', 'relic-control', 'gem-coins', 'abilities', 'game-state', 'boss', 'diagnostics'];
                if (panelIndex < panels.length) {
                    const panelId = panels[panelIndex];
                    if (!this.expandedPanels.has(panelId)) {
                        this.togglePanel(panelId);
                    }
                    // Scroll to panel
                    const section = document.getElementById(`debug-section-${panelId}`);
                    if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
                e.preventDefault();
            }
        });
    }

    /**
     * Setup update loop for diagnostics
     */
    setupUpdateLoop() {
        // Update diagnostics periodically
        setInterval(() => {
            if (this.isVisible) {
                this.updateDiagnostics();
                this.updateBossPanel();
            }
        }, 500);
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Show panel
     */
    show() {
        if (this.panel) {
            this.panel.style.display = 'block';
            this.isVisible = true;
            console.log('Debug panel shown');
        }
    }

    /**
     * Hide panel
     */
    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.isVisible = false;
            console.log('Debug panel hidden');
        }
    }

    /**
     * Update method - call from game loop if needed
     */
    update() {
        // Currently handled by setInterval in setupUpdateLoop
        // Can be called from main game loop for more frequent updates if needed
    }
}

export default DebugPanel;
