import * as Phaser from 'phaser';
import { getLimbStateProgress } from '@/entities/myriapoda/limbState';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { tuning } from '@/game/tuning';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { normalize, rotateVector } from '@/utils/math';

interface Point {
  x: number;
  y: number;
}

export class LimbRenderer {
  private elapsed = 0;

  constructor(
    private readonly graphics: Phaser.GameObjects.Graphics,
    private readonly strikeGraphics: Phaser.GameObjects.Graphics,
  ) {}

  render(myriapoda: Myriapoda): void {
    this.elapsed += tuning.fixedStepSeconds;

    for (const limb of myriapoda.limbs.limbs) {
      const segment = myriapoda.body.sampleAlongBody(limb.anchorRatio);
      const tangent = {
        x: Math.cos(segment.angle),
        y: Math.sin(segment.angle),
      };
      const normal = {
        x: -tangent.y * limb.side,
        y: tangent.x * limb.side,
      };
      const root = {
        x: segment.x + normal.x * limb.mountOffsetPx,
        y: segment.y + normal.y * limb.mountOffsetPx,
      };
      const points = limb.body.bodies.map((body) => vec2ToPixels(body.getPosition()));
      const tip = points[points.length - 1];
      const preTip = points[Math.max(0, points.length - 2)] ?? root;
      const stateProgress = getLimbStateProgress(limb.state);
      const attackWeight =
        limb.state.name === 'idle'
          ? 0
          : limb.state.name === 'hit'
            ? 1
            : limb.state.name === 'extend'
              ? stateProgress
              : 1 - stateProgress;
      const extendWeight = limb.state.name === 'extend' ? stateProgress : 0;
      const hitWeight = limb.state.name === 'hit' ? 1 - stateProgress * 0.22 : 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 20 + limb.phase * Math.PI * 2);
      const flicker =
        0.7 +
        0.3 *
          (0.5 +
            0.5 * Math.sin(this.elapsed * 34 + limb.phase * Math.PI * 4 + attackWeight * 2.4));
      const strikeDirection = normalize(tip.x - preTip.x, tip.y - preTip.y);
      const forward =
        strikeDirection.x === 0 && strikeDirection.y === 0 ? normal : strikeDirection;

      this.renderBaseLimb(root, points, tip, attackWeight);

      if (attackWeight > 0.01) {
        this.renderElectricStrike(
          points,
          tip,
          limb.desiredTarget,
          forward,
          limb.phase,
          attackWeight,
          extendWeight,
          hitWeight,
          pulse,
          flicker,
        );
      }
    }
  }

  private renderBaseLimb(
    root: Point,
    points: Point[],
    tip: Point,
    attackWeight: number,
  ): void {
    const baseWidth = 1.8 + attackWeight * 0.32;

    this.graphics.lineStyle(baseWidth * 1.55, 0x132a24, 0.12 + attackWeight * 0.08);
    this.drawLimbPath(this.graphics, root, points);
    this.graphics.lineStyle(baseWidth, tuning.limbBaseColor, 0.64 + attackWeight * 0.1);
    this.drawLimbPath(this.graphics, root, points);
    this.graphics.lineStyle(baseWidth * 0.42, 0xf3fff8, 0.12 + attackWeight * 0.08);
    this.drawLimbPath(this.graphics, root, points);

    this.graphics.fillStyle(tuning.limbBaseColor, 0.45 + attackWeight * 0.14);
    this.graphics.fillCircle(tip.x, tip.y, 1.35 + attackWeight * 0.3);
    this.graphics.fillStyle(0xf0fff8, 0.08 + attackWeight * 0.12);
    this.graphics.fillCircle(tip.x, tip.y, 0.65 + attackWeight * 0.18);
  }

  private renderElectricStrike(
    points: Point[],
    tip: Point,
    desiredTarget: Point | null,
    forward: Point,
    phase: number,
    attackWeight: number,
    extendWeight: number,
    hitWeight: number,
    pulse: number,
    flicker: number,
  ): void {
    const conductionStart = points[Math.max(0, points.length - 3)] ?? tip;
    const conductionMid = points[Math.max(0, points.length - 2)] ?? tip;
    const conductionBolt = [
      new Phaser.Math.Vector2(conductionStart.x, conductionStart.y),
      new Phaser.Math.Vector2(conductionMid.x, conductionMid.y),
      new Phaser.Math.Vector2(tip.x, tip.y),
    ];
    const dischargeEnd = this.resolveDischargeEnd(tip, desiredTarget, forward, hitWeight);
    const mainBolt = this.buildBoltBetween(
      tip,
      dischargeEnd,
      phase,
      attackWeight,
      tuning.limbStrikeJitterPx,
      0,
    );
    const secondaryBolt = this.buildBoltBetween(
      tip,
      dischargeEnd,
      phase + 0.37,
      attackWeight * 0.82,
      tuning.limbStrikeSecondaryJitterPx,
      0.58,
    );

    const glowAlpha = attackWeight * (0.12 + pulse * 0.08) * flicker;
    const midAlpha = attackWeight * (0.28 + pulse * 0.12);
    const coreAlpha = attackWeight * (0.56 + pulse * 0.18);
    const glowWidth = 4.6 + attackWeight * 2.4;
    const midWidth = 2.4 + attackWeight * 1.25;
    const coreWidth = 1 + attackWeight * 0.6;

    this.strokeBolt(
      conductionBolt,
      glowWidth * 0.38,
      midWidth * 0.42,
      coreWidth * 0.46,
      glowAlpha * 0.26,
      midAlpha * 0.34,
      coreAlpha * 0.4,
    );
    this.strokeBolt(mainBolt, glowWidth, midWidth, coreWidth, glowAlpha, midAlpha, coreAlpha);
    this.strokeBolt(
      secondaryBolt,
      glowWidth * 0.72,
      midWidth * 0.76,
      coreWidth * 0.82,
      glowAlpha * 0.54,
      midAlpha * 0.64,
      coreAlpha * 0.7,
    );

    this.drawBranchBolts(mainBolt, forward, phase, extendWeight, hitWeight, attackWeight);
    this.drawTipFlash(tip, forward, attackWeight, hitWeight, pulse);
    this.drawImpactFlash(dischargeEnd, forward, attackWeight, hitWeight, pulse);
  }

  private buildBoltBetween(
    start: Point,
    end: Point,
    phase: number,
    intensity: number,
    jitterAmplitude: number,
    seedOffset: number,
  ): Phaser.Math.Vector2[] {
    const bolt: Phaser.Math.Vector2[] = [];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.max(0.001, Math.hypot(deltaX, deltaY));
    const forward = normalize(deltaX, deltaY);
    const normal = {
      x: -forward.y,
      y: forward.x,
    };
    const segmentCount = 5;

    for (let index = 0; index <= segmentCount; index += 1) {
      const t = index / segmentCount;
      if (index === 0) {
        bolt.push(new Phaser.Math.Vector2(start.x, start.y));
        continue;
      }
      if (index === segmentCount) {
        bolt.push(new Phaser.Math.Vector2(end.x, end.y));
        continue;
      }

      const taper = Math.sin(Math.PI * t);
      const midpointBias = index % 2 === 0 ? 0.6 : 1;
      const waveA = Math.sin(
        this.elapsed * 31 +
          phase * Math.PI * 2 +
          index * 1.43 +
          seedOffset * 3.2,
      );
      const waveB = Math.cos(
        this.elapsed * 19 +
          phase * Math.PI * 1.6 +
          index * 0.94 +
          seedOffset * 2.1,
      );
      const lateralOffset =
        waveA * jitterAmplitude * intensity * taper * midpointBias * Math.min(1, distance / 18);
      const alongOffset = waveB * jitterAmplitude * 0.16 * intensity * taper;
      const base = {
        x: start.x + deltaX * t,
        y: start.y + deltaY * t,
      };

      bolt.push(
        new Phaser.Math.Vector2(
          base.x + normal.x * lateralOffset + forward.x * alongOffset,
          base.y + normal.y * lateralOffset + forward.y * alongOffset,
        ),
      );
    }

    return bolt;
  }

  private resolveDischargeEnd(
    tip: Point,
    desiredTarget: Point | null,
    forward: Point,
    hitWeight: number,
  ): Point {
    const maxReach = tuning.limbStrikeReachPx + hitWeight * 6;
    if (!desiredTarget) {
      return {
        x: tip.x + forward.x * maxReach,
        y: tip.y + forward.y * maxReach,
      };
    }

    const toTarget = {
      x: desiredTarget.x - tip.x,
      y: desiredTarget.y - tip.y,
    };
    const targetDirection = normalize(toTarget.x, toTarget.y);
    const direction =
      targetDirection.x === 0 && targetDirection.y === 0 ? forward : targetDirection;
    const targetDistance = Math.hypot(toTarget.x, toTarget.y);
    const reach = Math.min(maxReach, Math.max(6, targetDistance));

    return {
      x: tip.x + direction.x * reach,
      y: tip.y + direction.y * reach,
    };
  }

  private strokeBolt(
    points: Phaser.Math.Vector2[],
    glowWidth: number,
    midWidth: number,
    coreWidth: number,
    glowAlpha: number,
    midAlpha: number,
    coreAlpha: number,
  ): void {
    this.strikeGraphics.lineStyle(glowWidth, tuning.limbElectricGlowColor, glowAlpha);
    this.strikeGraphics.strokePoints(points, false, true);
    this.strikeGraphics.lineStyle(midWidth, tuning.limbElectricMidColor, midAlpha);
    this.strikeGraphics.strokePoints(points, false, true);
    this.strikeGraphics.lineStyle(coreWidth, tuning.limbElectricCoreColor, coreAlpha);
    this.strikeGraphics.strokePoints(points, false, true);
  }

  private drawBranchBolts(
    mainBolt: Phaser.Math.Vector2[],
    forward: Point,
    phase: number,
    extendWeight: number,
    hitWeight: number,
    attackWeight: number,
  ): void {
    if (mainBolt.length < 5) {
      return;
    }

    const branchCount = Math.min(3, Math.max(1, 1 + Math.round(extendWeight + hitWeight * 1.4)));
    const normal = {
      x: -forward.y,
      y: forward.x,
    };

    for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
      const progress = 0.54 + (branchIndex + 1) / (branchCount + 2) * 0.34;
      const startIndex = Math.min(
        mainBolt.length - 2,
        Math.max(1, Math.floor(progress * (mainBolt.length - 1))),
      );
      const start = mainBolt[startIndex];
      const side = branchIndex % 2 === 0 ? 1 : -1;
      const branchLength =
        tuning.limbStrikeBranchLengthPx *
        (0.78 + attackWeight * 0.42 - branchIndex * 0.08);
      const branchDirection = rotateVector(
        forward.x,
        forward.y,
        side * (0.72 + 0.16 * Math.sin(this.elapsed * 9 + phase * 5 + branchIndex)),
      );
      const tip = {
        x:
          start.x +
          branchDirection.x * branchLength +
          normal.x * side * branchLength * 0.2,
        y:
          start.y +
          branchDirection.y * branchLength +
          normal.y * side * branchLength * 0.2,
      };
      const mid = {
        x:
          start.x +
          branchDirection.x * branchLength * 0.45 +
          normal.x *
            side *
            tuning.limbStrikeBranchJitterPx *
            (0.6 + 0.4 * Math.sin(this.elapsed * 22 + branchIndex * 1.2)),
        y:
          start.y +
          branchDirection.y * branchLength * 0.45 +
          normal.y *
            side *
            tuning.limbStrikeBranchJitterPx *
            (0.6 + 0.4 * Math.sin(this.elapsed * 22 + branchIndex * 1.2)),
      };
      const branchPoints = [
        new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2(mid.x, mid.y),
        new Phaser.Math.Vector2(tip.x, tip.y),
      ];
      const alpha = attackWeight * (0.16 + hitWeight * 0.16);

      this.strikeGraphics.lineStyle(2.4, tuning.limbElectricGlowColor, alpha * 0.7);
      this.strikeGraphics.strokePoints(branchPoints, false, true);
      this.strikeGraphics.lineStyle(1.35, tuning.limbElectricMidColor, alpha * 0.95);
      this.strikeGraphics.strokePoints(branchPoints, false, true);
      this.strikeGraphics.lineStyle(0.7, tuning.limbElectricCoreColor, alpha * 1.2);
      this.strikeGraphics.strokePoints(branchPoints, false, true);
    }
  }

  private drawTipFlash(
    tip: Point,
    forward: Point,
    attackWeight: number,
    hitWeight: number,
    pulse: number,
  ): void {
    const glowRadius =
      tuning.limbStrikeTipFlashRadiusPx *
      (0.48 + attackWeight * 0.42 + hitWeight * 0.25);
    const coreRadius = glowRadius * 0.36;
    const flashAlpha = attackWeight * (0.2 + pulse * 0.12) + hitWeight * 0.12;

    this.strikeGraphics.fillStyle(tuning.limbElectricGlowColor, flashAlpha * 0.3);
    this.strikeGraphics.fillCircle(tip.x, tip.y, glowRadius);
    this.strikeGraphics.fillStyle(tuning.limbElectricMidColor, flashAlpha * 0.42);
    this.strikeGraphics.fillCircle(tip.x, tip.y, glowRadius * 0.58);
    this.strikeGraphics.fillStyle(tuning.limbElectricCoreColor, flashAlpha * 0.82);
    this.strikeGraphics.fillCircle(tip.x, tip.y, coreRadius);

    const rayDirections = [
      forward,
      rotateVector(forward.x, forward.y, 0.72),
      rotateVector(forward.x, forward.y, -0.72),
    ];

    for (const rayDirection of rayDirections) {
      const end = {
        x: tip.x + rayDirection.x * tuning.limbStrikeTipRayLengthPx * (0.8 + hitWeight * 0.2),
        y: tip.y + rayDirection.y * tuning.limbStrikeTipRayLengthPx * (0.8 + hitWeight * 0.2),
      };
      this.strikeGraphics.lineStyle(
        tuning.limbStrikeTipRayWidthPx * 1.8,
        tuning.limbElectricGlowColor,
        flashAlpha * 0.26,
      );
      this.strikeGraphics.strokeLineShape(
        new Phaser.Geom.Line(tip.x, tip.y, end.x, end.y),
      );
      this.strikeGraphics.lineStyle(
        tuning.limbStrikeTipRayWidthPx,
        tuning.limbElectricFlashColor,
        flashAlpha * 0.72,
      );
      this.strikeGraphics.strokeLineShape(
        new Phaser.Geom.Line(tip.x, tip.y, end.x, end.y),
      );
    }
  }

  private drawImpactFlash(
    impact: Point,
    forward: Point,
    attackWeight: number,
    hitWeight: number,
    pulse: number,
  ): void {
    const glowRadius =
      tuning.limbStrikeImpactFlashRadiusPx * (0.38 + attackWeight * 0.3 + hitWeight * 0.42);
    const alpha = attackWeight * (0.12 + pulse * 0.08) + hitWeight * 0.18;

    this.strikeGraphics.fillStyle(tuning.limbElectricGlowColor, alpha * 0.24);
    this.strikeGraphics.fillCircle(impact.x, impact.y, glowRadius);
    this.strikeGraphics.fillStyle(tuning.limbElectricMidColor, alpha * 0.34);
    this.strikeGraphics.fillCircle(impact.x, impact.y, glowRadius * 0.56);
    this.strikeGraphics.fillStyle(tuning.limbElectricCoreColor, alpha * 0.72);
    this.strikeGraphics.fillCircle(impact.x, impact.y, glowRadius * 0.24);

    const rayDirections = [
      forward,
      rotateVector(forward.x, forward.y, Math.PI * 0.5),
      rotateVector(forward.x, forward.y, -Math.PI * 0.5),
    ];
    const rayLength = tuning.limbStrikeTipRayLengthPx * (0.68 + hitWeight * 0.36);

    for (const rayDirection of rayDirections) {
      const end = {
        x: impact.x + rayDirection.x * rayLength,
        y: impact.y + rayDirection.y * rayLength,
      };
      this.strikeGraphics.lineStyle(
        tuning.limbStrikeTipRayWidthPx * 1.35,
        tuning.limbElectricGlowColor,
        alpha * 0.2,
      );
      this.strikeGraphics.strokeLineShape(
        new Phaser.Geom.Line(impact.x, impact.y, end.x, end.y),
      );
      this.strikeGraphics.lineStyle(
        tuning.limbStrikeTipRayWidthPx * 0.86,
        tuning.limbElectricFlashColor,
        alpha * 0.52,
      );
      this.strikeGraphics.strokeLineShape(
        new Phaser.Geom.Line(impact.x, impact.y, end.x, end.y),
      );
    }
  }

  private drawLimbPath(
    graphics: Phaser.GameObjects.Graphics,
    root: Point,
    points: Point[],
  ): void {
    const first = points[0];
    graphics.strokeLineShape(new Phaser.Geom.Line(root.x, root.y, first.x, first.y));
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      graphics.strokeLineShape(new Phaser.Geom.Line(from.x, from.y, to.x, to.y));
    }
  }
}
