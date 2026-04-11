import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import type {
  EnemyBurst,
  EnemyBurstBubble,
  EnemyBurstShard,
  EnemyBurstShardShape,
} from '@/rendering/enemyBurstFx';
import { clamp, rotateVector } from '@/utils/math';

const enemyBurstDepth = 8.02;

export class EnemyBurstFxRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(enemyBurstDepth);
    Phaser.Actions.AddEffectBloom(this.graphics, {
      threshold: tuning.enemyBurstBloomThreshold,
      blurRadius: tuning.enemyBurstBloomRadius,
      blurSteps: tuning.enemyBurstBloomSteps,
      blendAmount: tuning.enemyBurstBloomAmount,
      useInternal: true,
    });
  }

  render(bursts: readonly EnemyBurst[]): void {
    this.graphics.clear();

    for (const burst of bursts) {
      this.renderBurst(burst);
    }
  }

  clear(): void {
    this.graphics.clear();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private renderBurst(burst: EnemyBurst): void {
    for (const shard of burst.shards) {
      this.renderShard(burst, shard);
    }

    for (const bubble of burst.bubbles) {
      this.renderBubble(burst, bubble);
    }
  }

  private renderShard(burst: EnemyBurst, shard: EnemyBurstShard): void {
    const progress = clamp(burst.ageSeconds / shard.lifetimeSeconds, 0, 1);
    if (progress >= 1) {
      return;
    }

    const deceleration = 1 - progress * 0.42;
    const x = burst.x + shard.velocityX * burst.ageSeconds * deceleration;
    const y =
      burst.y +
      shard.velocityY * burst.ageSeconds * deceleration +
      progress * progress * 10;
    const sizePx = shard.sizePx * (1 - progress * 0.18);
    const alpha = Math.pow(1 - progress, 0.72);
    const rotation = shard.rotation + shard.angularVelocity * burst.ageSeconds;
    const points = buildShardPolygon(
      shard.shape,
      x,
      y,
      sizePx,
      shard.stretch,
      rotation,
    );

    this.graphics.fillStyle(burst.palette.glowColor, alpha * 0.12);
    this.graphics.fillCircle(x, y, sizePx * (1.15 + shard.stretch * 0.18));
    this.graphics.fillStyle(shard.color, alpha * 0.92);
    this.graphics.fillPoints(points, true);
    this.graphics.lineStyle(Math.max(0.7, sizePx * 0.08), 0xffffff, alpha * 0.12);
    this.graphics.strokePoints(points, true, true);
  }

  private renderBubble(burst: EnemyBurst, bubble: EnemyBurstBubble): void {
    const progress = clamp(burst.ageSeconds / bubble.lifetimeSeconds, 0, 1);
    if (progress >= 1) {
      return;
    }

    const wobble =
      Math.sin(burst.ageSeconds * bubble.wobbleSpeed) * bubble.wobbleAmplitudePx;
    const x = burst.x + bubble.velocityX * burst.ageSeconds + wobble;
    const y =
      burst.y +
      bubble.velocityY * burst.ageSeconds -
      tuning.enemyBurstBubbleRisePx * progress;
    const radius = bubble.sizePx + bubble.growthPx * progress;
    const alpha = Math.pow(1 - progress, 0.82);

    this.graphics.fillStyle(burst.palette.glowColor, alpha * 0.08);
    this.graphics.fillCircle(x, y, radius * 1.55);
    this.graphics.fillStyle(bubble.fillColor, alpha * 0.22);
    this.graphics.fillCircle(x, y, radius);
    this.graphics.lineStyle(Math.max(0.8, radius * 0.12), bubble.outlineColor, alpha * 0.48);
    this.graphics.strokeCircle(x, y, radius);
    this.graphics.fillStyle(0xffffff, alpha * 0.16);
    this.graphics.fillCircle(x - radius * 0.24, y - radius * 0.22, Math.max(0.4, radius * 0.18));
  }
}

function buildShardPolygon(
  shape: EnemyBurstShardShape,
  x: number,
  y: number,
  sizePx: number,
  stretch: number,
  rotation: number,
): Phaser.Math.Vector2[] {
  const shapePoints = getShapeTemplate(shape).map(([localX, localY]) => {
    const rotated = rotateVector(localX * sizePx * stretch, localY * sizePx, rotation);
    return new Phaser.Math.Vector2(x + rotated.x, y + rotated.y);
  });

  return shapePoints;
}

function getShapeTemplate(shape: EnemyBurstShardShape): Array<[number, number]> {
  switch (shape) {
    case 'diamond':
      return [
        [0, -1],
        [0.85, 0],
        [0, 1],
        [-0.85, 0],
      ];
    case 'sliver':
      return [
        [-1.3, -0.2],
        [1.25, -0.04],
        [0.8, 0.18],
        [-1.1, 0.16],
      ];
    case 'droplet':
      return [
        [-1.1, 0],
        [-0.08, -0.82],
        [0.95, -0.3],
        [1.15, 0.22],
        [0.08, 0.92],
      ];
  }
}
