import * as Phaser from 'phaser';

interface MaskedGraphicsLayerConfig {
  contentDepth?: number;
  maskDepth?: number;
  scrollFactor?: number;
  hideMaskGraphic?: boolean;
}

export class MaskedGraphicsLayer {
  readonly graphics: Phaser.GameObjects.Graphics;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly maskFilter: Phaser.Filters.Mask;

  constructor(scene: Phaser.Scene, config: MaskedGraphicsLayerConfig = {}) {
    this.graphics = scene.add.graphics();
    this.maskGraphics = new Phaser.GameObjects.Graphics(scene);

    if (config.scrollFactor !== undefined) {
      this.graphics.setScrollFactor(config.scrollFactor);
      this.maskGraphics.setScrollFactor(config.scrollFactor);
    }

    if (config.contentDepth !== undefined) {
      this.graphics.setDepth(config.contentDepth);
    }

    if (config.maskDepth !== undefined) {
      this.maskGraphics.setDepth(config.maskDepth);
    }

    if (config.hideMaskGraphic ?? true) {
      this.maskGraphics.setVisible(false);
    }

    const filters = this.graphics.enableFilters().filters;
    if (!filters) {
      throw new Error('Unable to enable Phaser filters for masked graphics layer.');
    }

    this.maskFilter = filters.internal.addMask(
      this.maskGraphics,
      false,
      scene.cameras.main,
      'world',
    );
  }

  clear(): void {
    this.graphics.clear();
    this.maskGraphics.clear();
  }

  drawMask(draw: (graphics: Phaser.GameObjects.Graphics) => void): void {
    this.maskGraphics.fillStyle(0xffffff, 1);
    draw(this.maskGraphics);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  destroy(): void {
    this.maskFilter.destroy();
    this.graphics.destroy();
    this.maskGraphics.destroy();
  }
}
