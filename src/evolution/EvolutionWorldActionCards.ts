import * as Phaser from 'phaser';
import {
  getEvolutionWorldActionCardLayout,
  type RectLike,
} from '@/evolution/evolutionLayout';
import type { EvolutionWorldActionId } from '@/evolution/evolutionData';

interface ActionAvailability {
  allowed: boolean;
  reason?: string;
}

export class EvolutionWorldActionCards {
  private readonly cardGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly iconGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly titles: Phaser.GameObjects.Text[] = [];
  private readonly costLabels: Phaser.GameObjects.Text[] = [];
  private readonly statusLabels: Phaser.GameObjects.Text[] = [];
  private readonly hitZones: Phaser.GameObjects.Zone[] = [];
  private availabilityById = new Map<EvolutionWorldActionId, ActionAvailability>();
  private activeActionId: EvolutionWorldActionId | null = null;
  private hoveredActionId: EvolutionWorldActionId | null = null;
  private bounds: RectLike = { x: 0, y: 0, width: 1, height: 1 };

  constructor(
    scene: Phaser.Scene,
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
      this.titles.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#f0fffb',
            align: 'center',
          })
          .setDepth(21.6)
          .setOrigin(0.5, 0.5),
      );
      this.costLabels.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '8px',
            color: '#daf3ed',
            align: 'center',
          })
          .setDepth(21.61)
          .setOrigin(0.5, 0.5),
      );
      this.statusLabels.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '9px',
            color: '#8aa89e',
            letterSpacing: 1.1,
            align: 'center',
          })
          .setDepth(21.62)
          .setOrigin(0.5, 0.5),
      );
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
      const title = this.titles[index];
      const costLabel = this.costLabels[index];
      const statusLabel = this.statusLabels[index];
      const zone = this.hitZones[index];
      const { rect } = card;
      const iconRadius = Math.min(
        18,
        rect.height * 0.2,
        rect.width * 0.22,
      );
      const iconCenterX = rect.x + rect.width * 0.5;
      const iconCenterY = rect.y + rect.height * 0.26;
      const isHovered = this.hoveredActionId === card.id;
      const isActive = this.activeActionId === card.id;
      const availability = this.availabilityById.get(card.id) ?? { allowed: !card.locked };
      const isAvailable = !card.locked && availability.allowed;

      cardG.clear();
      iconG.clear();

      cardG.fillStyle(
        isActive ? 0x10313d : isAvailable ? 0x08161d : 0x071015,
        isActive ? 0.98 : isAvailable ? 0.95 : 0.82,
      );
      cardG.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
      cardG.lineStyle(
        isActive ? 1.8 : 1.5,
        isActive ? 0xcff8ff : isHovered ? 0x9ee7ff : isAvailable ? 0xc8fff4 : 0x55717a,
        isActive ? 0.62 : isHovered ? 0.42 : isAvailable ? 0.34 : 0.18,
      );
      cardG.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
      cardG.lineStyle(1, 0xfff8e6, isAvailable ? 0.1 : 0.04);
      cardG.strokeRoundedRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8, 9);

      iconG.fillStyle(isAvailable ? 0x0f2730 : 0x09151a, isAvailable ? 0.82 : 0.72);
      iconG.fillCircle(iconCenterX, iconCenterY, iconRadius * 1.15);
      this.drawPremiumIcon(iconG, iconCenterX, iconCenterY, card.icon, iconRadius, isAvailable);

      title.setText(card.title);
      title.setWordWrapWidth(Math.max(48, rect.width - 10), true);
      title.setColor(isAvailable ? '#f0fffb' : '#8aa0a7');
      title.setPosition(iconCenterX, rect.y + rect.height * 0.52);

      costLabel.setText(card.costLabel ?? '');
      costLabel.setWordWrapWidth(Math.max(42, rect.width - 14), true);
      costLabel.setColor(isAvailable ? '#daf3ed' : '#688089');
      costLabel.setPosition(iconCenterX, rect.y + rect.height * 0.7);

      statusLabel.setText(
        card.locked
          ? 'LOCKED'
          : isActive
            ? 'PICK HEX'
            : isAvailable
              ? 'READY'
              : (availability.reason ?? 'UNAVAILABLE').toUpperCase(),
      );
      statusLabel.setColor(
        card.locked
          ? '#8aa89e'
          : isActive
            ? '#bff5ff'
            : isAvailable
              ? '#9be1d2'
              : '#8ca3ac',
      );
      statusLabel.setPosition(iconCenterX, rect.y + rect.height * 0.86);

      zone.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
      zone.setSize(rect.width, rect.height);
      zone.removeAllListeners();
      zone.on('pointerover', () => {
        this.hoveredActionId = card.id;
        this.render();
      });
      zone.on('pointerout', () => {
        if (this.hoveredActionId === card.id) {
          this.hoveredActionId = null;
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
    for (const g of this.cardGraphics) {
      g.setVisible(visible);
    }
    for (const g of this.iconGraphics) {
      g.setVisible(visible);
    }
    for (const t of this.titles) {
      t.setVisible(visible);
    }
    for (const t of this.costLabels) {
      t.setVisible(visible);
    }
    for (const t of this.statusLabels) {
      t.setVisible(visible);
    }
    for (const zone of this.hitZones) {
      zone.setVisible(visible);
      if (zone.input) {
        zone.input.enabled = visible;
      }
    }
  }

  destroy(): void {
    for (const g of this.cardGraphics) {
      g.destroy();
    }
    for (const g of this.iconGraphics) {
      g.destroy();
    }
    for (const t of this.titles) {
      t.destroy();
    }
    for (const t of this.costLabels) {
      t.destroy();
    }
    for (const t of this.statusLabels) {
      t.destroy();
    }
    for (const zone of this.hitZones) {
      zone.destroy();
    }
  }
}
