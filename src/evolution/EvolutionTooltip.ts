import * as Phaser from 'phaser';
import {
  deriveJitterSeed,
  drawJitteredRoundedRect,
  drawJitteredRoundedRectFill,
} from '@/evolution/evolutionBorderStyle';
import {
  formatResourceCostIconPairs,
  type ResourceCostIconEntry,
} from '@/evolution/evolutionData';
import type { ResourceCost } from '@/game/types';

interface TooltipAnchorRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TooltipContent {
  readonly title: string;
  readonly description: string;
  readonly cost?: ResourceCost;
  /**
   * Optional extra line placed below the description (e.g. a building's
   * requirement such as "Owned hex"). Rendered in a dim neutral tone.
   */
  readonly meta?: string;
  /** The rect on screen to anchor the tooltip next to, in scene-scale coords. */
  readonly anchorRect: TooltipAnchorRect;
}

const PANEL_WIDTH = 248;
const PANEL_PADDING = 12;
const LINE_GAP = 6;
const COST_ROW_ICON_SIZE = 16;
const COST_ROW_GAP = 10;
const COST_ROW_INTER_GAP = 4;

/**
 * Shared cRPG-style hover tooltip for the evolution screen. A single instance
 * lives on EvolutionScene; individual interactive widgets call `show()` /
 * `hide()` as pointers enter/leave their zones.
 *
 * Layout:
 *   [jittered dark panel]
 *     Title (bold, big)
 *     ---
 *     Description (body, word-wrapped)
 *     Cost: [icon] N  [icon] M
 *     Meta (requirement/etc, optional)
 */
export class EvolutionTooltip {
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly description: Phaser.GameObjects.Text;
  private readonly costLabel: Phaser.GameObjects.Text;
  private readonly meta: Phaser.GameObjects.Text;
  private readonly costIcons: Phaser.GameObjects.Image[] = [];
  private readonly costAmounts: Phaser.GameObjects.Text[] = [];
  private seedCounter = 1;

  constructor(private readonly scene: Phaser.Scene, depth: number) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(depth);
    this.container.setVisible(false);

    this.background = scene.add.graphics();
    this.container.add(this.background);

    this.title = scene.add.text(PANEL_PADDING, PANEL_PADDING, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#f0fffb',
      letterSpacing: 0.8,
    });
    this.container.add(this.title);

    this.description = scene.add.text(PANEL_PADDING, PANEL_PADDING, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '13px',
      color: '#cfe7e0',
      lineSpacing: 4,
      wordWrap: { width: PANEL_WIDTH - PANEL_PADDING * 2 },
    });
    this.container.add(this.description);

    this.costLabel = scene.add.text(PANEL_PADDING, PANEL_PADDING, 'COST', {
      fontFamily: 'Trebuchet MS',
      fontSize: '10px',
      color: '#8bc4b6',
      letterSpacing: 1.4,
    });
    this.container.add(this.costLabel);

    this.meta = scene.add.text(PANEL_PADDING, PANEL_PADDING, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '11px',
      color: '#81beb1',
      letterSpacing: 0.6,
      wordWrap: { width: PANEL_WIDTH - PANEL_PADDING * 2 },
    });
    this.container.add(this.meta);
  }

  destroy(): void {
    for (const icon of this.costIcons) {
      icon.destroy();
    }
    for (const label of this.costAmounts) {
      label.destroy();
    }
    this.costIcons.length = 0;
    this.costAmounts.length = 0;
    this.container.destroy();
  }

  /** Bring tooltip to the top of the scene so other UI can't draw over it. */
  bringToTop(): void {
    this.scene.children.bringToTop(this.container);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  show(content: TooltipContent): void {
    this.title.setText(content.title);
    this.description.setText(content.description);

    const costs = content.cost ? formatResourceCostIconPairs(content.cost) : [];
    this.applyCostRow(costs);
    this.costLabel.setVisible(costs.length > 0);

    if (content.meta && content.meta.length > 0) {
      this.meta.setText(content.meta.toUpperCase());
      this.meta.setVisible(true);
    } else {
      this.meta.setText('');
      this.meta.setVisible(false);
    }

    const height = this.layoutBodyAndMeasureHeight(costs.length);
    this.drawBackground(height);
    this.positionNear(content.anchorRect, height);
    this.container.setVisible(true);
  }

  private applyCostRow(entries: ResourceCostIconEntry[]): void {
    while (this.costIcons.length < entries.length) {
      const icon = this.scene.add.image(0, 0, entries[this.costIcons.length].textureKey);
      icon.setDisplaySize(COST_ROW_ICON_SIZE, COST_ROW_ICON_SIZE);
      icon.setOrigin(0, 0.5);
      this.container.add(icon);
      this.costIcons.push(icon);

      const amount = this.scene.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#f0fffb',
      });
      amount.setOrigin(0, 0.5);
      this.container.add(amount);
      this.costAmounts.push(amount);
    }

    for (let i = 0; i < this.costIcons.length; i += 1) {
      if (i < entries.length) {
        this.costIcons[i].setTexture(entries[i].textureKey);
        this.costIcons[i].setVisible(true);
        this.costAmounts[i].setText(String(entries[i].amount));
        this.costAmounts[i].setVisible(true);
      } else {
        this.costIcons[i].setVisible(false);
        this.costAmounts[i].setVisible(false);
      }
    }
  }

  private layoutBodyAndMeasureHeight(costCount: number): number {
    let cursorY = PANEL_PADDING;
    this.title.setPosition(PANEL_PADDING, cursorY);
    cursorY += this.title.height + LINE_GAP;

    this.description.setPosition(PANEL_PADDING, cursorY);
    cursorY += this.description.height + LINE_GAP;

    if (costCount > 0) {
      this.costLabel.setPosition(PANEL_PADDING, cursorY);
      cursorY += this.costLabel.height + 2;
      // Lay out cost entries left-to-right on the next line
      let rowX = PANEL_PADDING;
      const rowY = cursorY + COST_ROW_ICON_SIZE * 0.5;
      for (let i = 0; i < costCount; i += 1) {
        this.costIcons[i].setPosition(rowX, rowY);
        rowX += COST_ROW_ICON_SIZE + COST_ROW_INTER_GAP;
        this.costAmounts[i].setPosition(rowX, rowY);
        rowX += this.costAmounts[i].width + COST_ROW_GAP;
      }
      cursorY += COST_ROW_ICON_SIZE + LINE_GAP;
    }

    if (this.meta.visible) {
      this.meta.setPosition(PANEL_PADDING, cursorY);
      cursorY += this.meta.height + LINE_GAP;
    }

    return cursorY + PANEL_PADDING - LINE_GAP;
  }

  private drawBackground(height: number): void {
    this.background.clear();
    this.seedCounter = (this.seedCounter + 1) % 1_000_000;
    // Use a stable seed derived from "tooltip" + content title so the jitter
    // looks consistent while the tooltip is shown, and only changes between
    // distinct items.
    const seed = deriveJitterSeed(`tooltip-${this.title.text}`);
    drawJitteredRoundedRectFill(this.background, {
      x: 0,
      y: 0,
      width: PANEL_WIDTH,
      height,
      radius: 14,
      seed,
      color: 0x071619,
      alpha: 0.96,
    });
    drawJitteredRoundedRect(this.background, {
      x: 0,
      y: 0,
      width: PANEL_WIDTH,
      height,
      radius: 14,
      seed,
      strokeWidth: 2.2,
      color: 0x6ee0c8,
      alpha: 0.62,
    });
    drawJitteredRoundedRect(this.background, {
      x: 0,
      y: 0,
      width: PANEL_WIDTH,
      height,
      radius: 14,
      seed: seed + 1,
      strokeWidth: 0.9,
      color: 0xffffff,
      alpha: 0.08,
    });
  }

  private positionNear(anchor: TooltipAnchorRect, height: number): void {
    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;
    const margin = 10;

    // Prefer to the right of the anchor, flip to the left if it would overflow.
    let x = anchor.x + anchor.width + margin;
    if (x + PANEL_WIDTH > gameWidth - margin) {
      x = anchor.x - PANEL_WIDTH - margin;
    }
    if (x < margin) {
      x = margin;
    }

    let y = anchor.y;
    if (y + height > gameHeight - margin) {
      y = gameHeight - margin - height;
    }
    if (y < margin) {
      y = margin;
    }

    this.container.setPosition(x, y);
  }
}
