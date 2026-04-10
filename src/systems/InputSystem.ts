import Phaser from 'phaser';
import type { InputSnapshot } from '@/game/types';
import { normalize } from '@/utils/math';

export class InputSystem {
  private readonly keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private snapshot: InputSnapshot = {
    pointerWorldX: 0,
    pointerWorldY: 0,
    pointerDown: false,
    moveX: 0,
    moveY: 0,
  };

  constructor(scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.keys;
  }

  update(): void {
    const moveX = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    const moveY = Number(this.keys.down.isDown) - Number(this.keys.up.isDown);
    const normalized = normalize(moveX, moveY);

    this.snapshot = {
      pointerWorldX: 0,
      pointerWorldY: 0,
      pointerDown: false,
      moveX: normalized.x,
      moveY: normalized.y,
    };
  }

  getSnapshot(): InputSnapshot {
    return this.snapshot;
  }
}
