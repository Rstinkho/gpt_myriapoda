import Phaser from 'phaser';
import * as planck from 'planck';
import { textureKeys } from '@/game/assets';
import { tuning } from '@/game/tuning';
import { HeadBody } from '@/physics/bodies/HeadBody';

export class Head {
  readonly body: planck.Body;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, world: planck.World, x: number, y: number) {
    const headBody = new HeadBody(world, 'head', x, y);
    this.body = headBody.body;
    this.sprite = scene.add.image(x, y, textureKeys.head);
    this.sprite.setDisplaySize(tuning.headRadius * 2.6, tuning.headRadius * 2.6);
    this.sprite.setAlpha(0.8);
    this.sprite.setDepth(12);
  }
}
