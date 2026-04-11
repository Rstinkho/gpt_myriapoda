import * as Phaser from 'phaser';
import type * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { clamp } from '@/utils/math';
import { getJellyfishPhaseSeed } from '@/entities/enemies/jellyfish/JellyfishAI';
import { jellyfishDefinition } from '@/entities/enemies/jellyfish/definition';

export class JellyfishView {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private readonly phaseSeed: number;

  constructor(scene: Phaser.Scene, enemyId: string) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);
    this.phaseSeed = getJellyfishPhaseSeed(enemyId);
  }

  update(body: planck.Body, deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    const position = vec2ToPixels(body.getPosition());
    const velocity = body.getLinearVelocity();
    const speedPx = Math.hypot(velocity.x, velocity.y) * tuning.pixelsPerMeter;
    const speedRatio = clamp(
      speedPx / (tuning.jellyfishMaxSpeed * tuning.pixelsPerMeter),
      0,
      1,
    );
    const pulseWave =
      0.5 + 0.5 * Math.sin(this.elapsed * jellyfishDefinition.pulseSpeed + this.phaseSeed);
    const bellPulse = 0.45 + pulseWave * 0.35 + speedRatio * 0.2;
    const bob =
      Math.sin(this.elapsed * jellyfishDefinition.bobSpeed + this.phaseSeed) *
      jellyfishDefinition.bobAmplitudePx;
    const wobble =
      Math.sin(this.elapsed * 1.7 + this.phaseSeed) * jellyfishDefinition.wobbleFactor;
    const bellWidth =
      tuning.jellyfishDisplaySize *
      (jellyfishDefinition.bellWidthBase + bellPulse * jellyfishDefinition.bellWidthPulse);
    const bellHeight =
      tuning.jellyfishDisplaySize *
      (jellyfishDefinition.bellHeightBase - bellPulse * jellyfishDefinition.bellHeightPulse);
    const innerWidth = bellWidth * 0.62;
    const innerHeight = bellHeight * 0.48;
    const skirtY = bellHeight * 0.18;
    const tentacleBaseY = bellHeight * 0.22;
    const tentacleLength =
      tuning.jellyfishDisplaySize *
      (jellyfishDefinition.tentacleLengthBase +
        speedRatio * jellyfishDefinition.tentacleLengthSpeedBonus);
    const tentacleCount = jellyfishDefinition.tentacleCount;

    this.graphics.setPosition(position.x, position.y + bob);
    this.graphics.setRotation(wobble + velocity.x * 0.05);
    this.graphics.clear();

    this.graphics.fillStyle(jellyfishDefinition.auraColor, jellyfishDefinition.auraAlpha);
    this.graphics.fillEllipse(0, -2, bellWidth * 1.38, bellHeight * 1.18);
    this.graphics.fillStyle(jellyfishDefinition.bloomColor, jellyfishDefinition.bloomAlpha);
    this.graphics.fillEllipse(0, -3, bellWidth * 1.66, bellHeight * 1.34);

    const tentacleSpacing = bellWidth * jellyfishDefinition.tentacleSpacingMultiplier;
    const startX = -((tentacleCount - 1) * tentacleSpacing) * 0.5;
    for (let index = 0; index < tentacleCount; index += 1) {
      const x = startX + index * tentacleSpacing;
      const swayA =
        Math.sin(
          this.elapsed * jellyfishDefinition.tentacleSwaySpeedA +
            this.phaseSeed +
            index * 0.45,
        ) *
        (jellyfishDefinition.tentacleSwayBaseA +
          speedRatio * jellyfishDefinition.tentacleSwaySpeedBonusA);
      const swayB =
        Math.sin(
          this.elapsed * jellyfishDefinition.tentacleSwaySpeedB +
            this.phaseSeed * 1.3 +
            index * 0.3,
        ) *
        (jellyfishDefinition.tentacleSwayBaseB +
          speedRatio * jellyfishDefinition.tentacleSwaySpeedBonusB);
      const points = [
        new Phaser.Math.Vector2(x, tentacleBaseY),
        new Phaser.Math.Vector2(x + swayA, tentacleBaseY + tentacleLength * 0.36),
        new Phaser.Math.Vector2(x + swayB, tentacleBaseY + tentacleLength * 0.74),
        new Phaser.Math.Vector2(x + swayB * 0.45, tentacleBaseY + tentacleLength),
      ];
      this.graphics.lineStyle(
        2.6,
        jellyfishDefinition.tentacleGlowColor,
        jellyfishDefinition.tentacleGlowAlpha,
      );
      this.graphics.strokePoints(points, false, true);
      this.graphics.lineStyle(
        1.25,
        jellyfishDefinition.tentacleColor,
        jellyfishDefinition.tentacleAlpha,
      );
      this.graphics.strokePoints(points, false, true);
    }

    this.graphics.fillStyle(jellyfishDefinition.bellColor, jellyfishDefinition.bellAlpha);
    this.graphics.fillEllipse(0, -4, bellWidth, bellHeight);
    this.graphics.fillStyle(
      jellyfishDefinition.bellHighlightColor,
      jellyfishDefinition.bellHighlightAlpha,
    );
    this.graphics.fillEllipse(-bellWidth * 0.08, -bellHeight * 0.24, innerWidth, innerHeight);
    this.graphics.lineStyle(
      1.8,
      jellyfishDefinition.bellOutlineColor,
      jellyfishDefinition.bellOutlineAlpha,
    );
    this.graphics.strokeEllipse(0, -4, bellWidth, bellHeight);

    const skirtPoints = [
      new Phaser.Math.Vector2(-bellWidth * 0.42, skirtY),
      new Phaser.Math.Vector2(-bellWidth * 0.2, skirtY + 2 + pulseWave * 1.4),
      new Phaser.Math.Vector2(0, skirtY + 1.6),
      new Phaser.Math.Vector2(bellWidth * 0.22, skirtY + 2.8 + pulseWave),
      new Phaser.Math.Vector2(bellWidth * 0.42, skirtY),
    ];
    this.graphics.lineStyle(
      2.4,
      jellyfishDefinition.skirtColor,
      jellyfishDefinition.skirtAlpha,
    );
    this.graphics.strokePoints(skirtPoints, false, true);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
