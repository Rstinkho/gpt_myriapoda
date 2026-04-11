import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import type {
  HudSnapshot,
  NutrientPickupTier,
  PickupPalette,
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
  samplePickupAnimation,
} from '@/entities/pickups/PickupVisuals';
import { GraphicsMaskController } from '@/phaser/GraphicsMaskController';
import { MaskedGraphicsLayer } from '@/phaser/MaskedGraphicsLayer';
import { getPickupCountEntries, showsStatusPanel } from '@/ui/uiState';

const chamberGradientDepth = 1000.75;
const chamberNoiseDepth = 1000.78;
const chamberGlowDepth = 1001.02;
const chamberNoiseTextureSize = 256;

interface PanelMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  meterX: number;
  meterY: number;
  dashMeterY: number;
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
  private readonly chamberGradient: Phaser.GameObjects.Gradient;
  private readonly chamberNoiseQuad: Phaser.GameObjects.NoiseSimplex2D;
  private readonly chamberNoiseLayer: Phaser.GameObjects.Image;
  private readonly chamberGraphics: Phaser.GameObjects.Graphics;
  private readonly chamberGlowGraphics: Phaser.GameObjects.Graphics;
  private readonly chamberMask: GraphicsMaskController;
  private readonly stomachParticles: MaskedGraphicsLayer;
  private readonly stageLabel: Phaser.GameObjects.Text;
  private readonly stageValue: Phaser.GameObjects.Text;
  private readonly limbLabel: Phaser.GameObjects.Text;
  private readonly dashLabel: Phaser.GameObjects.Text;
  private readonly readyBadge: Phaser.GameObjects.Text;
  /** Single line: "SEGMENT COUNT  N" — one Text so label + number cannot split across baselines. */
  private readonly segmentLine: Phaser.GameObjects.Text;
  private readonly counterIcons: Record<NutrientPickupTier, Phaser.GameObjects.Image>;
  private readonly counterTexts: Record<NutrientPickupTier, Phaser.GameObjects.Text>;
  private readonly counterIconPhases: Record<NutrientPickupTier, number>;
  private readonly chamberNoiseTextureKey: string;
  private metrics?: PanelMetrics;
  private snapshot?: HudSnapshot;

  constructor(private readonly scene: Phaser.Scene) {
    const accentColor = toCssHex(tuning.uiPanelAccentColor);
    this.panelGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.chamberGradient = scene.add.gradient(
      this.createChamberGradientConfig(),
      0,
      0,
      128,
      128,
    );
    this.chamberGradient.setScrollFactor(0).setDepth(chamberGradientDepth).setOrigin(0.5);
    this.chamberNoiseTextureKey = `status-chamber-noise-${Math.floor(Math.random() * 1_000_000)}`;
    this.chamberNoiseQuad = scene.add.noisesimplex2d(
      this.createChamberNoiseConfig(),
      chamberNoiseTextureSize * 0.5,
      chamberNoiseTextureSize * 0.5,
      chamberNoiseTextureSize,
      chamberNoiseTextureSize,
    );
    this.chamberNoiseQuad.setRenderToTexture(this.chamberNoiseTextureKey);
    this.chamberNoiseQuad.setVisible(false);
    this.chamberNoiseLayer = scene.add.image(0, 0, this.chamberNoiseTextureKey);
    this.chamberNoiseLayer.setScrollFactor(0).setDepth(chamberNoiseDepth);
    this.chamberNoiseLayer.setAlpha(tuning.statusFxChamberNoiseAlpha);
    this.meterGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    this.chamberGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    this.chamberGlowGraphics = scene.add.graphics().setScrollFactor(0).setDepth(chamberGlowDepth);
    this.chamberMask = new GraphicsMaskController(scene, {
      maskDepth: 999,
      scrollFactor: 0,
      viewCamera: scene.cameras.main,
      viewTransform: 'local',
    });
    this.chamberMask.attach(this.chamberGradient);
    this.chamberMask.attach(this.chamberNoiseLayer);
    this.chamberMask.attach(this.chamberGlowGraphics);
    this.stomachParticles = new MaskedGraphicsLayer(scene, {
      contentDepth: 1002,
      maskDepth: 999,
      scrollFactor: 0,
      blurRadius: tuning.statusFxChamberMaskBlurRadius,
      viewTransform: 'local',
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

    this.dashLabel = scene.add.text(0, 0, 'DASH CD', {
      fontFamily: 'Trebuchet MS',
      fontSize: '15px',
      color: accentColor,
      letterSpacing: 1.5,
    });
    this.dashLabel.setScrollFactor(0).setDepth(1002);

    this.readyBadge = scene.add.text(0, 0, 'READY', {
      fontFamily: 'Trebuchet MS',
      fontSize: '13px',
      color: '#f8f5ce',
      backgroundColor: '#3f613f',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    });
    this.readyBadge.setOrigin(1, 0).setScrollFactor(0).setDepth(1002);

    this.segmentLine = scene.add.text(0, 0, 'SEGMENT COUNT  0', {
      fontFamily: 'Trebuchet MS',
      fontSize: '16px',
      color: accentColor,
      letterSpacing: 1,
    });
    this.segmentLine.setScrollFactor(0).setDepth(1002);
    this.segmentLine.setOrigin(0, 0.5);

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
    const chamberY = y + 258;
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
      dashMeterY: y + 200,
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
    this.dashLabel.setPosition(x + 24, y + 174);
    this.readyBadge.setPosition(x + width - 24, y + 122);
    this.segmentLine.setPosition(x + 24, y + 244);

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
      this.clearVisuals();
      return;
    }

    this.stageValue.setText(String(snapshot.stage));
    this.segmentLine.setText(`SEGMENT COUNT  ${snapshot.segments}`);
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

    this.clearVisuals();
    this.drawPanelBackground(metrics, snapshot.parasiteAlertProgress);

    this.drawCooldownMeter(
      metrics.meterX,
      metrics.meterY,
      metrics.meterWidth,
      metrics.meterHeight,
      snapshot.limbCooldownProgress,
      tuning.uiPanelAccentColor,
      snapshot.limbReady ? 0xf4e87c : 0xeafcff,
      snapshot.limbReady,
    );
    this.drawCooldownMeter(
      metrics.meterX,
      metrics.dashMeterY,
      metrics.meterWidth,
      metrics.meterHeight,
      snapshot.dashCooldownProgress,
      0xffbf86,
      snapshot.dashReady ? 0xfff4cf : 0xffe3c8,
      snapshot.dashReady,
    );

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
    const elapsedSeconds = this.scene.time.now / 1000;

    this.layoutChamberFxLayers(metrics);
    this.animateChamberFxLayers(elapsedSeconds);
    this.chamberMask.drawMask((maskGraphics) => {
      this.fillUInterior(
        metrics.chamberInnerX,
        metrics.chamberInnerX + metrics.chamberInnerWidth,
        metrics.chamberInnerY,
        metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
        maskGraphics,
      );
    });

    this.chamberGlowGraphics.fillStyle(
      tuning.statusFxChamberGradientBottomColor,
      0.04 + tuning.statusFxChamberGlowAlpha * 0.45,
    );
    this.fillUInterior(
      metrics.chamberInnerX,
      metrics.chamberInnerX + metrics.chamberInnerWidth,
      metrics.chamberInnerY,
      metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
      this.chamberGlowGraphics,
    );
    if (parasiteAlertProgress > 0) {
      this.chamberGlowGraphics.fillStyle(
        tuning.uiDangerColor,
        parasiteAlertProgress * tuning.statusFxChamberDangerWashAlpha,
      );
      this.fillUInterior(
        metrics.chamberInnerX,
        metrics.chamberInnerX + metrics.chamberInnerWidth,
        metrics.chamberInnerY,
        metrics.chamberInnerY + metrics.chamberInnerHeight - 8,
        this.chamberGlowGraphics,
      );
    }

    this.chamberGraphics.fillStyle(tuning.uiPanelAccentColor, 0.05);
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
      const definition = getPickupDefinition(particle.resourceId);
      const animationPhase = getPickupAnimationPhase(particle.id);
      const animation = samplePickupAnimation(
        definition.animationProfile,
        elapsedSeconds,
        animationPhase,
      );
      this.drawChamberParticleGlow(
        x,
        y,
        radius,
        definition.palette,
        animation.glowAlpha,
      );
      definition.drawParticle(this.stomachParticles.graphics, {
        x,
        y,
        radius,
        angle: particle.angle,
        elapsedSeconds,
        animationPhase,
        alpha: 0.96,
      });
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
      const definition = getPickupDefinition('parasite');
      const animationPhase = getPickupAnimationPhase(parasite.id);
      const animation = samplePickupAnimation(
        definition.animationProfile,
        elapsedSeconds,
        animationPhase,
      );
      this.drawChamberParticleGlow(
        x,
        y,
        radius,
        definition.palette,
        animation.glowAlpha,
        1.2,
      );
      definition.drawParticle(this.stomachParticles.graphics, {
        x,
        y,
        radius,
        angle: parasite.angle,
        elapsedSeconds,
        animationPhase,
        alpha: 0.98,
      });
    }
  }

  destroy(): void {
    this.chamberMask.destroy();
    this.stomachParticles.destroy();
    this.panelGraphics.destroy();
    this.meterGraphics.destroy();
    this.chamberGradient.destroy();
    this.chamberNoiseLayer.destroy();
    this.chamberNoiseQuad.destroy();
    this.chamberGraphics.destroy();
    this.chamberGlowGraphics.destroy();
    this.stageLabel.destroy();
    this.stageValue.destroy();
    this.limbLabel.destroy();
    this.dashLabel.destroy();
    this.readyBadge.destroy();
    this.segmentLine.destroy();
    for (const tier of nutrientPickupTiers) {
      this.counterIcons[tier].destroy();
      this.counterTexts[tier].destroy();
    }
    if (this.scene.textures.exists(this.chamberNoiseTextureKey)) {
      this.scene.textures.remove(this.chamberNoiseTextureKey);
    }
  }

  private setVisible(visible: boolean): void {
    this.panelGraphics.setVisible(visible);
    this.meterGraphics.setVisible(visible);
    this.chamberGradient.setVisible(visible);
    this.chamberNoiseLayer.setVisible(visible);
    this.chamberGraphics.setVisible(visible);
    this.chamberGlowGraphics.setVisible(visible);
    this.stomachParticles.setVisible(visible);
    this.stageLabel.setVisible(visible);
    this.stageValue.setVisible(visible);
    this.limbLabel.setVisible(visible);
    this.dashLabel.setVisible(visible);
    this.readyBadge.setVisible(visible && (this.snapshot?.limbReady ?? false));
    this.segmentLine.setVisible(visible);
    for (const tier of nutrientPickupTiers) {
      this.counterIcons[tier].setVisible(visible);
      this.counterTexts[tier].setVisible(visible);
    }
  }

  private clearVisuals(): void {
    this.panelGraphics.clear();
    this.meterGraphics.clear();
    this.chamberGraphics.clear();
    this.chamberGlowGraphics.clear();
    this.chamberMask.clear();
    this.stomachParticles.clear();
  }

  private drawPanelBackground(
    metrics: PanelMetrics,
    parasiteAlertProgress: number,
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 600);
    this.panelGraphics.fillStyle(0x061117, 0.8);
    this.panelGraphics.fillRoundedRect(
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      28,
    );
    this.panelGraphics.fillStyle(0xffffff, 0.02 + pulse * 0.01);
    this.panelGraphics.fillRoundedRect(
      metrics.x + 2,
      metrics.y + 2,
      metrics.width - 4,
      metrics.height - 4,
      26,
    );
    if (parasiteAlertProgress > 0) {
      this.panelGraphics.fillStyle(
        tuning.uiDangerColor,
        0.05 + parasiteAlertProgress * 0.08,
      );
      this.panelGraphics.fillRoundedRect(
        metrics.x + 10,
        metrics.y + 10,
        metrics.width - 20,
        metrics.height - 20,
        24,
      );
    }
    this.panelGraphics.lineStyle(1.2, tuning.uiPanelAccentColor, 0.2);
    this.panelGraphics.strokeRoundedRect(
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      28,
    );
    this.panelGraphics.lineStyle(1, 0xffffff, 0.05 + pulse * 0.02);
    this.panelGraphics.strokeRoundedRect(
      metrics.x + 2,
      metrics.y + 2,
      metrics.width - 4,
      metrics.height - 4,
      26,
    );
    this.panelGraphics.lineStyle(1, tuning.uiPanelAccentColor, 0.12);
    this.panelGraphics.lineBetween(
      metrics.x + 24,
      metrics.chamberY - 18,
      metrics.x + metrics.width - 24,
      metrics.chamberY - 18,
    );
  }

  private drawChamberParticleGlow(
    x: number,
    y: number,
    radius: number,
    palette: PickupPalette,
    glowAlpha: number,
    intensity = 1,
  ): void {
    const glowColor = palette.glow ?? palette.highlight;
    const alpha =
      tuning.statusFxChamberParticleGlowAlpha * intensity * (0.45 + glowAlpha * 0.9);
    this.chamberGlowGraphics.fillStyle(glowColor, alpha);
    this.chamberGlowGraphics.fillCircle(x, y, radius * 1.85);
    this.chamberGlowGraphics.fillStyle(palette.highlight, alpha * 0.5);
    this.chamberGlowGraphics.fillCircle(x, y, radius * 1.08);
  }

  private drawCooldownMeter(
    x: number,
    y: number,
    width: number,
    height: number,
    progress: number,
    baseColor: number,
    fillColor: number,
    isReady: boolean,
  ): void {
    this.meterGraphics.fillStyle(0x0b1518, 0.46);
    this.meterGraphics.fillRoundedRect(x, y, width, height, height * 0.5);
    this.meterGraphics.lineStyle(1.2, baseColor, 0.2);
    this.meterGraphics.strokeRoundedRect(x, y, width, height, height * 0.5);

    const fillWidth = width * progress;
    if (fillWidth <= 0) {
      return;
    }

    this.meterGraphics.fillStyle(baseColor, 0.44);
    this.meterGraphics.fillRoundedRect(x, y, fillWidth, height, height * 0.5);
    this.meterGraphics.fillStyle(fillColor, isReady ? 0.95 : 0.62);
    this.meterGraphics.fillRoundedRect(
      x,
      y + 2,
      Math.max(4, fillWidth - 4),
      Math.max(4, height - 4),
      (height - 4) * 0.5,
    );
  }

  private createChamberGradientConfig(): Phaser.Types.GameObjects.Gradient.GradientQuadConfig {
    return {
      bands: [
        {
          colorStart: this.toRgbaColor(
            tuning.statusFxChamberGradientTopColor,
            tuning.statusFxChamberGradientAlpha,
          ),
          colorEnd: this.toRgbaColor(
            tuning.statusFxChamberGradientBottomColor,
            tuning.statusFxChamberGradientAlpha,
          ),
          start: 0,
          end: 1,
          interpolation: 2,
        },
      ],
      start: { x: 0.5, y: 0 },
      shape: { x: 0, y: 1 },
      shapeMode: 0,
      repeatMode: 0,
      dither: true,
    };
  }

  private createChamberNoiseConfig(): Phaser.Types.GameObjects.NoiseSimplex2D.NoiseSimplex2DQuadConfig {
    return {
      noiseCells: [
        tuning.statusFxChamberNoiseCellsX,
        tuning.statusFxChamberNoiseCellsY,
      ],
      noiseIterations: tuning.statusFxChamberNoiseIterations,
      noiseWarpAmount: tuning.statusFxChamberNoiseWarpAmount,
      noiseColorStart: this.toRgbaColor(
        tuning.statusFxChamberGradientTopColor,
        tuning.statusFxChamberNoiseAlpha,
      ),
      noiseColorEnd: this.toRgbaColor(
        tuning.statusFxChamberGradientBottomColor,
        tuning.statusFxChamberNoiseAlpha,
      ),
    };
  }

  private layoutChamberFxLayers(metrics: PanelMetrics): void {
    const padding = Math.max(18, tuning.statusFxChamberMaskBlurRadius * 3);
    const width = Math.max(64, metrics.chamberInnerWidth + padding);
    const height = Math.max(64, metrics.chamberInnerHeight + padding);
    const centerX = metrics.chamberInnerX + metrics.chamberInnerWidth * 0.5;
    const centerY = metrics.chamberInnerY + metrics.chamberInnerHeight * 0.52;

    this.chamberGradient.setPosition(centerX, centerY);
    this.chamberGradient.setSize(width, height);
    this.chamberGradient.setDisplaySize(width, height);
    this.chamberNoiseLayer.setPosition(centerX, centerY);
    this.chamberNoiseLayer.setDisplaySize(width, height);
  }

  private animateChamberFxLayers(elapsedSeconds: number): void {
    this.chamberGradient.offset =
      Math.sin(elapsedSeconds * tuning.statusFxChamberNoiseFlowSpeed * 0.8) * 0.05;
    this.chamberNoiseQuad.noiseFlow =
      elapsedSeconds * tuning.statusFxChamberNoiseFlowSpeed;
    this.chamberNoiseQuad.noiseOffset = [
      elapsedSeconds * tuning.statusFxChamberNoiseOffsetSpeedX,
      elapsedSeconds * tuning.statusFxChamberNoiseOffsetSpeedY,
    ];
    this.chamberNoiseQuad.renderImmediate();
  }

  private toRgbaColor(color: number, alpha: number): [number, number, number, number] {
    return [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
      Phaser.Math.Clamp(alpha, 0, 1),
    ];
  }
}
