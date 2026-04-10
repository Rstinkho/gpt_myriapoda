import Phaser from 'phaser';
import type { HudSnapshot } from '@/game/types';

export class HUD {
  private readonly title: Phaser.GameObjects.Text;
  private readonly stats: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.title = scene.add.text(24, 20, 'MYRIAPODA', {
      fontFamily: 'Georgia',
      fontSize: '30px',
      color: '#eaf8da',
      stroke: '#071014',
      strokeThickness: 6,
    });
    this.title.setScrollFactor(0).setDepth(1000);

    this.stats = scene.add.text(24, 64, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '16px',
      color: '#d7f3df',
      lineSpacing: 6,
      stroke: '#071014',
      strokeThickness: 4,
    });
    this.stats.setScrollFactor(0).setDepth(1000);
  }

  layout(): void {
    this.title.setPosition(24, 20);
    this.stats.setPosition(24, 64);
  }

  setSnapshot(snapshot: HudSnapshot): void {
    const fillPercent = (snapshot.fillLevel / Math.max(1, snapshot.fillThreshold)) * 100;
    this.stats.setText([
      `Stomach ${snapshot.storedPickups} / ${snapshot.growthPickupGoal}  Spent ${snapshot.spentPickups}`,
      `Border ${fillPercent.toFixed(0)}%  Fill ${snapshot.fillLevel.toFixed(1)} / ${snapshot.fillThreshold.toFixed(1)}  Stage ${snapshot.stage}`,
      `Segments ${snapshot.segments}  Enemies ${snapshot.enemies}  Pickups ${snapshot.pickups}`,
      `Limb CD ${snapshot.attackCooldown.toFixed(1)}s  Active ${snapshot.activeLimbId ?? '-'}`,
      `Debug ${snapshot.debug ? 'ON' : 'OFF'}  Toggle TAB`,
    ]);
  }
}
