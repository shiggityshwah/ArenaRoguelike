/**
 * AudioManager - Manages game sound effects.
 *
 * Handles loading and playing sound effects with volume control.
 * Automatically initializes on module load.
 */
const AudioManager = {
    sounds: {},

    init() {
        // Sound files disabled - uncomment when sound files are added
        /*
        const soundList = {
            explosion: 'sounds/explosion.wav',
            hit: 'sounds/hit.wav',
            coin: 'sounds/coin.wav',
            laser: 'sounds/laser.wav',
            pickup: 'sounds/pickup.wav',
            windChime: 'sounds/wind-chime.wav',
            gameOver: 'sounds/game-over.wav'
        };
        for (const name in soundList) {
            this.sounds[name] = new Audio(soundList[name]);
        }
        */
    },

    play(name, volume = 1.0) {
        if (this.sounds[name]) {
            const sound = this.sounds[name].cloneNode();
            sound.volume = volume;
            sound.play().catch(e => {}); // Ignore play errors if context not ready
        }
    }
};

AudioManager.init();

export default AudioManager;
