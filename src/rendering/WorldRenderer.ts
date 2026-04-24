import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { getHexTypeDefinition } from '@/game/hexTypes';
import type { ExpansionEvent, HexCell, WorldRenderSnapshot } from '@/game/types';
import { createCoordKey } from '@/entities/world/WorldExpansion';
import {
  type BorderEdge,
  type BorderPoint,
  createExposedHexEdges,
  createDashedLineSegments,
  createProgressBorderEdgesFromOrdered,
  createProgressBorderSliceFromOrdered,
  createRegularHexPoints,
  HEX_NEIGHBOR_DIRECTIONS,
  orderBorderEdgesClockwise,
} from '@/rendering/worldBorderMath';
import {
  advanceDisplayFillProgress,
  sampleExpansionDisplayProgress,
  sampleStageAnimation,
  type StageAnimationSample,
} from '@/rendering/worldAnimationMath';
import {
  getPlayerInfluence,
} from '@/rendering/worldCellMath';

interface RenderCell extends HexCell {
  scale: number;
  alpha: number;
  isNew: boolean;
  playerInfluence: number;
}

interface PendingExpansion {
  elapsed: number;
  newCellKeys: Set<string>;
  overflowProgress: number;
  startProgress: number;
}

const worldRevealGlowOffset = -0.22;
const worldBorderShadowOffset = -0.08;
/** Hex outlines sit above tile fills but below player, plants, pickups, and enemies (see GameScene ~4.8+, Pickup 6, plants 7, jellyfish 8, head 12). */
const worldCellStrokeOffset = 3.5;
const worldStructureOffset = 4.1;
const worldConquestHudOffset = 8.2;
const worldRevealGlowRadiusPadding = 18;
const worldRevealGlowAlpha = 0.14;
const worldRevealGlowColor = 0x88edff;

export class WorldRenderer {
  private readonly revealGlowGraphics: Phaser.GameObjects.Graphics;
  private readonly cellGraphics: Phaser.GameObjects.Graphics;
  private readonly cellStrokeGraphics: Phaser.GameObjects.Graphics;
  private readonly structureGraphics: Phaser.GameObjects.Graphics;
  private readonly borderShadowGraphics: Phaser.GameObjects.Graphics;
  private readonly conquestHudGraphics: Phaser.GameObjects.Graphics;
  private fillPulse = 0;
  private displayFillProgress = 0;
  private pendingExpansion: PendingExpansion | null = null;
  private elapsed = 0;
  /**
   * Scratch buffers for hex vertices — avoid per-call allocation inside the render loop.
   * Two separate buffers so a single iteration can compute two hex polygons
   * (primary outline + outer glow ring for owned cells, etc.) without stomping.
   */
  private readonly hexPointsScratch: BorderPoint[] = createRegularHexPoints(0, 0, 1);
  private readonly hexPointsScratchAlt: BorderPoint[] = createRegularHexPoints(0, 0, 1);
  /**
   * Cached ordered border edge chain + fingerprint. Rebuilt only on cell-set changes.
   * Fingerprint is `(world.generation, hexSize)` — generation is a monotonic counter
   * bumped by HexWorld on any mutation (expansion, conquest, ownership). Previously we
   * used `(cellCount, hexSize)` which was *coarse*: if the count happened to match
   * across stages/conquests the cache would hand back a stale chain, producing the
   * border "blinking" to the wrong shape for a frame.
   */
  private cachedOrderedEdges: BorderEdge[] | null = null;
  private cachedOrderedEdgesFingerprint = '';
  /**
   * Fingerprint for the border graphics layer (rail + progress arc + tip orb).
   * When unchanged, skip `clear()` + redraw to avoid redundant work each frame.
   */
  private borderLayerFingerprint = '';

  constructor(scene: Phaser.Scene) {
    const base = tuning.worldHexBaseDepth;
    this.revealGlowGraphics = scene.add.graphics();
    this.revealGlowGraphics.setDepth(base + worldRevealGlowOffset);
    this.revealGlowGraphics.setScrollFactor(1);

    this.cellGraphics = scene.add.graphics();
    this.cellGraphics.setDepth(base);

    this.cellStrokeGraphics = scene.add.graphics();
    this.cellStrokeGraphics.setDepth(base + worldCellStrokeOffset);
    this.cellStrokeGraphics.setScrollFactor(1);

    this.structureGraphics = scene.add.graphics();
    this.structureGraphics.setDepth(base + worldStructureOffset);
    this.structureGraphics.setScrollFactor(1);

    this.borderShadowGraphics = scene.add.graphics();
    this.borderShadowGraphics.setDepth(base + worldBorderShadowOffset);
    this.borderShadowGraphics.setScrollFactor(1);

    this.conquestHudGraphics = scene.add.graphics();
    this.conquestHudGraphics.setDepth(base + worldConquestHudOffset);
    this.conquestHudGraphics.setScrollFactor(1);
  }

  addFillPulse(amount: number): void {
    this.fillPulse = Math.max(this.fillPulse, amount);
  }

  startExpansion(expansion: ExpansionEvent, overflowProgress: number): void {
    this.fillPulse = 1;
    this.pendingExpansion = {
      elapsed: 0,
      newCellKeys: new Set(expansion.newCells.map((cell) => createCoordKey(cell.coord))),
      overflowProgress: Math.max(0, Math.min(1, overflowProgress)),
      startProgress: this.displayFillProgress,
    };
    // Cache invalidation is now driven by the world's generation counter flowing
    // through `WorldRenderSnapshot.generation`; no explicit reset needed here.
  }

  isExpansionActive(): boolean {
    return this.pendingExpansion !== null;
  }

  destroy(): void {
    this.revealGlowGraphics.destroy();
    this.cellGraphics.destroy();
    this.cellStrokeGraphics.destroy();
    this.structureGraphics.destroy();
    this.borderShadowGraphics.destroy();
    this.conquestHudGraphics.destroy();
  }

  getSpawnableCells(cells: HexCell[]): HexCell[] {
    if (!this.pendingExpansion) {
      return cells;
    }

    const revealProgress = sampleStageAnimation(this.getExpansionProgress()).revealProgress;
    if (revealProgress > 0.001) {
      return cells;
    }

    return cells.filter((cell) => !this.pendingExpansion?.newCellKeys.has(createCoordKey(cell.coord)));
  }

  update(snapshot: WorldRenderSnapshot): void {
    this.elapsed += tuning.fixedStepSeconds;
    this.fillPulse = Math.max(0, this.fillPulse - tuning.fixedStepSeconds * tuning.worldFillPulseDecay);
    // Note: `borderShadowGraphics` is cleared only when the border fingerprint changes.
    this.cellGraphics.clear();
    this.cellStrokeGraphics.clear();
    this.structureGraphics.clear();
    this.conquestHudGraphics.clear();
    this.revealGlowGraphics.clear();

    const actualProgress = Math.max(0, Math.min(1, snapshot.fillLevel / Math.max(1, snapshot.fillThreshold)));
    let animation = sampleStageAnimation(1);
    let visibleCells = snapshot.cells;
    const progressCells = snapshot.progressCells && snapshot.progressCells.length > 0
      ? snapshot.progressCells
      : snapshot.cells;

    if (this.pendingExpansion) {
      this.pendingExpansion.elapsed = Math.min(
        tuning.expansionAnimationSeconds,
        this.pendingExpansion.elapsed + tuning.fixedStepSeconds,
      );
      const expansionProgress = this.getExpansionProgress();
      animation = sampleStageAnimation(expansionProgress);
      this.displayFillProgress = sampleExpansionDisplayProgress(
        this.pendingExpansion.startProgress,
        this.pendingExpansion.overflowProgress,
        expansionProgress,
      );
      visibleCells =
        animation.revealProgress > 0.001
          ? snapshot.cells
          : snapshot.cells.filter(
              (cell) => !this.pendingExpansion?.newCellKeys.has(createCoordKey(cell.coord)),
            );
    } else {
      this.displayFillProgress = advanceDisplayFillProgress(
        this.displayFillProgress,
        actualProgress,
        tuning.worldFillDisplayLerp,
      );
    }

    const silhouetteCells = this.createRenderCells(snapshot.cells, snapshot, animation, 'full');
    const revealCells = this.createRenderCells(snapshot.cells, snapshot, animation, 'revealed');
    const visibleRenderCells = this.createRenderCells(visibleCells, snapshot, animation, 'revealed');
    const progressRenderCells = this.createRenderCells(progressCells, snapshot, animation, 'full');

    const suppressHeavyFx = this.pendingExpansion !== null;
    const expansionCyanRims = this.pendingExpansion !== null;

    this.renderRevealGlow(revealCells, snapshot.hexSize, suppressHeavyFx);
    this.renderCells(
      this.cellGraphics,
      this.cellStrokeGraphics,
      visibleRenderCells,
      snapshot.hexSize,
      animation.revealProgress,
      expansionCyanRims,
    );
    this.renderTerritoryOverlays(
      this.cellStrokeGraphics,
      visibleRenderCells,
      snapshot.hexSize,
    );
    this.renderStructures(this.structureGraphics, visibleRenderCells, snapshot.hexSize);
    if (expansionCyanRims) {
      const rimAlpha = animation.cyanPrime !== undefined ? animation.cyanPrime : 1;
      this.renderExpansionCyanPrimeOverlays(
        this.cellStrokeGraphics,
        silhouetteCells,
        snapshot.hexSize,
        rimAlpha,
      );
    }
    // Border layer is redrawn only when something visually relevant changed:
    // world shape (generation), quantized fill progress, or expansion animation.
    const borderCacheSalt = this.pendingExpansion
      ? `exp:${this.pendingExpansion.elapsed.toFixed(3)}`
      : 'static';
    const quantizedProgress = Math.round(this.displayFillProgress * 1000) / 1000;
    const borderFingerprint = `${snapshot.generation}:${snapshot.hexSize.toFixed(2)}:${quantizedProgress.toFixed(3)}:${borderCacheSalt}`;
    if (borderFingerprint !== this.borderLayerFingerprint) {
      this.borderLayerFingerprint = borderFingerprint;
      this.borderShadowGraphics.clear();
      this.renderBorder(
        this.borderShadowGraphics,
        progressRenderCells,
        snapshot.hexSize,
        snapshot.generation,
        borderCacheSalt,
      );
    }
    this.renderObjectiveTarget(this.conquestHudGraphics, visibleRenderCells, snapshot);
    this.renderConquestProgressBar(this.conquestHudGraphics, visibleRenderCells, snapshot);

    if (this.pendingExpansion && this.getExpansionProgress() >= 1) {
      this.pendingExpansion = null;
    }
  }

  private renderTerritoryOverlays(
    graphics: Phaser.GameObjects.Graphics,
    cells: RenderCell[],
    hexSize: number,
  ): void {
    const dashOffset = this.elapsed * tuning.conquerBorderDashTravelSpeed;

    for (const cell of cells) {
      if (!cell.conquestState) {
        continue;
      }

      const radius = Math.max(4, (hexSize - tuning.worldCellInset) * cell.scale * 0.94);
      const points = createRegularHexPoints(
        cell.centerX,
        cell.centerY,
        radius,
        this.hexPointsScratch,
      );

      if (cell.conquestState === 'owned') {
        graphics.fillStyle(
          tuning.conquerBorderOwnedGlowColor,
          0.09 * cell.alpha,
        );
        graphics.fillPoints(
          createRegularHexPoints(
            cell.centerX,
            cell.centerY,
            radius * 1.12,
            this.hexPointsScratchAlt,
          ) as Phaser.Math.Vector2[],
          true,
        );
        graphics.fillStyle(
          tuning.conquerBorderOwnedFillColor,
          0.22 * cell.alpha,
        );
        graphics.fillPoints(points as Phaser.Math.Vector2[], true);
        graphics.lineStyle(
          tuning.conquerBorderOwnedWidth + 2.4,
          tuning.conquerBorderOwnedDarkColor,
          0.58 * cell.alpha,
        );
        graphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
        graphics.lineStyle(
          tuning.conquerBorderOwnedWidth,
          tuning.conquerBorderOwnedColor,
          0.88 * cell.alpha,
        );
        graphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
        graphics.lineStyle(
          tuning.conquerBorderOwnedWidth * 0.42,
          tuning.conquerBorderOwnedCoreColor,
          0.94 * cell.alpha,
        );
        graphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
        continue;
      }

      for (let side = 0; side < HEX_NEIGHBOR_DIRECTIONS.length; side += 1) {
        const dashedSegments = createDashedLineSegments(
          points[side],
          points[(side + 1) % points.length],
          tuning.conquerBorderDashLengthPx,
          tuning.conquerBorderGapLengthPx,
          dashOffset + side * (tuning.conquerBorderGapLengthPx * 0.7),
        );
        for (const segment of dashedSegments) {
          graphics.lineStyle(
            tuning.conquerBorderAnimatedWidth + 2,
            tuning.conquerBorderDarkColor,
            0.44 * cell.alpha,
          );
          graphics.lineBetween(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
          graphics.lineStyle(
            tuning.conquerBorderAnimatedWidth,
            tuning.conquerBorderActiveColor,
            0.92 * cell.alpha,
          );
          graphics.lineBetween(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
          graphics.lineStyle(
            Math.max(1.4, tuning.conquerBorderAnimatedWidth * 0.36),
            tuning.conquerBorderCoreColor,
            0.96 * cell.alpha,
          );
          graphics.lineBetween(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
        }
      }
    }
  }

  private getExpansionProgress(): number {
    if (!this.pendingExpansion || tuning.expansionAnimationSeconds <= 0) {
      return 1;
    }

    return Math.max(0, Math.min(1, this.pendingExpansion.elapsed / tuning.expansionAnimationSeconds));
  }

  private renderConquestProgressBar(
    graphics: Phaser.GameObjects.Graphics,
    cells: RenderCell[],
    snapshot: WorldRenderSnapshot,
  ): void {
    const conquest = snapshot.conquest;
    if (!conquest) {
      return;
    }

    const targetCell = cells.find(
      (cell) => cell.coord.q === conquest.coord.q && cell.coord.r === conquest.coord.r,
    );
    if (!targetCell) {
      return;
    }

    const radius = Math.max(4, (snapshot.hexSize - tuning.worldCellInset) * targetCell.scale * 0.94);
    const topY =
      targetCell.centerY - radius - tuning.conquerProgressBarOffsetYPx - tuning.conquerProgressBarHeightPx;
    const leftX = targetCell.centerX - tuning.conquerProgressBarWidthPx * 0.5;
    const timeProgress = Math.max(
      0,
      Math.min(1, conquest.occupiedSeconds / Math.max(0.0001, conquest.occupiedGoalSeconds)),
    );
    const killProgress = Math.max(
      0,
      Math.min(1, conquest.killCount / Math.max(1, conquest.killGoal)),
    );
    const pulse = conquest.playerInside
      ? 0.72 + Math.sin(this.elapsed * 6.2) * 0.12
      : 0.36;

    graphics.fillStyle(tuning.conquerBorderDarkColor, 0.24 + pulse * 0.08);
    graphics.fillRoundedRect(
      leftX - 5,
      topY - 5,
      tuning.conquerProgressBarWidthPx + 10,
      tuning.conquerProgressBarHeightPx + 10,
      10,
    );

    graphics.fillStyle(tuning.conquerProgressRailColor, 0.92);
    graphics.fillRoundedRect(
      leftX,
      topY,
      tuning.conquerProgressBarWidthPx,
      tuning.conquerProgressBarHeightPx,
      8,
    );

    const laneInset = 3;
    const laneGap = 2;
    const laneHeight =
      (tuning.conquerProgressBarHeightPx - laneInset * 2 - laneGap) * 0.5;
    const innerWidth = tuning.conquerProgressBarWidthPx - laneInset * 2;

    graphics.fillStyle(
      tuning.conquerProgressTimeColor,
      conquest.playerInside ? 0.9 : 0.54,
    );
    graphics.fillRect(
      leftX + laneInset,
      topY + laneInset,
      innerWidth * timeProgress,
      laneHeight,
    );

    graphics.fillStyle(tuning.conquerProgressKillColor, 0.82);
    graphics.fillRect(
      leftX + laneInset,
      topY + laneInset + laneHeight + laneGap,
      innerWidth * killProgress,
      laneHeight,
    );

    graphics.lineStyle(1.2, tuning.conquerProgressOutlineColor, 0.94);
    graphics.strokeRoundedRect(
      leftX,
      topY,
      tuning.conquerProgressBarWidthPx,
      tuning.conquerProgressBarHeightPx,
      8,
    );
  }

  private renderObjectiveTarget(
    graphics: Phaser.GameObjects.Graphics,
    cells: RenderCell[],
    snapshot: WorldRenderSnapshot,
  ): void {
    if (!snapshot.objectiveTargetCoord) {
      return;
    }

    const targetCell = cells.find(
      (cell) =>
        cell.coord.q === snapshot.objectiveTargetCoord?.q &&
        cell.coord.r === snapshot.objectiveTargetCoord?.r,
    );
    if (!targetCell) {
      return;
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 4.6);
    const radius = Math.max(10, (snapshot.hexSize - tuning.worldCellInset) * targetCell.scale * 0.92);
    const ringRadius = radius * 1.08 + pulse * 8;
    const beaconY = targetCell.centerY - ringRadius - 16 - pulse * 6;

    graphics.fillStyle(0xf7f1aa, 0.08 + pulse * 0.08);
    graphics.fillCircle(targetCell.centerX, targetCell.centerY, ringRadius + 8);
    graphics.lineStyle(3.2, 0x332b13, 0.54);
    graphics.strokeCircle(targetCell.centerX, targetCell.centerY, ringRadius);
    graphics.lineStyle(2.1, 0xf7e897, 0.86);
    graphics.strokeCircle(targetCell.centerX, targetCell.centerY, ringRadius - 2);
    graphics.lineStyle(1.2, 0xfffdf1, 0.94);
    graphics.strokeCircle(targetCell.centerX, targetCell.centerY, Math.max(8, radius * 0.92));

    graphics.fillStyle(0xfff7cf, 0.94);
    graphics.fillTriangle(
      targetCell.centerX,
      beaconY,
      targetCell.centerX - 9,
      beaconY - 14,
      targetCell.centerX + 9,
      beaconY - 14,
    );
    graphics.lineStyle(1.4, 0x3c3217, 0.6);
    graphics.strokeTriangle(
      targetCell.centerX,
      beaconY,
      targetCell.centerX - 9,
      beaconY - 14,
      targetCell.centerX + 9,
      beaconY - 14,
    );
  }

  private createRenderCells(
    cells: HexCell[],
    snapshot: WorldRenderSnapshot,
    animation: StageAnimationSample,
    mode: 'full' | 'revealed',
  ): RenderCell[] {
    if (cells.length === 0) {
      return [];
    }

    const worldCenter = {
      x: snapshot.bounds.centerX,
      y: snapshot.bounds.centerY,
    };

    return cells.map((cell) => {
      const directionX = cell.centerX - worldCenter.x;
      const directionY = cell.centerY - worldCenter.y;
      const distance = Math.hypot(directionX, directionY);
      const normalX = distance > 0 ? directionX / distance : 0;
      const normalY = distance > 0 ? directionY / distance : 0;
      const breathDistance =
        animation.spacingBreath * snapshot.hexSize * tuning.worldStageSpacingBreath;
      const breathedX = cell.centerX + normalX * breathDistance;
      const breathedY = cell.centerY + normalY * breathDistance;
      const rotated = this.rotateAround(
        breathedX,
        breathedY,
        worldCenter.x,
        worldCenter.y,
        animation.rotation,
      );
      const isNew = this.pendingExpansion?.newCellKeys.has(createCoordKey(cell.coord)) ?? false;
      const playerInfluence = getPlayerInfluence(
        rotated.x,
        rotated.y,
        snapshot.focusX,
        snapshot.focusY,
        snapshot.hexSize * tuning.worldCellPlayerInfluenceRadiusMultiplier,
      );
      const scale = isNew ? this.lerp(tuning.worldRevealCellMinScale, 1, animation.revealProgress) : 1;
      const alpha = isNew ? animation.revealProgress : 1;

      return {
        ...cell,
        centerX: rotated.x,
        centerY: rotated.y,
        scale: mode === 'full' ? 1 : scale,
        alpha: mode === 'full' ? 1 : alpha,
        isNew,
        playerInfluence,
      };
    });
  }

  private renderCells(
    fillGraphics: Phaser.GameObjects.Graphics,
    strokeGraphics: Phaser.GameObjects.Graphics,
    renderCells: RenderCell[],
    hexSize: number,
    revealProgress: number,
    useExpansionCyanRims: boolean,
  ): void {
    const cellStrokeAlpha =
      tuning.worldCellStrokeBaseAlpha + this.fillPulse * 0.2 + revealProgress * 0.1;
    const cellLineWidth = 2.2 + this.fillPulse * 0.9 + revealProgress * 0.95;

    for (const cell of renderCells) {
      const cellRadius = Math.max(4, (hexSize - tuning.worldCellInset) * cell.scale);
      const points = createRegularHexPoints(
        cell.centerX,
        cell.centerY,
        cellRadius,
        this.hexPointsScratch,
      );
      const phase = this.getCellPhase(cell);
      const hexType = getHexTypeDefinition(cell.type);
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * tuning.worldCellPulseSpeed + phase);
      const fillAlpha =
        (tuning.worldCellBaseFillAlpha + pulse * 0.045 + revealProgress * 0.025) * cell.alpha;
      const reactiveAlpha =
        (tuning.worldCellReactiveFillAlpha * 0.52 +
          pulse * 0.04 +
          this.fillPulse * 0.08 +
          cell.playerInfluence * 0.08) *
        cell.alpha;

      fillGraphics.fillStyle(hexType.fillColor, fillAlpha);
      fillGraphics.fillPoints(points as Phaser.Math.Vector2[], true);

      fillGraphics.fillStyle(hexType.reactiveColor, reactiveAlpha);
      fillGraphics.fillPoints(points as Phaser.Math.Vector2[], true);

      if (cell.playerInfluence > 0.01) {
        fillGraphics.fillStyle(0x66dbff, cell.playerInfluence * 0.085 * cell.alpha);
        fillGraphics.fillPoints(points as Phaser.Math.Vector2[], true);
      }
    }

    if (!useExpansionCyanRims) {
      this.strokeHexCellOutlines(strokeGraphics, renderCells, hexSize, cellLineWidth, cellStrokeAlpha);
    }
  }

  private renderStructures(
    graphics: Phaser.GameObjects.Graphics,
    renderCells: RenderCell[],
    hexSize: number,
  ): void {
    for (const cell of renderCells) {
      if (!cell.buildingId) {
        continue;
      }

      const radius = Math.max(8, (hexSize - tuning.worldCellInset) * cell.scale * 0.28);
      if (cell.buildingId === 'spire') {
        graphics.fillStyle(0xf8eab0, 0.12 * cell.alpha);
        graphics.fillCircle(cell.centerX, cell.centerY, radius * 1.75);
        graphics.lineStyle(2.2, 0xfff0cc, 0.56 * cell.alpha);
        graphics.strokeCircle(cell.centerX, cell.centerY, radius * 1.06);

        graphics.fillStyle(0xf2e1a0, 0.9 * cell.alpha);
        graphics.fillTriangle(
          cell.centerX,
          cell.centerY - radius * 1.18,
          cell.centerX - radius * 0.42,
          cell.centerY + radius * 0.56,
          cell.centerX + radius * 0.42,
          cell.centerY + radius * 0.56,
        );
        graphics.lineStyle(1.6, 0x1f1b10, 0.78 * cell.alpha);
        graphics.strokeTriangle(
          cell.centerX,
          cell.centerY - radius * 1.18,
          cell.centerX - radius * 0.42,
          cell.centerY + radius * 0.56,
          cell.centerX + radius * 0.42,
          cell.centerY + radius * 0.56,
        );
        graphics.fillStyle(0xf0d498, 0.86 * cell.alpha);
        graphics.fillRect(
          cell.centerX - radius * 0.12,
          cell.centerY + radius * 0.48,
          radius * 0.24,
          radius * 0.62,
        );
        graphics.fillStyle(0xbdf6ff, 0.92 * cell.alpha);
        graphics.fillCircle(cell.centerX, cell.centerY - radius * 0.08, radius * 0.18);
      }
    }
  }

  /** Thick stacked cyan rims on every cell for the full stage-expansion animation (alpha ramps during cyan-prime segment). */
  private renderExpansionCyanPrimeOverlays(
    graphics: Phaser.GameObjects.Graphics,
    cells: RenderCell[],
    hexSize: number,
    cyanPrime: number,
  ): void {
    const a = Math.max(0, Math.min(1, cyanPrime));
    const outerW = (tuning.worldBorderProgressWidth * 1.15) / 2;
    const innerW = outerW * 0.55;

    for (const cell of cells) {
      const r = Math.max(4, (hexSize - tuning.worldCellInset) * cell.scale);
      const points = createRegularHexPoints(
        cell.centerX,
        cell.centerY,
        r,
        this.hexPointsScratch,
      );
      const lineAlpha = cell.alpha;

      for (let side = 0; side < HEX_NEIGHBOR_DIRECTIONS.length; side += 1) {
        const ax = points[side].x;
        const ay = points[side].y;
        const bx = points[(side + 1) % 6].x;
        const by = points[(side + 1) % 6].y;

        graphics.lineStyle(outerW * 0.5, 0x0a5d77, 0.4 * a * lineAlpha);
        graphics.lineBetween(ax, ay, bx, by);
        graphics.lineStyle(outerW, 0x39d7f2, 0.88 * a * lineAlpha);
        graphics.lineBetween(ax, ay, bx, by);
        graphics.lineStyle(innerW, 0xc9f9ff, 0.95 * a * lineAlpha);
        graphics.lineBetween(ax, ay, bx, by);
      }
    }
  }

  private renderBorder(
    graphics: Phaser.GameObjects.Graphics,
    cells: HexCell[],
    hexSize: number,
    generation: number,
    cacheSalt: string,
  ): BorderPoint | null {
    const borderRadius = Math.max(4, hexSize);
    const orderedEdges = this.getOrderedBorderEdges(cells, borderRadius, generation, cacheSalt);
    if (orderedEdges.length === 0) {
      return null;
    }

    const progress = Math.max(0, Math.min(1, this.displayFillProgress));
    const progressEdges = createProgressBorderEdgesFromOrdered(orderedEdges, progress);
    const trailEdges = createProgressBorderSliceFromOrdered(
      orderedEdges,
      Math.max(0, progress - tuning.worldBorderTrailWindow),
      progress,
    );
    const frontEdges = createProgressBorderSliceFromOrdered(
      orderedEdges,
      Math.max(0, progress - tuning.worldBorderFrontWindow),
      progress,
    );
    const railOuterWidth = tuning.worldBorderBaseWidth;
    const railInnerWidth = tuning.worldBorderBaseWidth * 0.34;
    // Previously this included `+ this.fillPulse * 1.2`, which caused the border
    // to redraw every frame while the pulse decayed after every pickup (and
    // continuously during expansion). The pickup "flash" feedback now lives on
    // the cell layer (via `fillPulse` influencing cell stroke width + alpha).
    const progressOuterWidth = tuning.worldBorderProgressWidth;
    const progressInnerWidth = progressOuterWidth * 0.56;

    // Rail: dark underlay + bright core.
    this.drawJoinedEdges(
      graphics,
      orderedEdges,
      railOuterWidth,
      0x081416,
      0.9,
    );
    this.drawJoinedEdges(graphics, orderedEdges, railInnerWidth, 0xcafcff, 0.94);

    // Graceful empty-progress handling. Previously we early-returned when
    // `progressEdges` was empty, causing the progress arc + tip orb to pop on/off
    // any time `displayFillProgress` dipped to 0 (first frame, post-expansion
    // animation, etc.). Now we always paint a tip orb at the *starting* point
    // of the border chain so the visual reference never disappears, and simply
    // skip the along-the-arc passes when there's nothing to draw.
    if (progressEdges.length === 0) {
      const startPoint = orderedEdges[0].start;
      graphics.fillStyle(0xf7d490, 0.88);
      graphics.fillCircle(startPoint.x, startPoint.y, Math.max(4.5, progressOuterWidth * 0.24));
      graphics.fillStyle(0xfff8ea, 0.94);
      graphics.fillCircle(startPoint.x, startPoint.y, Math.max(2.2, progressInnerWidth * 0.22));
      return startPoint;
    }

    this.drawJoinedEdges(graphics, progressEdges, progressOuterWidth, 0x39d7f2, 0.78);
    this.drawJoinedEdges(
      graphics,
      progressEdges,
      progressInnerWidth * 0.92,
      0xc9f9ff,
      0.62,
    );

    this.drawJoinedEdges(graphics, trailEdges, progressOuterWidth * 0.92, 0x7de7ff, 0.34);
    this.drawJoinedEdges(graphics, frontEdges, progressOuterWidth * 0.78, 0xf7ca76, 0.96);
    this.drawJoinedEdges(graphics, frontEdges, progressInnerWidth, 0xfff5dd, 0.98);

    const tip = progressEdges[progressEdges.length - 1].end;

    graphics.fillStyle(0xf7d490, 0.96);
    graphics.fillCircle(tip.x, tip.y, Math.max(4.5, progressOuterWidth * 0.24));
    graphics.fillStyle(0xfff8ea, 0.98);
    graphics.fillCircle(tip.x, tip.y, Math.max(2.2, progressInnerWidth * 0.22));

    return tip;
  }

  /**
   * Returns the border edge chain already ordered clockwise, cached by
   * `(generation, borderRadius, cacheSalt)`. The sort + O(N) chain walk inside
   * `orderBorderEdgesClockwise` was being done 3× per frame (once per
   * `createProgressBorderSlice` call); caching makes it 1× per world mutation
   * in the steady state.
   *
   * `generation` is a monotonic counter maintained by HexWorld and bumped on every
   * structural or state change of a cell. Using it (rather than `cells.length`) is
   * what kills the class of blinks where an unchanged cell *count* hid an actually
   * changed cell *set* from the cache.
   *
   * `cacheSalt` is a string that changes per-frame during the expansion animation
   * (when cells are rotated around the world center). Under rotation the edge
   * geometry is different every frame so the cache is intentionally busted; once
   * the animation ends the salt becomes constant and the cache resumes working.
   */
  private getOrderedBorderEdges(
    cells: HexCell[],
    borderRadius: number,
    generation: number,
    cacheSalt: string,
  ): BorderEdge[] {
    const fingerprint = `${generation}:${borderRadius.toFixed(2)}:${cacheSalt}`;
    if (this.cachedOrderedEdges && fingerprint === this.cachedOrderedEdgesFingerprint) {
      return this.cachedOrderedEdges;
    }
    const exposed = createExposedHexEdges(cells, borderRadius);
    this.cachedOrderedEdges = orderBorderEdgesClockwise(exposed);
    this.cachedOrderedEdgesFingerprint = fingerprint;
    return this.cachedOrderedEdges;
  }

  private drawJoinedEdges(
    graphics: Phaser.GameObjects.Graphics,
    edges: { start: { x: number; y: number }; end: { x: number; y: number } }[],
    width: number,
    color: number,
    alpha: number,
  ): void {
    graphics.lineStyle(width, color, alpha);
    for (const edge of edges) {
      graphics.lineBetween(edge.start.x, edge.start.y, edge.end.x, edge.end.y);
    }
    graphics.fillStyle(color, alpha);
    const jointRadius = Math.max(1.6, width * 0.52);
    for (const edge of edges) {
      graphics.fillCircle(edge.start.x, edge.start.y, jointRadius);
      graphics.fillCircle(edge.end.x, edge.end.y, jointRadius);
    }
  }

  /**
   * Each hex draws all six sides with its own inset radius so shared interior edges are stroked twice
   * (double line between neighbors). Rendered in `cellStrokeGraphics` above entities.
   */
  private strokeHexCellOutlines(
    graphics: Phaser.GameObjects.Graphics,
    renderCells: RenderCell[],
    hexSize: number,
    cellLineWidth: number,
    cellStrokeAlpha: number,
  ): void {
    for (const cell of renderCells) {
      const r = Math.max(4, (hexSize - tuning.worldCellInset) * cell.scale);
      const points = createRegularHexPoints(
        cell.centerX,
        cell.centerY,
        r,
        this.hexPointsScratch,
      );
      const lineAlpha = cell.alpha;
      const strokeAlpha = (cellStrokeAlpha + cell.playerInfluence * 0.18) * lineAlpha;
      const hexType = getHexTypeDefinition(cell.type);

      for (let side = 0; side < HEX_NEIGHBOR_DIRECTIONS.length; side += 1) {
        const ax = points[side].x;
        const ay = points[side].y;
        const bx = points[(side + 1) % 6].x;
        const by = points[(side + 1) % 6].y;

        graphics.lineStyle(
          cellLineWidth + 1.2,
          0x061013,
          tuning.worldCellStrokeDarkLayerAlpha * lineAlpha,
        );
        graphics.lineBetween(ax, ay, bx, by);
        graphics.lineStyle(cellLineWidth, hexType.strokeColor, strokeAlpha);
        graphics.lineBetween(ax, ay, bx, by);
      }
    }
  }

  private renderRevealGlow(
    cells: RenderCell[],
    hexSize: number,
    suppress: boolean,
  ): void {
    if (suppress) {
      this.revealGlowGraphics.clear();
      this.revealGlowGraphics.setVisible(false);
      return;
    }

    let hasGlow = false;

    for (const cell of cells) {
      if (!cell.isNew || cell.alpha <= 0.001) {
        continue;
      }

      const fillR = Math.max(4, (hexSize - tuning.worldCellInset) * cell.scale);
      const glowRadius = Math.max(4, fillR + worldRevealGlowRadiusPadding * 0.5 * cell.alpha);
      const glowPoints = createRegularHexPoints(
        cell.centerX,
        cell.centerY,
        glowRadius,
        this.hexPointsScratch,
      );
      this.revealGlowGraphics.fillStyle(worldRevealGlowColor, worldRevealGlowAlpha * cell.alpha);
      this.revealGlowGraphics.fillPoints(glowPoints as Phaser.Math.Vector2[], true);
      hasGlow = true;
    }

    this.revealGlowGraphics.setVisible(hasGlow);
  }

  private rotateAround(
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    rotation: number,
  ): { x: number; y: number } {
    if (rotation === 0) {
      return { x, y };
    }

    const localX = x - centerX;
    const localY = y - centerY;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  private getCellPhase(cell: HexCell): number {
    return cell.coord.q * 1.37 + cell.coord.r * 2.11;
  }
}
