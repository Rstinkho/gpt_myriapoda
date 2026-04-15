import * as Phaser from 'phaser';
import {
  getEvolutionEnhancementTreeLayout,
  type RectLike,
} from '@/evolution/evolutionLayout';
import type { EvolutionUpgradeFamily } from '@/evolution/evolutionData';

export class EvolutionEnhancementBranch {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly sublabels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(21.5);
    const nodeCount = getEvolutionEnhancementTreeLayout({
      x: 0,
      y: 0,
      width: 600,
      height: 320,
    }, 'head').nodes.length;

    for (let i = 0; i < nodeCount; i += 1) {
      this.labels.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ecfff9',
            letterSpacing: 0.5,
            align: 'center',
            wordWrap: { width: 128 },
          })
          .setDepth(21.6)
          .setOrigin(0.5, 0.5),
      );
      this.sublabels.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '10px',
            color: '#8cc9b9',
            letterSpacing: 1.2,
            align: 'center',
          })
          .setDepth(21.6)
          .setOrigin(0.5, 0.5),
      );
    }
  }

  layout(bounds: RectLike, family: EvolutionUpgradeFamily): void {
    const layout = getEvolutionEnhancementTreeLayout(bounds, family);

    this.graphics.clear();

    for (const link of layout.links) {
      const from = layout.nodes.find((node) => node.id === link.fromId);
      const to = layout.nodes.find((node) => node.id === link.toId);
      if (!from || !to) {
        continue;
      }

      const startX = from.rect.x + from.rect.width;
      const startY = from.rect.y + from.rect.height * 0.5;
      const endX = to.rect.x;
      const endY = to.rect.y + to.rect.height * 0.5;
      const elbowX = startX + Math.max(24, (endX - startX) * 0.42);

      this.graphics.lineStyle(3.6, 0x072027, 0.5);
      this.graphics.beginPath();
      this.graphics.moveTo(startX, startY);
      this.graphics.lineTo(elbowX, startY);
      this.graphics.lineTo(elbowX, endY);
      this.graphics.lineTo(endX, endY);
      this.graphics.strokePath();

      this.graphics.lineStyle(1.8, 0x6deed6, 0.36);
      this.graphics.beginPath();
      this.graphics.moveTo(startX, startY);
      this.graphics.lineTo(elbowX, startY);
      this.graphics.lineTo(elbowX, endY);
      this.graphics.lineTo(endX, endY);
      this.graphics.strokePath();
    }

    layout.nodes.forEach((node, index) => {
      const { rect } = node;
      const cardInset = 4;
      this.graphics.fillStyle(node.locked ? 0x0b151c : 0x11252a, 0.94);
      this.graphics.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
      this.graphics.lineStyle(1.4, node.locked ? 0x81c9b7 : 0xcffdf6, node.locked ? 0.28 : 0.48);
      this.graphics.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
      this.graphics.lineStyle(1, 0xffffff, 0.12);
      this.graphics.strokeRoundedRect(
        rect.x + cardInset,
        rect.y + cardInset,
        rect.width - cardInset * 2,
        rect.height - cardInset * 2,
        9,
      );

      const label = this.labels[index];
      label.setText(node.label);
      label.setWordWrapWidth(Math.max(90, rect.width - 18), true);
      label.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.42);

      const sublabel = this.sublabels[index];
      sublabel.setText(node.sublabel);
      sublabel.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.73);
    });
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    for (const t of this.labels) {
      t.setVisible(visible);
    }
    for (const t of this.sublabels) {
      t.setVisible(visible);
    }
  }

  destroy(): void {
    this.graphics.destroy();
    for (const t of this.labels) {
      t.destroy();
    }
    for (const t of this.sublabels) {
      t.destroy();
    }
  }
}
