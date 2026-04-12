import * as Phaser from 'phaser';
import { registerEvolutionBuildingTextures } from '@/evolution/evolutionBuildingTextures';
import { textureKeys } from '@/game/assets';
import { pickupDefinitions } from '@/entities/pickups';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    this.createCircleTexture(textureKeys.head, 48, 0x8bd9b0, 0x2e4d42);
    for (const definition of pickupDefinitions) {
      this.createPickupTexture(definition.textureKey, 48, definition.buildTexture);
    }
    registerEvolutionBuildingTextures(this);

    this.scene.start('GameScene');
  }

  private createCircleTexture(key: string, size: number, fill: number, stroke: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(fill, 1);
    graphics.lineStyle(4, stroke, 1);
    graphics.fillCircle(size / 2, size / 2, size / 2 - 4);
    graphics.strokeCircle(size / 2, size / 2, size / 2 - 4);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private createPickupTexture(
    key: string,
    size: number,
    draw: (graphics: Phaser.GameObjects.Graphics, size: number) => void,
  ): void {
    const graphics = this.add.graphics();
    draw(graphics, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
