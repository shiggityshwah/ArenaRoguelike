/**
 * Boss UI System
 *
 * Manages 3D floating health bars and visual indicators for bosses:
 * - Canvas-based health bar sprites
 * - Billboard effect (always face camera)
 * - Boss name display
 * - Phase indicators
 * - Health bar animations
 */

import * as THREE from 'three';
import bossTypes from '../config/bossTypes.js';

/**
 * Boss icon/symbol mappings
 */
const BOSS_ICONS = {
  box: '👑',
  shooter: '🏰',
  tank: '🛡️',
  berserker: '⚡',
  magnetic: '🌀',
  elite: '⭐',
  phantom: '👻',
};

/**
 * Create a canvas-based health bar texture
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Canvas and context
 */
function createHealthBarCanvas(width = 512, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

/**
 * Draw health bar on canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} bossData - Boss entity data
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function drawHealthBar(ctx, bossData, width, height) {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  const bossConfig = bossTypes[bossData.bossType];
  const healthPercent = Math.max(0, Math.min(1, bossData.health / bossData.maxHealth));

  // Health bar dimensions
  const barWidth = width * 0.8;
  const barHeight = 30;
  const barX = (width - barWidth) / 2;
  const barY = height - barHeight - 10;

  // Background (black with alpha)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8);

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

  // Health bar background (dark red)
  ctx.fillStyle = '#3d0000';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Health bar fill (color based on boss type)
  const healthColor = `#${bossConfig.color.toString(16).padStart(6, '0')}`;
  const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth * healthPercent, barY);

  // Add gradient for visual appeal
  gradient.addColorStop(0, healthColor);
  gradient.addColorStop(0.5, '#ffffff');
  gradient.addColorStop(1, healthColor);

  ctx.fillStyle = gradient;
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

  // Health text
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;

  const healthText = `${Math.ceil(bossData.health)} / ${bossData.maxHealth}`;
  ctx.strokeText(healthText, width / 2, barY + barHeight / 2);
  ctx.fillText(healthText, width / 2, barY + barHeight / 2);

  // Boss name
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  const icon = BOSS_ICONS[bossData.bossType] || '';
  const nameText = `${icon} ${bossConfig.name} ${icon}`;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeText(nameText, width / 2, 30);

  ctx.fillStyle = healthColor;
  ctx.fillText(nameText, width / 2, 30);

  // Phase indicator
  if (bossData.currentPhase !== undefined) {
    const phaseInfo = bossConfig.phases[bossData.currentPhase];
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    const phaseText = phaseInfo.name;
    ctx.strokeText(phaseText, width / 2, 55);
    ctx.fillText(phaseText, width / 2, 55);
  }

  // Phase markers (segmented bar)
  if (bossConfig.phases.length > 1) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    for (let i = 1; i < bossConfig.phases.length; i++) {
      const phase = bossConfig.phases[i];
      const markerX = barX + barWidth * phase.healthPercent;

      // Draw phase marker line
      ctx.beginPath();
      ctx.moveTo(markerX, barY);
      ctx.lineTo(markerX, barY + barHeight);
      ctx.stroke();
    }
  }
}

/**
 * Create boss health bar sprite
 * @param {Object} scene - THREE.js scene
 * @param {Object} bossData - Boss entity data
 * @returns {Object} Health bar sprite and update function
 */
export function createBossHealthBar(scene, bossData) {
  const { canvas, ctx } = createHealthBarCanvas();

  // Create sprite material
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(200, 50, 1); // Adjust scale for visibility
  sprite.renderOrder = 999; // Render on top

  scene.add(sprite);

  // Animation state
  let displayedHealth = bossData.health;
  const healthChangeSpeed = 200; // HP per second for smooth animation

  /**
   * Update health bar position and content
   * @param {THREE.Camera} camera - Camera for billboard effect
   * @param {number} delta - Time delta in seconds
   */
  function update(camera, delta) {
    if (!bossData.mesh) return;

    // Billboard effect - always face camera
    sprite.quaternion.copy(camera.quaternion);

    // Position above boss
    const bossHeight = bossData.mesh.geometry.parameters?.height ||
                       bossData.mesh.geometry.parameters?.radius * 2 ||
                       20;
    const offset = (bossHeight * bossData.mesh.scale.y) / 2 + 60;

    sprite.position.copy(bossData.mesh.position);
    sprite.position.y += offset;

    // Smooth health animation
    if (Math.abs(displayedHealth - bossData.health) > 0.5) {
      const healthDiff = bossData.health - displayedHealth;
      const change = Math.sign(healthDiff) * Math.min(Math.abs(healthDiff), healthChangeSpeed * delta);
      displayedHealth += change;

      // Redraw health bar
      const tempBossData = { ...bossData, health: displayedHealth };
      drawHealthBar(ctx, tempBossData, canvas.width, canvas.height);
      texture.needsUpdate = true;
    } else if (displayedHealth !== bossData.health) {
      // Snap to final value
      displayedHealth = bossData.health;
      drawHealthBar(ctx, bossData, canvas.width, canvas.height);
      texture.needsUpdate = true;
    }
  }

  /**
   * Force immediate health bar update (for phase changes, etc.)
   */
  function forceUpdate() {
    displayedHealth = bossData.health;
    drawHealthBar(ctx, bossData, canvas.width, canvas.height);
    texture.needsUpdate = true;
  }

  /**
   * Remove health bar from scene
   */
  function destroy() {
    scene.remove(sprite);
    texture.dispose();
    spriteMaterial.dispose();
  }

  // Initial draw
  forceUpdate();

  return {
    sprite,
    update,
    forceUpdate,
    destroy,
  };
}

/**
 * Create boss entrance effect as UI overlay
 * @param {Object} scene - THREE.js scene (not used, kept for compatibility)
 * @param {Object} bossData - Boss entity data
 * @returns {Object} Effect objects for cleanup
 */
export function createBossEntranceEffect(scene, bossData) {
  const bossConfig = bossTypes[bossData.bossType];

  // Create UI overlay
  const overlay = document.createElement('div');
  overlay.id = 'boss-warning-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    border: 4px solid #ff0000;
    border-radius: 8px;
    padding: 20px 40px;
    z-index: 9999;
    text-align: center;
    box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
    animation: bossWarningPulse 0.5s ease-in-out infinite alternate;
  `;

  overlay.innerHTML = `
    <div style="color: #ff0000; font-size: 36px; font-weight: bold; font-family: Arial, sans-serif; text-shadow: 2px 2px 4px #000; margin-bottom: 10px;">
      ⚠️ WARNING ⚠️
    </div>
    <div style="color: #ffff00; font-size: 28px; font-weight: bold; font-family: Arial, sans-serif; text-shadow: 2px 2px 4px #000; margin-bottom: 5px;">
      ${bossConfig.name}
    </div>
    <div style="color: #ffffff; font-size: 20px; font-family: Arial, sans-serif; text-shadow: 1px 1px 2px #000;">
      has appeared!
    </div>
  `;

  // Add animation style if it doesn't exist
  if (!document.getElementById('boss-warning-animation')) {
    const style = document.createElement('style');
    style.id = 'boss-warning-animation';
    style.textContent = `
      @keyframes bossWarningPulse {
        from {
          transform: translateX(-50%) scale(1);
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
        }
        to {
          transform: translateX(-50%) scale(1.05);
          box-shadow: 0 0 50px rgba(255, 0, 0, 0.8);
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 3000);

  return {
    effects: [overlay],
    destroy: () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    },
  };
}

/**
 * Create phase transition effect
 * @param {Object} scene - THREE.js scene
 * @param {Object} bossData - Boss entity data
 * @param {number} phaseIndex - New phase index
 */
export function createPhaseTransitionEffect(scene, bossData, phaseIndex) {
  if (!bossData.mesh) return;

  const bossConfig = bossTypes[bossData.bossType];
  const phase = bossConfig.phases[phaseIndex];

  // Flash effect - handle both single and array materials
  let originalEmissive, originalIntensity;

  if (Array.isArray(bossData.mesh.material)) {
    // Store first material's values as reference
    originalEmissive = bossData.mesh.material[0].emissive.getHex();
    originalIntensity = bossData.mesh.material[0].emissiveIntensity;

    // Flash all materials white
    bossData.mesh.material.forEach(mat => {
      mat.emissive.setHex(0xffffff);
      mat.emissiveIntensity = 2.0;
    });
  } else {
    originalEmissive = bossData.mesh.material.emissive.getHex();
    originalIntensity = bossData.mesh.material.emissiveIntensity;

    bossData.mesh.material.emissive.setHex(0xffffff);
    bossData.mesh.material.emissiveIntensity = 2.0;
  }

  // Expanding ring effect
  const ringGeometry = new THREE.RingGeometry(10, 15, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: bossConfig.color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(bossData.mesh.position);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  // Animate ring
  let time = 0;
  const animationDuration = 1.0;

  const animateRing = () => {
    time += 0.016;

    if (time < animationDuration) {
      const progress = time / animationDuration;
      const scale = 1 + progress * 10;
      ring.scale.set(scale, scale, 1);
      ring.material.opacity = 0.8 * (1 - progress);

      requestAnimationFrame(animateRing);
    } else {
      scene.remove(ring);
      ringGeometry.dispose();
      ringMaterial.dispose();

      // Restore original emissive - handle both single and array materials
      if (Array.isArray(bossData.mesh.material)) {
        bossData.mesh.material.forEach(mat => {
          mat.emissive.setHex(originalEmissive);
          mat.emissiveIntensity = originalIntensity;
        });
      } else {
        bossData.mesh.material.emissive.setHex(originalEmissive);
        bossData.mesh.material.emissiveIntensity = originalIntensity;
      }
    }
  };

  animateRing();

  // Phase announcement (smaller, above boss)
  const { canvas, ctx } = createHealthBarCanvas(256, 64);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, 256, 64);

  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = `#${bossConfig.color.toString(16).padStart(6, '0')}`;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;

  ctx.strokeText(phase.name, 128, 32);
  ctx.fillText(phase.name, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(150, 40, 1);
  sprite.position.copy(bossData.mesh.position);
  sprite.position.y += 100;
  sprite.renderOrder = 1000;

  scene.add(sprite);

  // Auto-remove after 2 seconds
  setTimeout(() => {
    scene.remove(sprite);
    texture.dispose();
    spriteMaterial.dispose();
  }, 2000);
}

/**
 * Boss UI Manager
 * Manages all boss UI elements
 */
export class BossUIManager {
  constructor(scene) {
    this.scene = scene;
    this.activeHealthBars = new Map(); // bossId -> healthBar
  }

  /**
   * Create health bar for a boss
   * @param {Object} bossData - Boss entity data
   */
  createHealthBar(bossData) {
    if (!bossData.id) {
      console.error('Boss must have an id property');
      return;
    }

    // Remove existing health bar if any
    this.removeHealthBar(bossData.id);

    const healthBar = createBossHealthBar(this.scene, bossData);
    this.activeHealthBars.set(bossData.id, healthBar);

    // Create entrance effect
    createBossEntranceEffect(this.scene, bossData);

    return healthBar;
  }

  /**
   * Remove health bar for a boss
   * @param {string|number} bossId - Boss ID
   */
  removeHealthBar(bossId) {
    const healthBar = this.activeHealthBars.get(bossId);
    if (healthBar) {
      healthBar.destroy();
      this.activeHealthBars.delete(bossId);
    }
  }

  /**
   * Update all health bars
   * @param {THREE.Camera} camera - Camera for billboard effect
   * @param {number} delta - Time delta in seconds
   */
  update(camera, delta) {
    this.activeHealthBars.forEach((healthBar) => {
      healthBar.update(camera, delta);
    });
  }

  /**
   * Show phase transition effect
   * @param {Object} bossData - Boss entity data
   * @param {number} phaseIndex - New phase index
   */
  showPhaseTransition(bossData, phaseIndex) {
    createPhaseTransitionEffect(this.scene, bossData, phaseIndex);

    const healthBar = this.activeHealthBars.get(bossData.id);
    if (healthBar) {
      healthBar.forceUpdate();
    }
  }

  /**
   * Clear all boss UI elements
   */
  clear() {
    this.activeHealthBars.forEach((healthBar) => {
      healthBar.destroy();
    });
    this.activeHealthBars.clear();
  }
}

export default BossUIManager;
