import * as Phaser from 'phaser';
import { GameEvents } from '@/game/events';
import type { HudSnapshot } from '@/game/types';
import { StatusPanel } from '@/ui/StatusPanel';
import { TopHeader } from '@/ui/TopHeader';

interface UISceneData {
  eventBus: Phaser.Events.EventEmitter;
  getSnapshot: () => HudSnapshot;
}

export class UIScene extends Phaser.Scene {
  private topHeader?: TopHeader;
  private statusPanel?: StatusPanel;
  private eventBus?: Phaser.Events.EventEmitter;
  private getSnapshot?: () => HudSnapshot;

  constructor() {
    super('UIScene');
  }

  init(data: UISceneData): void {
    this.eventBus = data.eventBus;
    this.getSnapshot = data.getSnapshot;
  }

  create(): void {
    this.topHeader = new TopHeader(this);
    this.statusPanel = new StatusPanel(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.scale.on('resize', this.handleResize, this);
    this.handleResize();
    this.refresh();

    this.eventBus?.on(GameEvents.hudChanged, this.refresh, this);
  }

  private handleResize(): void {
    this.topHeader?.layout();
    this.statusPanel?.layout();
  }

  private refresh(): void {
    if (!this.getSnapshot) {
      return;
    }

    const snapshot = this.getSnapshot();
    this.topHeader?.setSnapshot(snapshot);
    this.statusPanel?.setSnapshot(snapshot);
  }

  private handleSceneShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.eventBus?.off(GameEvents.hudChanged, this.refresh, this);
    this.eventBus = undefined;
    this.getSnapshot = undefined;
    this.topHeader = undefined;
    this.statusPanel = undefined;
  }
}
