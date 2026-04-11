import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import type { HudSnapshot } from '@/game/types';
import { getModeDotStates } from '@/ui/uiState';

function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export class TopHeader {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly titleLineOne: Phaser.GameObjects.Text;
  private readonly titleLineTwo: Phaser.GameObjects.Text;
  private readonly tabLabel: Phaser.GameObjects.Text;
  private uiMode: HudSnapshot['uiMode'] = 'minimal';

  constructor(private readonly scene: Phaser.Scene) {
    const accentColor = toCssHex(tuning.uiPanelAccentColor);
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
      color: accentColor,
      stroke: '#061014',
      strokeThickness: 5,
    });
    this.titleLineTwo.setScrollFactor(0).setDepth(1001);

    this.tabLabel = scene.add.text(0, 0, 'TAB', {
      fontFamily: 'Trebuchet MS',
      fontSize: '15px',
      color: accentColor,
      letterSpacing: 2,
    });
    this.tabLabel.setOrigin(0.5).setScrollFactor(0).setDepth(1002);
  }

  layout(): void {
    this.titleLineOne.setPosition(24, 18);
    this.titleLineTwo.setPosition(26, 52);
    this.tabLabel.setPosition(
      24 + tuning.uiHeaderPillWidth * 0.5,
      86 + tuning.uiHeaderPillHeight * 0.5,
    );
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
    const pillWidth = tuning.uiHeaderPillWidth;
    const pillHeight = tuning.uiHeaderPillHeight;
    const pillRadius = pillHeight * 0.5;
    const leftDotX = pillX + pillWidth * (12 / 88);
    const rightDotX = pillX + pillWidth * 0.5;
    const dotY = pillY + pillHeight + 18;
    const [leftDotLit, rightDotLit] = getModeDotStates(this.uiMode);

    this.graphics.fillStyle(tuning.uiPanelAccentColor, 0.09);
    this.graphics.lineStyle(1.5, tuning.uiPanelAccentColor, 0.38);
    this.graphics.fillRoundedRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
    this.graphics.strokeRoundedRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
    this.graphics.lineStyle(1, 0xffffff, 0.12);
    this.graphics.strokeRoundedRect(
      pillX + 3,
      pillY + 3,
      pillWidth - 6,
      pillHeight - 6,
      Math.max(8, pillRadius - 3),
    );

    this.drawModeDot(leftDotX, dotY, leftDotLit);
    this.drawModeDot(rightDotX, dotY, rightDotLit);
  }

  private drawModeDot(x: number, y: number, lit: boolean): void {
    if (lit) {
      this.graphics.fillStyle(tuning.uiPanelAccentColor, 0.22);
      this.graphics.fillCircle(x, y, 11);
    }

    this.graphics.fillStyle(lit ? tuning.uiPanelAccentColor : 0x53707c, lit ? 0.92 : 0.48);
    this.graphics.fillCircle(x, y, 7.5);
    this.graphics.lineStyle(
      1.4,
      lit ? 0xffffff : tuning.uiPanelAccentColor,
      lit ? 0.4 : 0.2,
    );
    this.graphics.strokeCircle(x, y, 7.5);
  }
}
