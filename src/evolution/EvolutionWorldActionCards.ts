import * as Phaser from 'phaser';
import {
  getEvolutionWorldActionCardLayout,
  type RectLike,
} from '@/evolution/evolutionLayout';

export class EvolutionWorldActionCards {
  private readonly cardGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly iconGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly titles: Phaser.GameObjects.Text[] = [];
  private readonly lockedLabels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
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
      this.lockedLabels.push(
        scene.add
          .text(0, 0, 'LOCKED', {
            fontFamily: 'Trebuchet MS',
            fontSize: '9px',
            color: '#8aa89e',
            letterSpacing: 1.2,
            align: 'center',
          })
          .setDepth(21.6)
          .setOrigin(0.5, 0.5),
      );
    }
  }

  layout(bounds: RectLike): void {
    const cards = getEvolutionWorldActionCardLayout(bounds);

    cards.forEach((card, index) => {
      const cardG = this.cardGraphics[index];
      const iconG = this.iconGraphics[index];
      const title = this.titles[index];
      const locked = this.lockedLabels[index];
      const { rect } = card;
      const iconRadius = Math.min(
        18,
        rect.height * 0.2,
        rect.width * 0.22,
      );
      const iconCenterX = rect.x + rect.width * 0.5;
      const iconCenterY = rect.y + rect.height * 0.3;

      cardG.clear();
      iconG.clear();

      cardG.fillStyle(0x08161d, 0.95);
      cardG.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
      cardG.lineStyle(1.5, 0xc8fff4, 0.34);
      cardG.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
      cardG.lineStyle(1, 0xfff8e6, 0.1);
      cardG.strokeRoundedRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8, 9);

      iconG.fillStyle(0x0f2730, 0.82);
      iconG.fillCircle(iconCenterX, iconCenterY, iconRadius * 1.15);
      this.drawPremiumIcon(iconG, iconCenterX, iconCenterY, card.icon, iconRadius);

      title.setText(card.title);
      title.setWordWrapWidth(Math.max(48, rect.width - 10), true);
      title.setPosition(iconCenterX, rect.y + rect.height * 0.58);

      locked.setPosition(iconCenterX, rect.y + rect.height * 0.82);
    });
  }

  private drawPremiumIcon(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    kind: 'probe' | 'purify' | 'seed' | 'anchor',
    r: number,
  ): void {
    g.lineStyle(2, 0xe8fff8, 0.88);
    g.fillStyle(0x1a3d38, 0.4);
    switch (kind) {
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
    for (const t of this.lockedLabels) {
      t.setVisible(visible);
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
    for (const t of this.lockedLabels) {
      t.destroy();
    }
  }
}
