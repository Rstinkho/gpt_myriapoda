import * as Phaser from 'phaser';
import { GameEvents } from '@/game/events';
import { tuning } from '@/game/tuning';
import type { ExpansionEvent, HudSnapshot } from '@/game/types';
import { StatusPanel } from '@/ui/StatusPanel';
import { TopHeader } from '@/ui/TopHeader';

const transitionFlashDepth = 1100.1;

interface UISceneData {
  eventBus: Phaser.Events.EventEmitter;
  getSnapshot: () => HudSnapshot;
  requestEvolutionOpen: () => void;
  requestUiModeCycle?: () => void;
}

export class UIScene extends Phaser.Scene {
  private topHeader?: TopHeader;
  private statusPanel?: StatusPanel;
  private eventBus?: Phaser.Events.EventEmitter;
  private getSnapshot?: () => HudSnapshot;
  private requestEvolutionOpen?: () => void;
  private requestUiModeCycle?: () => void;
  private transitionFlashGraphics?: Phaser.GameObjects.Graphics;
  private transitionActive = false;
  private transitionElapsedMs = 0;

  constructor() {
    super('UIScene');
  }

  init(data: UISceneData): void {
    this.eventBus = data.eventBus;
    this.getSnapshot = data.getSnapshot;
    this.requestEvolutionOpen = data.requestEvolutionOpen;
    this.requestUiModeCycle = data.requestUiModeCycle;
  }

  create(): void {
    this.topHeader = new TopHeader(this, {
      requestEvolutionOpen: () => this.requestEvolutionOpen?.(),
      requestUiModeCycle: () => this.requestUiModeCycle?.(),
    });
    this.statusPanel = new StatusPanel(this);
    this.createTransitionOverlay();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.scale.on('resize', this.handleResize, this);
    this.handleResize();
    this.refresh();

    this.eventBus?.on(GameEvents.hudChanged, this.refresh, this);
    this.eventBus?.on(GameEvents.worldExpanded, this.handleWorldExpanded, this);
  }

  update(_time: number, deltaMs: number): void {
    this.updateTransitionOverlay(deltaMs);
  }

  private handleResize(): void {
    this.topHeader?.layout();
    this.statusPanel?.layout();
    if (this.transitionActive) {
      this.renderTransitionOverlay(this.getTransitionProgress());
    }
  }

  private refresh(): void {
    if (!this.getSnapshot) {
      return;
    }

    const snapshot = this.getSnapshot();
    this.topHeader?.setSnapshot(snapshot);
    this.statusPanel?.setSnapshot(snapshot);
  }

  private handleWorldExpanded(_payload: ExpansionEvent): void {
    this.transitionActive = true;
    this.transitionElapsedMs = 0;
    this.transitionFlashGraphics?.setVisible(true);
    this.renderTransitionOverlay(0);
  }

  private updateTransitionOverlay(deltaMs: number): void {
    if (!this.transitionActive) {
      return;
    }

    const duration = Math.max(1, tuning.transitionFxDurationMs);
    this.transitionElapsedMs = Math.min(duration, this.transitionElapsedMs + deltaMs);
    const progress = this.getTransitionProgress();
    this.renderTransitionOverlay(progress);

    if (progress >= 1) {
      this.transitionActive = false;
      this.clearTransitionOverlay();
    }
  }

  private getTransitionProgress(): number {
    return Phaser.Math.Clamp(
      this.transitionElapsedMs / Math.max(1, tuning.transitionFxDurationMs),
      0,
      1,
    );
  }

  private createTransitionOverlay(): void {
    this.transitionFlashGraphics = this.add.graphics();
    this.transitionFlashGraphics
      .setScrollFactor(0)
      .setDepth(transitionFlashDepth)
      .setVisible(false);
  }

  private renderTransitionOverlay(progress: number): void {
    if (!this.transitionFlashGraphics) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const envelope = Math.sin(progress * Math.PI);

    this.transitionFlashGraphics.clear();
    this.transitionFlashGraphics.fillStyle(
      0xffffff,
      tuning.transitionFxFlashAlpha * envelope * 0.32,
    );
    this.transitionFlashGraphics.fillRect(0, 0, width, height);
  }

  private clearTransitionOverlay(): void {
    this.transitionFlashGraphics?.clear();
    this.transitionFlashGraphics?.setVisible(false);
  }

  private destroyTransitionOverlay(): void {
    this.transitionFlashGraphics?.destroy();
    this.transitionFlashGraphics = undefined;
    this.transitionActive = false;
    this.transitionElapsedMs = 0;
  }

  private handleSceneShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.eventBus?.off(GameEvents.hudChanged, this.refresh, this);
    this.eventBus?.off(GameEvents.worldExpanded, this.handleWorldExpanded, this);
    this.topHeader?.destroy();
    this.statusPanel?.destroy();
    this.destroyTransitionOverlay();
    this.eventBus = undefined;
    this.getSnapshot = undefined;
    this.requestEvolutionOpen = undefined;
    this.requestUiModeCycle = undefined;
    this.topHeader = undefined;
    this.statusPanel = undefined;
  }
}
