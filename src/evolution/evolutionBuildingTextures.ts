import * as Phaser from 'phaser';

const SIZE = 72;

/**
 * Eight distinct “premium” building icons for the evolution world panel (procedural, no bitmap assets).
 */
export function drawEvolutionBuildingTexture(
  graphics: Phaser.GameObjects.Graphics,
  variant: number,
  size: number,
): void {
  const cx = size * 0.5;
  const cy = size * 0.52;
  graphics.clear();
  graphics.fillStyle(0x0a1e24, 1);
  graphics.fillRoundedRect(2, 2, size - 4, size - 4, 10);
  graphics.lineStyle(2, 0x6ee0c8, 0.55);
  graphics.strokeRoundedRect(2, 2, size - 4, size - 4, 10);

  switch (variant % 8) {
    case 0: {
      // Spire
      graphics.fillStyle(0x2a6b5e, 0.95);
      graphics.fillRect(cx - 4, 12, 8, size - 28);
      graphics.fillRect(cx - 16, size - 28, 32, 18);
      graphics.lineStyle(2, 0xa8ffe8, 0.5);
      graphics.strokeRect(cx - 16, size - 28, 32, 18);
      graphics.fillStyle(0xe8fff8, 0.45);
      graphics.fillCircle(cx, 18, 5);
      break;
    }
    case 1: {
      // Dome
      graphics.fillStyle(0x1f4d55, 0.95);
      graphics.fillEllipse(cx, cy + 4, 44, 36);
      graphics.lineStyle(2, 0x8fd4c6, 0.45);
      graphics.strokeEllipse(cx, cy + 4, 44, 36);
      graphics.lineStyle(1.5, 0xcffdf8, 0.35);
      graphics.strokeEllipse(cx, cy + 2, 28, 20);
      break;
    }
    case 2: {
      // Foundry stacks
      graphics.fillStyle(0x243842, 0.95);
      graphics.fillRoundedRect(cx - 26, cy - 4, 16, 28, 4);
      graphics.fillRoundedRect(cx - 6, cy - 14, 18, 38, 4);
      graphics.fillRoundedRect(cx + 14, cy + 2, 14, 22, 3);
      graphics.fillStyle(0xffb86a, 0.45);
      graphics.fillCircle(cx + 1, cy - 18, 4);
      break;
    }
    case 3: {
      // Relay rings
      graphics.lineStyle(2, 0x7fd8c8, 0.55);
      for (let i = -2; i <= 2; i += 1) {
        graphics.strokeCircle(cx + i * 8, cy, 14 + Math.abs(i) * 2);
      }
      graphics.fillStyle(0x1a3d38, 0.8);
      graphics.fillCircle(cx, cy, 8);
      break;
    }
    case 4: {
      // Bastion blocks
      graphics.fillStyle(0x2c4a52, 0.95);
      graphics.fillRoundedRect(cx - 22, cy - 8, 20, 26, 3);
      graphics.fillRoundedRect(cx - 2, cy - 14, 24, 32, 3);
      graphics.lineStyle(1.5, 0x9ee7d9, 0.35);
      graphics.strokeRoundedRect(cx - 22, cy - 8, 20, 26, 3);
      graphics.strokeRoundedRect(cx - 2, cy - 14, 24, 32, 3);
      break;
    }
    case 5: {
      // Silo
      graphics.fillStyle(0x355a62, 0.95);
      graphics.fillEllipse(cx, cy + 8, 36, 22);
      graphics.fillRect(cx - 10, cy - 18, 20, 28);
      graphics.lineStyle(2, 0xb8f5e8, 0.4);
      graphics.strokeEllipse(cx, cy + 8, 36, 22);
      break;
    }
    case 6: {
      // Spore nest
      graphics.lineStyle(2.2, 0x6bc4a8, 0.5);
      for (let r = 10; r <= 26; r += 8) {
        graphics.strokeEllipse(cx, cy + 4, r * 2, r * 1.4);
      }
      graphics.fillStyle(0x14302a, 0.9);
      graphics.fillCircle(cx, cy + 4, 7);
      break;
    }
    default: {
      // Prism gate
      graphics.fillStyle(0x1a3d45, 0.95);
      graphics.fillRect(cx - 20, cy - 16, 40, 34);
      graphics.lineStyle(2, 0x88ffe0, 0.45);
      graphics.lineBetween(cx - 14, cy + 18, cx, cy - 18);
      graphics.lineBetween(cx, cy - 18, cx + 14, cy + 18);
      graphics.lineBetween(cx - 14, cy + 18, cx + 14, cy + 18);
      graphics.fillStyle(0xa8fff0, 0.25);
      graphics.fillRect(cx - 6, cy - 4, 12, 12);
      break;
    }
  }
}

export function registerEvolutionBuildingTextures(scene: Phaser.Scene): void {
  for (let i = 0; i < 8; i += 1) {
    const key = `evo-building-${i}`;
    if (scene.textures.exists(key)) {
      continue;
    }
    const g = scene.add.graphics();
    drawEvolutionBuildingTexture(g, i, SIZE);
    g.generateTexture(key, SIZE, SIZE);
    g.destroy();
  }
}
