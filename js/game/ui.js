class UI {
    constructor(game) {
        this.game = game;
        this.scoreElement = document.getElementById('score');
        this.healthBarElement = document.getElementById('health-bar');
        this.experienceBarElement = document.getElementById('experience-bar');
        this.spacebarSymbol = document.getElementById('spacebar-symbol');
        this.levelUpOverlay = document.getElementById('level-up-overlay');
        this.upgradeOptions = document.getElementById('upgrade-options');
        this.skipButtonContainer = document.getElementById('skip-button-container');
        this.skipButtonProgress = document.getElementById('skip-button-progress');
        this.resetButton = document.getElementById('reset-button');
        this.gemCounters = document.getElementById('gem-counters');

        this.setupEventListeners();
    }

    updateStats(playerStats) {
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
        document.getElementById('stat-aoe').textContent = playerStats.areaDamageRadius;
    }

    setupEventListeners() {
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const spacebarPromptDiv = this.spacebarSymbol.querySelector('div');
        if (isTouchDevice) {
            spacebarPromptDiv.textContent = 'HOLD';
            spacebarPromptDiv.style.width = '300px';
        } else {
            spacebarPromptDiv.textContent = 'Hold SPACE';
            spacebarPromptDiv.style.width = '400px';
        }

        this.spacebarSymbol.addEventListener('mousedown', () => {
            this.game.player.keyState['Space'] = true;
        });

        this.spacebarSymbol.addEventListener('mouseup', () => {
            this.game.player.keyState['Space'] = false;
        });

        this.spacebarSymbol.addEventListener('mouseleave', () => {
            this.game.player.keyState['Space'] = false;
        });

        this.spacebarSymbol.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.game.player.keyState['Space'] = true;
        });

        this.spacebarSymbol.addEventListener('touchend', () => {
            this.game.player.keyState['Space'] = false;
        });

        this.spacebarSymbol.addEventListener('touchleave', () => {
            this.game.player.keyState['Space'] = false;
        });

        this.resetButton.addEventListener('click', () => {
            location.reload();
        });

        this.skipButtonContainer.addEventListener('click', () => {
            this.hideLevelUp();
        });
    }

    update(score, playerHealth, maxHealth, experience, experienceToNextLevel) {
        this.scoreElement.textContent = score;
        this.healthBarElement.style.width = `${(playerHealth / maxHealth) * 100}%`;
        this.experienceBarElement.style.width = `${(experience / experienceToNextLevel) * 100}%`;
    }

    updateGemCounters(gemCounts, gemMax) {
        for (const type in gemCounts) {
            const el = document.getElementById(`gem-${type}`);
            if (el) {
                el.textContent = `${gemCounts[type]}/${gemMax[type]}`;
                if (gemCounts[type] >= gemMax[type]) {
                    el.classList.add('gem-sparkle');
                } else {
                    el.classList.remove('gem-sparkle');
                }
            }
        }
    }

    showLevelUp() {
        this.levelUpOverlay.classList.add('visible');
        this.generateUpgradeOptions();
        this.game.isGamePaused = true;
    }

    hideLevelUp() {
        this.levelUpOverlay.classList.remove('visible');
        this.game.isGamePaused = false;
    }

    generateUpgradeOptions() {
        this.upgradeOptions.innerHTML = ''; // Clear existing options

        const upgrades = [
            { name: 'Damage', stat: 'damage', value: 5 },
            { name: 'Attack Speed', stat: 'attackSpeed', value: -0.05 },
            { name: 'Health', stat: 'maxHealth', value: 10 },
            { name: 'Pickup Radius', stat: 'pickupRadius', value: 5 },
        ];

        for (const upgrade of upgrades) {
            const button = document.createElement('div');
            button.classList.add('upgrade-button');
            button.innerHTML = `<div class="stat-name">${upgrade.name}</div><div class="stat-value">+${upgrade.value}</div>`;
            button.addEventListener('click', () => {
                this.applyUpgrade(upgrade.stat, upgrade.value);
                this.hideLevelUp();
            });
            this.upgradeOptions.appendChild(button);
        }
    }

    applyUpgrade(stat, value) {
        this.game.player.stats[stat] += value;
        if (stat === 'maxHealth') {
            this.game.playerHealth += value;
        }
        this.updateStats(this.game.player.stats);
    }
}
