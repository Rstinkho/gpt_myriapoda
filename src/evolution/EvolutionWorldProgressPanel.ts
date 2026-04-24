import * as Phaser from 'phaser';
import {
  deriveJitterSeed,
  drawJitteredRoundedRect,
  drawJitteredRoundedRectFill,
} from '@/evolution/evolutionBorderStyle';
import type { WorldProgressSnapshot } from '@/game/types';
import type { RectLike } from '@/evolution/evolutionLayout';

const PANEL_PADDING = 14;
const TITLE_GAP = 6;
const OBJECTIVE_GAP = 5;
const BAR_HEIGHT = 16;
/** Phaser throws if `setWordWrapWidth` is below one glyph width for the style. */
const MIN_WORD_WRAP_WIDTH = 80;

export class EvolutionWorldProgressPanel {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly stageLabel: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly header: Phaser.GameObjects.Text;
  private readonly objectiveTexts: Phaser.GameObjects.Text[] = [];
  private readonly progressLabel: Phaser.GameObjects.Text;
  private readonly progressValue: Phaser.GameObjects.Text;
  private bounds: RectLike = { x: 0, y: 0, width: 1, height: 1 };
  private snapshot: WorldProgressSnapshot | null = null;
  private visible = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(21.9);
    this.stageLabel = scene.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#8fd4c6',
        letterSpacing: 2.1,
      })
      .setDepth(22);
    this.title = scene.add
      .text(0, 0, '', {
        fontFamily: 'Georgia',
        fontSize: '18px',
        color: '#f6fbff',
        stroke: '#061014',
        strokeThickness: 4,
      })
      .setDepth(22);
    this.subtitle = scene.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '12px',
        color: '#cde7e1',
        lineSpacing: 4,
      })
      .setDepth(22);
    this.header = scene.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#88c9bc',
        letterSpacing: 1.8,
      })
      .setDepth(22);
    for (let index = 0; index < 5; index += 1) {
      this.objectiveTexts.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'Trebuchet MS',
            fontSize: '12px',
            color: '#e8fffb',
            lineSpacing: 3,
          })
          .setDepth(22),
      );
    }
    this.progressLabel = scene.add
      .text(0, 0, 'STAGE PROGRESS', {
        fontFamily: 'Trebuchet MS',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#88c9bc',
        letterSpacing: 1.8,
      })
      .setDepth(22);
    this.progressValue = scene.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f0fffb',
      })
      .setDepth(22)
      .setOrigin(1, 0);
  }

  setSnapshot(snapshot: WorldProgressSnapshot | null): void {
    this.snapshot = snapshot;
    this.render();
  }

  layout(bounds: RectLike): void {
    this.bounds = { ...bounds };
    this.render();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.graphics.setVisible(visible);
    this.stageLabel.setVisible(visible);
    this.title.setVisible(visible);
    this.subtitle.setVisible(visible);
    this.header.setVisible(visible);
    this.progressLabel.setVisible(visible);
    this.progressValue.setVisible(visible);
    for (const text of this.objectiveTexts) {
      text.setVisible(visible);
    }
    if (!visible) {
      this.graphics.clear();
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.stageLabel.destroy();
    this.title.destroy();
    this.subtitle.destroy();
    this.header.destroy();
    this.progressLabel.destroy();
    this.progressValue.destroy();
    for (const text of this.objectiveTexts) {
      text.destroy();
    }
  }

  private render(): void {
    if (!this.visible) {
      return;
    }

    this.graphics.clear();
    if (!this.snapshot || this.bounds.width <= 0 || this.bounds.height <= 0) {
      for (const text of this.objectiveTexts) {
        text.setVisible(false);
      }
      return;
    }

    const seed = deriveJitterSeed('evolution-world-progress-panel');
    drawJitteredRoundedRectFill(this.graphics, {
      x: this.bounds.x,
      y: this.bounds.y,
      width: this.bounds.width,
      height: this.bounds.height,
      radius: 18,
      seed,
      jitter: 1,
      color: 0x09161c,
      alpha: 0.92,
    });
    drawJitteredRoundedRect(this.graphics, {
      x: this.bounds.x,
      y: this.bounds.y,
      width: this.bounds.width,
      height: this.bounds.height,
      radius: 18,
      seed,
      jitter: 1,
      strokeWidth: 1.5,
      color: 0x8bd7ca,
      alpha: 0.5,
    });

    const innerWidth = Math.max(0, this.bounds.width - PANEL_PADDING * 2);
    const wordWrapWidth = Math.max(MIN_WORD_WRAP_WIDTH, innerWidth);
    let cursorY = this.bounds.y + PANEL_PADDING;

    const stageText = this.snapshot.isTutorial
      ? `TUTORIAL ${this.snapshot.stageIndex}/${this.snapshot.totalStages}`
      : `${this.snapshot.profileLabel.toUpperCase()}  LOOP ${this.snapshot.cycle + 1}`;
    this.stageLabel.setText(stageText);
    this.stageLabel.setPosition(this.bounds.x + PANEL_PADDING, cursorY);
    cursorY += this.stageLabel.height + 4;

    this.title.setText(this.snapshot.stageTitle.toUpperCase());
    this.title.setWordWrapWidth(wordWrapWidth, true);
    this.title.setPosition(this.bounds.x + PANEL_PADDING, cursorY);
    cursorY += this.title.height + TITLE_GAP;

    this.subtitle.setText(this.snapshot.stageSubtitle);
    this.subtitle.setWordWrapWidth(wordWrapWidth, true);
    this.subtitle.setPosition(this.bounds.x + PANEL_PADDING, cursorY);
    cursorY += this.subtitle.height + 8;

    this.header.setText(this.snapshot.objectiveHeader.toUpperCase());
    this.header.setPosition(this.bounds.x + PANEL_PADDING, cursorY);
    cursorY += this.header.height + 6;

    this.snapshot.objectives.forEach((objective, index) => {
      const text = this.objectiveTexts[index];
      const line = objective.showCounter
        ? `${objective.completed ? '[x]' : '[ ]'} ${objective.label}  ${objective.current}/${objective.target}`
        : `${objective.completed ? '[x]' : '[ ]'} ${objective.label}`;
      text.setText(line);
      text.setColor(objective.completed ? '#9ff5cf' : '#e8fffb');
      text.setAlpha(objective.completed ? 0.96 : 0.88);
      text.setWordWrapWidth(wordWrapWidth, true);
      text.setPosition(this.bounds.x + PANEL_PADDING, cursorY);
      text.setVisible(true);
      cursorY += text.height + OBJECTIVE_GAP;
    });

    for (let index = this.snapshot.objectives.length; index < this.objectiveTexts.length; index += 1) {
      this.objectiveTexts[index].setVisible(false);
    }

    const barY = this.bounds.y + this.bounds.height - PANEL_PADDING - BAR_HEIGHT;
    this.progressLabel.setPosition(this.bounds.x + PANEL_PADDING, barY - this.progressLabel.height - 4);
    this.progressValue.setText(
      `${this.snapshot.completedObjectiveCount}/${this.snapshot.objectiveCount}`,
    );
    this.progressValue.setPosition(
      this.bounds.x + this.bounds.width - PANEL_PADDING,
      barY - this.progressValue.height - 4,
    );

    drawJitteredRoundedRectFill(this.graphics, {
      x: this.bounds.x + PANEL_PADDING,
      y: barY,
      width: innerWidth,
      height: BAR_HEIGHT,
      radius: 10,
      seed: deriveJitterSeed('evolution-world-progress-bar-rail'),
      jitter: 0.8,
      color: 0x102026,
      alpha: 0.95,
    });
    drawJitteredRoundedRect(this.graphics, {
      x: this.bounds.x + PANEL_PADDING,
      y: barY,
      width: innerWidth,
      height: BAR_HEIGHT,
      radius: 10,
      seed: deriveJitterSeed('evolution-world-progress-bar-stroke'),
      jitter: 0.8,
      strokeWidth: 1.1,
      color: 0x79cabf,
      alpha: 0.42,
    });

    const progress01 = Phaser.Math.Clamp(this.snapshot.progress01, 0, 1);
    const fillWidth = Math.max(0, innerWidth * progress01);
    if (fillWidth > 4) {
      this.graphics.fillStyle(0x48d4aa, 0.72);
      this.graphics.fillRoundedRect(
        this.bounds.x + PANEL_PADDING + 2,
        barY + 2,
        Math.min(innerWidth - 4, fillWidth - 4),
        BAR_HEIGHT - 4,
        7,
      );
      this.graphics.fillStyle(0xf5fffa, 0.18);
      this.graphics.fillRoundedRect(
        this.bounds.x + PANEL_PADDING + 4,
        barY + 4,
        Math.max(0, Math.min(innerWidth - 8, fillWidth * 0.52)),
        Math.max(0, BAR_HEIGHT * 0.22),
        5,
      );
    }
  }
}
