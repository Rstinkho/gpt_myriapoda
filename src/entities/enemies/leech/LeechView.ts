import * as Phaser from 'phaser';
import type * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { LeechState } from '@/entities/enemies/Enemy';
import { getLeechPhaseSeed } from '@/entities/enemies/leech/LeechAI';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { clamp } from '@/utils/math';

interface LeechVisualSnapshot {
  state: LeechState;
  detachProgress: number;
}

export class LeechView {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly phaseSeed: number;
  private elapsed = 0;

  constructor(scene: Phaser.Scene, enemyId: string) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);
    this.phaseSeed = getLeechPhaseSeed(enemyId);
  }

  update(
    body: planck.Body,
    visualState: LeechVisualSnapshot,
    deltaSeconds: number,
  ): void {
    this.elapsed += deltaSeconds;
    const position = vec2ToPixels(body.getPosition());
    const velocity = body.getLinearVelocity();
    const speedRatio = clamp(
      Math.hypot(velocity.x, velocity.y) / tuning.leechMaxSpeed,
      0,
      1,
    );
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 5.8 + this.phaseSeed);
    const latchedPulse =
      visualState.state === 'latched' ? 0.28 + pulse * 0.26 : 0.08 + pulse * 0.08;
    const collapse =
      visualState.state === 'drainedOut'
        ? 0.72
        : visualState.state === 'detached'
          ? 0.9
          : 1;
    const width = tuning.leechDisplaySize * (0.32 + latchedPulse * 0.18) * collapse;
    const length =
      tuning.leechDisplaySize * (1.08 + speedRatio * 0.1 + latchedPulse * 0.12) * collapse;
    const digestiveCoreLength = length * (0.46 + latchedPulse * 0.08);
    const wobble =
      Math.sin(this.elapsed * 7.2 + this.phaseSeed) *
      (visualState.state === 'latched' ? 0.1 : 0.22);
    const detachTint = clamp(visualState.detachProgress / tuning.leechDetachThreshold, 0, 1);

    this.graphics.setPosition(position.x, position.y);
    this.graphics.setRotation(body.getAngle() + wobble);
    this.graphics.clear();

    this.graphics.fillStyle(0xf6d9cf, 0.08 + latchedPulse * 0.08);
    this.graphics.fillEllipse(0, 0, length * 1.16, width * 2.1);
    this.graphics.fillStyle(0xe8b8b0, 0.12 + latchedPulse * 0.06);
    this.graphics.fillEllipse(-length * 0.08, 0, length * 1.28, width * 2.38);

    const segmentOffsets = [-0.48, -0.24, 0, 0.22, 0.42];
    for (let index = 0; index < segmentOffsets.length; index += 1) {
      const progress = index / Math.max(1, segmentOffsets.length - 1);
      const localX = segmentOffsets[index] * length;
      const localY =
        Math.sin(this.elapsed * 9 + this.phaseSeed + progress * 2.3) *
        width *
        (visualState.state === 'latched' ? 0.08 : 0.18);
      const segmentWidth = width * (0.9 - progress * 0.18) + latchedPulse * width * 0.3;
      this.graphics.fillStyle(0xf0cfc5, 0.58 - progress * 0.08);
      this.graphics.fillEllipse(localX, localY, segmentWidth * 1.35, segmentWidth);
      this.graphics.fillStyle(0xfff3ee, 0.08);
      this.graphics.fillEllipse(
        localX - segmentWidth * 0.12,
        localY - segmentWidth * 0.14,
        segmentWidth * 0.44,
        segmentWidth * 0.24,
      );
    }

    this.graphics.fillStyle(0x9b5f67, 0.24 + latchedPulse * 0.26 + detachTint * 0.1);
    this.graphics.fillEllipse(
      length * 0.02,
      0,
      digestiveCoreLength,
      width * (0.44 + latchedPulse * 0.14),
    );
    this.graphics.fillStyle(0x5d2430, 0.24 + latchedPulse * 0.18);
    this.graphics.fillEllipse(length * 0.08, 0, digestiveCoreLength * 0.58, width * 0.26);

    const mouthX = -length * 0.54;
    this.graphics.fillStyle(0x6a2d32, 0.68);
    this.graphics.fillEllipse(mouthX, 0, width * 0.72, width * 0.58);
    this.graphics.lineStyle(1.6, 0xf9e5d9, 0.78);
    this.graphics.strokeEllipse(mouthX, 0, width * 0.56, width * 0.42);
    this.graphics.lineStyle(1.1, 0xf2cab7, 0.6);
    for (let hook = -1; hook <= 1; hook += 1) {
      this.graphics.beginPath();
      this.graphics.moveTo(mouthX - width * 0.18, hook * width * 0.08);
      this.graphics.lineTo(mouthX - width * 0.33, hook * width * 0.18);
      this.graphics.lineTo(mouthX - width * 0.26, hook * width * 0.28);
      this.graphics.strokePath();
    }

    this.graphics.lineStyle(1.2, 0xf8e6df, 0.46);
    this.graphics.beginPath();
    this.graphics.moveTo(length * 0.45, 0);
    this.graphics.lineTo(length * 0.62, width * 0.12);
    this.graphics.lineTo(length * 0.56, -width * 0.1);
    this.graphics.closePath();
    this.graphics.strokePath();
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
