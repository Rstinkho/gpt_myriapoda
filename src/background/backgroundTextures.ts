import * as Phaser from 'phaser';
import { textureKeys } from '@/game/assets';

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics();
}

function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = createGraphics(scene);
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

function drawSoftCloudTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  seed: number,
): void {
  const random = createSeededRandom(seed);
  const center = size * 0.5;

  for (let index = 0; index < 28; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = size * (0.08 + random() * 0.24);
    const orbit = size * (0.05 + random() * 0.22);
    graphics.fillStyle(0xffffff, 0.035 + random() * 0.05);
    graphics.fillEllipse(
      center + Math.cos(angle) * orbit,
      center + Math.sin(angle) * orbit,
      radius * (1.35 + random() * 1.4),
      radius * (1 + random() * 1.25),
    );
  }

  graphics.fillStyle(0xffffff, 0.08);
  graphics.fillEllipse(center, center, size * 0.42, size * 0.34);
}

function drawBioWebTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  seed: number,
): void {
  const random = createSeededRandom(seed);
  const center = size * 0.5;

  for (let branch = 0; branch < 14; branch += 1) {
    let x = center + (random() - 0.5) * size * 0.26;
    let y = center + (random() - 0.5) * size * 0.26;
    let angle = random() * Math.PI * 2;
    const segments = 6 + Math.floor(random() * 6);

    for (let segment = 0; segment < segments; segment += 1) {
      const length = size * (0.05 + random() * 0.07);
      const nextAngle = angle + (random() - 0.5) * 0.95;
      const nextX = x + Math.cos(nextAngle) * length;
      const nextY = y + Math.sin(nextAngle) * length;

      graphics.lineStyle(6, 0xffffff, 0.022);
      graphics.lineBetween(x, y, nextX, nextY);
      graphics.lineStyle(2.2, 0xffffff, 0.065);
      graphics.lineBetween(x, y, nextX, nextY);

      if (random() > 0.58) {
        const branchAngle = nextAngle + (random() > 0.5 ? 1 : -1) * (0.45 + random() * 0.45);
        const branchLength = length * (0.45 + random() * 0.5);
        const branchX = nextX + Math.cos(branchAngle) * branchLength;
        const branchY = nextY + Math.sin(branchAngle) * branchLength;
        graphics.lineStyle(3.5, 0xffffff, 0.016);
        graphics.lineBetween(nextX, nextY, branchX, branchY);
        graphics.lineStyle(1.2, 0xffffff, 0.048);
        graphics.lineBetween(nextX, nextY, branchX, branchY);
      }

      if (random() > 0.63) {
        graphics.fillStyle(0xffffff, 0.08);
        graphics.fillCircle(nextX, nextY, 1.5 + random() * 2.4);
      }

      x = nextX;
      y = nextY;
      angle = nextAngle;
    }
  }
}

function drawMembraneStainTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  seed: number,
): void {
  const random = createSeededRandom(seed);
  const center = size * 0.5;

  for (let layer = 0; layer < 14; layer += 1) {
    const angle = random() * Math.PI * 2;
    const orbit = size * (0.04 + random() * 0.16);
    const width = size * (0.18 + random() * 0.18);
    const height = width * (0.56 + random() * 0.42);
    graphics.fillStyle(0xffffff, 0.028 + random() * 0.04);
    graphics.fillEllipse(
      center + Math.cos(angle) * orbit,
      center + Math.sin(angle) * orbit,
      width,
      height,
    );
  }

  graphics.lineStyle(5, 0xffffff, 0.018);
  graphics.strokeEllipse(center, center, size * 0.3, size * 0.22);
  graphics.lineStyle(2, 0xffffff, 0.04);
  graphics.strokeEllipse(center, center, size * 0.22, size * 0.15);
}

function drawSoftGlowDotTexture(graphics: Phaser.GameObjects.Graphics, size: number): void {
  const center = size * 0.5;
  graphics.fillStyle(0xffffff, 0.05);
  graphics.fillCircle(center, center, size * 0.48);
  graphics.fillStyle(0xffffff, 0.12);
  graphics.fillCircle(center, center, size * 0.28);
  graphics.fillStyle(0xffffff, 0.72);
  graphics.fillCircle(center, center, size * 0.08);
}

function drawParticleDotTexture(graphics: Phaser.GameObjects.Graphics, size: number): void {
  const center = size * 0.5;
  graphics.fillStyle(0xffffff, 0.8);
  graphics.fillCircle(center, center, size * 0.18);
}

function drawSoftParticleTexture(graphics: Phaser.GameObjects.Graphics, size: number): void {
  const center = size * 0.5;
  graphics.fillStyle(0xffffff, 0.08);
  graphics.fillCircle(center, center, size * 0.46);
  graphics.fillStyle(0xffffff, 0.18);
  graphics.fillCircle(center, center, size * 0.3);
  graphics.fillStyle(0xffffff, 0.42);
  graphics.fillCircle(center, center, size * 0.15);
}

function drawMoteFragmentTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  seed: number,
): void {
  const random = createSeededRandom(seed);
  const center = size * 0.5;
  const points: Phaser.Math.Vector2[] = [];

  for (let index = 0; index < 5; index += 1) {
    const angle = (Math.PI * 2 * index) / 5 + random() * 0.42;
    const radius = size * (0.16 + random() * 0.12);
    points.push(
      new Phaser.Math.Vector2(
        center + Math.cos(angle) * radius,
        center + Math.sin(angle) * radius,
      ),
    );
  }

  graphics.fillStyle(0xffffff, 0.22);
  graphics.fillPoints(points, true);
  graphics.lineStyle(1.2, 0xffffff, 0.42);
  graphics.strokePoints(points, true, true);
}

function drawNeuralVeinTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  seed: number,
): void {
  const random = createSeededRandom(seed);
  const center = size * 0.5;

  for (let bundle = 0; bundle < 8; bundle += 1) {
    const startAngle = random() * Math.PI * 2;
    const startRadius = size * (0.04 + random() * 0.12);
    let x = center + Math.cos(startAngle) * startRadius;
    let y = center + Math.sin(startAngle) * startRadius;
    let angle = startAngle + (random() - 0.5) * 0.6;
    const segments = 10 + Math.floor(random() * 8);

    for (let segment = 0; segment < segments; segment += 1) {
      const length = size * (0.055 + random() * 0.055);
      const nextAngle = angle + (random() - 0.5) * 0.32;
      const nextX = x + Math.cos(nextAngle) * length;
      const nextY = y + Math.sin(nextAngle) * length;

      graphics.lineStyle(7, 0xffffff, 0.018);
      graphics.lineBetween(x, y, nextX, nextY);
      graphics.lineStyle(3.2, 0xffffff, 0.05);
      graphics.lineBetween(x, y, nextX, nextY);
      graphics.lineStyle(1.1, 0xffffff, 0.14);
      graphics.lineBetween(x, y, nextX, nextY);

      if (random() > 0.7) {
        const branchAngle = nextAngle + (random() > 0.5 ? 1 : -1) * (0.5 + random() * 0.45);
        const branchLength = length * (0.55 + random() * 0.6);
        const branchX = nextX + Math.cos(branchAngle) * branchLength;
        const branchY = nextY + Math.sin(branchAngle) * branchLength;
        graphics.lineStyle(4.2, 0xffffff, 0.014);
        graphics.lineBetween(nextX, nextY, branchX, branchY);
        graphics.lineStyle(1.6, 0xffffff, 0.04);
        graphics.lineBetween(nextX, nextY, branchX, branchY);
        graphics.lineStyle(0.9, 0xffffff, 0.11);
        graphics.lineBetween(nextX, nextY, branchX, branchY);

        if (random() > 0.55) {
          graphics.fillStyle(0xffffff, 0.1);
          graphics.fillCircle(branchX, branchY, 1 + random() * 1.6);
        }
      }

      if (random() > 0.74) {
        graphics.fillStyle(0xffffff, 0.09);
        graphics.fillCircle(nextX, nextY, 1.3 + random() * 1.8);
      }

      x = nextX;
      y = nextY;
      angle = nextAngle;
    }
  }
}

function drawCapillaryVeinTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  seed: number,
): void {
  const random = createSeededRandom(seed);
  const center = size * 0.5;

  for (let bundle = 0; bundle < 12; bundle += 1) {
    const startAngle = random() * Math.PI * 2;
    const startRadius = size * (0.02 + random() * 0.14);
    let x = center + Math.cos(startAngle) * startRadius;
    let y = center + Math.sin(startAngle) * startRadius;
    let angle = startAngle + (random() - 0.5) * 0.5;
    const segments = 8 + Math.floor(random() * 8);

    for (let segment = 0; segment < segments; segment += 1) {
      const length = size * (0.04 + random() * 0.07);
      const nextAngle = angle + (random() - 0.5) * 0.55;
      const nextX = x + Math.cos(nextAngle) * length;
      const nextY = y + Math.sin(nextAngle) * length;

      graphics.lineStyle(8.5, 0xffffff, 0.035);
      graphics.lineBetween(x, y, nextX, nextY);
      graphics.lineStyle(4.2, 0xffffff, 0.12);
      graphics.lineBetween(x, y, nextX, nextY);
      graphics.lineStyle(1.6, 0xffffff, 0.42);
      graphics.lineBetween(x, y, nextX, nextY);

      if (random() > 0.45) {
        const forkAngle = nextAngle + (random() > 0.5 ? 1 : -1) * (0.5 + random() * 0.5);
        const forkLength = length * (0.55 + random() * 0.55);
        const forkX = nextX + Math.cos(forkAngle) * forkLength;
        const forkY = nextY + Math.sin(forkAngle) * forkLength;
        graphics.lineStyle(5.5, 0xffffff, 0.026);
        graphics.lineBetween(nextX, nextY, forkX, forkY);
        graphics.lineStyle(2.4, 0xffffff, 0.1);
        graphics.lineBetween(nextX, nextY, forkX, forkY);
        graphics.lineStyle(1, 0xffffff, 0.32);
        graphics.lineBetween(nextX, nextY, forkX, forkY);

        if (random() > 0.55) {
          graphics.fillStyle(0xffffff, 0.38);
          graphics.fillCircle(forkX, forkY, 1 + random() * 1.6);
        }
      }

      if (random() > 0.55) {
        graphics.fillStyle(0xffffff, 0.3);
        graphics.fillCircle(nextX, nextY, 1.2 + random() * 1.8);
      }

      x = nextX;
      y = nextY;
      angle = nextAngle;
    }
  }
}

function drawPulseHeadTexture(graphics: Phaser.GameObjects.Graphics, size: number): void {
  const center = size * 0.5;
  graphics.fillStyle(0xffffff, 0.04);
  graphics.fillCircle(center, center, size * 0.48);
  graphics.fillStyle(0xffffff, 0.1);
  graphics.fillCircle(center, center, size * 0.32);
  graphics.fillStyle(0xffffff, 0.28);
  graphics.fillCircle(center, center, size * 0.2);
  graphics.fillStyle(0xffffff, 0.7);
  graphics.fillCircle(center, center, size * 0.1);
  graphics.fillStyle(0xffffff, 0.98);
  graphics.fillCircle(center, center, size * 0.055);
}

function drawCorruptionCrackTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  seed: number,
): void {
  const random = createSeededRandom(seed);
  const center = size * 0.5;

  for (let path = 0; path < 6; path += 1) {
    let x = center + (random() - 0.5) * size * 0.15;
    let y = center + (random() - 0.5) * size * 0.15;
    let angle = random() * Math.PI * 2;
    const segments = 5 + Math.floor(random() * 5);

    for (let segment = 0; segment < segments; segment += 1) {
      const length = size * (0.05 + random() * 0.06);
      angle += (random() - 0.5) * 0.8;
      const nextX = x + Math.cos(angle) * length;
      const nextY = y + Math.sin(angle) * length;
      graphics.lineStyle(4, 0xffffff, 0.02);
      graphics.lineBetween(x, y, nextX, nextY);
      graphics.lineStyle(1.4, 0xffffff, 0.09);
      graphics.lineBetween(x, y, nextX, nextY);

      if (random() > 0.62) {
        const splitAngle = angle + (random() > 0.5 ? 1 : -1) * (0.55 + random() * 0.3);
        const splitLength = length * (0.48 + random() * 0.36);
        graphics.lineStyle(1, 0xffffff, 0.06);
        graphics.lineBetween(
          nextX,
          nextY,
          nextX + Math.cos(splitAngle) * splitLength,
          nextY + Math.sin(splitAngle) * splitLength,
        );
      }

      x = nextX;
      y = nextY;
    }
  }
}

export function registerBackgroundTextures(scene: Phaser.Scene): void {
  ensureTexture(scene, textureKeys.background.softCloud, 512, 512, (graphics) => {
    drawSoftCloudTexture(graphics, 512, 0x14b7c0);
  });
  ensureTexture(scene, textureKeys.background.bioWeb, 640, 640, (graphics) => {
    drawBioWebTexture(graphics, 640, 0x51a6be);
  });
  ensureTexture(scene, textureKeys.background.neuralVein, 640, 640, (graphics) => {
    drawNeuralVeinTexture(graphics, 640, 0x2eb0cf);
  });
  ensureTexture(scene, textureKeys.background.capillaryVein, 640, 640, (graphics) => {
    drawCapillaryVeinTexture(graphics, 640, 0xb12a3f);
  });
  ensureTexture(scene, textureKeys.background.pulseHead, 96, 96, (graphics) => {
    drawPulseHeadTexture(graphics, 96);
  });
  ensureTexture(scene, textureKeys.background.membraneStain, 512, 512, (graphics) => {
    drawMembraneStainTexture(graphics, 512, 0x788ae1);
  });
  ensureTexture(scene, textureKeys.background.softGlowDot, 96, 96, (graphics) => {
    drawSoftGlowDotTexture(graphics, 96);
  });
  ensureTexture(scene, textureKeys.background.particleDot, 16, 16, (graphics) => {
    drawParticleDotTexture(graphics, 16);
  });
  ensureTexture(scene, textureKeys.background.softParticle, 64, 64, (graphics) => {
    drawSoftParticleTexture(graphics, 64);
  });
  ensureTexture(scene, textureKeys.background.moteFragment, 48, 48, (graphics) => {
    drawMoteFragmentTexture(graphics, 48, 0x09c4d3);
  });
  ensureTexture(scene, textureKeys.background.corruptionCrack, 384, 384, (graphics) => {
    drawCorruptionCrackTexture(graphics, 384, 0x5f2349);
  });
}
