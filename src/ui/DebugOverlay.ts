import Phaser from 'phaser';
import type { HudSnapshot } from '@/game/types';

export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.text = scene.add.text(0, 0, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#9ddbb5',
      align: 'right',
      stroke: '#030607',
      strokeThickness: 4,
    });
    this.text.setScrollFactor(0).setDepth(1000).setOrigin(1, 0);
  }

  layout(): void {
    this.text.setPosition(this.scene.scale.width - 24, 20);
  }

  setSnapshot(snapshot: HudSnapshot): void {
    this.text.setVisible(snapshot.debug);
    this.text.setText([
      `world stage: ${snapshot.stage}`,
      `segment count: ${snapshot.segments}`,
      `enemy count: ${snapshot.enemies}`,
      `pickup count: ${snapshot.pickups}`,
      `limb cd: ${snapshot.attackCooldown.toFixed(2)}s`,
      `fill ratio: ${(snapshot.fillLevel / Math.max(1, snapshot.fillThreshold)).toFixed(2)}`,
    ]);
  }
}
