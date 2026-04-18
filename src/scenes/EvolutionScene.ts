import * as Phaser from 'phaser';
import { EvolutionBackdropRenderer } from '@/background/EvolutionBackdropRenderer';
import {
  deriveJitterSeed,
  drawJitteredRoundedRect,
  drawJitteredRoundedRectFill,
} from '@/evolution/evolutionBorderStyle';
import { EvolutionEnhancementBranch } from '@/evolution/EvolutionEnhancementBranch';
import { EvolutionSegmentCard } from '@/evolution/EvolutionSegmentCard';
import {
  getEvolutionUpgradeFamily,
  type EvolutionWorldActionId,
} from '@/evolution/evolutionData';
import { EvolutionTooltip } from '@/evolution/EvolutionTooltip';
import {
  computeEvolutionContentSplit,
  evolutionToolbarResourceIds,
  getEvolutionMyriapodaPanelLayout,
  getEvolutionSegmentCardSideLength,
  getEvolutionWorldActionsViewLayout,
  getEvolutionWorldBuildingsViewLayout,
  getEvolutionWorldSideContentRect,
} from '@/evolution/evolutionLayout';
import { EvolutionMyriapodaPreview } from '@/evolution/EvolutionMyriapodaPreview';
import { EvolutionWorldActionCards } from '@/evolution/EvolutionWorldActionCards';
import { EvolutionWorldBuildingsPanel } from '@/evolution/EvolutionWorldBuildingsPanel';
import { EvolutionWorldView } from '@/evolution/EvolutionWorldView';
import { closeEvolutionOverlay } from '@/evolution/overlayLifecycle';
import { getPickupDefinition } from '@/entities/pickups/PickupRegistry';
import type {
  EvolutionMyriapodaCallbacks,
  EvolutionSection,
  EvolutionSnapshot,
  EvolutionWorldActionAvailability,
  EvolutionWorldActionCallbacks,
  WorldRightPanelView,
} from '@/game/types';
import { getHexTypeDefinition } from '@/game/hexTypes';

interface EvolutionSceneData {
  snapshot: EvolutionSnapshot;
  worldActions?: EvolutionWorldActionCallbacks;
  myriapodaActions?: EvolutionMyriapodaCallbacks;
}

const TAB_MYRIAPODA_W = 272;
const TAB_MYRIAPODA_H = 48;
const TAB_WORLD_W = 132;
const TAB_WORLD_H = 48;
const TAB_GAP = 14;
const MAIN_GUTTER = 14;
const TITLE_SUBTITLE_GAP = 20;
const CLOSE_MARGIN = 24;
const TOOLBAR_HEIGHT = 56;
const RESOURCE_ITEM_WIDTH = 84;
const RESOURCE_ITEM_GAP = 10;
const SECTION_BADGE_PAD_X = 14;
const SECTION_BADGE_PAD_Y = 8;
const WORLD_RIGHT_SUBTAB_TOP_PAD = 6;
const WORLD_RIGHT_SUBTAB_H = 44;
const WORLD_RIGHT_SUBTAB_GAP_AFTER = 8;
const WORLD_SUBTAB_ACTIONS_W = 112;
const WORLD_SUBTAB_BUILDINGS_W = 124;
const WORLD_SUBTAB_BETWEEN = 10;

export class EvolutionScene extends Phaser.Scene {
  private snapshot?: EvolutionSnapshot;
  private preview?: EvolutionMyriapodaPreview;
  private worldView?: EvolutionWorldView;
  private backdropRenderer?: EvolutionBackdropRenderer;
  private enhancementBranch?: EvolutionEnhancementBranch;
  private worldActionCards?: EvolutionWorldActionCards;
  private worldBuildingsPanel?: EvolutionWorldBuildingsPanel;
  private worldActionsSubTab?: Phaser.GameObjects.Text;
  private worldBuildingsSubTab?: Phaser.GameObjects.Text;
  private worldActionsSubTabHit?: Phaser.GameObjects.Zone;
  private worldBuildingsSubTabHit?: Phaser.GameObjects.Zone;
  private backdropGraphics?: Phaser.GameObjects.Graphics;
  private chromeGraphics?: Phaser.GameObjects.Graphics;
  private title?: Phaser.GameObjects.Text;
  private subtitle?: Phaser.GameObjects.Text;
  private sectionHeading?: Phaser.GameObjects.Text;
  private contextTitle?: Phaser.GameObjects.Text;
  private contextBody?: Phaser.GameObjects.Text;
  private contextStats?: Phaser.GameObjects.Text;
  private footerHint?: Phaser.GameObjects.Text;
  private myriapodaTab?: Phaser.GameObjects.Text;
  private worldTab?: Phaser.GameObjects.Text;
  private myriapodaTabHitArea?: Phaser.GameObjects.Zone;
  private worldTabHitArea?: Phaser.GameObjects.Zone;
  private closeButton?: Phaser.GameObjects.Text;
  private resourceIcons: Phaser.GameObjects.Image[] = [];
  private resourceCountTexts: Phaser.GameObjects.Text[] = [];
  private resourceSlotBounds: Phaser.Geom.Rectangle[] = [];
  private closeKey?: Phaser.Input.Keyboard.Key;
  private evolutionKey?: Phaser.Input.Keyboard.Key;
  private section: EvolutionSection = 'myriapoda';
  private worldRightPanel: WorldRightPanelView = 'actions';
  private hoveredTab: EvolutionSection | null = null;
  private hoveredWorldSubTab: WorldRightPanelView | null = null;
  private closeHovered = false;
  private outerBounds = new Phaser.Geom.Rectangle();
  private toolbarBounds = new Phaser.Geom.Rectangle();
  private contentBounds = new Phaser.Geom.Rectangle();
  private sideBounds = new Phaser.Geom.Rectangle();
  private sectionBadgeBounds = new Phaser.Geom.Rectangle();
  private detailCardBounds = new Phaser.Geom.Rectangle();
  private statsCardBounds = new Phaser.Geom.Rectangle();
  private lowerPanelBounds = new Phaser.Geom.Rectangle();
  private worldStatsBounds = new Phaser.Geom.Rectangle();
  private worldActionsBounds = new Phaser.Geom.Rectangle();
  private worldBuildingsBounds = new Phaser.Geom.Rectangle();
  private headerSeparator = { x: 0, y1: 0, y2: 0 };
  private contentTopY = 0;
  private closing = false;
  private worldActionCallbacks?: EvolutionWorldActionCallbacks;
  private armedWorldAction: EvolutionWorldActionId | null = null;
  private worldActionMessage = '';
  private tooltip?: EvolutionTooltip;
  private myriapodaActions?: EvolutionMyriapodaCallbacks;
  private segmentCard?: EvolutionSegmentCard;
  private segmentCardArea = new Phaser.Geom.Rectangle();
  private segmentPurchaseErrorTimer?: Phaser.Time.TimerEvent;
  private choosePartColumnLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('EvolutionScene');
  }

  init(data: EvolutionSceneData): void {
    this.snapshot = data.snapshot;
    this.worldActionCallbacks = data.worldActions;
    this.myriapodaActions = data.myriapodaActions;
    this.section = 'myriapoda';
    this.hoveredTab = null;
    this.hoveredWorldSubTab = null;
    this.worldRightPanel = 'actions';
    this.closeHovered = false;
    this.closing = false;
    this.armedWorldAction = null;
    this.worldActionMessage = '';
    this.resourceSlotBounds = evolutionToolbarResourceIds.map(() => new Phaser.Geom.Rectangle());
  }

  create(): void {
    if (!this.snapshot) {
      this.scene.stop();
      return;
    }

    this.backdropGraphics = this.add.graphics().setDepth(0.2);
    this.chromeGraphics = this.add.graphics().setDepth(20);
    this.backdropRenderer = new EvolutionBackdropRenderer(this);
    this.preview = new EvolutionMyriapodaPreview(this, this.snapshot.myriapoda);
    this.worldView = new EvolutionWorldView(this, this.snapshot.world);
    this.enhancementBranch = new EvolutionEnhancementBranch(this);
    this.worldActionCards = new EvolutionWorldActionCards(this, (actionId) =>
      this.handleWorldActionSelected(actionId),
    );
    this.worldBuildingsPanel = new EvolutionWorldBuildingsPanel(this);

    this.worldActionsSubTab = this.createWorldSubTabLabel('ACTIONS');
    this.worldBuildingsSubTab = this.createWorldSubTabLabel('BUILDINGS');
    this.worldActionsSubTabHit = this.createWorldSubTabHit('actions', WORLD_SUBTAB_ACTIONS_W);
    this.worldBuildingsSubTabHit = this.createWorldSubTabHit('buildings', WORLD_SUBTAB_BUILDINGS_W);

    this.tooltip = new EvolutionTooltip(this, 40);
    this.segmentCard = new EvolutionSegmentCard(this, () => this.handleSegmentPurchase());

    this.title = this.add
      .text(0, 0, 'EVOLUTION', {
        fontFamily: 'Georgia',
        fontSize: '34px',
        color: '#f1fbf5',
        stroke: '#061014',
        strokeThickness: 7,
      })
      .setDepth(21);

    this.subtitle = this.add
      .text(0, 0, 'Strategic mutation and world shaping', {
        fontFamily: 'Palatino Linotype',
        fontStyle: 'italic',
        fontSize: '20px',
        color: '#8fd4c6',
        stroke: '#061014',
        strokeThickness: 5,
      })
      .setDepth(21);

    this.sectionHeading = this.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ecfffb',
        letterSpacing: 2.2,
      })
      .setDepth(21)
      .setOrigin(0, 0.5);

    this.choosePartColumnLabel = this.add
      .text(0, 0, 'CHOOSE PART', {
        fontFamily: 'Trebuchet MS',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#8fd4c6',
        letterSpacing: 2.4,
      })
      .setDepth(21);

    this.contextTitle = this.add
      .text(0, 0, '', {
        fontFamily: 'Georgia',
        fontSize: '20px',
        color: '#f6fbff',
        stroke: '#061014',
        strokeThickness: 4,
        lineSpacing: 4,
      })
      .setDepth(21);

    this.contextBody = this.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '13px',
        color: '#cfe7e0',
        lineSpacing: 5,
      })
      .setDepth(21);

    this.contextStats = this.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '13px',
        color: '#90d7cb',
        lineSpacing: 6,
        letterSpacing: 0.6,
      })
      .setDepth(21);

    this.footerHint = this.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '14px',
        color: '#86bfb5',
        letterSpacing: 1.2,
      })
      .setDepth(21);

    this.myriapodaTab = this.createTabLabel('MYRIAPODA DEVELOPMENT');
    this.worldTab = this.createTabLabel('WORLD');
    this.myriapodaTabHitArea = this.createTabHitArea('myriapoda', TAB_MYRIAPODA_W, TAB_MYRIAPODA_H);
    this.worldTabHitArea = this.createTabHitArea('world', TAB_WORLD_W, TAB_WORLD_H);

    this.closeButton = this.add
      .text(0, 0, 'ESC / E CLOSE', {
        fontFamily: 'Trebuchet MS',
        fontSize: '14px',
        color: '#9fd8cc',
        letterSpacing: 2,
        padding: { left: 8, right: 8, top: 6, bottom: 6 },
      })
      .setDepth(21);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerover', this.handleCloseOver, this);
    this.closeButton.on('pointerout', this.handleCloseOut, this);
    this.closeButton.on('pointerdown', this.handleCloseRequested, this);

    for (const resourceId of evolutionToolbarResourceIds) {
      const definition = getPickupDefinition(resourceId);
      const icon = this.add.image(0, 0, definition.textureKey).setDepth(21).setScale(0.58);
      const countText = this.add
        .text(0, 0, '0', {
          fontFamily: 'Trebuchet MS',
          fontSize: '15px',
          color: '#c5f5ea',
          stroke: '#061014',
          strokeThickness: 3,
        })
        .setDepth(21)
        .setOrigin(0, 0.5);
      this.resourceIcons.push(icon);
      this.resourceCountTexts.push(countText);
    }

    this.closeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) ?? undefined;
    this.evolutionKey =
      this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E) ?? undefined;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.scale.on('resize', this.handleResize, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('wheel', this.handleWheel, this);
    this.handleResize();
    this.updateSectionVisibility();
    this.refreshWorldActionCards();
  }

  getTooltip(): EvolutionTooltip | undefined {
    return this.tooltip;
  }

  update(_time: number, deltaMs: number): void {
    if (
      (this.closeKey && Phaser.Input.Keyboard.JustDown(this.closeKey)) ||
      (this.evolutionKey && Phaser.Input.Keyboard.JustDown(this.evolutionKey))
    ) {
      this.handleCloseRequested();
      return;
    }

    const deltaSeconds = Math.min(0.05, deltaMs / 1000);
    if (this.section === 'myriapoda') {
      this.preview?.update(deltaSeconds);
      this.enhancementBranch?.update(deltaSeconds);
    } else {
      this.worldView?.update(deltaSeconds);
    }
    this.backdropRenderer?.update(deltaSeconds);
    this.refreshContextPanel();
  }

  private createTabLabel(label: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, label, {
        fontFamily: 'Trebuchet MS',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e7fffb',
        letterSpacing: 1.8,
      })
      .setDepth(21)
      .setOrigin(0.5, 0.5);
  }

  private createTabHitArea(
    section: EvolutionSection,
    width: number,
    height: number,
  ): Phaser.GameObjects.Zone {
    const zone = this.add.zone(0, 0, width, height).setOrigin(0.5).setDepth(21.2);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      this.hoveredTab = section;
      this.renderChrome();
    });
    zone.on('pointerout', () => {
      if (this.hoveredTab === section) {
        this.hoveredTab = null;
      }
      this.renderChrome();
    });
    zone.on('pointerdown', () => {
      this.setSection(section);
    });
    return zone;
  }

  private createWorldSubTabLabel(label: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, label, {
        fontFamily: 'Trebuchet MS',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#e7fffb',
        letterSpacing: 1.6,
      })
      .setDepth(21)
      .setOrigin(0.5, 0.5)
      .setVisible(false);
  }

  private createWorldSubTabHit(view: WorldRightPanelView, width: number): Phaser.GameObjects.Zone {
    const zone = this.add
      .zone(0, 0, width, WORLD_RIGHT_SUBTAB_H)
      .setOrigin(0.5)
      .setDepth(21.2);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      this.hoveredWorldSubTab = view;
      this.renderChrome();
    });
    zone.on('pointerout', () => {
      if (this.hoveredWorldSubTab === view) {
        this.hoveredWorldSubTab = null;
      }
      this.renderChrome();
    });
    zone.on('pointerdown', () => {
      this.setWorldRightPanelView(view);
    });
    return zone;
  }

  private setWorldRightPanelView(view: WorldRightPanelView): void {
    this.worldRightPanel = view;
    if (view !== 'actions') {
      this.armedWorldAction = null;
      this.worldActionMessage = '';
    }
    this.updateSectionVisibility();
    this.handleResize();
    this.refreshWorldActionCards();
    this.renderChrome();
    this.refreshContextPanel();
  }

  private setSection(section: EvolutionSection): void {
    this.section = section;
    if (section === 'myriapoda') {
      this.hoveredWorldSubTab = null;
      this.armedWorldAction = null;
      this.worldActionMessage = '';
    }
    this.tooltip?.hide();
    this.updateSectionVisibility();
    this.handleResize();
    this.refreshWorldActionCards();
    this.renderChrome();
    this.refreshContextPanel();
  }

  private updateSectionVisibility(): void {
    const myriapodaVisible = this.section === 'myriapoda';
    const worldVisible = !myriapodaVisible;
    const showWorldActions = worldVisible && this.worldRightPanel === 'actions';
    const showWorldBuildings = worldVisible && this.worldRightPanel === 'buildings';
    this.preview?.setVisible(myriapodaVisible);
    this.worldView?.setVisible(worldVisible);
    this.enhancementBranch?.setVisible(myriapodaVisible);
    this.segmentCard?.setVisible(myriapodaVisible);
    this.choosePartColumnLabel?.setVisible(myriapodaVisible);
    this.worldActionCards?.setVisible(showWorldActions);
    this.worldBuildingsPanel?.setVisible(showWorldBuildings);
    this.worldActionsSubTab?.setVisible(worldVisible);
    this.worldBuildingsSubTab?.setVisible(worldVisible);
    this.worldActionsSubTabHit?.setVisible(worldVisible);
    this.worldBuildingsSubTabHit?.setVisible(worldVisible);
  }

  private handleWorldActionSelected(actionId: EvolutionWorldActionId): void {
    this.armedWorldAction = this.armedWorldAction === actionId ? null : actionId;
    this.worldActionMessage =
      this.armedWorldAction === 'conquer'
        ? 'Pick a dead hex in the world map.'
        : '';
    this.refreshWorldActionCards();
    this.refreshContextPanel();
  }

  private handleSegmentPurchase(): void {
    const actions = this.myriapodaActions;
    if (!actions || !this.snapshot) {
      return;
    }
    const result = actions.purchaseSegment();
    if (!result.success) {
      if (result.reason) {
        const p = this.input.activePointer;
        this.segmentPurchaseErrorTimer?.remove(false);
        this.tooltip?.show({
          title: '',
          description: result.reason,
          anchorRect: { x: p.x, y: p.y, width: 1, height: 1 },
        });
        this.segmentPurchaseErrorTimer = this.time.delayedCall(2000, () => {
          this.tooltip?.hide();
          this.segmentPurchaseErrorTimer = undefined;
        });
      }
      return;
    }
    this.applyFreshSnapshotFromGame();
  }

  private applyFreshSnapshotFromGame(): void {
    const get = this.myriapodaActions?.getSnapshot;
    if (!get) {
      return;
    }
    this.snapshot = get();
    const resourceStripWidth =
      evolutionToolbarResourceIds.length * RESOURCE_ITEM_WIDTH +
      (evolutionToolbarResourceIds.length - 1) * RESOURCE_ITEM_GAP;
    const toolbarX = this.toolbarBounds.x;
    const toolbarWidth = this.toolbarBounds.width;
    const resourceStripX = toolbarX + toolbarWidth - resourceStripWidth;
    const toolbarCenterY = this.toolbarBounds.y + TOOLBAR_HEIGHT * 0.5;
    for (let i = 0; i < evolutionToolbarResourceIds.length; i += 1) {
      const resourceId = evolutionToolbarResourceIds[i];
      const slotX = resourceStripX + i * (RESOURCE_ITEM_WIDTH + RESOURCE_ITEM_GAP);
      const count = this.snapshot?.resourceCounts[resourceId] ?? 0;
      this.resourceCountTexts[i]?.setText(String(count));
      this.resourceCountTexts[i]?.setPosition(slotX + 38, toolbarCenterY);
    }
    this.preview?.syncSegmentCountFromGame(this.snapshot.myriapoda.segmentCount);
    if (this.contentBounds.width > 0 && this.contentBounds.height > 0) {
      this.preview?.layout(this.contentBounds);
    }
    this.segmentPurchaseErrorTimer?.remove(false);
    this.segmentPurchaseErrorTimer = undefined;
    this.tooltip?.hide();
    this.refreshContextPanel();
    this.renderChrome();
  }

  private refreshWorldActionCards(): void {
    const availability = new Map<EvolutionWorldActionId, EvolutionWorldActionAvailability>();
    availability.set(
      'conquer',
      this.worldActionCallbacks?.canStartConquest(null) ?? {
        allowed: false,
        reason: 'World actions unavailable.',
      },
    );
    availability.set('probe', { allowed: false, reason: 'Locked' });
    availability.set('seed', { allowed: false, reason: 'Locked' });
    availability.set('anchor', { allowed: false, reason: 'Locked' });
    this.worldActionCards?.setCardState(this.armedWorldAction, availability);
  }

  private handleResize(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const outerX = 34;
    const outerY = 24;
    const outerWidth = Math.max(900, width - 68);
    const outerHeight = Math.max(620, height - 48);
    const mainX = outerX + 28;
    const toolbarX = mainX;
    const toolbarWidth = outerWidth - 56;

    this.outerBounds.setTo(outerX, outerY, outerWidth, outerHeight);

    const titleRowY = outerY + 26;
    this.title?.setPosition(outerX + 28, titleRowY);
    const titleH = this.title?.height ?? 40;
    const titleCenterY = titleRowY + titleH * 0.5;
    this.subtitle?.setOrigin(0, 0.5);
    const subtitleX = (this.title?.x ?? 0) + (this.title?.width ?? 0) + TITLE_SUBTITLE_GAP;
    this.subtitle?.setPosition(subtitleX, titleCenterY);

    const titleRight = (this.title?.x ?? 0) + (this.title?.width ?? 0);
    this.headerSeparator.x = (titleRight + subtitleX) * 0.5;
    this.headerSeparator.y1 = titleRowY + 6;
    this.headerSeparator.y2 = titleRowY + titleH - 6;

    if (this.closeButton) {
      this.closeButton.setPosition(
        outerX + outerWidth - this.closeButton.width - CLOSE_MARGIN,
        outerY + 28,
      );
    }

    const toolbarY = titleRowY + titleH + 18;
    this.toolbarBounds.setTo(toolbarX, toolbarY, toolbarWidth, TOOLBAR_HEIGHT);
    const toolbarCenterY = toolbarY + TOOLBAR_HEIGHT * 0.5;
    const myriapodaCx = toolbarX + TAB_MYRIAPODA_W * 0.5;
    const worldCx = myriapodaCx + TAB_MYRIAPODA_W * 0.5 + TAB_GAP + TAB_WORLD_W * 0.5;
    this.myriapodaTab?.setPosition(myriapodaCx, toolbarCenterY);
    this.worldTab?.setPosition(worldCx, toolbarCenterY);
    this.myriapodaTabHitArea?.setPosition(myriapodaCx, toolbarCenterY);
    this.worldTabHitArea?.setPosition(worldCx, toolbarCenterY);

    const resourceStripWidth =
      evolutionToolbarResourceIds.length * RESOURCE_ITEM_WIDTH +
      (evolutionToolbarResourceIds.length - 1) * RESOURCE_ITEM_GAP;
    const resourceStripX = toolbarX + toolbarWidth - resourceStripWidth;
    for (let i = 0; i < evolutionToolbarResourceIds.length; i += 1) {
      const resourceId = evolutionToolbarResourceIds[i];
      const slotX = resourceStripX + i * (RESOURCE_ITEM_WIDTH + RESOURCE_ITEM_GAP);
      const slotY = toolbarCenterY - 16;
      const slotBounds = this.resourceSlotBounds[i];
      slotBounds.setTo(slotX, slotY, RESOURCE_ITEM_WIDTH, 32);

      const count = this.snapshot?.resourceCounts[resourceId] ?? 0;
      this.resourceIcons[i]?.setOrigin(0.5, 0.5);
      this.resourceIcons[i]?.setPosition(slotX + 20, toolbarCenterY);
      this.resourceCountTexts[i]?.setText(String(count));
      this.resourceCountTexts[i]?.setPosition(slotX + 38, toolbarCenterY);
    }

    const sectionHeadingY = toolbarY + TOOLBAR_HEIGHT + 22;
    this.sectionHeading?.setPosition(mainX + 4, sectionHeadingY);
    this.updateSectionBadgeBounds();

    this.contentTopY = this.sectionBadgeBounds.bottom + 16;
    const contentBottom = outerY + outerHeight - 36;
    const contentHeight = contentBottom - this.contentTopY;
    const innerW = outerWidth - 56;
    const split = computeEvolutionContentSplit(innerW, this.section, MAIN_GUTTER);

    this.contentBounds.setTo(mainX, this.contentTopY, split.leftWidth, contentHeight);
    this.sideBounds.setTo(
      mainX + split.leftWidth + MAIN_GUTTER,
      this.contentTopY,
      split.rightWidth,
      contentHeight,
    );

    this.preview?.layout(this.contentBounds);
    this.worldView?.layout(this.contentBounds);

    const myriapodaPanel = getEvolutionMyriapodaPanelLayout(this.sideBounds);
    this.detailCardBounds.setTo(
      myriapodaPanel.detailCard.x,
      myriapodaPanel.detailCard.y,
      myriapodaPanel.detailCard.width,
      myriapodaPanel.detailCard.height,
    );
    this.statsCardBounds.setTo(
      myriapodaPanel.statsCard.x,
      myriapodaPanel.statsCard.y,
      myriapodaPanel.statsCard.width,
      myriapodaPanel.statsCard.height,
    );
    this.lowerPanelBounds.setTo(
      myriapodaPanel.lowerPanel.x,
      myriapodaPanel.lowerPanel.y,
      myriapodaPanel.lowerPanel.width,
      myriapodaPanel.lowerPanel.height,
    );
    const col = myriapodaPanel.segmentColumn;
    const desiredSide = getEvolutionSegmentCardSideLength(myriapodaPanel.lowerPanel);
    const side = Math.min(desiredSide, col.width, col.height);
    this.segmentCardArea.setTo(
      col.x + (col.width - side) * 0.5,
      col.y + (col.height - side) * 0.5,
      side,
      side,
    );
    this.segmentCard?.layout(this.segmentCardArea);
    this.enhancementBranch?.layout(
      this.lowerPanelBounds,
      getEvolutionUpgradeFamily(this.preview?.getFocusedPart()?.id ?? null),
    );

    if (this.section === 'world') {
      const worldTabBarH = WORLD_RIGHT_SUBTAB_TOP_PAD + WORLD_RIGHT_SUBTAB_H;
      const subTabCenterY =
        this.sideBounds.y + WORLD_RIGHT_SUBTAB_TOP_PAD + WORLD_RIGHT_SUBTAB_H * 0.5;
      const subTabLeft = this.sideBounds.x + 12 + WORLD_SUBTAB_ACTIONS_W * 0.5;
      const subTabRight =
        subTabLeft +
        WORLD_SUBTAB_ACTIONS_W * 0.5 +
        WORLD_SUBTAB_BETWEEN +
        WORLD_SUBTAB_BUILDINGS_W * 0.5;
      this.worldActionsSubTab?.setPosition(subTabLeft, subTabCenterY);
      this.worldBuildingsSubTab?.setPosition(subTabRight, subTabCenterY);
      this.worldActionsSubTabHit?.setPosition(subTabLeft, subTabCenterY);
      this.worldBuildingsSubTabHit?.setPosition(subTabRight, subTabCenterY);
      this.bindWorldSubTabHitAreas();

      const worldContent = getEvolutionWorldSideContentRect(
        this.sideBounds,
        worldTabBarH,
        WORLD_RIGHT_SUBTAB_GAP_AFTER,
      );
      const wb = getEvolutionWorldBuildingsViewLayout(worldContent);
      this.worldBuildingsBounds.setTo(
        wb.buildingsSection.x,
        wb.buildingsSection.y,
        wb.buildingsSection.width,
        wb.buildingsSection.height,
      );
      /** Always place building tiles from current 30% column; otherwise they stay at (0,0). */
      this.worldBuildingsPanel?.setSelectedHexBuildable(!!this.worldView?.getFocusedCell()?.buildable);
      this.worldBuildingsPanel?.layout(wb.buildingsSection);

      if (this.worldRightPanel === 'actions') {
        const wa = getEvolutionWorldActionsViewLayout(worldContent);
        this.worldStatsBounds.setTo(
          wa.statsCard.x,
          wa.statsCard.y,
          wa.statsCard.width,
          wa.statsCard.height,
        );
        this.worldActionsBounds.setTo(
          wa.actionList.x,
          wa.actionList.y,
          wa.actionList.width,
          wa.actionList.height,
        );
        this.worldActionCards?.layout(this.worldActionsBounds);
      } else {
        this.worldStatsBounds.setTo(0, 0, 0, 0);
        this.worldActionsBounds.setTo(0, 0, 0, 0);
        this.worldActionCards?.layout({ x: 0, y: 0, width: 1, height: 1 });
      }
    }

    this.footerHint?.setPosition(outerX + 32, outerY + outerHeight - 34);
    this.refreshWorldActionCards();
    this.renderChrome();
    this.refreshContextPanel();
  }

  private renderChrome(): void {
    if (!this.backdropGraphics || !this.chromeGraphics) {
      return;
    }

    this.backdropGraphics.clear();

    this.chromeGraphics.clear();

    this.chromeGraphics.lineStyle(1.2, 0x7fd8c8, 0.55);
    this.chromeGraphics.lineBetween(
      this.headerSeparator.x,
      this.headerSeparator.y1,
      this.headerSeparator.x,
      this.headerSeparator.y2,
    );

    this.drawSectionTab(this.myriapodaTab, 'myriapoda', TAB_MYRIAPODA_W, TAB_MYRIAPODA_H);
    this.drawSectionTab(this.worldTab, 'world', TAB_WORLD_W, TAB_WORLD_H);

    if (this.section === 'world') {
      this.drawWorldRightSubTab(
        this.worldActionsSubTab,
        'actions',
        WORLD_SUBTAB_ACTIONS_W,
        WORLD_RIGHT_SUBTAB_H,
      );
      this.drawWorldRightSubTab(
        this.worldBuildingsSubTab,
        'buildings',
        WORLD_SUBTAB_BUILDINGS_W,
        WORLD_RIGHT_SUBTAB_H,
      );
    }

    // Detail / stats / tree panels intentionally have no background or border —
    // they read as clean text+graphic groups against the evolution backdrop.

    // Close: border only (no fill) — text has no backgroundColor.
    if (this.closeButton) {
      drawJitteredRoundedRect(this.chromeGraphics, {
        x: this.closeButton.x - 8,
        y: this.closeButton.y - 5,
        width: this.closeButton.width + 16,
        height: this.closeButton.height + 10,
        radius: 18,
        seed: deriveJitterSeed('evolution-close'),
        jitter: 1,
        strokeWidth: this.closeHovered ? 1.25 : 1.05,
        color: this.closeHovered ? 0xa4fff1 : 0x7aaea4,
        alpha: this.closeHovered ? 0.52 : 0.36,
      });
    }
  }

  private updateSectionBadgeBounds(): void {
    if (!this.sectionHeading) {
      return;
    }

    const headingWidth = this.sectionHeading.width + SECTION_BADGE_PAD_X * 2;
    const headingHeight = this.sectionHeading.height + SECTION_BADGE_PAD_Y * 2;
    this.sectionBadgeBounds.setTo(
      this.sectionHeading.x - 4,
      this.sectionHeading.y - headingHeight * 0.5,
      headingWidth,
      headingHeight,
    );
  }

  private bindWorldSubTabHitAreas(): void {
    this.worldActionsSubTabHit?.setSize(WORLD_SUBTAB_ACTIONS_W, WORLD_RIGHT_SUBTAB_H);
    this.worldBuildingsSubTabHit?.setSize(WORLD_SUBTAB_BUILDINGS_W, WORLD_RIGHT_SUBTAB_H);
  }

  private drawWorldRightSubTab(
    label: Phaser.GameObjects.Text | undefined,
    view: WorldRightPanelView,
    width: number,
    height: number,
  ): void {
    if (!label || !this.chromeGraphics) {
      return;
    }

    const isActive = this.worldRightPanel === view;
    const isHovered = this.hoveredWorldSubTab === view;
    const x = label.x - width / 2;
    const y = label.y - height / 2;

    const fillColor = isActive ? 0x103137 : isHovered ? 0x0d242a : 0x09171d;
    const fillAlpha = isActive ? 0.95 : isHovered ? 0.88 : 0.78;
    const strokeColor = isActive ? 0xcffdf8 : isHovered ? 0xa8e0d8 : 0x5a8078;
    const strokeAlpha = isActive ? 0.55 : isHovered ? 0.38 : 0.22;
    drawJitteredRoundedRectFill(this.chromeGraphics, {
      x,
      y,
      width,
      height,
      radius: 15,
      seed: deriveJitterSeed(`evolution-world-subtab-${view}`),
      jitter: 0.95,
      color: fillColor,
      alpha: fillAlpha,
    });
    drawJitteredRoundedRect(this.chromeGraphics, {
      x,
      y,
      width,
      height,
      radius: 15,
      seed: deriveJitterSeed(`evolution-world-subtab-${view}`),
      jitter: 0.95,
      strokeWidth: 1.05,
      color: strokeColor,
      alpha: strokeAlpha,
    });
  }

  private drawSectionTab(
    label: Phaser.GameObjects.Text | undefined,
    section: EvolutionSection,
    width: number,
    height: number,
  ): void {
    if (!label || !this.chromeGraphics) {
      return;
    }

    const isActive = this.section === section;
    const isHovered = this.hoveredTab === section;
    const x = label.x - width / 2;
    const y = label.y - height / 2;

    const fillColor = isActive ? 0x103137 : isHovered ? 0x0d242a : 0x09171d;
    const fillAlpha = isActive ? 0.95 : isHovered ? 0.88 : 0.78;
    const strokeColor = isActive ? 0xcffdf8 : isHovered ? 0xa8e0d8 : 0x5a8078;
    const strokeAlpha = isActive ? 0.55 : isHovered ? 0.38 : 0.22;
    drawJitteredRoundedRectFill(this.chromeGraphics, {
      x,
      y,
      width,
      height,
      radius: 17,
      seed: deriveJitterSeed(`evolution-section-tab-${section}`),
      jitter: 0.95,
      color: fillColor,
      alpha: fillAlpha,
    });
    drawJitteredRoundedRect(this.chromeGraphics, {
      x,
      y,
      width,
      height,
      radius: 17,
      seed: deriveJitterSeed(`evolution-section-tab-${section}`),
      jitter: 0.95,
      strokeWidth: 1.1,
      color: strokeColor,
      alpha: strokeAlpha,
    });
  }

  private refreshContextPanel(): void {
    if (
      !this.snapshot ||
      !this.sectionHeading ||
      !this.contextTitle ||
      !this.contextBody ||
      !this.contextStats ||
      !this.footerHint
    ) {
      return;
    }

    if (this.section === 'myriapoda') {
      const focused = this.preview?.getFocusedPart();
      const focusedName = this.preview?.getFocusedPartName() ?? 'Select a body part';
      const family = getEvolutionUpgradeFamily(focused?.id ?? null);
      this.sectionHeading.setText('MYRIAPODA DEVELOPMENT');
      this.updateSectionBadgeBounds();
      this.contextTitle.setVisible(true);
      this.contextBody.setVisible(true);
      this.contextTitle.setText(focusedName.toUpperCase());
      this.contextBody.setText(
        focused
          ? 'Hover a node to inspect.'
          : 'Click the preview to pin a body part.',
      );
      this.contextStats.setText(
        [
          `STORED: ${this.snapshot.myriapoda.stomachResources.length}/${this.snapshot.myriapoda.stomachCapacity}`,
          `PARASITES: ${this.snapshot.myriapoda.parasiteCount}`,
          `FAMILY: ${family.toUpperCase()}`,
          `FOCUS: ${focused ? focused.label : 'None'}`,
        ].join('\n'),
      );
      const col1Pad = 10;
      const labelY = this.detailCardBounds.y + 8;
      this.choosePartColumnLabel?.setPosition(this.detailCardBounds.x + col1Pad, labelY);
      const titleX = this.detailCardBounds.x + col1Pad;
      const titleY = labelY + (this.choosePartColumnLabel?.height ?? 12) + 4;
      const titleWrap = Math.max(40, this.detailCardBounds.width - col1Pad * 2);
      this.contextTitle.setPosition(titleX, titleY);
      this.contextTitle.setWordWrapWidth(titleWrap);
      // Place the body text just below the (possibly wrapped) title to avoid
      // overlap when long part names break onto a second line.
      const bodyY = titleY + this.contextTitle.height + 6;
      this.contextBody.setPosition(titleX, bodyY);
      this.contextBody.setWordWrapWidth(titleWrap);
      this.contextStats.setVisible(true);
      this.contextStats.setPosition(this.statsCardBounds.x + 10, this.statsCardBounds.y + 10);
      this.contextStats.setWordWrapWidth(Math.max(40, this.statsCardBounds.width - 20));
      this.segmentCard?.syncFromSnapshot(this.snapshot);
      this.enhancementBranch?.layout(this.lowerPanelBounds, family);
      this.footerHint.setText('CLICK TO PIN A BODY PART  |  E / ESC CLOSE');
      this.renderChrome();
      return;
    }

    const focusedCell = this.worldView?.getFocusedCell();
    const cellType = focusedCell ? getHexTypeDefinition(focusedCell.type) : null;
    const buildable = !!focusedCell?.buildable;
    const territoryState =
      focusedCell?.conquestState === 'active'
        ? 'CONQUERING'
        : focusedCell?.conquestState === 'owned'
          ? 'OWNED'
          : 'UNCLAIMED';
    this.worldBuildingsPanel?.setSelectedHexBuildable(buildable);
    if (this.worldBuildingsBounds.width > 0 && this.worldBuildingsBounds.height > 0) {
      this.worldBuildingsPanel?.layout(this.worldBuildingsBounds);
    }
    this.sectionHeading.setText('WORLD STRATEGIC VIEW');
    this.updateSectionBadgeBounds();
    this.contextTitle.setVisible(false);
    this.contextBody.setVisible(false);
    const showHexStats = this.worldRightPanel === 'actions';
    this.contextStats.setVisible(showHexStats);
    if (showHexStats) {
      this.contextStats.setText(
        [
          `HEX: ${focusedCell ? `${focusedCell.coord.q}, ${focusedCell.coord.r}` : 'None'}`,
          `HEX TYPE: ${cellType ? cellType.id.toUpperCase() : 'None'}`,
          `STATUS: ${focusedCell ? territoryState : 'None'}`,
          `BUILDABLE: ${focusedCell ? (buildable ? 'YES' : 'NO') : 'NO'}`,
          `WORLD STAGE: ${this.snapshot.world.stage}`,
          `FILL: ${this.snapshot.world.fillLevel}/${this.snapshot.world.fillThreshold}`,
          `ACTION: ${this.worldActionMessage || (this.armedWorldAction === 'conquer' ? 'Pick a dead hex.' : 'Select an action card.')}`,
        ].join('\n'),
      );
      this.contextStats.setPosition(this.worldStatsBounds.x + 18, this.worldStatsBounds.y + 20);
      this.contextStats.setWordWrapWidth(this.worldStatsBounds.width - 36);
    }
    this.footerHint.setText(
      this.armedWorldAction === 'conquer'
        ? 'CLICK A DEAD HEX TO START CONQUEST  |  WHEEL TO ZOOM  |  DRAG TO PAN'
        : 'WHEEL TO ZOOM  |  DRAG TO PAN  |  CLICK TO PIN  |  E / ESC CLOSE',
    );
    this.renderChrome();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.section === 'myriapoda') {
      this.preview?.handlePointerMove(pointer.x, pointer.y);
      return;
    }

    this.worldView?.handlePointerMove(pointer.x, pointer.y);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.section === 'myriapoda') {
      if (this.segmentCard?.tryConsumePointerDown(pointer.x, pointer.y)) {
        return;
      }
      this.preview?.handlePointerDown(pointer.x, pointer.y);
      return;
    }

    this.worldView?.handlePointerDown(pointer.x, pointer.y);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.section !== 'world') {
      return;
    }

    const pickedCell = this.worldView?.handlePointerUp(pointer.x, pointer.y) ?? null;
    if (
      this.worldRightPanel !== 'actions' ||
      this.armedWorldAction !== 'conquer' ||
      !pickedCell
    ) {
      return;
    }

    const availability = this.worldActionCallbacks?.canStartConquest(pickedCell.coord) ?? {
      allowed: false,
      reason: 'World actions unavailable.',
    };
    if (!availability.allowed) {
      this.worldActionMessage = availability.reason ?? 'Choose a dead hex.';
      this.refreshWorldActionCards();
      this.refreshContextPanel();
      return;
    }

    const result = this.worldActionCallbacks?.startConquest(pickedCell.coord) ?? {
      success: false,
      reason: 'Unable to start conquest.',
    };
    if (!result.success) {
      this.worldActionMessage = result.reason ?? 'Unable to start conquest.';
      this.refreshWorldActionCards();
      this.refreshContextPanel();
      return;
    }

    this.handleCloseRequested();
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    if (this.section !== 'world') {
      return;
    }

    this.worldView?.handleWheel(deltaY, pointer.x, pointer.y);
  }

  private handleCloseOver(): void {
    this.closeHovered = true;
    this.renderChrome();
  }

  private handleCloseOut(): void {
    this.closeHovered = false;
    this.renderChrome();
  }

  private handleCloseRequested(): void {
    if (this.closing) {
      return;
    }

    this.closing = true;
    closeEvolutionOverlay(this.scene as never);
  }

  private handleShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('wheel', this.handleWheel, this);

    this.closeButton?.off('pointerover', this.handleCloseOver, this);
    this.closeButton?.off('pointerout', this.handleCloseOut, this);
    this.closeButton?.off('pointerdown', this.handleCloseRequested, this);
    this.myriapodaTabHitArea?.removeAllListeners();
    this.worldTabHitArea?.removeAllListeners();

    this.preview?.destroy();
    this.worldView?.destroy();
    this.backdropRenderer?.destroy();
    this.enhancementBranch?.destroy();
    this.segmentPurchaseErrorTimer?.remove(false);
    this.segmentPurchaseErrorTimer = undefined;
    this.segmentCard?.destroy();
    this.worldActionCards?.destroy();
    this.worldBuildingsPanel?.destroy();
    this.tooltip?.destroy();
    this.tooltip = undefined;
    this.worldActionsSubTab?.destroy();
    this.worldBuildingsSubTab?.destroy();
    this.worldActionsSubTabHit?.destroy();
    this.worldBuildingsSubTabHit?.destroy();
    this.backdropGraphics?.destroy();
    this.chromeGraphics?.destroy();
    this.title?.destroy();
    this.subtitle?.destroy();
    this.sectionHeading?.destroy();
    this.choosePartColumnLabel?.destroy();
    this.contextTitle?.destroy();
    this.contextBody?.destroy();
    this.contextStats?.destroy();
    this.footerHint?.destroy();
    this.myriapodaTab?.destroy();
    this.worldTab?.destroy();
    this.myriapodaTabHitArea?.destroy();
    this.worldTabHitArea?.destroy();
    this.closeButton?.destroy();
    for (const img of this.resourceIcons) {
      img.destroy();
    }
    for (const t of this.resourceCountTexts) {
      t.destroy();
    }

    this.snapshot = undefined;
    this.preview = undefined;
    this.worldView = undefined;
    this.backdropRenderer = undefined;
    this.enhancementBranch = undefined;
    this.segmentCard = undefined;
    this.myriapodaActions = undefined;
    this.worldActionCards = undefined;
    this.worldBuildingsPanel = undefined;
    this.worldActionsSubTab = undefined;
    this.worldBuildingsSubTab = undefined;
    this.worldActionsSubTabHit = undefined;
    this.worldBuildingsSubTabHit = undefined;
    this.backdropGraphics = undefined;
    this.chromeGraphics = undefined;
    this.title = undefined;
    this.subtitle = undefined;
    this.sectionHeading = undefined;
    this.choosePartColumnLabel = undefined;
    this.contextTitle = undefined;
    this.contextBody = undefined;
    this.contextStats = undefined;
    this.footerHint = undefined;
    this.myriapodaTab = undefined;
    this.worldTab = undefined;
    this.myriapodaTabHitArea = undefined;
    this.worldTabHitArea = undefined;
    this.closeButton = undefined;
    this.resourceIcons = [];
    this.resourceCountTexts = [];
    this.resourceSlotBounds = [];
    this.closeKey = undefined;
    this.evolutionKey = undefined;
    this.closing = false;
    this.worldActionCallbacks = undefined;
    this.armedWorldAction = null;
    this.worldActionMessage = '';
  }
}
