import * as Phaser from 'phaser';
import { BootScene } from '@/scenes/BootScene';
import { EvolutionScene } from '@/scenes/EvolutionScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { GameScene } from '@/scenes/GameScene';
import { UIScene } from '@/scenes/UIScene';

export function createPhaserConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent: 'app',
    backgroundColor: '#061015',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    input: {
      mouse: true,
      touch: true,
    },
    scene: [BootScene, PreloadScene, GameScene, UIScene, EvolutionScene],
    render: {
      antialias: true,
      pixelArt: false,
      selfShadow: true,
      powerPreference: 'high-performance',
    },
  };
}
