import * as Phaser from 'phaser';
import { GraphicsMaskController } from '@/phaser/GraphicsMaskController';

interface MaskedGraphicsLayerConfig {
  contentDepth?: number;
  maskDepth?: number;
  scrollFactor?: number;
  hideMaskGraphic?: boolean;
  useInternal?: boolean;
  invert?: boolean;
  viewCamera?: Phaser.Cameras.Scene2D.Camera;
  viewTransform?: 'local' | 'world';
  scaleFactor?: number;
  blurRadius?: number;
  blurQuality?: number;
  blurSteps?: number;
  blurStrength?: number;
  blurColor?: number;
}

export class MaskedGraphicsLayer {
  readonly graphics: Phaser.GameObjects.Graphics;
  private readonly mask: GraphicsMaskController;

  constructor(scene: Phaser.Scene, config: MaskedGraphicsLayerConfig = {}) {
    this.graphics = scene.add.graphics();

    if (config.scrollFactor !== undefined) {
      this.graphics.setScrollFactor(config.scrollFactor);
    }

    if (config.contentDepth !== undefined) {
      this.graphics.setDepth(config.contentDepth);
    }

    this.mask = new GraphicsMaskController(scene, {
      maskDepth: config.maskDepth,
      scrollFactor: config.scrollFactor,
      hideMaskGraphic: config.hideMaskGraphic,
      useInternal: config.useInternal,
      invert: config.invert,
      viewCamera: config.viewCamera ?? scene.cameras.main,
      viewTransform: config.viewTransform ?? 'world',
      scaleFactor: config.scaleFactor,
      blurRadius: config.blurRadius,
      blurQuality: config.blurQuality,
      blurSteps: config.blurSteps,
      blurStrength: config.blurStrength,
      blurColor: config.blurColor,
    });
    this.mask.attach(this.graphics);
  }

  clear(): void {
    this.graphics.clear();
    this.mask.clear();
  }

  drawMask(draw: (graphics: Phaser.GameObjects.Graphics) => void): void {
    this.mask.drawMask(draw);
  }

  setRenderTransform(anchorX: number, anchorY: number, scale: number): void {
    this.graphics.setScale(scale);
    this.graphics.setPosition(anchorX * (1 - scale), anchorY * (1 - scale));
    this.mask.setRenderTransform(anchorX, anchorY, scale);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  destroy(): void {
    this.mask.destroy();
    this.graphics.destroy();
  }
}
