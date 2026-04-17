import * as Phaser from 'phaser';
import type { EvolutionScene } from '@/scenes/EvolutionScene';
import {
  deriveJitterSeed,
  drawJitteredRoundedRect,
  drawJitteredRoundedRectFill,
} from '@/evolution/evolutionBorderStyle';
import {
  formatResourceCostIconPairs,
  type EvolutionUpgradeFamily,
} from '@/evolution/evolutionData';
import {
  getEvolutionEnhancementTreeLayout,
  type EvolutionEnhancementNodeLayout,
  type RectLike,
} from '@/evolution/evolutionLayout';

interface NodeHoverZone {
  zone: Phaser.GameObjects.Zone;
  node: EvolutionEnhancementNodeLayout;
}

interface LinkGeometry {
  x1: number;
  y1: number;
  elbowX: number;
  y2: number;
  x2: number;
}

const NODE_JITTER = 0.7;
const NODE_CORNER_RADIUS = 11;
const COST_ICON_SIZE = 14;
const COST_ROW_GAP = 2;

/**
 * Renders the skill tree for the Myriapoda panel: animated connecting lines,
 * jittered-border cards, an icon+amount cost row, and hover tooltips.
 *
 * Two Graphics layers are used so the expensive node/card draw stays static
 * across frames while the cyan line overlay re-draws every frame for the
 * alpha pulse. Hover zones per node are recycled across layouts.
 */
export class EvolutionEnhancementBranch {
  private readonly linkUnderlay: Phaser.GameObjects.Graphics;
  private readonly linkOverlay: Phaser.GameObjects.Graphics;
  private readonly cardGraphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly costIcons: Phaser.GameObjects.Image[][] = [];
  private readonly costAmountLabels: Phaser.GameObjects.Text[][] = [];
  private readonly nodeZones: NodeHoverZone[] = [];
  private linkGeometry: LinkGeometry[] = [];
  private elapsed = 0;
  /**
   * Tracks whether the panel is currently shown. Cost icons/amounts live in
   * the scene, not in a Container, so position routines must consult this flag
   * before setting children visible — otherwise a layout pass run while the
   * panel is hidden (e.g. during a section switch) would leak children into
   * other panels.
   */
  private visible = true;

  constructor(private readonly scene: EvolutionScene) {
    this.linkUnderlay = scene.add.graphics().setDepth(21.3);
    this.linkOverlay = scene.add.graphics().setDepth(21.4);
    this.cardGraphics = scene.add.graphics().setDepth(21.5);

    const nodeCount = getEvolutionEnhancementTreeLayout(
      { x: 0, y: 0, width: 600, height: 320 },
      'head',
    ).nodes.length;

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
      this.costIcons.push([]);
      this.costAmountLabels.push([]);
    }
  }

  layout(bounds: RectLike, family: EvolutionUpgradeFamily): void {
    const layout = getEvolutionEnhancementTreeLayout(bounds, family);

    // Cache link endpoints so the overlay can redraw every frame without
    // recomputing layout geometry.
    this.linkGeometry = layout.links
      .map((link) => {
        const from = layout.nodes.find((node) => node.id === link.fromId);
        const to = layout.nodes.find((node) => node.id === link.toId);
        if (!from || !to) {
          return null;
        }
        const x1 = from.rect.x + from.rect.width;
        const y1 = from.rect.y + from.rect.height * 0.5;
        const x2 = to.rect.x;
        const y2 = to.rect.y + to.rect.height * 0.5;
        const elbowX = x1 + Math.max(24, (x2 - x1) * 0.42);
        return { x1, y1, elbowX, y2, x2 };
      })
      .filter((g): g is LinkGeometry => g !== null);

    this.redrawLinkUnderlay();
    // Static stroke snapshot so the first frame has a visible overlay.
    this.redrawLinkOverlay(1);

    this.cardGraphics.clear();
    layout.nodes.forEach((node, index) => {
      this.renderNodeCard(node);
      this.positionLabel(index, node);
      this.positionCostRow(index, node);
    });

    this.syncHoverZones(layout.nodes);
  }

  /**
   * Per-frame tick: advances the pulse phase and redraws the cyan line
   * overlay. Cards and underlay stay static. Called from EvolutionScene.update.
   */
  update(dtSeconds: number): void {
    this.elapsed += dtSeconds;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 1.4);
    this.redrawLinkOverlay(pulse);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.linkUnderlay.setVisible(visible);
    this.linkOverlay.setVisible(visible);
    this.cardGraphics.setVisible(visible);
    for (const t of this.labels) {
      t.setVisible(visible);
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
    for (const entry of this.nodeZones) {
      entry.zone.setVisible(visible);
      if (entry.zone.input) {
        entry.zone.input.enabled = visible;
      }
    }
    if (!visible) {
      this.scene.getTooltip()?.hide();
    }
  }

  destroy(): void {
    this.scene.getTooltip()?.hide();
    this.linkUnderlay.destroy();
    this.linkOverlay.destroy();
    this.cardGraphics.destroy();
    for (const t of this.labels) {
      t.destroy();
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
    for (const entry of this.nodeZones) {
      entry.zone.removeAllListeners();
      entry.zone.destroy();
    }
    this.nodeZones.length = 0;
  }

  private redrawLinkUnderlay(): void {
    this.linkUnderlay.clear();
    for (const g of this.linkGeometry) {
      this.linkUnderlay.lineStyle(3.6, 0x072027, 0.5);
      this.linkUnderlay.beginPath();
      this.linkUnderlay.moveTo(g.x1, g.y1);
      this.linkUnderlay.lineTo(g.elbowX, g.y1);
      this.linkUnderlay.lineTo(g.elbowX, g.y2);
      this.linkUnderlay.lineTo(g.x2, g.y2);
      this.linkUnderlay.strokePath();
    }
  }

  private redrawLinkOverlay(pulse01: number): void {
    const alpha = 0.28 + pulse01 * 0.18;
    this.linkOverlay.clear();
    for (const g of this.linkGeometry) {
      this.linkOverlay.lineStyle(1.8, 0x6deed6, alpha);
      this.linkOverlay.beginPath();
      this.linkOverlay.moveTo(g.x1, g.y1);
      this.linkOverlay.lineTo(g.elbowX, g.y1);
      this.linkOverlay.lineTo(g.elbowX, g.y2);
      this.linkOverlay.lineTo(g.x2, g.y2);
      this.linkOverlay.strokePath();
    }
  }

  private renderNodeCard(node: EvolutionEnhancementNodeLayout): void {
    const seed = deriveJitterSeed(`skill-${node.id}-${node.column}-${node.row}`);
    const fillColor = node.locked ? 0x0b151c : 0x11252a;
    const borderColor = node.locked ? 0x81c9b7 : 0xcffdf6;
    const borderAlpha = node.locked ? 0.32 : 0.58;

    drawJitteredRoundedRectFill(this.cardGraphics, {
      x: node.rect.x,
      y: node.rect.y,
      width: node.rect.width,
      height: node.rect.height,
      radius: NODE_CORNER_RADIUS,
      seed,
      jitter: NODE_JITTER,
      color: fillColor,
      alpha: 0.94,
    });
    drawJitteredRoundedRect(this.cardGraphics, {
      x: node.rect.x,
      y: node.rect.y,
      width: node.rect.width,
      height: node.rect.height,
      radius: NODE_CORNER_RADIUS,
      seed,
      jitter: NODE_JITTER,
      strokeWidth: 2.2,
      color: borderColor,
      alpha: borderAlpha,
    });
  }

  private positionLabel(index: number, node: EvolutionEnhancementNodeLayout): void {
    const label = this.labels[index];
    label.setText(node.label);
    label.setWordWrapWidth(Math.max(90, node.rect.width - 18), true);
    label.setPosition(node.rect.x + node.rect.width * 0.5, node.rect.y + node.rect.height * 0.38);
    label.setVisible(this.visible);
  }

  private positionCostRow(index: number, node: EvolutionEnhancementNodeLayout): void {
    const entries = formatResourceCostIconPairs(node.cost);
    const icons = this.costIcons[index];
    const amounts = this.costAmountLabels[index];
    const alpha = node.locked ? 0.55 : 1;

    while (icons.length < entries.length) {
      const icon = this.scene.add.image(0, 0, entries[icons.length].textureKey);
      icon.setDisplaySize(COST_ICON_SIZE, COST_ICON_SIZE);
      icon.setOrigin(0.5, 0.5).setDepth(21.6);
      icons.push(icon);

      const amount = this.scene.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#d9f7ee',
      });
      amount.setOrigin(0, 0.5).setDepth(21.6);
      amounts.push(amount);
    }

    // Pre-measure the row so we can center it horizontally in the card.
    let totalWidth = 0;
    for (let i = 0; i < entries.length; i += 1) {
      amounts[i].setText(String(entries[i].amount));
      totalWidth += COST_ICON_SIZE + COST_ROW_GAP + amounts[i].width;
      if (i < entries.length - 1) {
        totalWidth += COST_ROW_GAP * 2;
      }
    }

    const rowY = node.rect.y + node.rect.height * 0.74;
    let cursorX = node.rect.x + node.rect.width * 0.5 - totalWidth * 0.5;
    for (let i = 0; i < icons.length; i += 1) {
      if (i < entries.length) {
        icons[i].setTexture(entries[i].textureKey);
        icons[i].setAlpha(alpha);
        icons[i].setPosition(cursorX + COST_ICON_SIZE * 0.5, rowY);
        icons[i].setVisible(this.visible);
        cursorX += COST_ICON_SIZE + COST_ROW_GAP;
        amounts[i].setAlpha(alpha);
        amounts[i].setPosition(cursorX, rowY);
        amounts[i].setVisible(this.visible);
        cursorX += amounts[i].width + COST_ROW_GAP * 2;
      } else {
        icons[i].setVisible(false);
        amounts[i].setVisible(false);
      }
    }
  }

  private syncHoverZones(nodes: readonly EvolutionEnhancementNodeLayout[]): void {
    while (this.nodeZones.length < nodes.length) {
      const zone = this.scene.add.zone(0, 0, 10, 10);
      zone.setOrigin(0, 0).setDepth(21.7);
      zone.setInteractive({ useHandCursor: true });
      this.nodeZones.push({ zone, node: nodes[this.nodeZones.length] });
    }
    for (let i = 0; i < this.nodeZones.length; i += 1) {
      const entry = this.nodeZones[i];
      if (i < nodes.length) {
        const node = nodes[i];
        entry.node = node;
        entry.zone.setPosition(node.rect.x, node.rect.y);
        entry.zone.setSize(node.rect.width, node.rect.height);
        entry.zone.removeAllListeners();
        entry.zone.setVisible(this.visible);
        if (entry.zone.input) {
          entry.zone.input.enabled = this.visible;
        }
        const rect = node.rect;
        entry.zone.on('pointerover', () => {
          const tooltip = this.scene.getTooltip();
          tooltip?.show({
            title: node.label,
            description: node.description,
            cost: node.cost,
            meta: node.locked ? 'LOCKED' : undefined,
            anchorRect: rect,
          });
          tooltip?.bringToTop();
        });
        entry.zone.on('pointerout', () => {
          this.scene.getTooltip()?.hide();
        });
      } else {
        entry.zone.setVisible(false);
        if (entry.zone.input) {
          entry.zone.input.enabled = false;
        }
        entry.zone.removeAllListeners();
      }
    }
  }
}
