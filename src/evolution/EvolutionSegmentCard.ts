import * as Phaser from 'phaser';
import { textureKeys } from '@/game/assets';
import {
  deriveJitterSeed,
  drawJitteredRoundedRect,
  drawJitteredRoundedRectFill,
} from '@/evolution/evolutionBorderStyle';
import type { RectLike } from '@/evolution/evolutionLayout';
import type { EvolutionSnapshot } from '@/game/types';
import { tuning } from '@/game/tuning';

/**
 * Square “SEGMENTS” card: giant count, compact biomass price + small round + on the right.
 */
export class EvolutionSegmentCard {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly countText: Phaser.GameObjects.Text;
  private readonly plusText: Phaser.GameObjects.Text;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly biomassIcon: Phaser.GameObjects.Image;
  private bounds: RectLike = { x: 0, y: 0, width: 1, height: 1 };
  private readonly plusHit = new Phaser.Geom.Circle();
  private visible = true;

  private plusCx = 0;
  private plusCy = 0;
  private plusR = 12;
  /** Last afford / cap state for chrome. */
  private plusEnabled = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onAddPressed: () => void,
  ) {
    const depth = 22;
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    this.title = scene.add
      .text(0, 0, 'SEGMENTS', {
        fontFamily: 'Trebuchet MS',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#8fd4c6',
        letterSpacing: 2,
      })
      .setDepth(depth + 0.1)
      .setOrigin(0.5, 0);

    this.countText = scene.add
      .text(0, 0, '0', {
        fontFamily: 'Georgia',
        fontSize: '72px',
        color: '#f1fbf5',
        stroke: '#061014',
        strokeThickness: 3,
      })
      .setDepth(depth + 0.1)
      .setOrigin(0.5, 0.5);

    this.plusText = scene.add
      .text(0, 0, '+', {
        fontFamily: 'Trebuchet MS',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e7fffb',
      })
      .setDepth(depth + 0.1)
      .setOrigin(0.5, 0.5);

    this.costText = scene.add
      .text(0, 0, String(tuning.evolutionAddSegmentBiomassCost), {
        fontFamily: 'Trebuchet MS',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#b8e8dc',
      })
      .setDepth(depth + 0.1)
      .setOrigin(1, 0.5);

    this.biomassIcon = scene.add
      .image(0, 0, textureKeys.resourceIcons.biomass)
      .setScrollFactor(0)
      .setDepth(depth + 0.1)
      .setScale(0.34);
  }

  layout(bounds: RectLike): void {
    this.bounds = { ...bounds };
    this.applyTextLayout();
    this.redrawChrome();
  }

  syncFromSnapshot(snapshot: EvolutionSnapshot): void {
    const count = snapshot.myriapoda.segmentCount;
    const cost = tuning.evolutionAddSegmentBiomassCost;
    const biomass = snapshot.resourceCounts.biomass ?? 0;
    const atMax = count >= tuning.maxSegments;
    const canAfford = biomass >= cost && !atMax;

    this.plusEnabled = canAfford;
    this.countText.setText(String(count));

    this.plusText.setColor(canAfford ? '#e7fffb' : '#5a7a72');
    this.plusText.setAlpha(canAfford ? 1 : 0.45);
    this.costText.setAlpha(canAfford ? 1 : 0.55);
    this.biomassIcon.setAlpha(canAfford ? 1 : 0.55);

    this.applyTextLayout();
    this.redrawChrome();
  }

  /** Returns true if the + control handled the click (caller should not pass to preview). */
  tryConsumePointerDown(screenX: number, screenY: number): boolean {
    if (!this.visible || !Phaser.Geom.Circle.Contains(this.plusHit, screenX, screenY)) {
      return false;
    }
    this.onAddPressed();
    return true;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.graphics.setVisible(visible);
    this.title.setVisible(visible);
    this.countText.setVisible(visible);
    this.plusText.setVisible(visible);
    this.costText.setVisible(visible);
    this.biomassIcon.setVisible(visible);
  }

  destroy(): void {
    this.graphics.destroy();
    this.title.destroy();
    this.countText.destroy();
    this.plusText.destroy();
    this.costText.destroy();
    this.biomassIcon.destroy();
  }

  /** Starting font size before fitting inside the inner rect. */
  private computeCountFontSizeHint(): number {
    const { width, height } = this.bounds;
    const side = Math.min(width, height);
    return Phaser.Math.Clamp(Math.floor(side * 0.36), 28, 120);
  }

  private applyCountStyleAtSize(fs: number): void {
    this.countText.setStyle({
      fontFamily: 'Georgia',
      fontSize: `${fs}px`,
      color: '#f1fbf5',
      stroke: '#061014',
      strokeThickness: Math.max(2, Math.floor(fs * 0.04)),
    });
  }

  /**
   * Shrinks font until the count fits fully inside the inner rectangle (no overflow past card).
   */
  private fitCountFontToRect(maxW: number, maxH: number): void {
    const minFs = 14;
    let fs = this.computeCountFontSizeHint();
    this.applyCountStyleAtSize(fs);
    while (fs > minFs && (this.countText.width > maxW || this.countText.height > maxH)) {
      fs -= 1;
      this.applyCountStyleAtSize(fs);
    }
  }

  private redrawChrome(): void {
    const { x, y, width, height } = this.bounds;
    this.graphics.clear();
    if (width < 8 || height < 8) {
      return;
    }
    drawJitteredRoundedRectFill(this.graphics, {
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height: height - 2,
      radius: 12,
      seed: deriveJitterSeed('evo-segment-card-fill'),
      jitter: 0.75,
      color: 0x061117,
      alpha: 0.42,
    });
    drawJitteredRoundedRect(this.graphics, {
      x,
      y,
      width,
      height,
      radius: 12,
      seed: deriveJitterSeed('evo-segment-card-stroke'),
      jitter: 0.85,
      strokeWidth: 1.05,
      color: 0x7aaea4,
      alpha: 0.48,
    });

    const fill = this.plusEnabled ? 0x14302a : 0x0f1c18;
    const stroke = this.plusEnabled ? 0x8fd4c6 : 0x4a605a;
    const strokeAlpha = this.plusEnabled ? 0.65 : 0.35;

    this.graphics.fillStyle(fill, this.plusEnabled ? 0.88 : 0.55);
    this.graphics.fillCircle(this.plusCx, this.plusCy, this.plusR);
    this.graphics.lineStyle(1.4, stroke, strokeAlpha);
    this.graphics.strokeCircle(this.plusCx, this.plusCy, this.plusR);
  }

  private applyTextLayout(): void {
    const { x, y, width, height } = this.bounds;
    const pad = 8;
    const bottomRowY = y + height - pad - 11;

    this.title.setPosition(x + width * 0.5, y + pad + 2);

    const titleBottom = y + pad + 18;
    const bottomBand = 30;

    /** Half-in / half-out on the right edge, vertically centered. */
    this.plusR = Phaser.Math.Clamp(Math.floor(Math.min(width, height) * 0.1), 12, 22);
    this.plusCx = x + width;
    this.plusCy = y + height * 0.5;
    this.plusHit.setTo(this.plusCx, this.plusCy, this.plusR + 8);

    this.plusText.setPosition(this.plusCx, this.plusCy);

    const discGap = 6;
    const innerLeft = x + pad;
    const innerRight = x + width - pad - this.plusR - discGap;
    const innerTop = titleBottom;
    const innerBottom = y + height - pad - bottomBand;
    const innerW = Math.max(8, innerRight - innerLeft);
    const innerH = Math.max(8, innerBottom - innerTop);

    this.fitCountFontToRect(innerW, innerH);
    const countCx = innerLeft + innerW * 0.5;
    const countCy = innerTop + innerH * 0.5;
    this.countText.setPosition(countCx, countCy);

    const iconDisplay = Math.max(12, Math.min(20, this.plusR * 1.2));
    this.biomassIcon.setDisplaySize(iconDisplay, iconDisplay);

    const clusterRight = x + width - pad;
    this.costText.setOrigin(1, 0.5);
    this.costText.setPosition(clusterRight, bottomRowY);
    const iconGap = 5;
    this.biomassIcon.setPosition(
      clusterRight - this.costText.width - iconGap - iconDisplay * 0.5,
      bottomRowY,
    );
  }
}
