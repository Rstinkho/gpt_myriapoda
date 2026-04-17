import * as Phaser from 'phaser';

const SIZE = 72;

/**
 * Eight detailed building icons for the evolution world panel. Procedural art
 * only — no outer frame here; the evolution panel supplies the hand-drawn card
 * border so textures are just the building silhouettes on a clear background.
 */
export function drawEvolutionBuildingTexture(
  graphics: Phaser.GameObjects.Graphics,
  variant: number,
  size: number,
): void {
  const cx = size * 0.5;
  const cy = size * 0.52;

  graphics.clear();

  switch (variant % 8) {
    case 0:
      drawSpire(graphics, cx, cy, size);
      break;
    case 1:
      drawDome(graphics, cx, cy, size);
      break;
    case 2:
      drawFoundry(graphics, cx, cy, size);
      break;
    case 3:
      drawRelay(graphics, cx, cy, size);
      break;
    case 4:
      drawBastion(graphics, cx, cy, size);
      break;
    case 5:
      drawSilo(graphics, cx, cy, size);
      break;
    case 6:
      drawSpore(graphics, cx, cy, size);
      break;
    default:
      drawPrism(graphics, cx, cy, size);
      break;
  }
}

function drawSpire(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  const baseY = size - 14;
  // Base platform
  g.fillStyle(0x1e4048, 0.95);
  g.fillRoundedRect(cx - 22, baseY - 4, 44, 10, 2);
  g.lineStyle(1.4, 0xa8ffe8, 0.45);
  g.strokeRoundedRect(cx - 22, baseY - 4, 44, 10, 2);
  // Side crystals
  g.fillStyle(0x2b7161, 0.92);
  g.fillTriangle(cx - 20, baseY - 4, cx - 12, baseY - 4, cx - 16, baseY - 24);
  g.fillTriangle(cx + 12, baseY - 4, cx + 20, baseY - 4, cx + 16, baseY - 20);
  g.lineStyle(1.2, 0xcffdf6, 0.4);
  g.strokeTriangle(cx - 20, baseY - 4, cx - 12, baseY - 4, cx - 16, baseY - 24);
  g.strokeTriangle(cx + 12, baseY - 4, cx + 20, baseY - 4, cx + 16, baseY - 20);
  // Central crystal column
  g.fillStyle(0x3a9a86, 0.96);
  g.fillTriangle(cx - 8, baseY - 4, cx + 8, baseY - 4, cx, 14);
  g.lineStyle(1.6, 0xe8fff8, 0.55);
  g.strokeTriangle(cx - 8, baseY - 4, cx + 8, baseY - 4, cx, 14);
  // Inner light strand
  g.lineStyle(1.2, 0xcffdf6, 0.7);
  g.lineBetween(cx, 16, cx, baseY - 6);
  // Apex glow
  g.fillStyle(0xe8fff8, 0.55);
  g.fillCircle(cx, 14, 3.5);
  g.fillStyle(0xe8fff8, 0.22);
  g.fillCircle(cx, 14, 6);
}

function drawDome(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  const baseY = size - 16;
  // Support legs
  g.fillStyle(0x244c52, 0.95);
  g.fillRect(cx - 20, baseY - 2, 4, 12);
  g.fillRect(cx + 16, baseY - 2, 4, 12);
  // Outer dome
  g.fillStyle(0x1f4d55, 0.95);
  g.fillEllipse(cx, cy + 6, 48, 40);
  g.lineStyle(2, 0x8fd4c6, 0.5);
  g.strokeEllipse(cx, cy + 6, 48, 40);
  // Inner dome ring
  g.lineStyle(1.4, 0xcffdf8, 0.4);
  g.strokeEllipse(cx, cy + 2, 34, 26);
  // Window grid (three rectangles on the front)
  g.fillStyle(0xa8ffe8, 0.55);
  g.fillRect(cx - 10, cy + 2, 5, 6);
  g.fillRect(cx - 2.5, cy + 2, 5, 6);
  g.fillRect(cx + 5, cy + 2, 5, 6);
  // Base platform
  g.fillStyle(0x152f35, 0.95);
  g.fillRect(cx - 26, baseY, 52, 6);
  g.lineStyle(1.2, 0x6fb8a8, 0.45);
  g.strokeRect(cx - 26, baseY, 52, 6);
}

function drawFoundry(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  const baseY = size - 14;
  // Base
  g.fillStyle(0x1a2c32, 0.95);
  g.fillRoundedRect(cx - 26, baseY - 4, 52, 10, 2);
  // Left crucible
  g.fillStyle(0x2f5058, 0.94);
  g.fillRoundedRect(cx - 24, cy - 4, 16, 22, 3);
  g.lineStyle(1.3, 0x9ee7d9, 0.45);
  g.strokeRoundedRect(cx - 24, cy - 4, 16, 22, 3);
  // Main chimney
  g.fillStyle(0x2a4048, 0.95);
  g.fillRoundedRect(cx - 6, cy - 18, 20, 38, 3);
  g.lineStyle(1.5, 0xcffdf6, 0.5);
  g.strokeRoundedRect(cx - 6, cy - 18, 20, 38, 3);
  // Right crucible
  g.fillStyle(0x2f5058, 0.94);
  g.fillRoundedRect(cx + 14, cy + 4, 12, 16, 3);
  g.lineStyle(1.2, 0x9ee7d9, 0.4);
  g.strokeRoundedRect(cx + 14, cy + 4, 12, 16, 3);
  // Chimney smoke puffs
  g.fillStyle(0xffb86a, 0.55);
  g.fillCircle(cx + 4, cy - 22, 3.4);
  g.fillStyle(0xffe1a0, 0.42);
  g.fillCircle(cx + 8, cy - 28, 2.4);
  g.fillStyle(0xfff3c2, 0.3);
  g.fillCircle(cx + 2, cy - 32, 1.8);
  // Rim glow inside main crucible
  g.fillStyle(0xffb86a, 0.5);
  g.fillRect(cx - 4, cy - 14, 16, 3);
}

function drawRelay(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  const baseY = size - 14;
  // Base pad
  g.fillStyle(0x1a3038, 0.95);
  g.fillRoundedRect(cx - 18, baseY - 2, 36, 8, 2);
  // Central mast
  g.fillStyle(0x254e50, 0.95);
  g.fillRect(cx - 2, cy - 14, 4, 24);
  // Rotating ring silhouette
  g.lineStyle(2, 0x7fd8c8, 0.55);
  g.strokeEllipse(cx, cy - 4, 34, 14);
  g.lineStyle(1.3, 0xa8ffe8, 0.35);
  g.strokeEllipse(cx, cy - 4, 22, 8);
  // Tri-antenna
  g.lineStyle(1.8, 0xcffdf6, 0.7);
  g.lineBetween(cx, cy - 14, cx - 10, cy - 22);
  g.lineBetween(cx, cy - 14, cx + 10, cy - 22);
  g.lineBetween(cx, cy - 14, cx, cy - 26);
  // Beacon spark
  g.fillStyle(0xe8fff8, 0.85);
  g.fillCircle(cx, cy - 26, 2.6);
  g.fillStyle(0xe8fff8, 0.25);
  g.fillCircle(cx, cy - 26, 5);
  // Side antenna tips
  g.fillStyle(0xcffdf6, 0.7);
  g.fillCircle(cx - 10, cy - 22, 1.8);
  g.fillCircle(cx + 10, cy - 22, 1.8);
}

function drawBastion(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  const baseY = size - 14;
  // Base plinth
  g.fillStyle(0x1c2e34, 0.95);
  g.fillRect(cx - 24, baseY - 2, 48, 8);
  // Body: tiered walls
  g.fillStyle(0x2c4a52, 0.95);
  g.fillRect(cx - 22, cy - 8, 44, 24);
  g.fillRect(cx - 16, cy - 16, 32, 10);
  g.lineStyle(1.4, 0x9ee7d9, 0.45);
  g.strokeRect(cx - 22, cy - 8, 44, 24);
  g.strokeRect(cx - 16, cy - 16, 32, 10);
  // Battlements (crenellations)
  const cr = cy - 18;
  for (let i = -3; i <= 3; i += 1) {
    if (i === -1 || i === 0) {
      continue;
    }
    g.fillStyle(0x2c4a52, 0.95);
    g.fillRect(cx + i * 5, cr, 3.5, 3);
  }
  // Slit windows
  g.fillStyle(0xffdca4, 0.55);
  g.fillRect(cx - 18, cy - 4, 2, 6);
  g.fillRect(cx - 2, cy - 4, 2, 6);
  g.fillRect(cx + 14, cy - 4, 2, 6);
  // Banner
  g.fillStyle(0xe8fff8, 0.4);
  g.fillTriangle(cx, cy - 22, cx + 6, cy - 20, cx, cy - 18);
  g.lineStyle(1, 0xcffdf6, 0.5);
  g.lineBetween(cx, cy - 22, cx, cy - 14);
}

function drawSilo(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  const baseY = size - 14;
  // Ground anchors
  g.fillStyle(0x1c2e34, 0.95);
  g.fillRect(cx - 20, baseY, 40, 4);
  // Cylinder body
  g.fillStyle(0x355a62, 0.96);
  g.fillRect(cx - 12, cy - 16, 24, 30);
  g.lineStyle(1.4, 0xb8f5e8, 0.45);
  g.strokeRect(cx - 12, cy - 16, 24, 30);
  // Cap
  g.fillStyle(0x3b6d75, 0.96);
  g.fillEllipse(cx, cy - 16, 24, 8);
  g.lineStyle(1.4, 0xb8f5e8, 0.5);
  g.strokeEllipse(cx, cy - 16, 24, 8);
  // Hatch on top
  g.fillStyle(0x0e2126, 0.9);
  g.fillEllipse(cx, cy - 16, 6, 2);
  // Ladder rungs on the right
  g.lineStyle(1.2, 0xcffdf6, 0.55);
  for (let i = 0; i < 5; i += 1) {
    const ry = cy - 14 + i * 6;
    g.lineBetween(cx + 12, ry, cx + 18, ry);
  }
  g.lineBetween(cx + 18, cy - 14, cx + 18, cy + 12);
  // Grain valve
  g.fillStyle(0x152c33, 0.95);
  g.fillRoundedRect(cx - 6, cy + 10, 12, 6, 2);
  g.fillStyle(0xffdca4, 0.5);
  g.fillCircle(cx, cy + 13, 1.6);
}

function drawSpore(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  // Outer tendrils (curves approximated with arcs)
  g.lineStyle(2.2, 0x6bc4a8, 0.55);
  g.strokeEllipse(cx, cy + 6, 46, 30);
  g.lineStyle(1.6, 0x8cdcbe, 0.45);
  g.strokeEllipse(cx, cy + 2, 34, 22);
  // Bulbous sac
  g.fillStyle(0x16372e, 0.96);
  g.fillEllipse(cx, cy + 4, 24, 22);
  g.lineStyle(1.4, 0xa8ffd9, 0.55);
  g.strokeEllipse(cx, cy + 4, 24, 22);
  // Inner sac pocket (darker)
  g.fillStyle(0x0c2321, 0.95);
  g.fillEllipse(cx - 2, cy + 6, 12, 10);
  // Drifting spore dots around the sac
  const dots: Array<[number, number, number]> = [
    [cx - 18, cy - 8, 1.8],
    [cx + 16, cy - 10, 2.2],
    [cx + 20, cy + 6, 1.6],
    [cx - 20, cy + 4, 1.4],
    [cx - 4, cy - 16, 2],
    [cx + 8, cy - 18, 1.4],
  ];
  for (const [dx, dy, r] of dots) {
    g.fillStyle(0xbff5c4, 0.55);
    g.fillCircle(dx, dy, r);
    g.fillStyle(0xe8ffd6, 0.25);
    g.fillCircle(dx, dy, r + 1.2);
  }
  // Tendril tips
  g.fillStyle(0x6bc4a8, 0.85);
  g.fillCircle(cx - 23, cy + 10, 1.6);
  g.fillCircle(cx + 23, cy + 10, 1.6);
}

function drawPrism(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
  const baseY = size - 14;
  // Base glyphs
  g.fillStyle(0x1a3d45, 0.95);
  g.fillRoundedRect(cx - 22, baseY - 2, 44, 8, 2);
  g.lineStyle(1.2, 0x88ffe0, 0.4);
  for (let i = -2; i <= 2; i += 1) {
    g.strokeCircle(cx + i * 8, baseY + 2, 1.4);
  }
  // Outer gate frame (angular)
  g.fillStyle(0x1e4550, 0.95);
  g.fillTriangle(cx - 22, baseY - 4, cx + 22, baseY - 4, cx, cy - 24);
  g.lineStyle(2, 0xcffdf6, 0.5);
  g.strokeTriangle(cx - 22, baseY - 4, cx + 22, baseY - 4, cx, cy - 24);
  // Inner gate void
  g.fillStyle(0x061014, 0.92);
  g.fillTriangle(cx - 14, baseY - 6, cx + 14, baseY - 6, cx, cy - 16);
  // Refraction beams
  g.lineStyle(1.2, 0xa8fff0, 0.55);
  g.lineBetween(cx - 10, baseY - 6, cx - 2, cy - 14);
  g.lineBetween(cx + 10, baseY - 6, cx + 2, cy - 14);
  // Central prism shard
  g.fillStyle(0x5adcc0, 0.85);
  g.fillTriangle(cx - 4, cy - 4, cx + 4, cy - 4, cx, cy - 16);
  g.lineStyle(1.3, 0xe8fff8, 0.7);
  g.strokeTriangle(cx - 4, cy - 4, cx + 4, cy - 4, cx, cy - 16);
  // Apex spark
  g.fillStyle(0xe8fff8, 0.85);
  g.fillCircle(cx, cy - 16, 1.8);
  g.fillStyle(0xe8fff8, 0.25);
  g.fillCircle(cx, cy - 16, 4);
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
