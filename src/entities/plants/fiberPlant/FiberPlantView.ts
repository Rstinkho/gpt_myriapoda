import * as Phaser from 'phaser';
import { getPickupAnimationPhase } from '@/entities/pickups/PickupVisuals';

interface FiberPlantRenderSnapshot {
  anchor: { x: number; y: number };
  stemPoints: Array<{ x: number; y: number }>;
  top: { x: number; y: number };
  growthScale: number;
  state: 'grown' | 'chewing' | 'cooldown' | 'regrowing';
}

export class FiberPlantView {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private readonly phaseSeed: number;

  constructor(scene: Phaser.Scene, plantId: string) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(7);
    this.phaseSeed = getPickupAnimationPhase(plantId);
  }

  update(snapshot: FiberPlantRenderSnapshot, deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.graphics.clear();

    const pulse =
      0.5 + 0.5 * Math.sin(this.elapsed * 2.1 + this.phaseSeed * 0.9);
    const chewPulse =
      snapshot.state === 'chewing'
        ? 0.5 + 0.5 * Math.sin(this.elapsed * 18 + this.phaseSeed * 1.4)
        : 0;
    const visibleGrowth =
      snapshot.state === 'cooldown'
        ? 0.16
        : snapshot.state === 'regrowing'
          ? Phaser.Math.Clamp(snapshot.growthScale + pulse * 0.02, 0.16, 1)
          : 1;
    const stemAlpha =
      snapshot.state === 'cooldown'
        ? 0.2
        : snapshot.state === 'regrowing'
          ? 0.32 + visibleGrowth * 0.38
          : 0.88;
    const leafAlpha =
      snapshot.state === 'cooldown'
        ? 0
        : snapshot.state === 'regrowing'
          ? 0.2 + visibleGrowth * 0.48
          : 0.84;
    const rootScale =
      snapshot.state === 'cooldown' ? 1.08 : 0.92 + snapshot.growthScale * 0.14;
    const crownScale =
      visibleGrowth * (0.92 + pulse * 0.06 + chewPulse * 0.08);
    const visibleStemPoints = snapshot.stemPoints.map((point, index) => {
      const ratio = (index + 1) / Math.max(1, snapshot.stemPoints.length);
      const pointGrowth = Phaser.Math.Clamp(
        visibleGrowth * Phaser.Math.Linear(0.34, 1, ratio),
        0,
        1,
      );
      return this.interpolatePoint(snapshot.anchor, point, pointGrowth);
    });
    const visibleTop = this.interpolatePoint(
      snapshot.anchor,
      snapshot.top,
      visibleGrowth,
    );

    this.drawRootCluster(snapshot.anchor, rootScale, 0.74 + pulse * 0.08);

    if (snapshot.state === 'cooldown') {
      this.drawStump(snapshot.anchor, pulse);
      return;
    }

    this.drawStem([snapshot.anchor, ...visibleStemPoints, visibleTop], stemAlpha);

    const leafAnchors = [
      {
        previous: snapshot.anchor,
        origin:
          visibleStemPoints[0] ??
          this.interpolatePoint(snapshot.anchor, visibleTop, 0.28),
        next:
          visibleStemPoints[1] ??
          visibleTop,
        length: 12.5 * visibleGrowth,
        width: 4.6 * visibleGrowth,
      },
      {
        previous: visibleStemPoints[0] ?? snapshot.anchor,
        origin:
          visibleStemPoints[1] ??
          this.interpolatePoint(snapshot.anchor, visibleTop, 0.56),
        next:
          visibleStemPoints[2] ??
          visibleTop,
        length: 14.5 * visibleGrowth,
        width: 5.1 * visibleGrowth,
      },
      {
        previous: visibleStemPoints[Math.max(0, visibleStemPoints.length - 2)] ?? snapshot.anchor,
        origin:
          visibleStemPoints[Math.max(0, visibleStemPoints.length - 1)] ??
          this.interpolatePoint(snapshot.anchor, visibleTop, 0.82),
        next: visibleTop,
        length: 11.5 * visibleGrowth,
        width: 4.1 * visibleGrowth,
      },
    ];

    for (let index = 0; index < leafAnchors.length; index += 1) {
      const anchor = leafAnchors[index];
      this.drawLeafPair(
        anchor.origin,
        anchor.previous,
        anchor.next,
        anchor.length,
        anchor.width,
        leafAlpha * (0.9 - index * 0.08),
        pulse,
        chewPulse,
      );
    }

    this.drawTerminalCrown(visibleTop, crownScale, leafAlpha, pulse, chewPulse);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private drawRootCluster(
    anchor: { x: number; y: number },
    scale: number,
    alpha: number,
  ): void {
    this.graphics.fillStyle(0x040706, 0.26 * alpha);
    this.graphics.fillEllipse(
      anchor.x,
      anchor.y + 2,
      20 * scale,
      9 * scale,
    );

    const rootSpread = 7.8 * scale;
    const tendrils = [
      [
        new Phaser.Math.Vector2(anchor.x - 1.5 * scale, anchor.y + 1),
        new Phaser.Math.Vector2(anchor.x - rootSpread * 0.58, anchor.y + 4.2 * scale),
        new Phaser.Math.Vector2(anchor.x - rootSpread, anchor.y + 6.2 * scale),
      ],
      [
        new Phaser.Math.Vector2(anchor.x + 0.8 * scale, anchor.y + 1),
        new Phaser.Math.Vector2(anchor.x + rootSpread * 0.44, anchor.y + 4.6 * scale),
        new Phaser.Math.Vector2(anchor.x + rootSpread * 0.88, anchor.y + 6.5 * scale),
      ],
      [
        new Phaser.Math.Vector2(anchor.x - 0.4 * scale, anchor.y + 1.2 * scale),
        new Phaser.Math.Vector2(anchor.x - rootSpread * 0.18, anchor.y + 5.4 * scale),
        new Phaser.Math.Vector2(anchor.x - rootSpread * 0.1, anchor.y + 7 * scale),
      ],
    ];

    for (const tendril of tendrils) {
      this.graphics.lineStyle(2.4, 0x0d110d, 0.34 * alpha);
      this.graphics.strokePoints(tendril, false, true);
      this.graphics.lineStyle(1.2, 0x6a775a, 0.28 * alpha);
      this.graphics.strokePoints(tendril, false, true);
    }

    this.graphics.fillStyle(0x718360, 0.44 * alpha);
    this.graphics.fillEllipse(anchor.x, anchor.y + 0.8, 12.5 * scale, 7 * scale);
    this.graphics.fillStyle(0xcedfb3, 0.28 * alpha);
    this.graphics.fillEllipse(anchor.x - 1.2 * scale, anchor.y - 0.4, 5.5 * scale, 2.8 * scale);
    this.graphics.lineStyle(1.1, 0x2a3323, 0.42 * alpha);
    this.graphics.strokeEllipse(anchor.x, anchor.y + 0.8, 12.5 * scale, 7 * scale);
  }

  private drawStump(anchor: { x: number; y: number }, pulse: number): void {
    const stumpTop = { x: anchor.x, y: anchor.y - 6.5 - pulse * 0.8 };
    this.graphics.lineStyle(4.8, 0x14100d, 0.64);
    this.graphics.lineBetween(anchor.x, anchor.y, stumpTop.x, stumpTop.y);
    this.graphics.lineStyle(3.1, 0x748164, 0.72);
    this.graphics.lineBetween(anchor.x, anchor.y, stumpTop.x, stumpTop.y);
    this.graphics.fillStyle(0xcfd5ad, 0.74);
    this.graphics.fillEllipse(stumpTop.x, stumpTop.y, 6.6, 3.2);
    this.graphics.fillStyle(0xeef6d1, 0.24 + pulse * 0.12);
    this.graphics.fillEllipse(stumpTop.x - 0.5, stumpTop.y - 0.2, 3.2, 1.4);
    this.graphics.lineStyle(1, 0x4d4f38, 0.48);
    this.graphics.strokeEllipse(stumpTop.x, stumpTop.y, 6.6, 3.2);
  }

  private drawStem(
    points: Array<{ x: number; y: number }>,
    alpha: number,
  ): void {
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const ratio = index / Math.max(1, points.length - 1);
      const width = Phaser.Math.Linear(6.4, 2.5, ratio);

      this.graphics.lineStyle(width + 1.8, 0x10160f, 0.42 * alpha);
      this.graphics.lineBetween(start.x, start.y, end.x, end.y);
      this.graphics.lineStyle(width, 0x7daf6e, 0.62 * alpha);
      this.graphics.lineBetween(start.x, start.y, end.x, end.y);
      this.graphics.lineStyle(Math.max(0.8, width * 0.38), 0xe6f6d9, 0.32 * alpha);
      this.graphics.lineBetween(
        Phaser.Math.Linear(start.x, end.x, 0.16),
        Phaser.Math.Linear(start.y, end.y, 0.16),
        Phaser.Math.Linear(start.x, end.x, 0.88),
        Phaser.Math.Linear(start.y, end.y, 0.88),
      );
    }
  }

  private drawLeafPair(
    origin: { x: number; y: number },
    previous: { x: number; y: number },
    next: { x: number; y: number },
    length: number,
    width: number,
    alpha: number,
    pulse: number,
    chewPulse: number,
  ): void {
    if (alpha <= 0.02 || length <= 0.6) {
      return;
    }

    const stemDx = next.x - previous.x;
    const stemDy = next.y - previous.y;
    const stemLength = Math.max(0.001, Math.hypot(stemDx, stemDy));
    const stemDir = {
      x: stemDx / stemLength,
      y: stemDy / stemLength,
    };
    const normal = {
      x: -stemDir.y,
      y: stemDir.x,
    };
    const lift = 0.58 + pulse * 0.08 + chewPulse * 0.06;
    const leftDirection = {
      x: normal.x * 0.82 + stemDir.x * -lift,
      y: normal.y * 0.82 + stemDir.y * -lift,
    };
    const rightDirection = {
      x: -normal.x * 0.82 + stemDir.x * -lift * 0.96,
      y: -normal.y * 0.82 + stemDir.y * -lift * 0.96,
    };

    this.drawLeafBlade(origin, leftDirection, length, width, alpha, false);
    this.drawLeafBlade(origin, rightDirection, length * 0.94, width * 0.92, alpha * 0.96, true);
  }

  private drawLeafBlade(
    origin: { x: number; y: number },
    direction: { x: number; y: number },
    length: number,
    width: number,
    alpha: number,
    mirrored: boolean,
  ): void {
    const magnitude = Math.max(0.001, Math.hypot(direction.x, direction.y));
    const dir = {
      x: direction.x / magnitude,
      y: direction.y / magnitude,
    };
    const normal = {
      x: -dir.y,
      y: dir.x,
    };
    const curve = mirrored ? -1 : 1;
    const tip = {
      x: origin.x + dir.x * length,
      y: origin.y + dir.y * length,
    };
    const shoulder = {
      x: origin.x + dir.x * length * 0.44,
      y: origin.y + dir.y * length * 0.44,
    };
    const belly = {
      x: origin.x + dir.x * length * 0.72,
      y: origin.y + dir.y * length * 0.72,
    };
    const baseLeft = {
      x: origin.x + normal.x * width * 0.3,
      y: origin.y + normal.y * width * 0.3,
    };
    const baseRight = {
      x: origin.x - normal.x * width * 0.3,
      y: origin.y - normal.y * width * 0.3,
    };
    const points = [
      new Phaser.Math.Vector2(baseLeft.x, baseLeft.y),
      new Phaser.Math.Vector2(
        shoulder.x + normal.x * width * (0.72 + curve * 0.08),
        shoulder.y + normal.y * width * (0.72 + curve * 0.08),
      ),
      new Phaser.Math.Vector2(
        belly.x + normal.x * width * (0.16 + curve * 0.08),
        belly.y + normal.y * width * (0.16 + curve * 0.08),
      ),
      new Phaser.Math.Vector2(tip.x, tip.y),
      new Phaser.Math.Vector2(
        belly.x - normal.x * width * (0.18 - curve * 0.05),
        belly.y - normal.y * width * (0.18 - curve * 0.05),
      ),
      new Phaser.Math.Vector2(
        shoulder.x - normal.x * width * (0.64 - curve * 0.08),
        shoulder.y - normal.y * width * (0.64 - curve * 0.08),
      ),
      new Phaser.Math.Vector2(baseRight.x, baseRight.y),
    ];

    this.graphics.fillStyle(0x7cb874, 0.46 * alpha);
    this.graphics.fillPoints(points, true);
    this.graphics.lineStyle(1.1, 0x21341f, 0.36 * alpha);
    this.graphics.strokePoints(points, true, true);
    this.graphics.lineStyle(0.9, 0xe4f8da, 0.28 * alpha);
    this.graphics.lineBetween(origin.x, origin.y, tip.x, tip.y);
    this.graphics.fillStyle(0xdaf4d0, 0.08 * alpha);
    this.graphics.fillEllipse(
      origin.x + dir.x * length * 0.5,
      origin.y + dir.y * length * 0.5,
      width * 1.5,
      width * 0.78,
    );
  }

  private drawTerminalCrown(
    top: { x: number; y: number },
    scale: number,
    alpha: number,
    pulse: number,
    chewPulse: number,
  ): void {
    if (scale <= 0.08 || alpha <= 0.02) {
      return;
    }

    const crownAlpha = alpha * (0.92 + pulse * 0.08);
    const lobeLength = 10.5 * scale;
    const lobeWidth = 3.9 * scale;
    const lobeDirections = [
      { x: -0.72, y: -0.88 },
      { x: 0, y: -1 },
      { x: 0.72, y: -0.84 },
    ];

    for (let index = 0; index < lobeDirections.length; index += 1) {
      const direction = lobeDirections[index];
      this.drawLeafBlade(
        top,
        {
          x: direction.x,
          y: direction.y - chewPulse * 0.04,
        },
        lobeLength * (index === 1 ? 1.08 : 0.94),
        lobeWidth * (index === 1 ? 1.06 : 0.94),
        crownAlpha * (index === 1 ? 1 : 0.88),
        index === 2,
      );
    }

    this.graphics.fillStyle(0xe5efc8, 0.84 * crownAlpha);
    this.graphics.fillEllipse(top.x, top.y - 1.6 * scale, 9.6 * scale, 11.8 * scale);
    this.graphics.fillStyle(0xf9ffea, 0.16 + pulse * 0.14 + chewPulse * 0.08);
    this.graphics.fillEllipse(
      top.x - 0.9 * scale,
      top.y - 3.1 * scale,
      3.7 * scale,
      4.8 * scale,
    );
    this.graphics.fillStyle(0xcbd692, 0.36 * crownAlpha);
    this.graphics.fillCircle(top.x + 0.25 * scale, top.y + 0.2 * scale, 1.6 * scale);
    this.graphics.lineStyle(1.1, 0x596546, 0.46 * crownAlpha);
    this.graphics.strokeEllipse(top.x, top.y - 1.6 * scale, 9.6 * scale, 11.8 * scale);
  }

  private interpolatePoint(
    from: { x: number; y: number },
    to: { x: number; y: number },
    t: number,
  ): { x: number; y: number } {
    const clampedT = Phaser.Math.Clamp(t, 0, 1);
    return {
      x: Phaser.Math.Linear(from.x, to.x, clampedT),
      y: Phaser.Math.Linear(from.y, to.y, clampedT),
    };
  }
}
