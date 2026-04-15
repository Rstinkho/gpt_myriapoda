import * as Phaser from 'phaser';
import type * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type {
  ShellbackAttackState,
  ShellbackClawSide,
  ShellbackShellState,
} from '@/game/types';
import { shellbackDefinition } from '@/entities/enemies/shellback/definition';
import {
  getShellbackAttackWeight,
  getShellbackPhaseSeed,
  getShellbackShellOpenFactor,
} from '@/entities/enemies/shellback/ShellbackAI';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { clamp, normalize } from '@/utils/math';

interface ShellbackVisualSnapshot {
  health: number;
  shellState: ShellbackShellState;
  shellTimer: number;
  attackState: ShellbackAttackState;
  attackTimer: number;
  attackTarget: { x: number; y: number } | null;
  activeClaw: ShellbackClawSide;
  isVulnerable: boolean;
}

interface LocalPoint {
  x: number;
  y: number;
}

interface ShellbackClawPose {
  root: LocalPoint;
  elbow: LocalPoint;
  wrist: LocalPoint;
  knuckle: LocalPoint;
  upperBase: LocalPoint;
  lowerBase: LocalPoint;
  upperTip: LocalPoint;
  lowerTip: LocalPoint;
  direction: LocalPoint;
  normal: LocalPoint;
  reach: number;
  activeWeight: number;
}

interface ShellbackPalette {
  fleshColor: number;
  fleshShadowColor: number;
  fleshLayerColor: number;
  clawColor: number;
  clawHighlightColor: number;
  eyeGlowColor: number;
}

function drawRibbon(
  graphics: Phaser.GameObjects.Graphics,
  from: LocalPoint,
  to: LocalPoint,
  startWidth: number,
  endWidth: number,
  color: number,
  alpha: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const points = [
    new Phaser.Math.Vector2(from.x + normalX * startWidth, from.y + normalY * startWidth),
    new Phaser.Math.Vector2(from.x - normalX * startWidth, from.y - normalY * startWidth),
    new Phaser.Math.Vector2(to.x - normalX * endWidth, to.y - normalY * endWidth),
    new Phaser.Math.Vector2(to.x + normalX * endWidth, to.y + normalY * endWidth),
  ];
  graphics.fillStyle(color, alpha);
  graphics.fillPoints(points, true);
}

function lerpPoint(a: LocalPoint, b: LocalPoint, t: number): LocalPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export class ShellbackView {
  private readonly healthGraphics: Phaser.GameObjects.Graphics;
  private readonly telegraphGraphics: Phaser.GameObjects.Graphics;
  private readonly bodyGraphics: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private hitIndicatorTimer = 0;
  private lastHealth: number = tuning.shellbackHealth;
  private readonly phaseSeed: number;

  constructor(scene: Phaser.Scene, enemyId: string) {
    this.healthGraphics = scene.add.graphics();
    this.telegraphGraphics = scene.add.graphics();
    this.bodyGraphics = scene.add.graphics();
    this.healthGraphics.setDepth(8.2);
    this.telegraphGraphics.setDepth(7.4);
    this.bodyGraphics.setDepth(8);
    Phaser.Actions.AddEffectBloom(this.telegraphGraphics, {
      threshold: 0.12,
      blurRadius: 14,
      blurSteps: 4,
      blendAmount: 0.68,
      useInternal: true,
    });
    this.phaseSeed = getShellbackPhaseSeed(enemyId);
  }

  update(
    body: planck.Body,
    visualState: ShellbackVisualSnapshot,
    deltaSeconds: number,
  ): void {
    this.elapsed += deltaSeconds;
    if (visualState.health < this.lastHealth) {
      this.hitIndicatorTimer = 0.5;
    }
    this.lastHealth = visualState.health;
    this.hitIndicatorTimer = Math.max(0, this.hitIndicatorTimer - deltaSeconds);
    const position = vec2ToPixels(body.getPosition());
    const velocity = body.getLinearVelocity();
    const speedRatio = clamp(
      Math.hypot(velocity.x, velocity.y) / tuning.shellbackMaxSpeed,
      0,
      1,
    );
    const shellOpen = getShellbackShellOpenFactor(
      visualState.shellState,
      visualState.shellTimer,
    );
    const attackWeight = shellOpen * getShellbackAttackWeight(
      visualState.attackState,
      visualState.attackTimer,
    );
    const pulse = 0.5 + 0.5 * Math.sin(
      this.elapsed * shellbackDefinition.shellPulseSpeed + this.phaseSeed,
    );
    const gait = Math.sin(this.elapsed * shellbackDefinition.gaitSpeed + this.phaseSeed);
    const shellWidth =
      tuning.shellbackDisplaySize * (0.88 + pulse * 0.03 + shellOpen * 0.08);
    const shellHeight =
      tuning.shellbackDisplaySize * (0.66 - shellOpen * 0.06 + pulse * 0.025);
    const bellyWidth = shellWidth * (0.86 + shellOpen * 0.08);
    const bellyHeight = shellHeight * (0.68 + shellOpen * 0.12);
    const bodyRotation = body.getAngle() + gait * 0.05 + speedRatio * 0.04;
    const attackTargetLocal = visualState.attackTarget
      ? this.toLocalPoint(position, bodyRotation, visualState.attackTarget)
      : null;
    const leftClaw = this.createClawPose(
      'left',
      shellOpen,
      attackWeight,
      visualState.activeClaw === 'left',
      attackTargetLocal,
    );
    const rightClaw = this.createClawPose(
      'right',
      shellOpen,
      attackWeight,
      visualState.activeClaw === 'right',
      attackTargetLocal,
    );
    const activeClaw = visualState.activeClaw === 'left' ? leftClaw : rightClaw;

    this.healthGraphics.setPosition(
      position.x,
      position.y - tuning.shellbackDisplaySize * 0.98,
    );
    this.healthGraphics.setRotation(0);
    this.telegraphGraphics.setPosition(position.x, position.y);
    this.telegraphGraphics.setRotation(bodyRotation);
    this.bodyGraphics.setPosition(position.x, position.y);
    this.bodyGraphics.setRotation(bodyRotation);
    this.healthGraphics.clear();
    this.telegraphGraphics.clear();
    this.bodyGraphics.clear();

    const palette = this.getPalette(visualState.isVulnerable);

    this.drawHealthBar(visualState.health, pulse, visualState.isVulnerable);
    this.drawLegs(shellOpen, gait, speedRatio, palette);
    this.drawCrabLayer(shellWidth, shellHeight, bellyWidth, bellyHeight, shellOpen, pulse, palette);
    this.drawClaw(leftClaw, shellOpen, pulse, visualState.activeClaw === 'left', palette);
    this.drawClaw(rightClaw, shellOpen, pulse, visualState.activeClaw === 'right', palette);
    this.drawAttackEffect(
      visualState.attackState,
      attackWeight,
      pulse,
      activeClaw,
      attackTargetLocal,
    );
    this.drawEyes(shellWidth, shellHeight, shellOpen, pulse, palette);
  }

  destroy(): void {
    this.healthGraphics.destroy();
    this.telegraphGraphics.destroy();
    this.bodyGraphics.destroy();
  }

  private drawCrabLayer(
    shellWidth: number,
    shellHeight: number,
    bellyWidth: number,
    bellyHeight: number,
    shellOpen: number,
    pulse: number,
    palette: ShellbackPalette,
  ): void {
    this.bodyGraphics.fillStyle(palette.fleshShadowColor, 0.34 + shellOpen * 0.14);
    this.bodyGraphics.fillEllipse(-1, shellHeight * 0.08, bellyWidth * 1.22, bellyHeight * 1.16);
    this.bodyGraphics.fillStyle(palette.fleshColor, 0.84);
    this.bodyGraphics.fillEllipse(0, shellHeight * 0.02, bellyWidth, bellyHeight);

    const plateOffsets = [-0.34, -0.08, 0.18];
    for (let index = 0; index < plateOffsets.length; index += 1) {
      const localY = shellHeight * (0.1 + plateOffsets[index] * 0.45);
      const plateWidth = bellyWidth * (0.94 - index * 0.14);
      const alpha = 0.34 + shellOpen * 0.12 + pulse * 0.05;
      this.bodyGraphics.fillStyle(palette.fleshLayerColor, alpha);
      this.bodyGraphics.fillEllipse(0.5 + index * 0.5, localY, plateWidth, bellyHeight * 0.24);
      this.bodyGraphics.lineStyle(1.1, palette.fleshShadowColor, 0.32);
      this.bodyGraphics.strokeEllipse(0.5 + index * 0.5, localY, plateWidth, bellyHeight * 0.24);
    }

    for (let side = -1; side <= 1; side += 2) {
      const cheek = side * (shellWidth * 0.34 + shellOpen * 1.6);
      this.bodyGraphics.fillStyle(palette.fleshLayerColor, 0.46);
      this.bodyGraphics.fillEllipse(-2, cheek, shellWidth * 0.18, shellHeight * 0.16);
      this.bodyGraphics.fillStyle(palette.fleshShadowColor, 0.22);
      this.bodyGraphics.fillCircle(3, cheek + side * 1.2, 1.8);
    }
  }

  private drawLegs(
    shellOpen: number,
    gait: number,
    speedRatio: number,
    palette: ShellbackPalette,
  ): void {
    for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
      const side = sideIndex === 0 ? -1 : 1;
      for (let legIndex = 0; legIndex < 4; legIndex += 1) {
        const spread = -0.36 + legIndex * 0.22;
        const base = {
          x: -7 + legIndex * 4.6,
          y: side * (6.2 + legIndex * 1.46),
        };
        const stride =
          Math.sin(
            this.elapsed * (6.2 + legIndex * 0.34) + this.phaseSeed + legIndex * 0.7,
          ) *
          (2.1 + speedRatio * 0.9);
        const lift =
          Math.cos(this.elapsed * 6.8 + this.phaseSeed + legIndex * 0.6) * 1.6;
        const fold = 1 - shellOpen;
        const knee = {
          x: base.x + 7.6 + lift * 0.2,
          y: base.y + side * (6.1 + spread * 5.6) + stride * 0.16 - side * fold * 3.6,
        };
        const tip = {
          x: knee.x + 8.2 + stride,
          y: knee.y + side * (4.6 + spread * 4.4) - side * fold * 4.8,
        };
        drawRibbon(this.bodyGraphics, base, knee, 1.1, 0.7, palette.fleshColor, 0.82);
        drawRibbon(this.bodyGraphics, knee, tip, 0.85, 0.52, palette.fleshLayerColor, 0.9);
      }
    }
  }

  private drawClaw(
    pose: ShellbackClawPose,
    shellOpen: number,
    pulse: number,
    isActive: boolean,
    palette: ShellbackPalette,
  ): void {
    drawRibbon(this.bodyGraphics, pose.root, pose.elbow, 1.7, 1.3, palette.clawColor, 0.92);
    drawRibbon(this.bodyGraphics, pose.elbow, pose.wrist, 1.45, 1.15, palette.clawColor, 0.94);

    const palmFront = {
      x: pose.wrist.x + pose.direction.x * (6 + pose.activeWeight * 4),
      y: pose.wrist.y + pose.direction.y * (6 + pose.activeWeight * 4),
    };
    const palmBack = {
      x: pose.wrist.x - pose.direction.x * 2.8,
      y: pose.wrist.y - pose.direction.y * 2.8,
    };
    const palmPoints = [
      new Phaser.Math.Vector2(
        palmBack.x + pose.normal.x * 2.6,
        palmBack.y + pose.normal.y * 2.6,
      ),
      new Phaser.Math.Vector2(
        palmBack.x - pose.normal.x * 2.6,
        palmBack.y - pose.normal.y * 2.6,
      ),
      new Phaser.Math.Vector2(
        palmFront.x - pose.normal.x * 3.4,
        palmFront.y - pose.normal.y * 3.4,
      ),
      new Phaser.Math.Vector2(
        palmFront.x + pose.normal.x * 3.4,
        palmFront.y + pose.normal.y * 3.4,
      ),
    ];
    this.bodyGraphics.fillStyle(palette.clawColor, 0.96);
    this.bodyGraphics.fillPoints(palmPoints, true);
    this.bodyGraphics.lineStyle(1.2, palette.clawHighlightColor, 0.44);
    this.bodyGraphics.strokePoints(palmPoints, true, true);

    const upperJoint = lerpPoint(pose.knuckle, pose.upperTip, 0.46);
    const lowerJoint = lerpPoint(pose.knuckle, pose.lowerTip, 0.46);
    drawRibbon(
      this.bodyGraphics,
      pose.upperBase,
      upperJoint,
      1.2,
      0.8,
      palette.clawColor,
      0.98,
    );
    drawRibbon(
      this.bodyGraphics,
      pose.lowerBase,
      lowerJoint,
      1.2,
      0.8,
      palette.clawColor,
      0.98,
    );

    this.bodyGraphics.fillStyle(palette.clawColor, 0.98);
    this.bodyGraphics.fillTriangle(
      upperJoint.x + pose.normal.x * 0.5,
      upperJoint.y + pose.normal.y * 0.5,
      pose.upperBase.x,
      pose.upperBase.y,
      pose.upperTip.x,
      pose.upperTip.y,
    );
    this.bodyGraphics.fillTriangle(
      lowerJoint.x - pose.normal.x * 0.5,
      lowerJoint.y - pose.normal.y * 0.5,
      pose.lowerBase.x,
      pose.lowerBase.y,
      pose.lowerTip.x,
      pose.lowerTip.y,
    );

    this.bodyGraphics.lineStyle(
      1.3 + pose.activeWeight * 0.6,
      palette.clawHighlightColor,
      0.62 + (isActive ? 0.12 : 0),
    );
    this.bodyGraphics.strokeLineShape(
      new Phaser.Geom.Line(pose.upperBase.x, pose.upperBase.y, pose.upperTip.x, pose.upperTip.y),
    );
    this.bodyGraphics.strokeLineShape(
      new Phaser.Geom.Line(pose.lowerBase.x, pose.lowerBase.y, pose.lowerTip.x, pose.lowerTip.y),
    );
    this.bodyGraphics.fillStyle(palette.clawHighlightColor, 0.18 + pulse * 0.08);
    this.bodyGraphics.fillCircle(pose.upperTip.x, pose.upperTip.y, 1.1 + pose.activeWeight * 0.5);
    this.bodyGraphics.fillCircle(pose.lowerTip.x, pose.lowerTip.y, 1.1 + pose.activeWeight * 0.5);

    if (shellOpen < 0.2) {
      this.bodyGraphics.lineStyle(1.6, palette.clawHighlightColor, 0.22);
      this.bodyGraphics.strokeLineShape(
        new Phaser.Geom.Line(pose.root.x - 2, pose.root.y, pose.wrist.x, pose.wrist.y),
      );
    }
  }

  private drawEyes(
    shellWidth: number,
    shellHeight: number,
    shellOpen: number,
    pulse: number,
    palette: ShellbackPalette,
  ): void {
    for (let side = -1; side <= 1; side += 2) {
      const stalkBase = {
        x: -4 + shellWidth * 0.12,
        y: side * shellWidth * 0.12,
      };
      const stalkMid = {
        x: stalkBase.x + 2 + shellOpen * 2.2,
        y: stalkBase.y - side * 0.8 - (5.2 + shellOpen * 4.8),
      };
      const stalkTip = {
        x: stalkMid.x + 2.4,
        y: stalkMid.y - 1.8,
      };
      drawRibbon(this.bodyGraphics, stalkBase, stalkMid, 0.9, 0.64, palette.fleshShadowColor, 0.3);
      drawRibbon(this.bodyGraphics, stalkMid, stalkTip, 0.78, 0.54, palette.fleshLayerColor, 0.86);
      this.bodyGraphics.fillStyle(palette.eyeGlowColor, 0.14 + pulse * 0.12);
      this.bodyGraphics.fillCircle(stalkTip.x, stalkTip.y, 3.2);
      this.bodyGraphics.fillStyle(shellbackDefinition.eyeColor, 0.98);
      this.bodyGraphics.fillCircle(stalkTip.x, stalkTip.y, 1.46);
      this.bodyGraphics.fillStyle(palette.clawHighlightColor, 0.88);
      this.bodyGraphics.fillCircle(stalkTip.x - 0.34, stalkTip.y - 0.36, 0.42);
    }

    this.bodyGraphics.fillStyle(palette.fleshShadowColor, 0.24);
    this.bodyGraphics.fillEllipse(shellWidth * 0.04, 0, shellWidth * 0.16, shellHeight * 0.18);
  }

  private drawAttackEffect(
    attackState: ShellbackAttackState,
    attackWeight: number,
    pulse: number,
    activeClaw: ShellbackClawPose,
    attackTargetLocal: LocalPoint | null,
  ): void {
    if (attackWeight <= 0.04 || !attackTargetLocal) {
      return;
    }

    const source = {
      x: activeClaw.knuckle.x + activeClaw.direction.x * 0.8,
      y: activeClaw.knuckle.y + activeClaw.direction.y * 0.8,
    };
    const target =
      attackState === 'strike'
        ? attackTargetLocal
        : lerpPoint(source, attackTargetLocal, 0.82 + attackWeight * 0.12);
    const boltAlpha =
      (attackState === 'strike' ? 0.94 : 0.42 + attackWeight * 0.28) *
      (0.74 + pulse * 0.12);
    const arcAmplitude = 1.7 + attackWeight * 3.8;
    const arcCount = attackState === 'strike' ? 3 : 2;

    this.telegraphGraphics.fillStyle(
      shellbackDefinition.attackTelegraphColor,
      0.16 + attackWeight * 0.14,
    );
    this.telegraphGraphics.fillCircle(
      source.x,
      source.y,
      3.4 + attackWeight * 1.6,
    );
    this.telegraphGraphics.fillStyle(
      shellbackDefinition.attackTelegraphFillColor,
      0.32 + attackWeight * 0.18,
    );
    this.telegraphGraphics.fillCircle(
      source.x,
      source.y,
      1.9 + attackWeight * 0.9,
    );

    for (let index = 0; index < arcCount; index += 1) {
      const seed = this.phaseSeed + this.elapsed * 26 + index * 2.3;
      const branchShift = (index - (arcCount - 1) / 2) * (1.5 + attackWeight * 1.9);
      const start = {
        x: source.x + activeClaw.normal.x * branchShift,
        y: source.y + activeClaw.normal.y * branchShift,
      };
      const end = {
        x: target.x - activeClaw.normal.x * branchShift * 0.32,
        y: target.y - activeClaw.normal.y * branchShift * 0.32,
      };
      this.drawElectricArc(
        start,
        end,
        shellbackDefinition.attackTelegraphColor,
        boltAlpha * (0.94 - index * 0.16),
        2.2 - index * 0.24,
        arcAmplitude * (1 - index * 0.14),
        seed,
        6,
      );
      this.drawElectricArc(
        start,
        end,
        shellbackDefinition.attackTelegraphFillColor,
        boltAlpha * (0.82 - index * 0.14),
        1.1 - index * 0.08,
        arcAmplitude * 0.46,
        seed + 0.9,
        6,
      );

      if (index < arcCount - 1) {
        const branchBase = lerpPoint(start, end, 0.38 + index * 0.16);
        const branchTip = {
          x:
            branchBase.x +
            activeClaw.normal.x * (index % 2 === 0 ? 7 : -7) +
            activeClaw.direction.x * (4 + attackWeight * 3),
          y:
            branchBase.y +
            activeClaw.normal.y * (index % 2 === 0 ? 7 : -7) +
            activeClaw.direction.y * (4 + attackWeight * 3),
        };
        this.drawElectricArc(
          branchBase,
          branchTip,
          shellbackDefinition.attackTelegraphColor,
          boltAlpha * 0.42,
          1.2,
          arcAmplitude * 0.62,
          seed + 3.4,
          4,
        );
      }
    }

    this.telegraphGraphics.fillStyle(
      shellbackDefinition.attackTelegraphColor,
      0.14 + attackWeight * 0.12,
    );
    this.telegraphGraphics.fillCircle(
      target.x,
      target.y,
      4.2 + attackWeight * 1.6,
    );
    this.telegraphGraphics.fillStyle(
      shellbackDefinition.attackTelegraphFillColor,
      0.38 + attackWeight * 0.14,
    );
    this.telegraphGraphics.fillCircle(
      target.x,
      target.y,
      2.2 + attackWeight * 0.9,
    );

    if (attackState === 'strike') {
      for (let index = 0; index < 4; index += 1) {
        const angle = this.phaseSeed + index * (Math.PI / 2) + this.elapsed * 12;
        const burstTarget = {
          x: attackTargetLocal.x + Math.cos(angle) * (6.2 + pulse * 1.4),
          y: attackTargetLocal.y + Math.sin(angle) * (6.2 + pulse * 1.4),
        };
        this.drawElectricArc(
          attackTargetLocal,
          burstTarget,
          shellbackDefinition.attackTelegraphColor,
          0.52 + pulse * 0.08,
          1.4,
          2.2,
          this.phaseSeed + index * 1.8 + this.elapsed * 18,
          4,
        );
        this.drawElectricArc(
          attackTargetLocal,
          burstTarget,
          shellbackDefinition.attackTelegraphFillColor,
          0.46 + pulse * 0.08,
          0.8,
          1.1,
          this.phaseSeed + index * 2.1 + this.elapsed * 22,
          4,
        );
      }
    }
  }

  private drawElectricArc(
    start: LocalPoint,
    end: LocalPoint,
    color: number,
    alpha: number,
    width: number,
    amplitude: number,
    seed: number,
    segments: number,
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const direction = {
      x: dx / length,
      y: dy / length,
    };
    const normal = {
      x: -direction.y,
      y: direction.x,
    };
    let previous = start;

    for (let index = 1; index <= segments; index += 1) {
      const t = index / segments;
      const envelope = Math.sin(Math.PI * t);
      const normalOffset =
        (Math.sin(seed * 1.7 + t * 11.5) +
          Math.sin(seed * 2.9 - t * 24.2) * 0.55) *
        amplitude *
        envelope;
      const tangentOffset =
        Math.cos(seed * 0.8 + t * 17.3) *
        amplitude *
        0.16 *
        envelope;
      const point =
        index === segments
          ? end
          : {
              x:
                start.x +
                dx * t +
                normal.x * normalOffset +
                direction.x * tangentOffset,
              y:
                start.y +
                dy * t +
                normal.y * normalOffset +
                direction.y * tangentOffset,
            };
      this.telegraphGraphics.lineStyle(
        width,
        color,
        alpha * (0.96 - t * 0.12),
      );
      this.telegraphGraphics.strokeLineShape(
        new Phaser.Geom.Line(previous.x, previous.y, point.x, point.y),
      );
      previous = point;
    }
  }

  private drawHealthBar(
    health: number,
    pulse: number,
    isVulnerable: boolean,
  ): void {
    const intensity = clamp(this.hitIndicatorTimer / 0.5, 0, 1);
    const shellCount = tuning.shellbackHealth;
    const spacing = 10.5;
    const startX = -((shellCount - 1) * spacing) / 2;

    for (let index = 0; index < shellCount; index += 1) {
      const x = startX + index * spacing;
      const isActive = index < health;
      const shellSize = 4.2 + pulse * 0.18 + (isActive ? 0.16 : 0) + intensity * 0.22;
      const shellY =
        Math.sin(this.elapsed * 3.2 + this.phaseSeed + index * 0.45) * 0.5 - 1;

      this.drawHealthShell(x, shellY, shellSize, isActive, intensity, isVulnerable);
    }
  }

  private drawHealthShell(
    x: number,
    y: number,
    size: number,
    isActive: boolean,
    intensity: number,
    isVulnerable: boolean,
  ): void {
    const fillColor = isActive
      ? isVulnerable
        ? shellbackDefinition.hitPointColor
        : 0xe6dac0
      : 0x4c5358;
    const rimColor = isActive
      ? isVulnerable
        ? shellbackDefinition.shellInvulnerableHighlightColor
        : 0xb59763
      : 0x7a848b;
    const ridgeColor = isActive ? 0xffffff : 0x9aa2a8;
    const baseY = y + size * 0.78;
    const points: Phaser.Math.Vector2[] = [];

    for (let index = 0; index <= 8; index += 1) {
      const t = index / 8;
      const angle = Math.PI - t * Math.PI;
      points.push(
        new Phaser.Math.Vector2(
          x + Math.cos(angle) * size * 1.05,
          y - Math.sin(angle) * size * 0.92,
        ),
      );
    }
    points.push(new Phaser.Math.Vector2(x + size * 0.84, baseY));
    points.push(new Phaser.Math.Vector2(x - size * 0.84, baseY));

    this.healthGraphics.fillStyle(
      fillColor,
      isActive ? 0.88 + intensity * 0.08 : 0.32,
    );
    this.healthGraphics.fillPoints(points, true);
    this.healthGraphics.lineStyle(
      1,
      rimColor,
      isActive ? 0.84 + intensity * 0.08 : 0.4,
    );
    this.healthGraphics.strokePoints(points, true, true);

    for (let ridgeIndex = -1; ridgeIndex <= 1; ridgeIndex += 1) {
      const ridgeTop = {
        x: x + ridgeIndex * size * 0.34,
        y: y - size * (ridgeIndex === 0 ? 0.66 : 0.48),
      };
      const ridgeBase = {
        x: x + ridgeIndex * size * 0.52,
        y: baseY - size * 0.08,
      };
      this.healthGraphics.lineStyle(
        ridgeIndex === 0 ? 1.05 : 0.9,
        ridgeColor,
        isActive ? 0.42 + intensity * 0.08 : 0.16,
      );
      this.healthGraphics.strokeLineShape(
        new Phaser.Geom.Line(ridgeBase.x, ridgeBase.y, ridgeTop.x, ridgeTop.y),
      );
    }

    this.healthGraphics.lineStyle(0.95, rimColor, isActive ? 0.7 : 0.28);
    this.healthGraphics.strokeLineShape(
      new Phaser.Geom.Line(
        x - size * 0.78,
        baseY,
        x + size * 0.78,
        baseY,
      ),
    );

    if (!isActive) {
      this.healthGraphics.lineStyle(1, 0xc6d0d6, 0.16);
      this.healthGraphics.strokeLineShape(
        new Phaser.Geom.Line(
          x - size * 0.44,
          y - size * 0.1,
          x + size * 0.28,
          baseY - size * 0.18,
        ),
      );
      this.healthGraphics.strokeLineShape(
        new Phaser.Geom.Line(
          x - size * 0.08,
          y - size * 0.48,
          x + size * 0.4,
          y + size * 0.1,
        ),
      );
    }
  }

  private getPalette(isVulnerable: boolean): ShellbackPalette {
    if (isVulnerable) {
      return {
        fleshColor: shellbackDefinition.fleshColor,
        fleshShadowColor: shellbackDefinition.fleshShadowColor,
        fleshLayerColor: shellbackDefinition.fleshLayerColor,
        clawColor: shellbackDefinition.clawColor,
        clawHighlightColor: shellbackDefinition.clawHighlightColor,
        eyeGlowColor: shellbackDefinition.eyeGlowColor,
      };
    }

    return {
      fleshColor: shellbackDefinition.shellInvulnerableColor,
      fleshShadowColor: 0x94a0a8,
      fleshLayerColor: shellbackDefinition.shellInvulnerableHighlightColor,
      clawColor: 0xe5edf2,
      clawHighlightColor: 0xffffff,
      eyeGlowColor: 0xf5fcff,
    };
  }

  private createClawPose(
    side: ShellbackClawSide,
    shellOpen: number,
    attackWeight: number,
    isActive: boolean,
    attackTargetLocal: LocalPoint | null,
  ): ShellbackClawPose {
    const sideSign = side === 'left' ? -1 : 1;
    const root = {
      x: tuning.shellbackDisplaySize * 0.26,
      y: tuning.shellbackDisplaySize * 0.23 * sideSign,
    };
    const activeWeight = isActive ? attackWeight : attackWeight * 0.2;
    const defaultDirection = normalize(1, sideSign * 0.16);
    const direction = attackTargetLocal
      ? normalize(
          attackTargetLocal.x - root.x,
          attackTargetLocal.y - root.y,
        )
      : defaultDirection;
    const normal = {
      x: -direction.y,
      y: direction.x,
    };
    const elbow = {
      x: root.x + 6.4 + direction.x * (3.2 + activeWeight * 3.6),
      y:
        root.y +
        sideSign * (4.6 + shellOpen * 2.1) +
        direction.y * (2.4 + activeWeight * 2.2),
    };
    const reach = 12 + shellOpen * 5 + activeWeight * 18;
    const wrist = {
      x: elbow.x + direction.x * reach,
      y: elbow.y + direction.y * reach,
    };
    const knuckle = {
      x: wrist.x + direction.x * (2.6 + activeWeight * 2.8),
      y: wrist.y + direction.y * (2.6 + activeWeight * 2.8),
    };
    const jawSpread = Math.max(
      0.9,
      4.2 + shellOpen * 1.9 + (isActive ? 0 : 1.4) - activeWeight * 4.1,
    );
    const jawLength = 6 + activeWeight * 3.8;
    const upperBase = {
      x: knuckle.x + normal.x * jawSpread * 0.58,
      y: knuckle.y + normal.y * jawSpread * 0.58,
    };
    const lowerBase = {
      x: knuckle.x - normal.x * jawSpread * 0.58,
      y: knuckle.y - normal.y * jawSpread * 0.58,
    };
    const upperTip = {
      x: knuckle.x + direction.x * jawLength + normal.x * jawSpread,
      y: knuckle.y + direction.y * jawLength + normal.y * jawSpread,
    };
    const lowerTip = {
      x: knuckle.x + direction.x * jawLength - normal.x * jawSpread,
      y: knuckle.y + direction.y * jawLength - normal.y * jawSpread,
    };

    return {
      root,
      elbow,
      wrist,
      knuckle,
      upperBase,
      lowerBase,
      upperTip,
      lowerTip,
      direction,
      normal,
      reach,
      activeWeight,
    };
  }

  private toLocalPoint(
    bodyPosition: { x: number; y: number },
    bodyAngle: number,
    worldPoint: { x: number; y: number },
  ): LocalPoint {
    const dx = worldPoint.x - bodyPosition.x;
    const dy = worldPoint.y - bodyPosition.y;
    const cos = Math.cos(-bodyAngle);
    const sin = Math.sin(-bodyAngle);
    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos,
    };
  }
}
