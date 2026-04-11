import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { getHexTypeDefinition } from '@/game/hexTypes';
import type { ExpansionEvent, HexCell, WorldRenderSnapshot } from '@/game/types';
import { createCoordKey } from '@/entities/world/WorldExpansion';
import {
  createExposedHexEdges,
  createProgressBorderEdges,
  createProgressBorderSlice,
  createRegularHexPoints,
} from '@/rendering/worldBorderMath';
import {
  advanceDisplayFillProgress,
  sampleExpansionDisplayProgress,
  sampleStageAnimation,
} from '@/rendering/worldAnimationMath';
import {
  getPlayerInfluence,
} from '@/rendering/worldCellMath';

interface RenderCell extends HexCell {
  scale: number;
  alpha: number;
  playerInfluence: number;
}

interface PendingExpansion {
  elapsed: number;
  newCellKeys: Set<string>;
  overflowProgress: number;
  startProgress: number;
}

export class WorldRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private fillPulse = 0;
  private displayFillProgress = 0;
  private pendingExpansion: PendingExpansion | null = null;
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(1);
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
  }

  isExpansionActive(): boolean {
    return this.pendingExpansion !== null;
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
    this.graphics.clear();

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

    const renderCells = this.createRenderCells(visibleCells, snapshot, animation);
    this.renderCells(renderCells, snapshot.hexSize, animation.revealProgress);
    if (!this.pendingExpansion) {
      this.renderBorder(renderCells, snapshot.hexSize);
    }

    if (this.pendingExpansion && this.getExpansionProgress() >= 1) {
      this.pendingExpansion = null;
    }
  }

  private getExpansionProgress(): number {
    if (!this.pendingExpansion || tuning.expansionAnimationSeconds <= 0) {
      return 1;
    }

    return Math.max(0, Math.min(1, this.pendingExpansion.elapsed / tuning.expansionAnimationSeconds));
  }

  private createRenderCells(
    cells: HexCell[],
    snapshot: WorldRenderSnapshot,
    animation: { spacingBreath: number; rotation: number; revealProgress: number },
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

      return {
        ...cell,
        centerX: rotated.x,
        centerY: rotated.y,
        scale: isNew ? this.lerp(tuning.worldRevealCellMinScale, 1, animation.revealProgress) : 1,
        alpha: isNew ? animation.revealProgress : 1,
        playerInfluence,
      };
    });
  }

  private renderCells(renderCells: RenderCell[], hexSize: number, revealProgress: number): void {
    const cellStrokeAlpha = 0.34 + this.fillPulse * 0.18 + revealProgress * 0.08;
    const cellLineWidth = 2.2 + this.fillPulse * 0.9 + revealProgress * 0.95;

    for (const cell of renderCells) {
      const cellRadius = Math.max(4, (hexSize - tuning.worldCellInset) * cell.scale);
      const shadowPoints = createRegularHexPoints(
        cell.centerX,
        cell.centerY,
        Math.max(3, cellRadius + tuning.worldCellShadowInset),
      );
      const points = createRegularHexPoints(cell.centerX, cell.centerY, cellRadius);
      const innerPoints = createRegularHexPoints(
        cell.centerX,
        cell.centerY,
        Math.max(3, cellRadius - tuning.worldCellInnerInset),
      );
      const phase = this.getCellPhase(cell);
      const hexType = getHexTypeDefinition(cell.type);
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * tuning.worldCellPulseSpeed + phase);
      const shimmer =
        0.5 +
        0.5 * Math.sin(this.elapsed * tuning.worldCellHighlightTravelSpeed + phase * 1.7 + this.displayFillProgress * Math.PI);
      const fillAlpha =
        (tuning.worldCellBaseFillAlpha + pulse * 0.045 + revealProgress * 0.025) * cell.alpha;
      const reactiveAlpha =
        (tuning.worldCellReactiveFillAlpha * 0.52 +
          pulse * 0.04 +
          this.fillPulse * 0.08 +
          cell.playerInfluence * 0.08) *
        cell.alpha;
      const innerGlowAlpha =
        (tuning.worldCellReactiveGlowAlpha * 0.72 +
          shimmer * 0.06 +
          this.displayFillProgress * 0.04 +
          cell.playerInfluence * tuning.worldCellPlayerGlowAlpha) *
        cell.alpha;
      const contourAlpha =
        (tuning.worldCellContourAlpha + shimmer * 0.05 + cell.playerInfluence * 0.12) * cell.alpha;
      const shadowAlpha = (0.1 + cell.playerInfluence * 0.08) * cell.alpha;
      const strokeAlpha = (cellStrokeAlpha + cell.playerInfluence * 0.18) * cell.alpha;

      this.graphics.fillStyle(hexType.shadowColor, shadowAlpha);
      this.graphics.fillPoints(shadowPoints as Phaser.Math.Vector2[], true);

      this.graphics.fillStyle(hexType.fillColor, fillAlpha);
      this.graphics.fillPoints(points as Phaser.Math.Vector2[], true);

      this.graphics.fillStyle(hexType.reactiveColor, reactiveAlpha);
      this.graphics.fillPoints(points as Phaser.Math.Vector2[], true);

      if (cell.playerInfluence > 0.01) {
        this.graphics.fillStyle(0x66dbff, cell.playerInfluence * 0.085 * cell.alpha);
        this.graphics.fillPoints(shadowPoints as Phaser.Math.Vector2[], true);
      }

      this.graphics.fillStyle(hexType.glowColor, innerGlowAlpha);
      this.graphics.fillPoints(innerPoints as Phaser.Math.Vector2[], true);

      this.graphics.lineStyle(cellLineWidth + 1.2, 0x061013, 0.54 * cell.alpha);
      this.graphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      this.graphics.lineStyle(cellLineWidth, hexType.strokeColor, strokeAlpha);
      this.graphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      this.graphics.lineStyle(
        Math.max(0.8, cellLineWidth * 0.42),
        hexType.contourColor,
        contourAlpha,
      );
      this.graphics.strokePoints(innerPoints as Phaser.Math.Vector2[], true, true);
    }
  }

  private renderBorder(cells: HexCell[], hexSize: number): void {
    const borderRadius = Math.max(4, hexSize);
    const exposedEdges = createExposedHexEdges(cells, borderRadius);
    if (exposedEdges.length === 0) {
      return;
    }

    const progress = Math.max(0, Math.min(1, this.displayFillProgress));
    const progressEdges = createProgressBorderEdges(exposedEdges, progress);
    const trailEdges = createProgressBorderSlice(
      exposedEdges,
      Math.max(0, progress - tuning.worldBorderTrailWindow),
      progress,
    );
    const frontEdges = createProgressBorderSlice(
      exposedEdges,
      Math.max(0, progress - tuning.worldBorderFrontWindow),
      progress,
    );
    const railOuterWidth = tuning.worldBorderBaseWidth;
    const railInnerWidth = tuning.worldBorderBaseWidth * 0.34;
    const progressOuterWidth = tuning.worldBorderProgressWidth + this.fillPulse * 1.2;
    const progressInnerWidth = progressOuterWidth * 0.56;

    this.drawJoinedEdges(
      exposedEdges,
      railOuterWidth + tuning.worldBorderGlowWidth * 0.8,
      0x143640,
      0.3 + this.fillPulse * 0.08,
    );
    this.drawJoinedEdges(exposedEdges, railOuterWidth, 0x081416, 0.9);
    this.drawJoinedEdges(exposedEdges, railInnerWidth + 1.2, 0x4dcfe6, 0.42);
    this.drawJoinedEdges(exposedEdges, railInnerWidth, 0xcafcff, 0.94);

    if (progressEdges.length === 0) {
      return;
    }

    this.drawJoinedEdges(
      progressEdges,
      progressOuterWidth + tuning.worldBorderGlowWidth,
      0x0a5d77,
      0.44,
    );
    this.drawJoinedEdges(progressEdges, progressOuterWidth, 0x39d7f2, 0.78);
    this.drawJoinedEdges(progressEdges, progressInnerWidth * 0.92, 0xc9f9ff, 0.62);

    this.drawJoinedEdges(trailEdges, progressOuterWidth * 0.92, 0x7de7ff, 0.34);
    this.drawJoinedEdges(frontEdges, progressOuterWidth * 0.78, 0xf7ca76, 0.96);
    this.drawJoinedEdges(frontEdges, progressInnerWidth, 0xfff5dd, 0.98);

    const tip = progressEdges[progressEdges.length - 1].end;
    this.graphics.fillStyle(0xf7d490, 0.96);
    this.graphics.fillCircle(tip.x, tip.y, Math.max(4.5, progressOuterWidth * 0.24));
    this.graphics.fillStyle(0xfff8ea, 0.98);
    this.graphics.fillCircle(tip.x, tip.y, Math.max(2.2, progressInnerWidth * 0.22));
  }

  private drawJoinedEdges(
    edges: { start: { x: number; y: number }; end: { x: number; y: number } }[],
    width: number,
    color: number,
    alpha: number,
  ): void {
    this.graphics.lineStyle(width, color, alpha);
    for (const edge of edges) {
      this.graphics.lineBetween(edge.start.x, edge.start.y, edge.end.x, edge.end.y);
    }
    this.graphics.fillStyle(color, alpha);
    const jointRadius = Math.max(1.6, width * 0.52);
    for (const edge of edges) {
      this.graphics.fillCircle(edge.start.x, edge.start.y, jointRadius);
      this.graphics.fillCircle(edge.end.x, edge.end.y, jointRadius);
    }
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
