import Phaser from 'phaser';
import type { HudSnapshot } from '@/game/types';
import { getModeDotStates } from '@/ui/uiState';

export class TopHeader {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly titleLineOne: Phaser.GameObjects.Text;
  private readonly titleLineTwo: Phaser.GameObjects.Text;
  private readonly tabLabel: Phaser.GameObjects.Text;
  private uiMode: HudSnapshot['uiMode'] = 'minimal';

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0).setDepth(1000);

    this.titleLineOne = scene.add.text(0, 0, 'Myriapoda: PART I', {
      fontFamily: 'Georgia',
      fontSize: '30px',
      color: '#edf8ef',
      stroke: '#061014',
      strokeThickness: 6,
    });
    this.titleLineOne.setScrollFactor(0).setDepth(1001);

    this.titleLineTwo = scene.add.text(0, 0, 'The Darkest Deeps', {
      fontFamily: 'Palatino Linotype',
      fontStyle: 'italic',
      fontSize: '24px',
      color: '#bfe2de',
      stroke: '#061014',
      strokeThickness: 5,
    });
    this.titleLineTwo.setScrollFactor(0).setDepth(1001);

    this.tabLabel = scene.add.text(0, 0, 'TAB', {
      fontFamily: 'Trebuchet MS',
      fontSize: '15px',
      color: '#eaffff',
      letterSpacing: 2,
    });
    this.tabLabel.setOrigin(0.5).setScrollFactor(0).setDepth(1002);
  }

  layout(): void {
    this.titleLineOne.setPosition(24, 18);
    this.titleLineTwo.setPosition(26, 52);
    this.tabLabel.setPosition(68, 102);
    this.redraw();
  }

  setSnapshot(snapshot: HudSnapshot): void {
    this.uiMode = snapshot.uiMode;
    this.redraw();
  }

  private redraw(): void {
    this.graphics.clear();

    const pillX = 24;
    const pillY = 86;
    const pillWidth = 88;
    const pillHeight = 32;
    const [leftDotLit, rightDotLit] = getModeDotStates(this.uiMode);

    this.graphics.fillStyle(0x9fdfff, 0.09);
    this.graphics.lineStyle(1.5, 0xe6fbff, 0.38);
    this.graphics.fillRoundedRect(pillX, pillY, pillWidth, pillHeight, 16);
    this.graphics.strokeRoundedRect(pillX, pillY, pillWidth, pillHeight, 16);
    this.graphics.lineStyle(1, 0xffffff, 0.12);
    this.graphics.strokeRoundedRect(pillX + 3, pillY + 3, pillWidth - 6, pillHeight - 6, 13);

    this.drawModeDot(36, 136, leftDotLit);
    this.drawModeDot(68, 136, rightDotLit);
  }

  private drawModeDot(x: number, y: number, lit: boolean): void {
    if (lit) {
      this.graphics.fillStyle(0x9cf0ff, 0.22);
      this.graphics.fillCircle(x, y, 11);
    }

    this.graphics.fillStyle(lit ? 0xe8ffff : 0x53707c, lit ? 0.92 : 0.48);
    this.graphics.fillCircle(x, y, 7.5);
    this.graphics.lineStyle(1.4, lit ? 0xffffff : 0x8ab2bd, lit ? 0.4 : 0.2);
    this.graphics.strokeCircle(x, y, 7.5);
  }
}
