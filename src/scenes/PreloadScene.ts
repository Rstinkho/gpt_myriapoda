import Phaser from 'phaser';
import { textureKeys } from '@/game/assets';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    this.createCircleTexture(textureKeys.head, 48, 0x8bd9b0, 0x2e4d42);
    this.createPolygonTexture(textureKeys.pickupTriangle, [24, 2, 44, 38, 4, 38], 48, 48, 0xe9db75);
    this.createPolygonTexture(textureKeys.pickupCrystal, [24, 0, 42, 16, 34, 44, 14, 44, 6, 16], 48, 48, 0x78d8ff);
    this.createPolygonTexture(textureKeys.pickupBone, [10, 10, 18, 6, 24, 10, 30, 6, 38, 10, 34, 24, 38, 38, 30, 42, 24, 38, 18, 42, 10, 38, 14, 24], 48, 48, 0xf4e3c6);

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

  private createPolygonTexture(
    key: string,
    points: number[],
    width: number,
    height: number,
    fill: number,
  ): void {
    const graphics = this.add.graphics();
    const polygon = new Phaser.Geom.Polygon(points);
    graphics.fillStyle(fill, 1);
    graphics.lineStyle(3, 0x102028, 0.9);
    graphics.fillPoints(polygon.points, true);
    graphics.strokePoints(polygon.points, true, true);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}
