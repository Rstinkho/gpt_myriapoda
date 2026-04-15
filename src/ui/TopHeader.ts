import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import type { HudSnapshot } from '@/game/types';
import { getModeDotStates } from '@/ui/uiState';

const evolutionPillWidth = 42;
const evolutionPillGap = 14;

/** Top-left HUD layout (title + pill row). */
const HEADER_MARGIN_X = 28;
const TITLE_LINE_1_Y = 22;
const TITLE_LINE_2_Y = 60;
const PILL_ROW_Y = 98;
const CONQUEST_BANNER_Y = 152;

/** TAB pill: single row — label then two dots (same baseline / vertical center). */
const TAB_ROW_PAD_X = 14;
const TAB_TO_DOTS_GAP = 12;
const TAB_DOT_PITCH = 15;

function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

interface TopHeaderCallbacks {
  requestEvolutionOpen?: () => void;
  requestUiModeCycle?: () => void;
}

export class TopHeader {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly titleLineOne: Phaser.GameObjects.Text;
  private readonly titleLineTwo: Phaser.GameObjects.Text;
  private readonly tabLabel: Phaser.GameObjects.Text;
  private readonly evolutionLabel: Phaser.GameObjects.Text;
  private readonly conquestLabel: Phaser.GameObjects.Text;
  private readonly tabHitArea: Phaser.GameObjects.Zone;
  private readonly evolutionHitArea: Phaser.GameObjects.Zone;
  private tabHovered = false;
  private evolutionHovered = false;
  private uiMode: HudSnapshot['uiMode'] = 'minimal';
  private conquest: HudSnapshot['conquest'] = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: TopHeaderCallbacks = {},
  ) {
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
      fontSize: '17px',
      fontStyle: 'bold',
      color: accentColor,
      letterSpacing: 2,
    });
    this.tabLabel.setOrigin(0, 0.5).setScrollFactor(0).setDepth(1002);

    this.evolutionLabel = scene.add.text(0, 0, 'E', {
      fontFamily: 'Trebuchet MS',
      fontSize: '17px',
      fontStyle: 'bold',
      color: accentColor,
      letterSpacing: 2,
    });
    this.evolutionLabel.setOrigin(0.5).setScrollFactor(0).setDepth(1002);

    this.conquestLabel = scene.add.text(0, 0, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '12px',
      color: '#dffaff',
      lineSpacing: 4,
    });
    this.conquestLabel.setScrollFactor(0).setDepth(1002).setVisible(false);

    this.tabHitArea = scene.add.zone(0, 0, tuning.uiHeaderPillWidth, tuning.uiHeaderPillHeight);
    this.tabHitArea.setOrigin(0, 0).setScrollFactor(0).setDepth(1003);
    this.tabHitArea.setInteractive({ useHandCursor: true });
    this.tabHitArea.on('pointerover', this.handleTabOver, this);
    this.tabHitArea.on('pointerout', this.handleTabOut, this);
    this.tabHitArea.on('pointerdown', this.handleTabDown, this);

    this.evolutionHitArea = scene.add.zone(0, 0, evolutionPillWidth, tuning.uiHeaderPillHeight);
    this.evolutionHitArea.setOrigin(0, 0).setScrollFactor(0).setDepth(1003);
    this.evolutionHitArea.setInteractive({ useHandCursor: true });
    this.evolutionHitArea.on('pointerover', this.handleEvolutionOver, this);
    this.evolutionHitArea.on('pointerout', this.handleEvolutionOut, this);
    this.evolutionHitArea.on('pointerdown', this.handleEvolutionDown, this);
  }

  layout(): void {
    const tabX = HEADER_MARGIN_X;
    const tabY = PILL_ROW_Y;
    const evolutionX = tabX + tuning.uiHeaderPillWidth + evolutionPillGap;
    const evolutionY = tabY;
    const pillH = tuning.uiHeaderPillHeight;

    this.titleLineOne.setPosition(HEADER_MARGIN_X, TITLE_LINE_1_Y);
    this.titleLineTwo.setPosition(HEADER_MARGIN_X + 2, TITLE_LINE_2_Y);
    const rowY = tabY + pillH * 0.5;
    this.tabLabel.setPosition(tabX + TAB_ROW_PAD_X, rowY);
    this.evolutionLabel.setPosition(
      evolutionX + evolutionPillWidth * 0.5,
      evolutionY + pillH * 0.5,
    );
    this.tabHitArea.setPosition(tabX, tabY);
    this.tabHitArea.setSize(tuning.uiHeaderPillWidth, pillH);
    this.evolutionHitArea.setPosition(evolutionX, evolutionY);
    this.evolutionHitArea.setSize(evolutionPillWidth, pillH);
    this.conquestLabel.setPosition(HEADER_MARGIN_X + 14, CONQUEST_BANNER_Y + 10);
    this.redraw();
  }

  setSnapshot(snapshot: HudSnapshot): void {
    this.uiMode = snapshot.uiMode;
    this.conquest = snapshot.conquest;
    this.redraw();
  }

  private redraw(): void {
    this.graphics.clear();

    const pillX = HEADER_MARGIN_X;
    const pillY = PILL_ROW_Y;
    const pillWidth = tuning.uiHeaderPillWidth;
    const pillHeight = tuning.uiHeaderPillHeight;
    const pillRadius = pillHeight * 0.5;
    const rowY = pillY + pillHeight * 0.5;
    const leftDotX = pillX + TAB_ROW_PAD_X + this.tabLabel.width + TAB_TO_DOTS_GAP;
    const rightDotX = leftDotX + TAB_DOT_PITCH;
    const dotY = rowY;
    const [leftDotLit, rightDotLit] = getModeDotStates(this.uiMode);
    const evolutionX = pillX + pillWidth + evolutionPillGap;
    const evolutionRadius = pillHeight * 0.5;

    this.drawPill(
      pillX,
      pillY,
      pillWidth,
      pillHeight,
      pillRadius,
      this.tabHovered ? 0.2 : 0.09,
      this.tabHovered ? 0.74 : 0.38,
    );
    this.drawPill(
      evolutionX,
      pillY,
      evolutionPillWidth,
      pillHeight,
      evolutionRadius,
      this.evolutionHovered ? 0.22 : 0.12,
      this.evolutionHovered ? 0.78 : 0.46,
    );

    if (this.evolutionHovered) {
      this.graphics.fillStyle(tuning.uiPanelAccentColor, 0.12);
      this.graphics.fillCircle(
        evolutionX + evolutionPillWidth * 0.5,
        pillY + pillHeight * 0.5,
        18,
      );
    }

    this.drawModeDot(leftDotX, dotY, leftDotLit);
    this.drawModeDot(rightDotX, dotY, rightDotLit);

    if (this.conquest) {
      const bannerX = HEADER_MARGIN_X;
      const bannerY = CONQUEST_BANNER_Y;
      const bannerWidth = 268;
      const bannerHeight = 54;
      this.drawPill(bannerX, bannerY, bannerWidth, bannerHeight, 18, 0.15, 0.54);
      this.graphics.fillStyle(0x4ab8ff, 0.08);
      this.graphics.fillRoundedRect(bannerX + 6, bannerY + 6, bannerWidth - 12, bannerHeight - 12, 14);
      this.conquestLabel.setVisible(true);
      this.conquestLabel.setText(
        [
          `CONQUER ${this.conquest.coord.q},${this.conquest.coord.r}  ${this.conquest.playerInside ? 'INSIDE' : 'OUTSIDE'}`,
          `${Math.floor(this.conquest.occupiedSeconds)}/${Math.floor(this.conquest.occupiedGoalSeconds)}s  |  ${this.conquest.killCount}/${this.conquest.killGoal} LEECHES`,
        ].join('\n'),
      );
    } else {
      this.conquestLabel.setVisible(false);
      this.conquestLabel.setText('');
    }
  }

  destroy(): void {
    this.tabHitArea.off('pointerover', this.handleTabOver, this);
    this.tabHitArea.off('pointerout', this.handleTabOut, this);
    this.tabHitArea.off('pointerdown', this.handleTabDown, this);
    this.tabHitArea.destroy();
    this.evolutionHitArea.off('pointerover', this.handleEvolutionOver, this);
    this.evolutionHitArea.off('pointerout', this.handleEvolutionOut, this);
    this.evolutionHitArea.off('pointerdown', this.handleEvolutionDown, this);
    this.evolutionHitArea.destroy();
    this.conquestLabel.destroy();
    this.evolutionLabel.destroy();
    this.tabLabel.destroy();
    this.titleLineOne.destroy();
    this.titleLineTwo.destroy();
    this.graphics.destroy();
  }

  private drawPill(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillAlpha: number,
    strokeAlpha: number,
  ): void {
    this.graphics.fillStyle(tuning.uiPanelAccentColor, fillAlpha);
    this.graphics.lineStyle(1.5, tuning.uiPanelAccentColor, strokeAlpha);
    this.graphics.fillRoundedRect(x, y, width, height, radius);
    this.graphics.strokeRoundedRect(x, y, width, height, radius);
    this.graphics.lineStyle(1, 0xffffff, 0.12);
    this.graphics.strokeRoundedRect(
      x + 3,
      y + 3,
      width - 6,
      height - 6,
      Math.max(8, radius - 3),
    );
  }

  private handleTabOver(): void {
    this.tabHovered = true;
    this.redraw();
  }

  private handleTabOut(): void {
    this.tabHovered = false;
    this.redraw();
  }

  private handleTabDown(): void {
    this.callbacks.requestUiModeCycle?.();
  }

  private handleEvolutionOver(): void {
    this.evolutionHovered = true;
    this.redraw();
  }

  private handleEvolutionOut(): void {
    this.evolutionHovered = false;
    this.redraw();
  }

  private handleEvolutionDown(): void {
    this.callbacks.requestEvolutionOpen?.();
  }

  private drawModeDot(x: number, y: number, lit: boolean): void {
    const r = 5.2;
    if (lit) {
      this.graphics.fillStyle(tuning.uiPanelAccentColor, 0.2);
      this.graphics.fillCircle(x, y, 7.5);
    }

    this.graphics.fillStyle(lit ? tuning.uiPanelAccentColor : 0x53707c, lit ? 0.92 : 0.48);
    this.graphics.fillCircle(x, y, r);
    this.graphics.lineStyle(
      1.15,
      lit ? 0xffffff : tuning.uiPanelAccentColor,
      lit ? 0.4 : 0.2,
    );
    this.graphics.strokeCircle(x, y, r);
  }
}
