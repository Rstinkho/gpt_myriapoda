import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { getHexTypeDefinition } from '@/game/hexTypes';
import type { ExpansionEvent, HexCell, WorldRenderSnapshot } from '@/game/types';
import { createCoordKey } from '@/entities/world/WorldExpansion';
import { GraphicsMaskController } from '@/phaser/GraphicsMaskController';
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
const worldConquestHudOffset = 8.2;
const worldRevealGlowRadiusPadding = 18;
const worldRevealGlowAlpha = 0.14;
const worldRevealGlowColor = 0x88edff;

export class WorldRenderer {
  private readonly revealGlowGraphics: Phaser.GameObjects.Graphics;
  private readonly cellGraphics: Phaser.GameObjects.Graphics;
  private readonly cellStrokeGraphics: Phaser.GameObjects.Graphics;
  private readonly borderShadowGraphics: Phaser.GameObjects.Graphics;
  private readonly conquestHudGraphics: Phaser.GameObjects.Graphics;
  private readonly worldBorderMask: GraphicsMaskController;
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
  /** Cached silhouette mask fingerprint — shares the same generation semantics. */
  private silhouetteMaskFingerprint = '';
  /**
   * Fingerprint for the border-shadow graphics layer (rail + progress arc + tip orb).
   * When the fingerprint doesn't change, we skip the `clear()` + redraw entirely. This
   * is crucial because `borderShadowGraphics` has a bloom filter attached — every
   * `clear()`/redraw re-uploads geometry and forces the filter to re-convolve the
   * whole layer, which read as per-frame blinking/re-rendering on camera moves even
   * though the border shape itself hadn't changed.
   *
   * The inputs to this fingerprint are *only* the things that visually change the
   * border: the world shape (generation), the animated fill progress (quantized so
   * the per-frame LERP-towards-target noise doesn't bust the cache), and the
   * expansion animation state.
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

    this.borderShadowGraphics = scene.add.graphics();
    this.borderShadowGraphics.setDepth(base + worldBorderShadowOffset);
    this.borderShadowGraphics.setScrollFactor(1);
    this.borderShadowGraphics.enableFilters();

    this.conquestHudGraphics = scene.add.graphics();
    this.conquestHudGraphics.setDepth(base + worldConquestHudOffset);
    this.conquestHudGraphics.setScrollFactor(1);

    Phaser.Actions.AddEffectBloom(this.borderShadowGraphics, {
      threshold: tuning.worldBorderBloomThreshold,
      blurRadius: tuning.worldBorderBloomRadius,
      blurSteps: tuning.worldBorderBloomSteps,
      blendAmount: tuning.worldBorderBloomAmount,
      useInternal: true,
    });

    this.worldBorderMask = new GraphicsMaskController(scene, {
      viewCamera: scene.cameras.main,
      viewTransform: 'world',
      invert: true,
    });
    this.worldBorderMask.attach(this.borderShadowGraphics);
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
    this.worldBorderMask.destroy();
    this.revealGlowGraphics.destroy();
    this.cellGraphics.destroy();
    this.cellStrokeGraphics.destroy();
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
    // Note: `borderShadowGraphics` is intentionally *not* cleared here. It is
    // cleared below only when the border layer fingerprint changes. Keeping it
    // stable between frames avoids the bloom filter re-convolving every frame,
    // which was presenting as a constant "re-render" of the hex outline during
    // normal movement/camera motion even though the border shape was static.
    this.cellGraphics.clear();
    this.cellStrokeGraphics.clear();
    this.conquestHudGraphics.clear();
    this.revealGlowGraphics.clear();

    const actualProgress = Math.max(0, Math.min(1, snapshot.fillLevel / Math.max(1, snapshot.fillThreshold)));
    let animation = sampleStageAnimation(1);
    let visibleCells = snapshot.cells;

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
    if (expansionCyanRims) {
      const rimAlpha = animation.cyanPrime !== undefined ? animation.cyanPrime : 1;
      this.renderExpansionCyanPrimeOverlays(
        this.cellStrokeGraphics,
        silhouetteCells,
        snapshot.hexSize,
        rimAlpha,
      );
    }
    // Silhouette mask is fingerprinted by `generation` and rebuilds only on world
    // mutation; it uses the *raw* (unrotated) cell positions so the mask stays
    // valid for the whole expansion animation even as cells rotate inside it.
    this.drawWorldSilhouetteMask(snapshot.cells, snapshot.hexSize, snapshot.generation);

    // Border layer is redrawn *only* when something visually relevant changed:
    //   - World shape mutated (generation bump).
    //   - Animated fill progress crossed a visible threshold (quantized).
    //   - An expansion animation is in progress (border tracks the rotation).
    // Camera pans, player movement, and the `fillPulse` decay all leave this
    // fingerprint unchanged, so the bloom-filtered graphics keeps its previous
    // frame intact — no clear, no re-upload, no filter re-convolution.
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
        silhouetteCells,
        snapshot.hexSize,
        snapshot.generation,
        borderCacheSalt,
      );
    }
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

  /** Thick stacked cyan rims on every cell for the full stage-expansion animation (alpha ramps during cyan-prime segment). */
  private renderExpansionCyanPrimeOverlays(
    graphics: Phaser.GameObjects.Graphics,
    cells: RenderCell[],
    hexSize: number,
    cyanPrime: number,
  ): void {
    const a = Math.max(0, Math.min(1, cyanPrime));
    const glowW = (tuning.worldBorderGlowWidth * 1.1) / 2;
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

        graphics.lineStyle(glowW + outerW * 0.5, 0x0a5d77, 0.4 * a * lineAlpha);
        graphics.lineBetween(ax, ay, bx, by);
        graphics.lineStyle(outerW, 0x39d7f2, 0.88 * a * lineAlpha);
        graphics.lineBetween(ax, ay, bx, by);
        graphics.lineStyle(innerW, 0xc9f9ff, 0.95 * a * lineAlpha);
        graphics.lineBetween(ax, ay, bx, by);
      }
    }
  }

  /**
   * Builds an inverted silhouette mask covering every world hex. The border-shadow filter
   * uses this to clip its bloom to the outside of the world shape. Fingerprinted by the
   * world's `generation` counter + hexSize so the mask rebuilds exactly once per world
   * mutation (expansion, conquest state change, ownership change).
   *
   * Guarded on `cells.length > 0` so the initial empty render (before WorldSystem has
   * populated its snapshot) doesn't write an empty mask that would leave the bloom
   * unclipped for a frame.
   */
  private drawWorldSilhouetteMask(cells: HexCell[], hexSize: number, generation: number): void {
    if (cells.length === 0) {
      return;
    }

    const fingerprint = `${generation}:${hexSize.toFixed(2)}`;
    if (fingerprint === this.silhouetteMaskFingerprint) {
      return;
    }
    this.silhouetteMaskFingerprint = fingerprint;

    const borderRadius = Math.max(4, hexSize);
    this.worldBorderMask.clear();
    this.worldBorderMask.drawMask((g) => {
      for (const cell of cells) {
        const pts = createRegularHexPoints(
          cell.centerX,
          cell.centerY,
          borderRadius,
          this.hexPointsScratch,
        );
        g.fillPoints(pts as Phaser.Math.Vector2[], true);
      }
    });
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
    // the cell layer (via `fillPulse` influencing cell stroke width + alpha);
    // the outer border stays at a constant width so its bloom-filtered layer
    // can stay static between genuine fill-progress / stage changes.
    const progressOuterWidth = tuning.worldBorderProgressWidth;
    const progressInnerWidth = progressOuterWidth * 0.56;

    // Rail collapsed from 4 passes to 2: dark-underlay + bright core. The bloom filter
    // on this layer generates the outer halo, so the prior halo/cyan-ring passes were
    // largely redundant overdraw under the glow.
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

    this.drawJoinedEdges(
      graphics,
      progressEdges,
      progressOuterWidth + tuning.worldBorderGlowWidth,
      0x0a5d77,
      0.44,
    );
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
