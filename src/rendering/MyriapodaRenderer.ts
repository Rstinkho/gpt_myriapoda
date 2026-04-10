import Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { getPickupDefinition } from '@/entities/pickups/PickupRegistry';
import { getPickupAnimationPhase } from '@/entities/pickups/PickupVisuals';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { LimbRenderer } from '@/rendering/LimbRenderer';
import { rotateVector } from '@/utils/math';

export class MyriapodaRenderer {
  private static readonly bodyCircleScale = 1.3;
  private static readonly headVisualScale = 1.5;
  private static readonly mustacheLengthScale = 1.45;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly stomachParticleGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly limbRenderer: LimbRenderer;
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5);
    this.stomachParticleGraphics = scene.add.graphics();
    this.stomachParticleGraphics.setDepth(6);
    this.stomachMaskGraphics = scene.add.graphics();
    this.stomachParticleGraphics.setMask(this.stomachMaskGraphics.createGeometryMask());
    this.limbRenderer = new LimbRenderer(this.graphics);
  }

  update(myriapoda: Myriapoda): void {
    const headPosition = vec2ToPixels(myriapoda.head.body.getPosition());
    this.elapsed += tuning.fixedStepSeconds;
    myriapoda.head.sprite.setVisible(false);

    this.clear();
    this.renderBody(myriapoda);
    this.renderTail(myriapoda);
    this.limbRenderer.render(myriapoda);
    this.renderStomach(myriapoda);
    this.renderHead(myriapoda, headPosition.x, headPosition.y, myriapoda.head.body.getAngle());
  }

  clear(): void {
    this.graphics.clear();
    this.stomachParticleGraphics.clear();
    this.stomachMaskGraphics.clear();
  }

  private renderBody(myriapoda: Myriapoda): void {
    const stomachIndex = myriapoda.body.getStomachSegmentIndex();
    const scale = tuning.headRadius / 11;
    const headPosition = vec2ToPixels(myriapoda.head.body.getPosition());
    const firstSegment = myriapoda.body.segments[0];
    const firstVisual = this.getSegmentVisual(firstSegment.radius, stomachIndex === 0, 0);
    this.renderHeadConnector(headPosition, firstSegment, firstVisual);

    for (let index = myriapoda.body.segments.length - 1; index > 0; index -= 1) {
      const segment = myriapoda.body.segments[index];
      const previous = myriapoda.body.segments[index - 1];
      const segmentStyle = this.getSegmentVisual(segment.radius, index === stomachIndex);
      const previousStyle = this.getSegmentVisual(previous.radius, index - 1 === stomachIndex);
      this.renderConnector(
        { x: segment.x, y: segment.y },
        { x: previous.x, y: previous.y },
        segmentStyle,
        previousStyle,
      );
    }

    for (let index = myriapoda.body.segments.length - 1; index >= 0; index -= 1) {
      const segment = myriapoda.body.segments[index];
      const isStomach = index === stomachIndex;
      const visual = this.getSegmentVisual(segment.radius, isStomach, index);
      this.graphics.fillStyle(visual.fillColor, visual.alpha);
      this.graphics.fillCircle(segment.x, segment.y, visual.radius);
      this.graphics.lineStyle(Math.max(0.7, 1.35 * scale), isStomach ? 0xffd5e7 : 0xbaf2d7, isStomach ? 0.28 : 0.42);
      this.graphics.strokeCircle(segment.x, segment.y, visual.radius);
    }
  }

  private getSegmentVisual(radius: number, isStomach: boolean, index = 0): {
    radius: number;
    alpha: number;
    fillColor: number;
  } {
    if (isStomach) {
      const stomachRadius = tuning.stomachRadiusMeters * tuning.pixelsPerMeter;
      return {
        radius: stomachRadius,
        alpha: 0.18,
        fillColor: Phaser.Display.Color.GetColor(255, 164, 192),
      };
    }

    return {
      radius: radius * MyriapodaRenderer.bodyCircleScale,
      alpha: tuning.bodyAlpha,
      fillColor: Phaser.Display.Color.GetColor(
        92 + Math.min(90, index * 3),
        156 + Math.min(70, index * 2),
        132 + Math.min(45, index * 2),
      ),
    };
  }

  private renderHeadConnector(
    headPosition: { x: number; y: number },
    segment: { x: number; y: number; radius: number },
    segmentVisual: { radius: number; alpha: number; fillColor: number },
  ): void {
    const dx = segment.x - headPosition.x;
    const dy = segment.y - headPosition.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const direction = { x: dx / distance, y: dy / distance };
    const normal = { x: -direction.y, y: direction.x };
    const headConnectorRadius = tuning.headRadius * MyriapodaRenderer.headVisualScale * 0.72;
    const headBoundary = {
      x: headPosition.x + direction.x * headConnectorRadius,
      y: headPosition.y + direction.y * headConnectorRadius,
    };
    const bodyBoundary = this.getCircleBoundaryPoint(segment, segmentVisual.radius, {
      x: -direction.x,
      y: -direction.y,
    });
    const halfWidth = Math.min(segmentVisual.radius, headConnectorRadius) * 0.28;
    const polygon = [
      new Phaser.Math.Vector2(headBoundary.x + normal.x * halfWidth, headBoundary.y + normal.y * halfWidth),
      new Phaser.Math.Vector2(headBoundary.x - normal.x * halfWidth, headBoundary.y - normal.y * halfWidth),
      new Phaser.Math.Vector2(bodyBoundary.x - normal.x * halfWidth, bodyBoundary.y - normal.y * halfWidth),
      new Phaser.Math.Vector2(bodyBoundary.x + normal.x * halfWidth, bodyBoundary.y + normal.y * halfWidth),
    ];

    this.graphics.fillStyle(segmentVisual.fillColor, segmentVisual.alpha + 0.06);
    this.graphics.fillPoints(polygon, true);
    this.graphics.lineStyle(Math.max(0.5, tuning.headRadius / 11), 0xbaf2d7, 0.18);
    this.graphics.strokePoints(polygon, true, true);
  }

  private renderConnector(
    from: { x: number; y: number },
    to: { x: number; y: number },
    fromVisual: { radius: number; alpha: number; fillColor: number },
    toVisual: { radius: number; alpha: number; fillColor: number },
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const dir = { x: dx / length, y: dy / length };
    const normal = { x: -dir.y, y: dir.x };

    const fromBoundary = this.getCircleBoundaryPoint(from, fromVisual.radius, dir);
    const toBoundary = this.getCircleBoundaryPoint(to, toVisual.radius, { x: -dir.x, y: -dir.y });
    const bridgeHalfWidth = Math.min(fromVisual.radius, toVisual.radius) * 0.24;

    const polygon = [
      new Phaser.Math.Vector2(fromBoundary.x + normal.x * bridgeHalfWidth, fromBoundary.y + normal.y * bridgeHalfWidth),
      new Phaser.Math.Vector2(fromBoundary.x - normal.x * bridgeHalfWidth, fromBoundary.y - normal.y * bridgeHalfWidth),
      new Phaser.Math.Vector2(toBoundary.x - normal.x * bridgeHalfWidth, toBoundary.y - normal.y * bridgeHalfWidth),
      new Phaser.Math.Vector2(toBoundary.x + normal.x * bridgeHalfWidth, toBoundary.y + normal.y * bridgeHalfWidth),
    ];

    this.graphics.fillStyle(fromVisual.fillColor, Math.min(fromVisual.alpha, toVisual.alpha) + 0.04);
    this.graphics.fillPoints(polygon, true);
    this.graphics.lineStyle(Math.max(0.5, tuning.headRadius / 11), 0xbaf2d7, 0.18);
    this.graphics.strokePoints(polygon, true, true);
  }

  private getCircleBoundaryPoint(
    center: { x: number; y: number },
    radius: number,
    direction: { x: number; y: number },
  ): { x: number; y: number } {
    return {
      x: center.x + direction.x * radius,
      y: center.y + direction.y * radius,
    };
  }

  private renderStomach(myriapoda: Myriapoda): void {
    const stomachAnchor = myriapoda.stomach.getAnchor();
    const chamberRadius = tuning.stomachRadiusMeters * tuning.pixelsPerMeter;
    const scale = tuning.headRadius / 11;
    this.graphics.fillStyle(0xffaecd, 0.07);
    this.graphics.fillCircle(stomachAnchor.x, stomachAnchor.y, chamberRadius);
    this.graphics.lineStyle(Math.max(1.1, 2.6 * scale), 0xffebf3, 0.56);
    this.graphics.strokeCircle(stomachAnchor.x, stomachAnchor.y, chamberRadius);
    this.graphics.lineStyle(Math.max(0.55, 1.1 * scale), 0xff97bc, 0.42);
    this.graphics.strokeCircle(stomachAnchor.x, stomachAnchor.y, chamberRadius * 0.92);

    this.stomachMaskGraphics.fillStyle(0xffffff, 1);
    this.stomachMaskGraphics.fillCircle(
      stomachAnchor.x,
      stomachAnchor.y,
      chamberRadius - tuning.stomachContainmentMarginMeters * tuning.pixelsPerMeter,
    );

    for (const particle of myriapoda.stomach.particles) {
      const local = vec2ToPixels(particle.body.getPosition());
      getPickupDefinition(particle.resourceId).drawParticle(
        this.stomachParticleGraphics,
        {
          x: stomachAnchor.x + local.x,
          y: stomachAnchor.y + local.y,
          radius: particle.radiusMeters * tuning.pixelsPerMeter * 1.28,
          angle: particle.body.getAngle(),
          elapsedSeconds: this.elapsed,
          animationPhase: getPickupAnimationPhase(particle.id),
          alpha: 0.94,
        },
      );
    }

    for (const parasite of myriapoda.stomach.getUiParasiteSnapshots()) {
      getPickupDefinition('parasite').drawParticle(this.stomachParticleGraphics, {
        x: stomachAnchor.x + parasite.localX * chamberRadius,
        y: stomachAnchor.y + parasite.localY * chamberRadius,
        radius: chamberRadius * parasite.radius,
        angle: parasite.angle,
        elapsedSeconds: this.elapsed,
        animationPhase: getPickupAnimationPhase(parasite.id),
        alpha: 0.96,
      });
    }
  }

  private renderTail(myriapoda: Myriapoda): void {
    const tailAnchor = myriapoda.body.getTailAnchor();
    const tailTip = myriapoda.tail.getTipPixels();
    const tailDirection = {
      x: -Math.cos(tailAnchor.angle),
      y: -Math.sin(tailAnchor.angle),
    };
    const sway = Math.sin(this.elapsed * 3.6) * tuning.tailSwayPx * 0.35;
    const control = {
      x: tailAnchor.x + tailDirection.x * tuning.tailLengthPx * 0.45 - tailDirection.y * sway,
      y: tailAnchor.y + tailDirection.y * tuning.tailLengthPx * 0.45 + tailDirection.x * sway,
    };
    const tailPoints = [
      new Phaser.Math.Vector2(tailAnchor.x, tailAnchor.y),
      new Phaser.Math.Vector2(control.x, control.y),
      new Phaser.Math.Vector2(tailTip.x, tailTip.y),
    ];

    this.graphics.lineStyle(3.4, 0x0a1717, 0.64);
    this.graphics.strokePoints(tailPoints, false, true);
    this.graphics.lineStyle(1.8, 0x9eddb5, 0.74);
    this.graphics.strokePoints(tailPoints, false, true);
    this.graphics.fillStyle(0xaee7c0, 0.55);
    this.graphics.fillCircle(tailTip.x, tailTip.y, tuning.tailRadiusPx);
  }

  private renderHead(myriapoda: Myriapoda, x: number, y: number, angle: number): void {
    const blinkPhase = (this.elapsed + 0.2) % 4.2;
    const blink = blinkPhase > 3.85 ? Math.max(0.12, 1 - (blinkPhase - 3.85) * 10) : 1;
    const scale = (tuning.headRadius / 11) * MyriapodaRenderer.headVisualScale;
    const headWidth = tuning.headRadius * 2.05 * MyriapodaRenderer.headVisualScale;
    const headHeight = tuning.headRadius * 1.8 * MyriapodaRenderer.headVisualScale;
    const vacuum = myriapoda.vacuum;
    const consumePulse =
      tuning.vacuumConsumePulseSeconds > 0
        ? Math.min(1, vacuum.consumePulseTimer / tuning.vacuumConsumePulseSeconds)
        : 0;
    const mouthOpen = Math.min(1, vacuum.suctionAmount + consumePulse * tuning.mouthConsumeBoost);

    this.graphics.fillStyle(0xaee7c0, 0.92);
    this.graphics.lineStyle(Math.max(0.7, 1.4 * scale), 0xe6fff1, 0.5);
    this.graphics.fillEllipse(x, y, headWidth, headHeight);
    this.graphics.strokeEllipse(x, y, headWidth, headHeight);

    this.renderVacuumMouth(x, y, angle, scale, mouthOpen, consumePulse);
    this.renderVacuumVortex(vacuum, scale);

    const leftEye = rotateVector(2.4 * scale, -4.6 * scale, angle);
    const rightEye = rotateVector(2.4 * scale, 4.6 * scale, angle);
    const pupilOffset = rotateVector(0.95 * scale, 0, angle);
    this.drawEye(x + leftEye.x, y + leftEye.y, blink, pupilOffset, scale);
    this.drawEye(x + rightEye.x, y + rightEye.y, blink, pupilOffset, scale);

    this.drawMustache(x, y, angle, -1, scale);
    this.drawMustache(x, y, angle, 1, scale);
  }

  private renderVacuumMouth(
    x: number,
    y: number,
    angle: number,
    scale: number,
    mouthOpen: number,
    consumePulse: number,
  ): void {
    const mouthCenter = rotateVector(7.1 * scale, 0, angle);
    const centerX = x + mouthCenter.x;
    const centerY = y + mouthCenter.y;

    if (mouthOpen < 0.08) {
      const mouthMid = rotateVector(7.5 * scale, 0, angle);
      const mouthLeft = rotateVector(6.2 * scale, -2.2 * scale, angle);
      const mouthRight = rotateVector(6.2 * scale, 2.2 * scale, angle);
      this.graphics.lineStyle(Math.max(0.8, 1.5 * scale), 0x183127, 0.75);
      this.graphics.strokePoints(
        [
          new Phaser.Math.Vector2(x + mouthLeft.x, y + mouthLeft.y),
          new Phaser.Math.Vector2(x + mouthMid.x, y + mouthMid.y),
          new Phaser.Math.Vector2(x + mouthRight.x, y + mouthRight.y),
        ],
        false,
        true,
      );
      return;
    }

    const mouthWidth = (4.2 + mouthOpen * 7.8 + consumePulse * 1.5) * scale;
    const mouthHeight = (0.9 + mouthOpen * 5.4 + consumePulse * 1.1) * scale;
    this.graphics.fillStyle(0x102118, 0.82 + mouthOpen * 0.08);
    this.graphics.fillEllipse(centerX, centerY, mouthWidth, mouthHeight);
    this.graphics.lineStyle(Math.max(0.55, 0.95 * scale), 0x06100a, 0.45 + mouthOpen * 0.25);
    this.graphics.strokeEllipse(centerX, centerY, mouthWidth, mouthHeight);
    this.graphics.fillStyle(0xeafee8, 0.08 + mouthOpen * 0.14);
    this.graphics.fillEllipse(
      centerX + 0.55 * scale,
      centerY - 0.2 * scale,
      mouthWidth * 0.42,
      Math.max(0.35 * scale, mouthHeight * 0.2),
    );
  }

  private renderVacuumVortex(
    vacuum: Myriapoda['vacuum'],
    scale: number,
  ): void {
    if (vacuum.activePickupCount <= 0) {
      return;
    }

    const forward = {
      x: Math.cos(vacuum.coneAngle),
      y: Math.sin(vacuum.coneAngle),
    };
    const sideways = {
      x: -forward.y,
      y: forward.x,
    };
    const strength = Math.max(0.22, vacuum.suctionAmount);
    const spinSpeed = 4.8 + strength * 6.4;
    const phase = this.elapsed * spinSpeed;
    const ribbonCount = 2;
    const ringCount = 3;
    const tunnelLength = tuning.vacuumConeLength * (0.86 + strength * 0.12);
    const outerAlpha = tuning.vacuumWispAlpha * (0.8 + strength * 0.62);
    const outerWidth = tuning.vacuumWispWidth * (1.55 + strength * 0.52) * scale;

    for (let ribbon = 0; ribbon < ribbonCount; ribbon += 1) {
      const ribbonPhase = phase * 0.9 + ribbon * Math.PI;
      const points: Phaser.Math.Vector2[] = [];
      for (let step = 0; step <= 8; step += 1) {
        const t = step / 8;
        const distance = Phaser.Math.Linear(
          tunnelLength * 0.98,
          tuning.headRadius * 1.42,
          t,
        );
        const width = Phaser.Math.Linear(
          18 + strength * 10,
          2.6 + strength * 1.1,
          t,
        ) * scale;
        const orbit = ribbonPhase + t * Math.PI * (1.45 + strength * 0.42);
        const offset = Math.sin(orbit) * width;
        const drift = Math.cos(orbit * 0.7 + t * 3.4) * width * 0.16;
        points.push(
          new Phaser.Math.Vector2(
            vacuum.mouthPosition.x +
              forward.x * distance +
              sideways.x * offset +
              forward.x * drift,
            vacuum.mouthPosition.y +
              forward.y * distance +
              sideways.y * offset +
              forward.y * drift,
          ),
        );
      }

      this.strokeTaperedPath(
        points,
        outerWidth,
        outerWidth * 0.18,
        0xddfffb,
        outerAlpha * 0.28,
      );
      this.strokeTaperedPath(
        points,
        outerWidth * 0.38,
        outerWidth * 0.08,
        0xb8fff6,
        outerAlpha * 0.52,
      );
    }

    for (let ring = 0; ring < ringCount; ring += 1) {
      const travel = (phase * 0.12 + ring / ringCount) % 1;
      const distance = Phaser.Math.Linear(
        tunnelLength * 0.84,
        tuning.headRadius * 1.9,
        travel,
      );
      const center = {
        x: vacuum.mouthPosition.x + forward.x * distance,
        y: vacuum.mouthPosition.y + forward.y * distance,
      };
      const radiusX = Phaser.Math.Linear(
        22 + strength * 10,
        7 + strength * 2,
        travel,
      ) * scale;
      const radiusY = radiusX * (0.28 + strength * 0.05);
      const startAngle = phase * 0.72 + ring * 1.18;
      const points = this.sampleRotatedEllipseArcPoints(
        center,
        radiusX,
        radiusY,
        vacuum.coneAngle,
        startAngle,
        startAngle + Math.PI * 1.08,
        8,
      );
      const alpha = outerAlpha * Phaser.Math.Linear(0.44, 0.92, 1 - travel);
      this.strokeTaperedPath(
        points,
        outerWidth * Phaser.Math.Linear(0.52, 0.24, travel),
        outerWidth * 0.1,
        0xd7fff8,
        alpha * 0.36,
      );
    }
  }

  private sampleRotatedEllipseArcPoints(
    center: { x: number; y: number },
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    steps: number,
  ): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index <= steps; index += 1) {
      const t = index / Math.max(1, steps);
      const theta = Phaser.Math.Linear(startAngle, endAngle, t);
      const localX = Math.cos(theta) * radiusX;
      const localY = Math.sin(theta) * radiusY;
      const rotated = rotateVector(localX, localY, rotation);
      points.push(
        new Phaser.Math.Vector2(
          center.x + rotated.x,
          center.y + rotated.y,
        ),
      );
    }

    return points;
  }

  private strokeTaperedPath(
    points: Phaser.Math.Vector2[],
    startWidth: number,
    endWidth: number,
    color: number,
    alpha: number,
  ): void {
    for (let index = 1; index < points.length; index += 1) {
      const segmentT = (index - 1) / Math.max(1, points.length - 2);
      const width = Phaser.Math.Linear(startWidth, endWidth, segmentT);
      const segmentAlpha = alpha * Phaser.Math.Linear(0.38, 1, segmentT);
      this.graphics.lineStyle(width, color, segmentAlpha);
      this.graphics.strokeLineShape(
        new Phaser.Geom.Line(
          points[index - 1].x,
          points[index - 1].y,
          points[index].x,
          points[index].y,
        ),
      );
    }
  }

  private drawEye(
    x: number,
    y: number,
    blink: number,
    pupilOffset: { x: number; y: number },
    scale: number,
  ): void {
    this.graphics.fillStyle(0xfafefc, 0.96);
    this.graphics.fillEllipse(x, y, 6.4 * scale, 5.2 * scale * blink);
    this.graphics.fillStyle(0x17251f, 0.95);
    this.graphics.fillCircle(x + pupilOffset.x, y + pupilOffset.y * blink, Math.max(0.7, 1.35 * scale));
  }

  private drawMustache(x: number, y: number, angle: number, side: -1 | 1, scale: number): void {
    const reach = MyriapodaRenderer.mustacheLengthScale;
    const base = rotateVector(5.1 * scale, 2.4 * side * scale, angle);
    const mid = rotateVector(10.6 * scale * reach, 5.6 * side * scale, angle);
    const tip = rotateVector(13.7 * scale * reach, 7.1 * side * scale, angle);
    const lowerMid = rotateVector(10.2 * scale * reach, 4.1 * side * scale, angle);
    const lowerTip = rotateVector(13.2 * scale * reach, 5.2 * side * scale, angle);

    this.graphics.lineStyle(Math.max(0.75, 1.25 * scale), 0x284438, 0.74);
    this.graphics.strokePoints(
      [
        new Phaser.Math.Vector2(x + base.x, y + base.y),
        new Phaser.Math.Vector2(x + mid.x, y + mid.y),
        new Phaser.Math.Vector2(x + tip.x, y + tip.y),
      ],
      false,
      true,
    );
    this.graphics.strokePoints(
      [
        new Phaser.Math.Vector2(x + base.x, y + base.y + 1.2 * scale),
        new Phaser.Math.Vector2(x + lowerMid.x, y + lowerMid.y),
        new Phaser.Math.Vector2(x + lowerTip.x, y + lowerTip.y),
      ],
      false,
      true,
    );
  }
}
