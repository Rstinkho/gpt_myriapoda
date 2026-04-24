import * as Phaser from 'phaser';
import type { EvolutionScene } from '@/scenes/EvolutionScene';
import {
  deriveJitterSeed,
  drawJitteredRoundedRect,
  drawJitteredRoundedRectFill,
} from '@/evolution/evolutionBorderStyle';
import {
  formatResourceCostIconPairs,
  type EvolutionWorldActionId,
} from '@/evolution/evolutionData';
import {
  getEvolutionWorldActionCardLayout,
  type EvolutionActionCardLayout,
  type RectLike,
} from '@/evolution/evolutionLayout';
import type { ResourceCost } from '@/game/types';

interface ActionAvailability {
  allowed: boolean;
  reason?: string;
  cost?: ResourceCost;
}

const COST_ICON_SIZE = 14;
const COST_ROW_GAP = 2;
const CARD_RADIUS = 12;

export class EvolutionWorldActionCards {
  private readonly cardGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly iconGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly costIcons: Phaser.GameObjects.Image[][] = [];
  private readonly costAmountLabels: Phaser.GameObjects.Text[][] = [];
  private readonly hitZones: Phaser.GameObjects.Zone[] = [];
  private availabilityById = new Map<EvolutionWorldActionId, ActionAvailability>();
  private activeActionId: EvolutionWorldActionId | null = null;
  private hoveredActionId: EvolutionWorldActionId | null = null;
  private bounds: RectLike = { x: 0, y: 0, width: 1, height: 1 };
  /**
   * Tracks panel visibility so positioning code can avoid setting cost icons
   * visible while the panel is hidden (the icons live in the scene root, not
   * a Container, so render() must consult this flag).
   */
  private visible = true;

  constructor(
    private readonly scene: EvolutionScene,
    private readonly onActionSelected: (actionId: EvolutionWorldActionId) => void,
  ) {
    const cardCount = getEvolutionWorldActionCardLayout({
      x: 0,
      y: 0,
      width: 260,
      height: 420,
    }).length;

    for (let i = 0; i < cardCount; i += 1) {
      this.cardGraphics.push(scene.add.graphics().setDepth(21.5));
      this.iconGraphics.push(scene.add.graphics().setDepth(21.55));
      this.costIcons.push([]);
      this.costAmountLabels.push([]);
      const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0.5).setDepth(21.7);
      zone.setInteractive({ useHandCursor: true });
      this.hitZones.push(zone);
    }
  }

  layout(bounds: RectLike): void {
    this.bounds = { ...bounds };
    this.render();
  }

  setCardState(
    activeActionId: EvolutionWorldActionId | null,
    availabilityById: ReadonlyMap<EvolutionWorldActionId, ActionAvailability>,
  ): void {
    this.activeActionId = activeActionId;
    this.availabilityById = new Map(availabilityById);
    this.render();
  }

  private render(): void {
    const cards = getEvolutionWorldActionCardLayout(this.bounds);

    cards.forEach((card, index) => {
      const cardG = this.cardGraphics[index];
      const iconG = this.iconGraphics[index];
      const zone = this.hitZones[index];
      const { rect } = card;
      // Larger icon now that the card no longer has a title row.
      const iconRadius = Math.min(28, rect.height * 0.32, rect.width * 0.34);
      const iconCenterX = rect.x + rect.width * 0.5;
      const iconCenterY = rect.y + rect.height * 0.42;
      const isHovered = this.hoveredActionId === card.id;
      const isActive = this.activeActionId === card.id;
      const availability = this.availabilityById.get(card.id) ?? { allowed: !card.locked };
      const isAvailable = !card.locked && availability.allowed;
      const displayCost = availability.cost ?? card.cost;

      cardG.clear();
      iconG.clear();
      cardG.setVisible(this.visible);
      iconG.setVisible(this.visible);

      const seed = deriveJitterSeed(`action-${card.id}`);
      drawJitteredRoundedRectFill(cardG, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        radius: CARD_RADIUS,
        seed,
        color: isActive ? 0x10313d : isAvailable ? 0x08161d : 0x071015,
        alpha: isActive ? 0.98 : isAvailable ? 0.95 : 0.82,
      });
      const borderColor = isActive
        ? 0xcff8ff
        : isHovered
          ? 0x9ee7ff
          : isAvailable
            ? 0xc8fff4
            : 0x55717a;
      const borderAlpha = isActive ? 0.68 : isHovered ? 0.52 : isAvailable ? 0.44 : 0.22;
      drawJitteredRoundedRect(cardG, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        radius: CARD_RADIUS,
        seed,
        strokeWidth: 1.8,
        color: borderColor,
        alpha: borderAlpha,
      });

      iconG.fillStyle(isAvailable ? 0x0f2730 : 0x09151a, isAvailable ? 0.82 : 0.72);
      iconG.fillCircle(iconCenterX, iconCenterY, iconRadius * 1.15);
      this.drawPremiumIcon(iconG, iconCenterX, iconCenterY, card.icon, iconRadius, isAvailable);

      // Cost row sits at the bottom of the card; full text moves to tooltip.
      this.positionCostRow(index, displayCost, iconCenterX, rect.y + rect.height * 0.84, isAvailable);

      zone.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
      zone.setSize(rect.width, rect.height);
      zone.setVisible(this.visible);
      if (zone.input) {
        zone.input.enabled = this.visible;
      }
      zone.removeAllListeners();
      const rectCopy: RectLike = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      const meta = card.locked
        ? 'LOCKED'
        : isActive
          ? 'PICK A HEX'
          : isAvailable
            ? 'READY'
            : (availability.reason ?? 'UNAVAILABLE').toUpperCase();
      zone.on('pointerover', () => {
        this.hoveredActionId = card.id;
        const tooltip = this.scene.getTooltip();
        tooltip?.show({
          title: card.title,
          description: card.description,
          cost: displayCost,
          meta,
          anchorRect: rectCopy,
        });
        tooltip?.bringToTop();
        this.render();
      });
      zone.on('pointerout', () => {
        if (this.hoveredActionId === card.id) {
          this.hoveredActionId = null;
          this.scene.getTooltip()?.hide();
          this.render();
        }
      });
      zone.on('pointerdown', () => {
        if (card.locked || !availability.allowed) {
          return;
        }
        this.onActionSelected(card.id);
      });
    });
  }

  private positionCostRow(
    index: number,
    cost: ResourceCost | undefined,
    centerX: number,
    rowY: number,
    isAvailable: boolean,
  ): void {
    const entries = cost ? formatResourceCostIconPairs(cost) : [];
    const icons = this.costIcons[index];
    const amounts = this.costAmountLabels[index];
    const alpha = isAvailable ? 1 : 0.5;

    while (icons.length < entries.length) {
      const icon = this.scene.add.image(0, 0, entries[icons.length].textureKey);
      icon.setDisplaySize(COST_ICON_SIZE, COST_ICON_SIZE);
      icon.setOrigin(0.5, 0.5).setDepth(21.61);
      icons.push(icon);

      const amount = this.scene.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#daf3ed',
      });
      amount.setOrigin(0, 0.5).setDepth(21.61);
      amounts.push(amount);
    }

    let totalWidth = 0;
    for (let i = 0; i < entries.length; i += 1) {
      amounts[i].setText(String(entries[i].amount));
      totalWidth += COST_ICON_SIZE + COST_ROW_GAP + amounts[i].width;
      if (i < entries.length - 1) {
        totalWidth += COST_ROW_GAP * 2;
      }
    }

    let cursorX = centerX - totalWidth * 0.5;
    for (let i = 0; i < icons.length; i += 1) {
      if (i < entries.length) {
        icons[i].setTexture(entries[i].textureKey);
        icons[i].setAlpha(alpha);
        icons[i].setPosition(cursorX + COST_ICON_SIZE * 0.5, rowY);
        icons[i].setVisible(this.visible);
        cursorX += COST_ICON_SIZE + COST_ROW_GAP;
        amounts[i].setAlpha(alpha);
        amounts[i].setColor(isAvailable ? '#daf3ed' : '#7fa097');
        amounts[i].setPosition(cursorX, rowY);
        amounts[i].setVisible(this.visible);
        cursorX += amounts[i].width + COST_ROW_GAP * 2;
      } else {
        icons[i].setVisible(false);
        amounts[i].setVisible(false);
      }
    }
  }

  private drawPremiumIcon(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    kind: 'conquer' | 'probe' | 'purify' | 'seed' | 'anchor',
    r: number,
    active: boolean,
  ): void {
    const alpha = active ? 0.88 : 0.4;
    g.lineStyle(2, active ? 0xe8fff8 : 0x8aa0a7, alpha);
    g.fillStyle(active ? 0x1a3d38 : 0x132127, active ? 0.4 : 0.22);
    switch (kind) {
      case 'conquer':
        g.strokePoints(
          [
            new Phaser.Math.Vector2(x, y - r),
            new Phaser.Math.Vector2(x + r * 0.86, y - r * 0.5),
            new Phaser.Math.Vector2(x + r * 0.86, y + r * 0.5),
            new Phaser.Math.Vector2(x, y + r),
            new Phaser.Math.Vector2(x - r * 0.86, y + r * 0.5),
            new Phaser.Math.Vector2(x - r * 0.86, y - r * 0.5),
          ],
          true,
          true,
        );
        g.lineBetween(x - r * 0.6, y, x + r * 0.6, y);
        g.lineBetween(x, y - r * 0.6, x, y + r * 0.6);
        break;
      case 'probe':
        g.strokeCircle(x, y, r);
        g.lineBetween(x - r * 0.5, y, x + r * 0.5, y);
        g.lineBetween(x, y - r * 0.5, x, y + r * 0.5);
        break;
      case 'purify':
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2;
          g.strokeLineShape(
            new Phaser.Geom.Line(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r),
          );
        }
        break;
      case 'seed':
        g.fillCircle(x, y - r * 0.2, r * 0.35);
        g.lineBetween(x, y + r * 0.1, x, y + r * 0.9);
        break;
      case 'anchor':
        g.lineBetween(x, y - r, x, y + r * 0.4);
        g.lineBetween(x - r * 0.7, y + r * 0.2, x + r * 0.7, y + r * 0.2);
        g.strokeCircle(x, y - r * 0.35, r * 0.35);
        break;
      default:
        break;
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const g of this.cardGraphics) {
      g.setVisible(visible);
    }
    for (const g of this.iconGraphics) {
      g.setVisible(visible);
    }
    for (const row of this.costIcons) {
      for (const icon of row) {
        icon.setVisible(visible);
      }
    }
    for (const row of this.costAmountLabels) {
      for (const label of row) {
        label.setVisible(visible);
      }
    }
    for (const zone of this.hitZones) {
      zone.setVisible(visible);
      if (zone.input) {
        zone.input.enabled = visible;
      }
    }
    if (!visible) {
      this.scene.getTooltip()?.hide();
    }
  }

  destroy(): void {
    for (const g of this.cardGraphics) {
      g.destroy();
    }
    for (const g of this.iconGraphics) {
      g.destroy();
    }
    for (const row of this.costIcons) {
      for (const icon of row) {
        icon.destroy();
      }
    }
    for (const row of this.costAmountLabels) {
      for (const label of row) {
        label.destroy();
      }
    }
    for (const zone of this.hitZones) {
      zone.destroy();
    }
  }
}
