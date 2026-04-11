import * as Phaser from 'phaser';
import { getLimbStateProgress } from '@/entities/myriapoda/limbState';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { tuning } from '@/game/tuning';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { normalize } from '@/utils/math';

export class LimbRenderer {
  private elapsed = 0;

  constructor(private readonly graphics: Phaser.GameObjects.Graphics) {}

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
      const preTip = points[Math.max(0, points.length - 2)];
      const tip = points[points.length - 1];
      const attackWeight =
        limb.state.name === 'idle'
          ? 0
          : limb.state.name === 'hit'
            ? 1
            : limb.state.name === 'extend'
              ? getLimbStateProgress(limb.state)
              : 1 - getLimbStateProgress(limb.state);
      const extendWeight = limb.state.name === 'extend' ? getLimbStateProgress(limb.state) : 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 18 + limb.phase * Math.PI * 2);
      const glowAlpha = attackWeight * (0.12 + pulse * 0.08);
      const yellowAlpha = attackWeight * (0.34 + (1 - pulse) * 0.24);
      const baseWidth = 1.8 + attackWeight * 0.4;
      const glowWidth = 2.8 + attackWeight * 1.1;
      const hotWidth = 1.7 + attackWeight * 0.6;
      const strikeDirection = normalize(tip.x - preTip.x, tip.y - preTip.y);
      const strikeNormal = {
        x: -strikeDirection.y,
        y: strikeDirection.x,
      };
      const sideOffset = 4.2 + extendWeight * 4.2 + pulse * 0.8;
      const sideGlowAlpha = extendWeight * (0.16 + pulse * 0.14);
      const sideHotAlpha = extendWeight * (0.34 + (1 - pulse) * 0.24);

      if (glowAlpha > 0.01) {
        this.graphics.lineStyle(glowWidth, tuning.limbGlowColor, glowAlpha);
        this.drawLimbPath(root, points);
        this.graphics.lineStyle(hotWidth, 0xffd74f, yellowAlpha);
        this.drawLimbPath(root, points);
      }

      if (sideGlowAlpha > 0.01) {
        this.drawSideLightning(root, tip, strikeDirection, strikeNormal, sideOffset, limb.phase, extendWeight, sideGlowAlpha, sideHotAlpha);
        this.drawSideLightning(root, tip, strikeDirection, strikeNormal, -sideOffset, limb.phase + 0.5, extendWeight, sideGlowAlpha, sideHotAlpha);
      }

      this.graphics.lineStyle(baseWidth, tuning.limbBaseColor, 0.65 + attackWeight * 0.12);
      this.drawLimbPath(root, points);
      if (glowAlpha > 0.01) {
        this.graphics.fillStyle(tuning.limbGlowColor, 0.18 + glowAlpha * 0.6);
        this.graphics.fillCircle(tip.x, tip.y, 1.8 + attackWeight * 1.1);
        this.graphics.fillStyle(0xffd649, 0.46 + yellowAlpha * 0.82);
        this.graphics.fillCircle(tip.x, tip.y, 1.2 + attackWeight * 0.55);
      }
      this.graphics.fillStyle(tuning.limbBaseColor, 0.45 + attackWeight * 0.18);
      this.graphics.fillCircle(tip.x, tip.y, 1.35 + attackWeight * 0.35);
    }
  }

  private drawLimbPath(
    root: { x: number; y: number },
    points: Array<{ x: number; y: number }>,
  ): void {
    const first = points[0];
    this.graphics.strokeLineShape(new Phaser.Geom.Line(root.x, root.y, first.x, first.y));
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      this.graphics.strokeLineShape(new Phaser.Geom.Line(from.x, from.y, to.x, to.y));
    }
  }

  private drawSideLightning(
    root: { x: number; y: number },
    tip: { x: number; y: number },
    direction: { x: number; y: number },
    normal: { x: number; y: number },
    offset: number,
    phase: number,
    extendWeight: number,
    glowAlpha: number,
    hotAlpha: number,
  ): void {
    const startDistance = 7 + extendWeight * 7;
    const endDistance = 4 + extendWeight * 9;
    const start = {
      x: root.x + direction.x * startDistance + normal.x * offset,
      y: root.y + direction.y * startDistance + normal.y * offset,
    };
    const end = {
      x: tip.x - direction.x * endDistance + normal.x * offset,
      y: tip.y - direction.y * endDistance + normal.y * offset,
    };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 4) {
      return;
    }

    const segments = 5;
    const jitterBase = 0.65 + extendWeight * 1.15;
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments;
      const along = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      const taper = Math.sin(Math.PI * t);
      const zigzag =
        index === 0 || index === segments
          ? 0
          : (index % 2 === 0 ? -1 : 1) *
            jitterBase *
            taper *
            (0.86 + 0.14 * Math.sin(this.elapsed * 16 + phase * Math.PI * 2 + index));
      points.push(
        new Phaser.Math.Vector2(
          along.x + normal.x * zigzag,
          along.y + normal.y * zigzag,
        ),
      );
    }

    this.graphics.lineStyle(2.2 + extendWeight * 0.7, tuning.limbGlowColor, glowAlpha * 0.9);
    this.graphics.strokePoints(points, false, true);
    this.graphics.lineStyle(1.15 + extendWeight * 0.35, 0xffd232, hotAlpha * 1.08);
    this.graphics.strokePoints(points, false, true);
  }
}
