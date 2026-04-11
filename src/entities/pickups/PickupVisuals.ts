import type * as Phaser from 'phaser';
import type { PickupAnimationProfile, PickupPalette } from '@/game/types';
import { rotateVector } from '@/utils/math';

export interface PickupParticleRenderOptions {
  x: number;
  y: number;
  radius: number;
  angle: number;
  elapsedSeconds: number;
  animationPhase: number;
  alpha?: number;
}

export interface PickupAnimationState {
  pulse: number;
  shimmer: number;
  scale: number;
  alpha: number;
  rotationOffset: number;
  glowAlpha: number;
}

const neutralAnimationState: PickupAnimationState = {
  pulse: 0.5,
  shimmer: 0.5,
  scale: 1,
  alpha: 1,
  rotationOffset: 0,
  glowAlpha: 0,
};

function interpolateChannel(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

function interpolateColor(from: number, to: number, t: number): number {
  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;

  return (
    (interpolateChannel(fromR, toR, t) << 16) |
    (interpolateChannel(fromG, toG, t) << 8) |
    interpolateChannel(fromB, toB, t)
  );
}

export function getPickupAnimationPhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}

export function samplePickupAnimation(
  profile: PickupAnimationProfile | undefined,
  elapsedSeconds: number,
  animationPhase: number,
): PickupAnimationState {
  if (!profile) {
    return neutralAnimationState;
  }

  const pulse =
    0.5 + 0.5 * Math.sin(elapsedSeconds * profile.pulseSpeed + animationPhase);
  const shimmer =
    0.5 +
    0.5 *
      Math.sin(
        elapsedSeconds * profile.shimmerSpeed + animationPhase * 1.7 + 0.8,
      );

  return {
    pulse,
    shimmer,
    scale: 1 + (pulse * 2 - 1) * profile.scaleAmplitude,
    alpha: 1 - profile.alphaAmplitude * 0.5 + pulse * profile.alphaAmplitude,
    rotationOffset:
      Math.sin(elapsedSeconds * profile.pulseSpeed * 0.42 + animationPhase) *
      profile.rotationAmplitude,
    glowAlpha: profile.glowAlpha * (0.38 + shimmer * 0.62),
  };
}

export function applyPickupSpriteAnimation(
  sprite: Phaser.GameObjects.Image,
  baseWidth: number,
  baseHeight: number,
  baseAlpha: number,
  baseRotation: number,
  palette: PickupPalette,
  profile: PickupAnimationProfile | undefined,
  elapsedSeconds: number,
  animationPhase: number,
): void {
  const animation = samplePickupAnimation(
    profile,
    elapsedSeconds,
    animationPhase,
  );
  sprite.setDisplaySize(baseWidth * animation.scale, baseHeight * animation.scale);
  sprite.setAlpha(Math.min(1, baseAlpha * animation.alpha));
  sprite.setRotation(baseRotation + animation.rotationOffset);

  if (!profile) {
    sprite.clearTint();
    return;
  }

  sprite.setTint(
    interpolateColor(
      palette.highlight,
      palette.glow ?? palette.base,
      animation.shimmer,
    ),
  );
}

export function projectPickupPoints(
  points: Array<{ x: number; y: number }>,
  x: number,
  y: number,
  radius: number,
  angle: number,
): Phaser.Math.Vector2[] {
  return points.map((point) => {
    const rotated = rotateVector(point.x * radius, point.y * radius, angle);
    return { x: x + rotated.x, y: y + rotated.y } as Phaser.Math.Vector2;
  });
}

export function drawPickupPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: Array<{ x: number; y: number }>,
  options: {
    x: number;
    y: number;
    radius: number;
    angle: number;
    fill: number;
    fillAlpha: number;
    stroke?: number;
    strokeAlpha?: number;
    lineWidth?: number;
  },
): void {
  const vectors = projectPickupPoints(
    points,
    options.x,
    options.y,
    options.radius,
    options.angle,
  );
  graphics.fillStyle(options.fill, options.fillAlpha);
  graphics.fillPoints(vectors as Phaser.Math.Vector2[], true);

  if (options.stroke !== undefined && options.strokeAlpha !== undefined) {
    graphics.lineStyle(
      options.lineWidth ?? Math.max(0.8, options.radius * 0.12),
      options.stroke,
      options.strokeAlpha,
    );
    graphics.strokePoints(vectors as Phaser.Math.Vector2[], true, true);
  }
}

export function drawPickupLine(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  angle: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: number,
  alpha: number,
  width: number,
): void {
  const worldStart = rotateVector(start.x * radius, start.y * radius, angle);
  const worldEnd = rotateVector(end.x * radius, end.y * radius, angle);
  graphics.lineStyle(width, color, alpha);
  graphics.lineBetween(
    x + worldStart.x,
    y + worldStart.y,
    x + worldEnd.x,
    y + worldEnd.y,
  );
}
