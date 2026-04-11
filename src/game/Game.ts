import * as Phaser from 'phaser';
import { createPhaserConfig } from '@/game/config';

export function createGame(): Phaser.Game {
  return new Phaser.Game(createPhaserConfig());
}
