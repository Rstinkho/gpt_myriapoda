import * as Phaser from 'phaser';
import type { EvolutionScene } from '@/scenes/EvolutionScene';
import { deriveJitterSeed, drawJitteredRoundedRect } from '@/evolution/evolutionBorderStyle';
import { formatResourceCostIconPairs } from '@/evolution/evolutionData';
import {
  getEvolutionWorldBuildingSlotLayout,
  getEvolutionWorldBuildingsGridBounds,
  type EvolutionBuildingSlotLayout,
  type RectLike,
} from '@/evolution/evolutionLayout';
import type { EvolutionWorldBuildingAvailability } from '@/game/types';

const COST_ICON_SIZE = 12;
const COST_ROW_GAP = 2;
const CARD_RADIUS = 10;

export class EvolutionWorldBuildingsPanel {
  private readonly cardGraphics: Phaser.GameObjects.Graphics;
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly costIcons: Phaser.GameObjects.Image[][] = [];
  private readonly costAmountLabels: Phaser.GameObjects.Text[][] = [];
  private readonly hitZones: Phaser.GameObjects.Zone[] = [];
  private selectedHexBuildable = false;
  private hoveredIndex: number | null = null;
  private availabilityById = new Map<string, EvolutionWorldBuildingAvailability>();
  private sectionBounds: RectLike = { x: 0, y: 0, width: 1, height: 1 };
  private visible = true;

  constructor(
    private readonly scene: EvolutionScene,
    private readonly onBuildingSelected: (buildingId: string) => void,
  ) {
    this.cardGraphics = scene.add.graphics().setDepth(21.5);

    const slotCount = getEvolutionWorldBuildingSlotLayout({
      x: 0,
      y: 0,
      width: 260,
      height: 180,
    }).length;
    for (let i = 0; i < slotCount; i += 1) {
      this.icons.push(
        scene.add
          .image(0, 0, 'evo-building-0')
          .setDepth(21.6)
          .setOrigin(0.5, 0.5),
      );
      this.costIcons.push([]);
      this.costAmountLabels.push([]);
      const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(21.7);
      zone.setInteractive({ useHandCursor: true });
      this.hitZones.push(zone);
    }
  }

  setSelectedHexBuildable(buildable: boolean): void {
    this.selectedHexBuildable = buildable;
  }

  setCardState(availabilityById: ReadonlyMap<string, EvolutionWorldBuildingAvailability>): void {
    this.availabilityById = new Map(availabilityById);
    this.renderCurrentLayout();
  }

  layout(sectionBounds: RectLike): void {
    this.sectionBounds = { ...sectionBounds };
    this.renderCurrentLayout();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.cardGraphics.setVisible(visible);
    for (const img of this.icons) {
      img.setVisible(visible);
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
    this.cardGraphics.destroy();
    for (const img of this.icons) {
      img.destroy();
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
      zone.removeAllListeners();
      zone.destroy();
    }
  }

  private renderCurrentLayout(): void {
    const grid = getEvolutionWorldBuildingsGridBounds(this.sectionBounds);
    const slots = getEvolutionWorldBuildingSlotLayout(grid);

    this.cardGraphics.clear();
    this.cardGraphics.setVisible(this.visible);
    slots.forEach((slot, index) => {
      this.renderCardBackground(slot, index);
      this.positionIcon(slot, index);
      this.positionCostRow(index, slot);
      this.wireHoverZone(index, slot);
    });
  }

  private renderCardBackground(slot: EvolutionBuildingSlotLayout, index: number): void {
    const { rect } = slot;
    const seed = deriveJitterSeed(`building-${slot.id}`);
    const hovered = this.hoveredIndex === index;
    const availability = this.getAvailability(slot);
    const borderColor = slot.locked
      ? 0x567078
      : availability.allowed
        ? hovered
          ? 0xbef1ff
          : 0x6ee0c8
        : hovered
          ? 0x8fbec9
          : 0x536f76;
    const alpha = slot.locked
      ? 0.22
      : availability.allowed
        ? hovered
          ? 0.74
          : 0.58
        : hovered
          ? 0.44
          : 0.3;

    drawJitteredRoundedRect(this.cardGraphics, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      radius: CARD_RADIUS,
      seed,
      strokeWidth: 2,
      color: borderColor,
      alpha,
    });
  }

  private positionIcon(slot: EvolutionBuildingSlotLayout, index: number): void {
    const { rect } = slot;
    const icon = this.icons[index];
    const iconSize = Math.min(rect.width - 12, rect.height * 0.7);
    icon.setTexture(slot.textureKey);
    icon.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.42);
    icon.setDisplaySize(iconSize, iconSize);
    icon.setAlpha(slot.locked ? 0.36 : this.getAvailability(slot).allowed ? 1 : 0.56);
    icon.setVisible(this.visible);
  }

  private positionCostRow(index: number, slot: EvolutionBuildingSlotLayout): void {
    const entries = formatResourceCostIconPairs(slot.cost);
    const icons = this.costIcons[index];
    const amounts = this.costAmountLabels[index];
    const availability = this.getAvailability(slot);
    const alpha = slot.locked ? 0.34 : availability.allowed ? 1 : 0.54;

    while (icons.length < entries.length) {
      const icon = this.scene.add.image(0, 0, entries[icons.length].textureKey);
      icon.setDisplaySize(COST_ICON_SIZE, COST_ICON_SIZE);
      icon.setOrigin(0.5, 0.5).setDepth(21.66);
      icons.push(icon);

      const amount = this.scene.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#d6efe8',
      });
      amount.setOrigin(0, 0.5).setDepth(21.66);
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

    const centerX = slot.rect.x + slot.rect.width * 0.5;
    const rowY = slot.rect.y + slot.rect.height * 0.86;
    let cursorX = centerX - totalWidth * 0.5;
    for (let i = 0; i < icons.length; i += 1) {
      if (i < entries.length) {
        icons[i].setTexture(entries[i].textureKey);
        icons[i].setPosition(cursorX + COST_ICON_SIZE * 0.5, rowY);
        icons[i].setAlpha(alpha);
        icons[i].setVisible(this.visible);
        cursorX += COST_ICON_SIZE + COST_ROW_GAP;
        amounts[i].setPosition(cursorX, rowY);
        amounts[i].setAlpha(alpha);
        amounts[i].setColor(slot.locked ? '#6b8480' : availability.allowed ? '#d6efe8' : '#8ba19d');
        amounts[i].setVisible(this.visible);
        cursorX += amounts[i].width + COST_ROW_GAP * 2;
      } else {
        icons[i].setVisible(false);
        amounts[i].setVisible(false);
      }
    }
  }

  private wireHoverZone(index: number, slot: EvolutionBuildingSlotLayout): void {
    const zone = this.hitZones[index];
    const availability = this.getAvailability(slot);
    zone.setPosition(slot.rect.x, slot.rect.y);
    zone.setSize(slot.rect.width, slot.rect.height);
    zone.setVisible(this.visible);
    if (zone.input) {
      zone.input.enabled = this.visible;
    }
    zone.removeAllListeners();
    const rectCopy: RectLike = {
      x: slot.rect.x,
      y: slot.rect.y,
      width: slot.rect.width,
      height: slot.rect.height,
    };
    zone.on('pointerover', () => {
      this.hoveredIndex = index;
      const tooltip = this.scene.getTooltip();
      tooltip?.show({
        title: slot.name,
        description: slot.description,
        cost: slot.cost,
        meta: slot.locked
          ? 'LOCKED'
          : availability.allowed
            ? 'READY ON THIS HEX'
            : (availability.reason ?? `REQUIRES ${slot.requirement}`).toUpperCase(),
        anchorRect: rectCopy,
      });
      tooltip?.bringToTop();
      this.renderCurrentLayout();
    });
    zone.on('pointerout', () => {
      if (this.hoveredIndex === index) {
        this.hoveredIndex = null;
        this.scene.getTooltip()?.hide();
        this.renderCurrentLayout();
      }
    });
    zone.on('pointerdown', () => {
      if (slot.locked || !availability.allowed) {
        return;
      }
      this.onBuildingSelected(slot.id);
    });
  }

  private getAvailability(slot: EvolutionBuildingSlotLayout): EvolutionWorldBuildingAvailability {
    return (
      this.availabilityById.get(slot.id) ?? {
        allowed: this.selectedHexBuildable && !slot.locked,
        reason: this.selectedHexBuildable ? undefined : 'Select an owned buildable hex.',
      }
    );
  }
}
