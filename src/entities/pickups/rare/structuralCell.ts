import type * as Phaser from 'phaser';
import { textureKeys } from '@/game/assets';
import type {
  PickupAnimationProfile,
  PickupPalette,
} from '@/game/types';
import type { PickupDefinition } from '@/entities/pickups/PickupRegistry';
import {
  samplePickupAnimation,
  type PickupParticleRenderOptions,
} from '@/entities/pickups/PickupVisuals';
import { rotateVector } from '@/utils/math';

const structuralCellPalette: PickupPalette = {
  base: 0x8e66d4,
  shadow: 0x412560,
  highlight: 0xf0d9ff,
  detail: 0xc09bff,
  glow: 0xe88dff,
};

const structuralCellAnimation: PickupAnimationProfile = {
  pulseSpeed: 3.2,
  shimmerSpeed: 5.6,
  scaleAmplitude: 0.08,
  alphaAmplitude: 0.18,
  rotationAmplitude: 0.08,
  glowAlpha: 0.22,
};

function drawOrganelle(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  angle: number,
  offset: { x: number; y: number },
  fill: number,
  alpha: number,
): void {
  const rotated = rotateVector(offset.x * radius, offset.y * radius, angle);
  graphics.fillStyle(fill, alpha);
  graphics.fillCircle(x + rotated.x, y + rotated.y, radius * 0.12);
}

function drawStructuralCell(
  graphics: Phaser.GameObjects.Graphics,
  options: PickupParticleRenderOptions,
): void {
  const alpha = options.alpha ?? 1;
  const animation = samplePickupAnimation(
    structuralCellAnimation,
    options.elapsedSeconds,
    options.animationPhase,
  );
  const radius = options.radius * animation.scale;

  graphics.fillStyle(
    structuralCellPalette.glow ?? structuralCellPalette.highlight,
    animation.glowAlpha * alpha,
  );
  graphics.fillCircle(options.x, options.y, radius * (1.24 + animation.pulse * 0.08));

  graphics.fillStyle(structuralCellPalette.shadow, 0.24 * alpha);
  graphics.fillCircle(options.x + radius * 0.06, options.y + radius * 0.08, radius * 1.02);

  graphics.fillStyle(structuralCellPalette.base, 0.92 * alpha);
  graphics.fillCircle(options.x, options.y, radius);
  graphics.lineStyle(Math.max(0.8, radius * 0.12), structuralCellPalette.highlight, 0.72 * alpha);
  graphics.strokeCircle(options.x, options.y, radius);

  graphics.fillStyle(structuralCellPalette.detail, (0.34 + animation.shimmer * 0.18) * alpha);
  graphics.fillCircle(options.x, options.y, radius * 0.72);
  graphics.lineStyle(Math.max(0.5, radius * 0.08), structuralCellPalette.highlight, 0.32 * alpha);
  graphics.strokeCircle(options.x, options.y, radius * 0.72);

  const nucleusOffset = rotateVector(radius * 0.16, radius * -0.1, options.angle);
  graphics.fillStyle(structuralCellPalette.shadow, 0.6 * alpha);
  graphics.fillCircle(
    options.x + nucleusOffset.x,
    options.y + nucleusOffset.y,
    radius * 0.26,
  );
  graphics.fillStyle(structuralCellPalette.highlight, (0.52 + animation.shimmer * 0.18) * alpha);
  graphics.fillCircle(
    options.x + nucleusOffset.x - radius * 0.04,
    options.y + nucleusOffset.y - radius * 0.04,
    radius * 0.14,
  );

  drawOrganelle(
    graphics,
    options.x,
    options.y,
    radius,
    options.angle,
    { x: -0.42, y: -0.12 },
    structuralCellPalette.highlight,
    0.28 * alpha,
  );
  drawOrganelle(
    graphics,
    options.x,
    options.y,
    radius,
    options.angle,
    { x: 0.36, y: 0.18 },
    structuralCellPalette.detail,
    0.34 * alpha,
  );
  drawOrganelle(
    graphics,
    options.x,
    options.y,
    radius,
    options.angle,
    { x: -0.08, y: 0.42 },
    structuralCellPalette.highlight,
    0.24 * alpha,
  );
}

function buildStructuralCellTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
): void {
  drawStructuralCell(graphics, {
    x: size * 0.5,
    y: size * 0.5,
    radius: size * 0.27,
    angle: 0,
    elapsedSeconds: 0,
    animationPhase: 0,
  });
}

export const structuralCellPickupDefinition: PickupDefinition = {
  tier: 'rare',
  resourceId: 'structuralCell',
  textureKey: textureKeys.pickups.structuralCell,
  digestValue: 4,
  radius: 12,
  palette: structuralCellPalette,
  animationProfile: structuralCellAnimation,
  isHarmful: false,
  buildTexture: buildStructuralCellTexture,
  drawParticle: drawStructuralCell,
};
