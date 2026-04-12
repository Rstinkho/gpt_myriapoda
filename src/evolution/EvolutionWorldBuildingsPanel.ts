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
    }
  }

  layout(sectionBounds: RectLike): void {
    const grid = getEvolutionWorldBuildingsGridBounds(sectionBounds);
    const slots = getEvolutionWorldBuildingSlotLayout(grid);

    slots.forEach((slot, index) => {
      const icon = this.icons[index];
      const name = this.names[index];
      const { rect } = slot;
      const iconSize = Math.min(rect.width, rect.height) * 0.62;
      icon.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.38);
      icon.setDisplaySize(iconSize, iconSize);
      name.setText(slot.name);
      name.setWordWrapWidth(rect.width - 4, true);
      name.setPosition(rect.x + rect.width * 0.5, rect.y + rect.height * 0.72);
    });
  }

  setVisible(visible: boolean): void {
    for (const img of this.icons) {
      img.setVisible(visible);
    }
    for (const t of this.names) {
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
  }
}
