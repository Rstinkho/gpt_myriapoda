import * as Phaser from 'phaser';
import { textureKeys } from '@/game/assets';
import {
  getEvolutionWorldBuildingSlotLayout,
  getEvolutionWorldBuildingsGridBounds,
  type RectLike,
} from '@/evolution/evolutionLayout';

export class EvolutionWorldBuildingsPanel {
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly names: Phaser.GameObjects.Text[] = [];
  private readonly costs: Phaser.GameObjects.Text[] = [];
  private readonly requirements: Phaser.GameObjects.Text[] = [];
  private selectedHexBuildable = false;

  constructor(scene: Phaser.Scene) {
    const keys = textureKeys.evolutionBuildings;
    for (let i = 0; i < keys.length; i += 1) {
      this.icons.push(
        scene.add
          .image(0, 0, keys[i])
          .setDepth(21.6)
          .setOrigin(0.5, 0.4),
      );
      this.names.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '9px',
            color: '#a8d4cc',
            letterSpacing: 0.4,
            align: 'center',
          })
          .setDepth(21.65)
          .setOrigin(0.5, 0),
      );
      this.costs.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '8px',
            color: '#d6efe8',
            letterSpacing: 0.2,
            align: 'center',
          })
          .setDepth(21.66)
          .setOrigin(0.5, 0),
      );
      this.requirements.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '8px',
            color: '#81beb1',
            letterSpacing: 0.5,
            align: 'center',
          })
          .setDepth(21.67)
          .setOrigin(0.5, 0),
      );
    }
  }

  setSelectedHexBuildable(buildable: boolean): void {
    this.selectedHexBuildable = buildable;
  }

  layout(sectionBounds: RectLike): void {
    const grid = getEvolutionWorldBuildingsGridBounds(sectionBounds);
    const slots = getEvolutionWorldBuildingSlotLayout(grid);

    slots.forEach((slot, index) => {
      const icon = this.icons[index];
      const name = this.names[index];
      const cost = this.costs[index];
      const requirement = this.requirements[index];
      const { rect } = slot;
      const iconSize = Math.min(rect.width, rect.height) * 0.62;
      icon.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.38);
      icon.setDisplaySize(iconSize, iconSize);
      name.setText(slot.name);
      name.setWordWrapWidth(rect.width - 4, true);
      name.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.66);
      cost.setText(slot.costLabel);
      cost.setWordWrapWidth(rect.width - 6, true);
      cost.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.82);
      requirement.setText(this.selectedHexBuildable ? 'READY ON THIS HEX' : slot.requirement.toUpperCase());
      requirement.setWordWrapWidth(rect.width - 6, true);
      requirement.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.92);
    });
  }

  setVisible(visible: boolean): void {
    for (const img of this.icons) {
      img.setVisible(visible);
    }
    for (const t of this.names) {
      t.setVisible(visible);
    }
    for (const t of this.costs) {
      t.setVisible(visible);
    }
    for (const t of this.requirements) {
      t.setVisible(visible);
    }
  }

  destroy(): void {
    for (const img of this.icons) {
      img.destroy();
    }
    for (const t of this.names) {
      t.destroy();
    }
    for (const t of this.costs) {
      t.destroy();
    }
    for (const t of this.requirements) {
      t.destroy();
    }
  }
}
