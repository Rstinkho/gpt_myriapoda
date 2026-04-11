import * as Phaser from 'phaser';

type FilterableGameObject = Phaser.GameObjects.GameObject & {
  enableFilters(): Phaser.GameObjects.GameObject;
  readonly filters: Phaser.Types.GameObjects.FiltersInternalExternal | null;
};

interface GraphicsMaskControllerConfig {
  maskGraphics?: Phaser.GameObjects.Graphics;
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

export class GraphicsMaskController {
  readonly maskGraphics: Phaser.GameObjects.Graphics;
  readonly blurFilter: Phaser.Filters.Blur | null;

  private readonly scene: Phaser.Scene;
  private readonly attachments: Phaser.Filters.Mask[] = [];
  private readonly ownMaskGraphic: boolean;
  private readonly useInternal: boolean;
  private readonly invert: boolean;
  private readonly viewTransform: 'local' | 'world';
  private readonly scaleFactor: number;
  private readonly viewCamera?: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, config: GraphicsMaskControllerConfig = {}) {
    this.scene = scene;
    this.maskGraphics = config.maskGraphics ?? new Phaser.GameObjects.Graphics(scene);
    this.ownMaskGraphic = !config.maskGraphics;
    this.useInternal = config.useInternal ?? true;
    this.invert = config.invert ?? false;
    this.viewTransform = config.viewTransform ?? 'world';
    this.scaleFactor = config.scaleFactor ?? 1;
    this.viewCamera = config.viewCamera;

    if (config.scrollFactor !== undefined) {
      this.maskGraphics.setScrollFactor(config.scrollFactor);
    }

    if (config.maskDepth !== undefined) {
      this.maskGraphics.setDepth(config.maskDepth);
    }

    if (config.hideMaskGraphic ?? true) {
      this.maskGraphics.setVisible(false);
    }

    this.blurFilter =
      config.blurRadius && config.blurRadius > 0
        ? this.createBlurFilter(config)
        : null;
  }

  attach(target: FilterableGameObject): Phaser.Filters.Mask {
    const filterableTarget = target.enableFilters() as FilterableGameObject;
    const filters = filterableTarget.filters;

    if (!filters) {
      throw new Error('Unable to enable Phaser filters for masked display object.');
    }

    const maskFilter = (this.useInternal ? filters.internal : filters.external).addMask(
      this.maskGraphics,
      this.invert,
      this.viewCamera ?? this.scene.cameras.main,
      this.viewTransform,
      this.scaleFactor,
    );

    this.attachments.push(maskFilter);
    return maskFilter;
  }

  clear(): void {
    this.maskGraphics.clear();
    this.markDirty();
  }

  drawMask(draw: (graphics: Phaser.GameObjects.Graphics) => void): void {
    this.maskGraphics.fillStyle(0xffffff, 1);
    draw(this.maskGraphics);
    this.markDirty();
  }

  destroy(): void {
    for (const attachment of this.attachments) {
      attachment.destroy();
    }
    this.attachments.length = 0;

    this.blurFilter?.destroy();

    if (this.ownMaskGraphic) {
      this.maskGraphics.destroy();
    }
  }

  private createBlurFilter(config: GraphicsMaskControllerConfig): Phaser.Filters.Blur {
    const filters = this.maskGraphics.enableFilters().filters;

    if (!filters) {
      throw new Error('Unable to enable Phaser filters for masked mask graphic.');
    }

    const blurRadius = config.blurRadius ?? 0;
    const blur = filters.internal.addBlur(
      config.blurQuality ?? this.getBlurQuality(blurRadius),
      blurRadius,
      blurRadius,
      config.blurStrength ?? 1,
      config.blurColor ?? 0xffffff,
      config.blurSteps ?? 4,
    );

    blur.setPaddingOverride(null);

    return blur;
  }

  private getBlurQuality(blurRadius: number): number {
    if (blurRadius >= 24) {
      return 2;
    }

    if (blurRadius >= 12) {
      return 1;
    }

    return 0;
  }

  private markDirty(): void {
    for (const attachment of this.attachments) {
      attachment.needsUpdate = true;
    }
  }
}
