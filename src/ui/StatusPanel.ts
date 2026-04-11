import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import type {
  HudSnapshot,
  NutrientPickupTier,
  UiStomachParticleSnapshot,
  UiStomachParasiteSnapshot,
} from '@/game/types';
import {
  getDefaultPickupDefinition,
  getPickupDefinition,
  nutrientPickupTiers,
} from '@/entities/pickups/PickupRegistry';
import {
  applyPickupSpriteAnimation,
  getPickupAnimationPhase,
} from '@/entities/pickups/PickupVisuals';
import { MaskedGraphicsLayer } from '@/phaser/MaskedGraphicsLayer';
import { getPickupCountEntries, showsStatusPanel } from '@/ui/uiState';

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

function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export class StatusPanel {
  private readonly panelGraphics: Phaser.GameObjects.Graphics;
  private readonly meterGraphics: Phaser.GameObjects.Graphics;
  private readonly chamberGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachParticles: MaskedGraphicsLayer;
  private readonly stageLabel: Phaser.GameObjects.Text;
  private readonly stageValue: Phaser.GameObjects.Text;
  private readonly limbLabel: Phaser.GameObjects.Text;
  private readonly readyBadge: Phaser.GameObjects.Text;
  private readonly segmentLabel: Phaser.GameObjects.Text;
  private readonly segmentValue: Phaser.GameObjects.Text;
  private readonly counterIcons: Record<NutrientPickupTier, Phaser.GameObjects.Image>;
  private readonly counterTexts: Record<NutrientPickupTier, Phaser.GameObjects.Text>;
  private readonly counterIconPhases: Record<NutrientPickupTier, number>;
  private metrics?: PanelMetrics;
  private snapshot?: HudSnapshot;

  constructor(private readonly scene: Phaser.Scene) {
    const accentColor = toCssHex(tuning.uiPanelAccentColor);
    this.panelGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.meterGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    this.chamberGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    this.stomachParticles = new MaskedGraphicsLayer(scene, {
      contentDepth: 1002,
      maskDepth: 999,
      scrollFactor: 0,
    });

    this.stageLabel = scene.add.text(0, 0, 'STAGE', {
      fontFamily: 'Trebuchet MS',
      fontSize: '15px',
      color: accentColor,
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
      color: accentColor,
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
      color: accentColor,
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
      basic: scene.add.image(0, 0, getDefaultPickupDefinition('basic').textureKey),
      advanced: scene.add.image(0, 0, getDefaultPickupDefinition('advanced').textureKey),
      rare: scene.add.image(0, 0, getDefaultPickupDefinition('rare').textureKey),
    };
    this.counterTexts = {
      basic: scene.add.text(0, 0, '0', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#eefbff',
        stroke: '#061014',
        strokeThickness: 4,
      }),
      advanced: scene.add.text(0, 0, '0', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#eefbff',
        stroke: '#061014',
        strokeThickness: 4,
      }),
      rare: scene.add.text(0, 0, '0', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#eefbff',
        stroke: '#061014',
        strokeThickness: 4,
      }),
    };
    this.counterIconPhases = {
      basic: getPickupAnimationPhase('status-basic'),
      advanced: getPickupAnimationPhase('status-advanced'),
      rare: getPickupAnimationPhase('status-rare'),
    };

    for (const tier of nutrientPickupTiers) {
      this.counterIcons[tier].setScrollFactor(0).setDepth(1002);
      this.counterTexts[tier].setScrollFactor(0).setDepth(1002);
    }
  }

  layout(): void {
    const width = Math.min(
      tuning.uiPanelMaxWidth,
      Math.max(tuning.uiPanelMinWidth, this.scene.scale.width * 0.24),
    );
    const height = Math.min(this.scene.scale.height - tuning.uiPanelMarginTop * 2, 560);
    const x = this.scene.scale.width - width - tuning.uiPanelMarginRight;
    const y = tuning.uiPanelMarginTop;
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
      basic: 0,
      advanced: 0,
      rare: 0,
    });
    const slotWidth = (width - 48) / counterEntries.length;
    counterEntries.forEach((entry, index) => {
      const iconX = x + 24 + slotWidth * index + tuning.uiCounterIconSize * (2 / 3);
      const textX = iconX + tuning.uiCounterIconSize;
      this.counterIcons[entry.tier].setPosition(iconX, pickupRowY);
      this.counterIcons[entry.tier].setDisplaySize(
        tuning.uiCounterIconSize,
        tuning.uiCounterIconSize,
      );
      this.counterTexts[entry.tier].setPosition(textX, pickupRowY - 11);
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
      this.stomachParticles.clear();
      return;
    }

    this.stageValue.setText(String(snapshot.stage));
    this.segmentValue.setText(String(snapshot.segments));
    this.readyBadge.setVisible(snapshot.limbReady);
    for (const entry of getPickupCountEntries(snapshot.pickupCounts)) {
      this.counterTexts[entry.tier].setText(String(entry.count));
    }
    this.redraw();
  }

  private redraw(): void {
    if (!this.metrics || !this.snapshot || !showsStatusPanel(this.snapshot.uiMode)) {
      return;
    }

    const metrics = this.metrics;
    const snapshot = this.snapshot;
    const elapsedSeconds = this.scene.time.now / 1000;

    this.panelGraphics.clear();
    this.meterGraphics.clear();
    this.chamberGraphics.clear();
    this.stomachParticles.clear();

    this.meterGraphics.fillStyle(0x0b1518, 0.46);
    this.meterGraphics.fillRoundedRect(
      metrics.meterX,
      metrics.meterY,
      metrics.meterWidth,
      metrics.meterHeight,
      metrics.meterHeight * 0.5,
    );
    this.meterGraphics.lineStyle(1.2, tuning.uiPanelAccentColor, 0.2);
    this.meterGraphics.strokeRoundedRect(
      metrics.meterX,
      metrics.meterY,
      metrics.meterWidth,
      metrics.meterHeight,
      metrics.meterHeight * 0.5,
    );

    const fillWidth = metrics.meterWidth * snapshot.limbCooldownProgress;
    if (fillWidth > 0) {
      this.meterGraphics.fillStyle(tuning.uiPanelAccentColor, 0.44);
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

    this.animateCounterIcons(elapsedSeconds);
    this.drawStomachChamber(metrics, snapshot.parasiteAlertProgress);
    this.drawStomachParticles(snapshot.stomachParticles, metrics, elapsedSeconds);
    this.drawStomachParasites(snapshot.stomachParasites, metrics, elapsedSeconds);
  }

  private animateCounterIcons(elapsedSeconds: number): void {
    for (const tier of nutrientPickupTiers) {
      const definition = getDefaultPickupDefinition(tier);
      applyPickupSpriteAnimation(
        this.counterIcons[tier],
        24,
        24,
        0.96,
        0,
        definition.palette,
        definition.animationProfile,
        elapsedSeconds,
        this.counterIconPhases[tier],
      );
    }
  }

  private drawStomachChamber(
    metrics: PanelMetrics,
    parasiteAlertProgress: number,
  ): void {
    const wallLeft = metrics.chamberX + 18;
    const wallRight = metrics.chamberX + metrics.chamberWidth - 18;
    const topY = metrics.chamberY + 10;
    const bottomY = metrics.chamberY + metrics.chamberHeight - 18;
    const arcRadius = (wallRight - wallLeft) * 0.5;
    const arcCenterX = (wallLeft + wallRight) * 0.5;
    const arcCenterY = bottomY - arcRadius;

    this.chamberGraphics.fillStyle(tuning.uiPanelAccentColor, 0.08);
    this.fillUInterior(
      metrics.chamberInnerX,
      metrics.chamberInnerX + metrics.chamberInnerWidth,
      metrics.chamberInnerY,
      metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
    );
    if (parasiteAlertProgress > 0) {
      this.chamberGraphics.fillStyle(
        tuning.uiDangerColor,
        0.08 + parasiteAlertProgress * 0.16,
      );
      this.fillUInterior(
        metrics.chamberInnerX,
        metrics.chamberInnerX + metrics.chamberInnerWidth,
        metrics.chamberInnerY,
        metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
      );
    }

    this.chamberGraphics.lineStyle(
      14,
      parasiteAlertProgress > 0 ? tuning.uiDangerColor : tuning.uiPanelAccentColor,
      0.12 + parasiteAlertProgress * 0.1,
    );
    this.strokeUShape(wallLeft, wallRight, topY, arcCenterX, arcCenterY, arcRadius);
    this.chamberGraphics.lineStyle(
      8,
      parasiteAlertProgress > 0 ? tuning.uiDangerColor : tuning.uiPanelAccentColor,
      0.4 + parasiteAlertProgress * 0.18,
    );
    this.strokeUShape(wallLeft, wallRight, topY, arcCenterX, arcCenterY, arcRadius);
    this.chamberGraphics.lineStyle(
      2.8,
      parasiteAlertProgress > 0 ? 0xffd4d7 : 0xffffff,
      0.2 + parasiteAlertProgress * 0.16,
    );
    this.strokeUShape(wallLeft, wallRight, topY, arcCenterX, arcCenterY, arcRadius);
    this.chamberGraphics.fillStyle(
      parasiteAlertProgress > 0 ? tuning.uiDangerColor : tuning.uiPanelAccentColor,
      0.08 + parasiteAlertProgress * 0.12,
    );
    this.chamberGraphics.fillCircle(wallLeft, topY, 6);
    this.chamberGraphics.fillCircle(wallRight, topY, 6);

    this.stomachParticles.drawMask((maskGraphics) => {
      this.fillUInterior(
        metrics.chamberInnerX,
        metrics.chamberInnerX + metrics.chamberInnerWidth,
        metrics.chamberInnerY,
        metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
        maskGraphics,
      );
    });
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
    elapsedSeconds: number,
  ): void {
    for (const particle of particles) {
      const x =
        metrics.chamberInnerX +
        ((particle.localX + 1) * 0.5) * metrics.chamberInnerWidth;
      const y =
        metrics.chamberInnerY +
        ((particle.localY + 1) * 0.5) * metrics.chamberInnerHeight;
      const radius =
        Math.max(
          6,
          particle.radius *
            Math.min(metrics.chamberInnerWidth, metrics.chamberInnerHeight) *
            0.54,
        );
      getPickupDefinition(particle.resourceId).drawParticle(
        this.stomachParticles.graphics,
        {
          x,
          y,
          radius,
          angle: particle.angle,
          elapsedSeconds,
          animationPhase: getPickupAnimationPhase(particle.id),
          alpha: 0.96,
        },
      );
    }
  }

  private drawStomachParasites(
    parasites: UiStomachParasiteSnapshot[],
    metrics: PanelMetrics,
    elapsedSeconds: number,
  ): void {
    for (const parasite of parasites) {
      const x =
        metrics.chamberInnerX +
        ((parasite.localX + 1) * 0.5) * metrics.chamberInnerWidth;
      const y =
        metrics.chamberInnerY +
        ((parasite.localY + 1) * 0.5) * metrics.chamberInnerHeight;
      const radius =
        Math.max(
          7,
          parasite.radius *
            Math.min(metrics.chamberInnerWidth, metrics.chamberInnerHeight) *
            0.54,
        );
      getPickupDefinition('parasite').drawParticle(this.stomachParticles.graphics, {
        x,
        y,
        radius,
        angle: parasite.angle,
        elapsedSeconds,
        animationPhase: getPickupAnimationPhase(parasite.id),
        alpha: 0.98,
      });
    }
  }

  private setVisible(visible: boolean): void {
    this.panelGraphics.setVisible(visible);
    this.meterGraphics.setVisible(visible);
    this.chamberGraphics.setVisible(visible);
    this.stomachParticles.setVisible(visible);
    this.stageLabel.setVisible(visible);
    this.stageValue.setVisible(visible);
    this.limbLabel.setVisible(visible);
    this.readyBadge.setVisible(visible && (this.snapshot?.limbReady ?? false));
    this.segmentLabel.setVisible(visible);
    this.segmentValue.setVisible(visible);
    for (const tier of nutrientPickupTiers) {
      this.counterIcons[tier].setVisible(visible);
      this.counterTexts[tier].setVisible(visible);
    }
  }
}
