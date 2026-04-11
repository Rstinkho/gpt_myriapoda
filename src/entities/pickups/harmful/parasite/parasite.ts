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

const parasitePalette: PickupPalette = {
  base: 0x8d8e62,
  shadow: 0x2e2f1a,
  highlight: 0xd8ddb5,
  detail: 0x5f6b31,
  glow: 0xb79a63,
};

const parasiteAnimation: PickupAnimationProfile = {
  pulseSpeed: 5.1,
  shimmerSpeed: 7.3,
  scaleAmplitude: 0.06,
  alphaAmplitude: 0.12,
  rotationAmplitude: 0.22,
  glowAlpha: 0.08,
};

function drawParasiteBody(
  graphics: Phaser.GameObjects.Graphics,
  options: PickupParticleRenderOptions,
): void {
  const alpha = options.alpha ?? 1;
  const animation = samplePickupAnimation(
    parasiteAnimation,
    options.elapsedSeconds,
    options.animationPhase,
  );
  const radius = options.radius * animation.scale;
  const segmentOffsets = [-0.9, -0.62, -0.28, 0.06, 0.38, 0.7];
  const waveStrength = 0.18 + animation.pulse * 0.1;

  graphics.fillStyle(parasitePalette.shadow, 0.2 * alpha);
  for (let index = 0; index < segmentOffsets.length; index += 1) {
    const progress = index / Math.max(1, segmentOffsets.length - 1);
    const segmentRadius = radius * (0.16 - progress * 0.04);
    const wobble =
      Math.sin(
        options.elapsedSeconds * 8.4 +
          options.animationPhase +
          progress * 2.6,
      ) *
      waveStrength;
    const offset = rotateVector(
      segmentOffsets[index] * radius,
      wobble * radius,
      options.angle,
    );
    graphics.fillCircle(
      options.x + offset.x + radius * 0.04,
      options.y + offset.y + radius * 0.06,
      segmentRadius,
    );
  }

  for (let index = 0; index < segmentOffsets.length; index += 1) {
    const progress = index / Math.max(1, segmentOffsets.length - 1);
    const segmentRadius = radius * (0.17 - progress * 0.045);
    const highlightRadius = segmentRadius * 0.38;
    const wobble =
      Math.sin(
        options.elapsedSeconds * 8.4 +
          options.animationPhase +
          progress * 2.6,
      ) *
      waveStrength;
    const offset = rotateVector(
      segmentOffsets[index] * radius,
      wobble * radius,
      options.angle,
    );
    graphics.fillStyle(
      progress > 0.72 ? parasitePalette.detail : parasitePalette.base,
      (0.92 - progress * 0.16) * alpha,
    );
    graphics.fillCircle(options.x + offset.x, options.y + offset.y, segmentRadius);

    graphics.fillStyle(parasitePalette.highlight, (0.18 - progress * 0.04) * alpha);
    graphics.fillCircle(
      options.x + offset.x - segmentRadius * 0.18,
      options.y + offset.y - segmentRadius * 0.24,
      highlightRadius,
    );

    if (index < segmentOffsets.length - 1) {
      const nextProgress = (index + 1) / Math.max(1, segmentOffsets.length - 1);
      const nextWobble =
        Math.sin(
          options.elapsedSeconds * 8.4 +
            options.animationPhase +
            nextProgress * 2.6,
        ) *
        waveStrength;
      const nextOffset = rotateVector(
        segmentOffsets[index + 1] * radius,
        nextWobble * radius,
        options.angle,
      );
      graphics.lineStyle(
        Math.max(0.8, radius * 0.09),
        parasitePalette.shadow,
        0.42 * alpha,
      );
      graphics.lineBetween(
        options.x + offset.x,
        options.y + offset.y,
        options.x + nextOffset.x,
        options.y + nextOffset.y,
      );
    }
  }

  const headOffset = rotateVector(segmentOffsets[0] * radius, 0, options.angle);
  graphics.fillStyle(parasitePalette.shadow, 0.7 * alpha);
  graphics.fillCircle(options.x + headOffset.x, options.y + headOffset.y, radius * 0.2);
  const eyeLeft = rotateVector(-0.82 * radius, -0.08 * radius, options.angle);
  const eyeRight = rotateVector(-0.82 * radius, 0.08 * radius, options.angle);
  graphics.fillStyle(0x1a0707, 0.86 * alpha);
  graphics.fillCircle(options.x + eyeLeft.x, options.y + eyeLeft.y, radius * 0.035);
  graphics.fillCircle(options.x + eyeRight.x, options.y + eyeRight.y, radius * 0.035);
}

function buildParasiteTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
): void {
  drawParasiteBody(graphics, {
    x: size * 0.5,
    y: size * 0.5,
    radius: size * 0.38,
    angle: -0.18,
    elapsedSeconds: 0,
    animationPhase: 0,
  });
}

export const parasitePickupDefinition: PickupDefinition = {
  tier: 'harmful',
  resourceId: 'parasite',
  textureKey: textureKeys.pickups.parasite,
  digestValue: 0,
  radius: 17,
  palette: parasitePalette,
  animationProfile: parasiteAnimation,
  isHarmful: true,
  worldLifetimeSeconds: 10,
  despawnAnimationSeconds: 1.4,
  stomachEffect: 'parasite',
  buildTexture: buildParasiteTexture,
  drawParticle: drawParasiteBody,
};
