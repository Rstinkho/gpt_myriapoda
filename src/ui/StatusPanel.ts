import Phaser from 'phaser';
import { textureKeys } from '@/game/assets';
import type {
  HudSnapshot,
  MatterShape,
  PickupType,
  UiStomachParticleSnapshot,
} from '@/game/types';
import { getPickupCountEntries, showsStatusPanel } from '@/ui/uiState';
import { rotateVector } from '@/utils/math';

const matterShapePoints: Record<MatterShape, Array<{ x: number; y: number }>> = {
  triangle: [
    { x: 0, y: -1.05 },
    { x: 0.95, y: 0.8 },
    { x: -0.95, y: 0.8 },
  ],
  crystal: [
    { x: 0, y: -1.08 },
    { x: 0.86, y: -0.22 },
    { x: 0.46, y: 1.02 },
    { x: -0.46, y: 1.02 },
    { x: -0.86, y: -0.22 },
  ],
  bone: [
    { x: -1.1, y: -0.48 },
    { x: -0.58, y: -0.88 },
    { x: -0.08, y: -0.52 },
    { x: 0.08, y: -0.52 },
    { x: 0.58, y: -0.88 },
    { x: 1.1, y: -0.48 },
    { x: 0.82, y: 0 },
    { x: 1.1, y: 0.48 },
    { x: 0.58, y: 0.88 },
    { x: 0.08, y: 0.52 },
    { x: -0.08, y: 0.52 },
    { x: -0.58, y: 0.88 },
    { x: -1.1, y: 0.48 },
    { x: -0.82, y: 0 },
  ],
};

interface PanelMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  meterX: number;
  meterY: number;
  meterWidth: number;
  meterHeight: number;
  chamberX: number;
  chamberY: number;
  chamberWidth: number;
  chamberHeight: number;
  chamberInnerX: number;
  chamberInnerY: number;
  chamberInnerWidth: number;
  chamberInnerHeight: number;
  pickupRowY: number;
}

export class StatusPanel {
  private readonly panelGraphics: Phaser.GameObjects.Graphics;
  private readonly meterGraphics: Phaser.GameObjects.Graphics;
  private readonly chamberGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachParticleGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly stageLabel: Phaser.GameObjects.Text;
  private readonly stageValue: Phaser.GameObjects.Text;
  private readonly limbLabel: Phaser.GameObjects.Text;
  private readonly readyBadge: Phaser.GameObjects.Text;
  private readonly segmentLabel: Phaser.GameObjects.Text;
  private readonly segmentValue: Phaser.GameObjects.Text;
  private readonly counterIcons: Record<PickupType, Phaser.GameObjects.Image>;
  private readonly counterTexts: Record<PickupType, Phaser.GameObjects.Text>;
  private metrics?: PanelMetrics;
  private snapshot?: HudSnapshot;

  constructor(private readonly scene: Phaser.Scene) {
    this.panelGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.meterGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    this.chamberGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    this.stomachParticleGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1002);
    this.stomachMaskGraphics = scene.add.graphics().setScrollFactor(0).setDepth(999);
    this.stomachMaskGraphics.setVisible(false);
    this.stomachParticleGraphics.setMask(this.stomachMaskGraphics.createGeometryMask());

    this.stageLabel = scene.add.text(0, 0, 'STAGE', {
      fontFamily: 'Trebuchet MS',
      fontSize: '15px',
      color: '#cdeef3',
      letterSpacing: 2,
    });
    this.stageLabel.setScrollFactor(0).setDepth(1002);

    this.stageValue = scene.add.text(0, 0, '1', {
      fontFamily: 'Georgia',
      fontSize: '56px',
      color: '#f7fbff',
      stroke: '#061014',
      strokeThickness: 6,
    });
    this.stageValue.setScrollFactor(0).setDepth(1002);

    this.limbLabel = scene.add.text(0, 0, 'LIMB CD', {
      fontFamily: 'Trebuchet MS',
      fontSize: '15px',
      color: '#bde4e7',
      letterSpacing: 1.5,
    });
    this.limbLabel.setScrollFactor(0).setDepth(1002);

    this.readyBadge = scene.add.text(0, 0, 'READY', {
      fontFamily: 'Trebuchet MS',
      fontSize: '13px',
      color: '#f8f5ce',
      backgroundColor: '#3f613f',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    });
    this.readyBadge.setOrigin(1, 0).setScrollFactor(0).setDepth(1002);

    this.segmentLabel = scene.add.text(0, 0, 'SEGMENT COUNT', {
      fontFamily: 'Trebuchet MS',
      fontSize: '14px',
      color: '#bde4e7',
      letterSpacing: 1.2,
    });
    this.segmentLabel.setScrollFactor(0).setDepth(1002);

    this.segmentValue = scene.add.text(0, 0, '0', {
      fontFamily: 'Georgia',
      fontSize: '22px',
      color: '#f2fbff',
      stroke: '#061014',
      strokeThickness: 5,
    });
    this.segmentValue.setScrollFactor(0).setDepth(1002);

    this.counterIcons = {
      triangle: scene.add.image(0, 0, textureKeys.pickupTriangle),
      crystal: scene.add.image(0, 0, textureKeys.pickupCrystal),
      bone: scene.add.image(0, 0, textureKeys.pickupBone),
    };
    this.counterTexts = {
      triangle: scene.add.text(0, 0, '0', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#eefbff',
        stroke: '#061014',
        strokeThickness: 4,
      }),
      crystal: scene.add.text(0, 0, '0', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#eefbff',
        stroke: '#061014',
        strokeThickness: 4,
      }),
      bone: scene.add.text(0, 0, '0', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#eefbff',
        stroke: '#061014',
        strokeThickness: 4,
      }),
    };

    for (const type of ['triangle', 'crystal', 'bone'] as const) {
      this.counterIcons[type].setScrollFactor(0).setDepth(1002);
      this.counterTexts[type].setScrollFactor(0).setDepth(1002);
    }
  }

  layout(): void {
    const width = Math.min(280, Math.max(240, this.scene.scale.width * 0.24));
    const height = Math.min(this.scene.scale.height - 32, 560);
    const x = this.scene.scale.width - width - 20;
    const y = 18;
    const meterWidth = width - 48;
    const chamberY = y + 214;
    const pickupRowY = y + height - 48;
    const chamberHeight = Math.max(150, pickupRowY - chamberY - 34);
    const chamberX = x + 24;
    const chamberWidth = width - 48;

    this.metrics = {
      x,
      y,
      width,
      height,
      meterX: x + 24,
      meterY: y + 152,
      meterWidth,
      meterHeight: 16,
      chamberX,
      chamberY,
      chamberWidth,
      chamberHeight,
      chamberInnerX: chamberX + 22,
      chamberInnerY: chamberY + 34,
      chamberInnerWidth: chamberWidth - 44,
      chamberInnerHeight: chamberHeight - 48,
      pickupRowY,
    };

    this.stageLabel.setPosition(x + 24, y + 24);
    this.stageValue.setPosition(x + 24, y + 44);
    this.limbLabel.setPosition(x + 24, y + 126);
    this.readyBadge.setPosition(x + width - 24, y + 122);
    this.segmentLabel.setPosition(x + 24, y + 188);
    this.segmentValue.setPosition(x + 176, y + 184);

    const counterEntries = getPickupCountEntries({
      triangle: 0,
      crystal: 0,
      bone: 0,
    });
    const slotWidth = (width - 48) / counterEntries.length;
    counterEntries.forEach((entry, index) => {
      const iconX = x + 24 + slotWidth * index + 16;
      const textX = iconX + 24;
      this.counterIcons[entry.type].setPosition(iconX, pickupRowY);
      this.counterIcons[entry.type].setDisplaySize(24, 24);
      this.counterTexts[entry.type].setPosition(textX, pickupRowY - 11);
    });

    this.redraw();
  }

  setSnapshot(snapshot: HudSnapshot): void {
    this.snapshot = snapshot;
    const visible = showsStatusPanel(snapshot.uiMode);
    this.setVisible(visible);
    if (!visible) {
      this.panelGraphics.clear();
      this.meterGraphics.clear();
      this.chamberGraphics.clear();
      this.stomachParticleGraphics.clear();
      this.stomachMaskGraphics.clear();
      return;
    }

    this.stageValue.setText(String(snapshot.stage));
    this.segmentValue.setText(String(snapshot.segments));
    this.readyBadge.setVisible(snapshot.limbReady);
    for (const entry of getPickupCountEntries(snapshot.pickupCounts)) {
      this.counterTexts[entry.type].setText(String(entry.count));
    }
    this.redraw();
  }

  private redraw(): void {
    if (!this.metrics || !this.snapshot || !showsStatusPanel(this.snapshot.uiMode)) {
      return;
    }

    const metrics = this.metrics;
    const snapshot = this.snapshot;

    this.panelGraphics.clear();
    this.meterGraphics.clear();
    this.chamberGraphics.clear();
    this.stomachParticleGraphics.clear();
    this.stomachMaskGraphics.clear();

    this.meterGraphics.fillStyle(0x0b1518, 0.46);
    this.meterGraphics.fillRoundedRect(
      metrics.meterX,
      metrics.meterY,
      metrics.meterWidth,
      metrics.meterHeight,
      metrics.meterHeight * 0.5,
    );
    this.meterGraphics.lineStyle(1.2, 0xcff7ff, 0.2);
    this.meterGraphics.strokeRoundedRect(
      metrics.meterX,
      metrics.meterY,
      metrics.meterWidth,
      metrics.meterHeight,
      metrics.meterHeight * 0.5,
    );

    const fillWidth = metrics.meterWidth * snapshot.limbCooldownProgress;
    if (fillWidth > 0) {
      this.meterGraphics.fillStyle(0x56ccff, 0.44);
      this.meterGraphics.fillRoundedRect(
        metrics.meterX,
        metrics.meterY,
        fillWidth,
        metrics.meterHeight,
        metrics.meterHeight * 0.5,
      );
      this.meterGraphics.fillStyle(
        snapshot.limbReady ? 0xf4e87c : 0xeafcff,
        snapshot.limbReady ? 0.95 : 0.62,
      );
      this.meterGraphics.fillRoundedRect(
        metrics.meterX,
        metrics.meterY + 2,
        Math.max(4, fillWidth - 4),
        Math.max(4, metrics.meterHeight - 4),
        (metrics.meterHeight - 4) * 0.5,
      );
    }

    this.drawStomachChamber(metrics);
    this.drawStomachParticles(snapshot.stomachParticles, metrics);
  }

  private drawStomachChamber(metrics: PanelMetrics): void {
    const wallLeft = metrics.chamberX + 18;
    const wallRight = metrics.chamberX + metrics.chamberWidth - 18;
    const topY = metrics.chamberY + 10;
    const bottomY = metrics.chamberY + metrics.chamberHeight - 18;
    const arcRadius = (wallRight - wallLeft) * 0.5;
    const arcCenterX = (wallLeft + wallRight) * 0.5;
    const arcCenterY = bottomY - arcRadius;

    this.chamberGraphics.fillStyle(0xa8ebff, 0.08);
    this.fillUInterior(
      metrics.chamberInnerX,
      metrics.chamberInnerX + metrics.chamberInnerWidth,
      metrics.chamberInnerY,
      metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
    );

    this.chamberGraphics.lineStyle(14, 0x90e8ff, 0.12);
    this.strokeUShape(wallLeft, wallRight, topY, arcCenterX, arcCenterY, arcRadius);
    this.chamberGraphics.lineStyle(8, 0xcef9ff, 0.4);
    this.strokeUShape(wallLeft, wallRight, topY, arcCenterX, arcCenterY, arcRadius);
    this.chamberGraphics.lineStyle(2.8, 0xffffff, 0.2);
    this.strokeUShape(wallLeft, wallRight, topY, arcCenterX, arcCenterY, arcRadius);
    this.chamberGraphics.fillStyle(0xa6e8ff, 0.08);
    this.chamberGraphics.fillCircle(wallLeft, topY, 6);
    this.chamberGraphics.fillCircle(wallRight, topY, 6);

    this.stomachMaskGraphics.fillStyle(0xffffff, 1);
    this.fillUInterior(
      metrics.chamberInnerX,
      metrics.chamberInnerX + metrics.chamberInnerWidth,
      metrics.chamberInnerY,
      metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
      this.stomachMaskGraphics,
    );
  }

  private strokeUShape(
    leftX: number,
    rightX: number,
    topY: number,
    arcCenterX: number,
    arcCenterY: number,
    arcRadius: number,
  ): void {
    this.chamberGraphics.beginPath();
    this.chamberGraphics.moveTo(leftX, topY);
    this.chamberGraphics.lineTo(leftX, arcCenterY);
    const steps = 18;
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const angle = Math.PI - t * Math.PI;
      const px = arcCenterX + Math.cos(angle) * arcRadius;
      const py = arcCenterY + Math.sin(angle) * arcRadius;
      this.chamberGraphics.lineTo(px, py);
    }
    this.chamberGraphics.lineTo(rightX, topY);
    this.chamberGraphics.strokePath();
  }

  private fillUInterior(
    leftX: number,
    rightX: number,
    topY: number,
    bottomY: number,
    graphics: Phaser.GameObjects.Graphics = this.chamberGraphics,
  ): void {
    const arcRadius = (rightX - leftX) * 0.5;
    const arcCenterX = (leftX + rightX) * 0.5;
    const arcCenterY = bottomY - arcRadius;
    const points: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(leftX, topY)];
    points.push(new Phaser.Math.Vector2(leftX, arcCenterY));
    const steps = 24;
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const angle = Math.PI - t * Math.PI;
      points.push(
        new Phaser.Math.Vector2(
          arcCenterX + Math.cos(angle) * arcRadius,
          arcCenterY + Math.sin(angle) * arcRadius,
        ),
      );
    }
    points.push(new Phaser.Math.Vector2(rightX, topY));
    graphics.fillPoints(points, true);
  }

  private drawStomachParticles(
    particles: UiStomachParticleSnapshot[],
    metrics: PanelMetrics,
  ): void {
    for (const particle of particles) {
      const x =
        metrics.chamberInnerX +
        ((particle.localX + 1) * 0.5) * metrics.chamberInnerWidth;
      const y =
        metrics.chamberInnerY +
        ((particle.localY + 1) * 0.5) * metrics.chamberInnerHeight;
      const radius =
        Math.max(6, particle.radius * Math.min(metrics.chamberInnerWidth, metrics.chamberInnerHeight) * 0.54);
      this.drawMatterShape(x, y, radius, particle.angle, particle.color, particle.shape);
    }
  }

  private drawMatterShape(
    x: number,
    y: number,
    radius: number,
    angle: number,
    color: number,
    shape: MatterShape,
  ): void {
    const points = matterShapePoints[shape].map((point) => {
      const rotated = rotateVector(point.x * radius, point.y * radius, angle);
      return new Phaser.Math.Vector2(x + rotated.x, y + rotated.y);
    });

    this.stomachParticleGraphics.fillStyle(color, 0.92);
    this.stomachParticleGraphics.fillPoints(points, true);
    this.stomachParticleGraphics.lineStyle(0.85, 0xfff7fb, 0.22);
    this.stomachParticleGraphics.strokePoints(points, true, true);
  }

  private setVisible(visible: boolean): void {
    this.panelGraphics.setVisible(visible);
    this.meterGraphics.setVisible(visible);
    this.chamberGraphics.setVisible(visible);
    this.stomachParticleGraphics.setVisible(visible);
    this.stageLabel.setVisible(visible);
    this.stageValue.setVisible(visible);
    this.limbLabel.setVisible(visible);
    this.readyBadge.setVisible(visible && (this.snapshot?.limbReady ?? false));
    this.segmentLabel.setVisible(visible);
    this.segmentValue.setVisible(visible);
    for (const type of ['triangle', 'crystal', 'bone'] as const) {
      this.counterIcons[type].setVisible(visible);
      this.counterTexts[type].setVisible(visible);
    }
  }
}
