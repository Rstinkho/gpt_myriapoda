import * as Phaser from 'phaser';
import type { HexCell, WorldRenderSnapshot } from '@/game/types';
import { tuning } from '@/game/tuning';
import { getEvolutionStrategicHexStyle } from '@/evolution/evolutionVisuals';
import {
  createDashedLineSegments,
  createRegularHexPoints,
} from '@/rendering/worldBorderMath';
import { computeFitZoom } from '@/systems/cameraMath';
import {
  type EvolutionWorldCamera,
  type EvolutionWorldViewport,
  findHexCellAtWorldPoint,
  viewportToWorldPoint,
  worldToViewportPoint,
} from '@/evolution/worldHexPicking';

function cloneViewport(viewport: EvolutionWorldViewport): EvolutionWorldViewport {
  return { ...viewport };
}

function cloneCamera(camera: EvolutionWorldCamera): EvolutionWorldCamera {
  return { ...camera };
}

export class EvolutionWorldView {
  private readonly scene: Phaser.Scene;
  private readonly frameGraphics: Phaser.GameObjects.Graphics;
  private readonly cellGraphics: Phaser.GameObjects.Graphics;
  private readonly glowGraphics: Phaser.GameObjects.Graphics;
  private visible = false;
  private snapshot?: WorldRenderSnapshot;
  private viewport: EvolutionWorldViewport = { x: 0, y: 0, width: 0, height: 0 };
  private camera: EvolutionWorldCamera = { centerX: 0, centerY: 0, zoom: 1 };
  private minZoom = 0.08;
  private maxZoom = 1.6;
  private hoveredCell: HexCell | null = null;
  private pinnedCell: HexCell | null = null;
  private elapsed = 0;
  private dragging = false;
  private didDrag = false;
  private dragStartPointer = { x: 0, y: 0 };
  private dragStartCamera: EvolutionWorldCamera = { centerX: 0, centerY: 0, zoom: 1 };

  constructor(scene: Phaser.Scene, snapshot: WorldRenderSnapshot) {
    this.scene = scene;
    this.snapshot = snapshot;
    this.frameGraphics = scene.add.graphics().setDepth(2.2);
    this.cellGraphics = scene.add.graphics().setDepth(3.2);
    this.glowGraphics = scene.add.graphics().setDepth(4.2);
  }

  layout(viewport: EvolutionWorldViewport): void {
    this.viewport = cloneViewport(viewport);
    this.fitCameraToWorld();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.clear();
    }
  }

  update(deltaSeconds: number): void {
    if (!this.visible || !this.snapshot) {
      return;
    }

    this.elapsed += deltaSeconds;
    this.render();
  }

  destroy(): void {
    this.clear();
    this.frameGraphics.destroy();
    this.cellGraphics.destroy();
    this.glowGraphics.destroy();
  }

  containsPoint(x: number, y: number): boolean {
    return (
      x >= this.viewport.x &&
      x <= this.viewport.x + this.viewport.width &&
      y >= this.viewport.y &&
      y <= this.viewport.y + this.viewport.height
    );
  }

  handlePointerMove(x: number, y: number): void {
    if (!this.visible || !this.snapshot) {
      return;
    }

    if (this.dragging) {
      const dx = (x - this.dragStartPointer.x) / Math.max(0.0001, this.camera.zoom);
      const dy = (y - this.dragStartPointer.y) / Math.max(0.0001, this.camera.zoom);
      this.camera.centerX = this.dragStartCamera.centerX - dx;
      this.camera.centerY = this.dragStartCamera.centerY - dy;
      this.didDrag = this.didDrag || Math.abs(dx) > 6 || Math.abs(dy) > 6;
      if (this.didDrag) {
        this.hoveredCell = null;
      }
      return;
    }

    if (!this.containsPoint(x, y)) {
      this.hoveredCell = null;
      return;
    }

    const worldPoint = viewportToWorldPoint(x, y, this.viewport, this.camera);
    this.hoveredCell = findHexCellAtWorldPoint(
      this.snapshot.cells,
      this.snapshot.hexSize,
      worldPoint.x,
      worldPoint.y,
    );
  }

  handlePointerDown(x: number, y: number): boolean {
    if (!this.visible || !this.snapshot || !this.containsPoint(x, y)) {
      return false;
    }

    this.dragging = true;
    this.didDrag = false;
    this.dragStartPointer = { x, y };
    this.dragStartCamera = cloneCamera(this.camera);
    return true;
  }

  handlePointerUp(x: number, y: number): HexCell | null {
    if (!this.dragging) {
      return null;
    }

    this.dragging = false;
    if (this.didDrag || !this.snapshot || !this.containsPoint(x, y)) {
      return null;
    }

    const worldPoint = viewportToWorldPoint(x, y, this.viewport, this.camera);
    const picked = findHexCellAtWorldPoint(
      this.snapshot.cells,
      this.snapshot.hexSize,
      worldPoint.x,
      worldPoint.y,
    );
    if (!picked) {
      this.pinnedCell = null;
      return null;
    }

    this.pinnedCell =
      this.pinnedCell?.coord.q === picked.coord.q && this.pinnedCell.coord.r === picked.coord.r
        ? null
        : picked;
    this.hoveredCell = picked;
    return picked;
  }

  handleWheel(deltaY: number, pointerX: number, pointerY: number): void {
    if (!this.visible || !this.snapshot || !this.containsPoint(pointerX, pointerY)) {
      return;
    }

    const before = viewportToWorldPoint(pointerX, pointerY, this.viewport, this.camera);
    const nextZoom = Phaser.Math.Clamp(
      this.camera.zoom * Math.exp((-deltaY / 100) * 0.12),
      this.minZoom,
      this.maxZoom,
    );
    const nextCamera = {
      ...this.camera,
      zoom: nextZoom,
    };
    const after = viewportToWorldPoint(pointerX, pointerY, this.viewport, nextCamera);
    this.camera.zoom = nextZoom;
    this.camera.centerX += before.x - after.x;
    this.camera.centerY += before.y - after.y;
  }

  getFocusedCell(): HexCell | null {
    return this.pinnedCell ?? this.hoveredCell;
  }

  getHoveredCell(): HexCell | null {
    return this.hoveredCell;
  }

  getCellAtScreenPoint(x: number, y: number): HexCell | null {
    if (!this.snapshot || !this.containsPoint(x, y)) {
      return null;
    }

    const worldPoint = viewportToWorldPoint(x, y, this.viewport, this.camera);
    return findHexCellAtWorldPoint(
      this.snapshot.cells,
      this.snapshot.hexSize,
      worldPoint.x,
      worldPoint.y,
    );
  }

  getViewport(): EvolutionWorldViewport {
    return this.viewport;
  }

  private fitCameraToWorld(): void {
    if (!this.snapshot || this.viewport.width <= 0 || this.viewport.height <= 0) {
      return;
    }

    const padding = this.snapshot.hexSize * 1.3;
    const bounds = {
      ...this.snapshot.bounds,
      minX: this.snapshot.bounds.minX - padding,
      maxX: this.snapshot.bounds.maxX + padding,
      minY: this.snapshot.bounds.minY - padding,
      maxY: this.snapshot.bounds.maxY + padding,
      width: this.snapshot.bounds.width + padding * 2,
      height: this.snapshot.bounds.height + padding * 2,
    };
    const fitZoom = computeFitZoom(this.viewport.width, this.viewport.height, bounds);
    this.minZoom = Math.max(0.065, fitZoom * 0.72);
    this.maxZoom = Math.max(this.minZoom * 5.4, 1.9);
    this.camera = {
      centerX: this.snapshot.bounds.centerX,
      centerY: this.snapshot.bounds.centerY,
      zoom: Math.max(fitZoom, 0.18),
    };
  }

  private render(): void {
    if (!this.snapshot) {
      return;
    }

    this.clear();

    this.frameGraphics.lineStyle(1, 0x8cbfb6, 0.32);
    this.frameGraphics.strokeRoundedRect(
      this.viewport.x,
      this.viewport.y,
      this.viewport.width,
      this.viewport.height,
      34,
    );

    for (const cell of this.snapshot.cells) {
      const screen = worldToViewportPoint(cell.centerX, cell.centerY, this.viewport, this.camera);
      const radius = Math.max(5, this.snapshot.hexSize * this.camera.zoom * 0.88);
      if (
        screen.x < this.viewport.x - radius ||
        screen.x > this.viewport.x + this.viewport.width + radius ||
        screen.y < this.viewport.y - radius ||
        screen.y > this.viewport.y + this.viewport.height + radius
      ) {
        continue;
      }

      const points = createRegularHexPoints(screen.x, screen.y, radius);
      const style = getEvolutionStrategicHexStyle(cell.type);
      const isFocused =
        (this.hoveredCell?.coord.q === cell.coord.q && this.hoveredCell.coord.r === cell.coord.r) ||
        (this.pinnedCell?.coord.q === cell.coord.q && this.pinnedCell.coord.r === cell.coord.r);
      const fillAlpha = Phaser.Math.Clamp(style.fillAlpha + (isFocused ? 0.14 : 0), 0, 1);
      const reactiveAlpha = Phaser.Math.Clamp(
        style.reactiveAlpha + (isFocused ? 0.16 : 0),
        0,
        1,
      );

      if (!isFocused) {
        this.glowGraphics.fillStyle(style.glowColor, style.glowAlpha * 0.45);
        this.glowGraphics.fillPoints(
          createRegularHexPoints(screen.x, screen.y, radius * 1.1) as Phaser.Math.Vector2[],
          true,
        );
      }

      this.cellGraphics.fillStyle(style.fillColor, fillAlpha);
      this.cellGraphics.fillPoints(points as Phaser.Math.Vector2[], true);
      this.cellGraphics.fillStyle(style.reactiveColor, reactiveAlpha);
      this.cellGraphics.fillPoints(points as Phaser.Math.Vector2[], true);
      this.cellGraphics.lineStyle(3.6, 0x051116, 0.78);
      this.cellGraphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      this.cellGraphics.lineStyle(
        isFocused ? 2.8 : 2.2,
        style.strokeColor,
        Phaser.Math.Clamp(style.strokeAlpha + (isFocused ? 0.12 : 0), 0, 1),
      );
      this.cellGraphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      this.cellGraphics.lineStyle(
        isFocused ? 1.6 : 1.1,
        style.contourColor,
        Phaser.Math.Clamp(style.contourAlpha + (isFocused ? 0.12 : 0), 0, 1),
      );
      this.cellGraphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      this.renderTerritoryOverlay(points, cell, isFocused);

      if (isFocused) {
        const focusRadius = radius * (this.pinnedCell ? 1.28 : 1.2);
        this.glowGraphics.fillStyle(style.glowColor, this.pinnedCell ? 0.26 : 0.18);
        this.glowGraphics.fillPoints(
          createRegularHexPoints(screen.x, screen.y, focusRadius) as Phaser.Math.Vector2[],
          true,
        );
        this.glowGraphics.fillStyle(0xffffff, this.pinnedCell ? 0.08 : 0.05);
        this.glowGraphics.fillPoints(
          createRegularHexPoints(screen.x, screen.y, radius * 0.98) as Phaser.Math.Vector2[],
          true,
        );
        this.glowGraphics.lineStyle(4.2, style.glowColor, this.pinnedCell ? 0.5 : 0.34);
        this.glowGraphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
        this.glowGraphics.lineStyle(2.4, 0xf7ffff, this.pinnedCell ? 0.96 : 0.82);
        this.glowGraphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      }
    }
  }

  private renderTerritoryOverlay(
    points: Array<{ x: number; y: number }>,
    cell: HexCell,
    isFocused: boolean,
  ): void {
    if (!cell.conquestState) {
      return;
    }

    if (cell.conquestState === 'owned') {
      const center = points.reduce(
        (accumulator, point) => ({
          x: accumulator.x + point.x / points.length,
          y: accumulator.y + point.y / points.length,
        }),
        { x: 0, y: 0 },
      );
      const radius = Math.max(
        6,
        points.reduce((largest, point) => {
          return Math.max(
            largest,
            Math.hypot(point.x - center.x, point.y - center.y),
          );
        }, 0),
      );
      this.glowGraphics.fillStyle(
        tuning.conquerBorderOwnedGlowColor,
        isFocused ? 0.18 : 0.12,
      );
      this.glowGraphics.fillPoints(
        createRegularHexPoints(center.x, center.y, radius * 1.12) as Phaser.Math.Vector2[],
        true,
      );
      this.glowGraphics.fillStyle(
        tuning.conquerBorderOwnedFillColor,
        isFocused ? 0.3 : 0.22,
      );
      this.glowGraphics.fillPoints(points as Phaser.Math.Vector2[], true);
      this.glowGraphics.lineStyle(
        tuning.conquerBorderOwnedWidth + (isFocused ? 1.4 : 0),
        tuning.conquerBorderOwnedColor,
        isFocused ? 0.72 : 0.56,
      );
      this.glowGraphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      this.glowGraphics.lineStyle(
        Math.max(1.4, tuning.conquerBorderOwnedWidth * 0.38),
        tuning.conquerBorderOwnedCoreColor,
        0.96,
      );
      this.glowGraphics.strokePoints(points as Phaser.Math.Vector2[], true, true);
      return;
    }

    const dashOffset = this.elapsed * tuning.conquerBorderDashTravelSpeed;
    for (let index = 0; index < points.length; index += 1) {
      const segments = createDashedLineSegments(
        points[index],
        points[(index + 1) % points.length],
        tuning.conquerBorderDashLengthPx * Math.max(0.35, this.camera.zoom),
        tuning.conquerBorderGapLengthPx * Math.max(0.35, this.camera.zoom),
        dashOffset + index * tuning.conquerBorderGapLengthPx,
      );
      for (const segment of segments) {
        this.glowGraphics.lineStyle(
          tuning.conquerBorderAnimatedWidth,
          tuning.conquerBorderActiveColor,
          isFocused ? 0.96 : 0.82,
        );
        this.glowGraphics.lineBetween(
          segment.start.x,
          segment.start.y,
          segment.end.x,
          segment.end.y,
        );
        this.glowGraphics.lineStyle(
          Math.max(1.2, tuning.conquerBorderAnimatedWidth * 0.34),
          tuning.conquerBorderCoreColor,
          0.98,
        );
        this.glowGraphics.lineBetween(
          segment.start.x,
          segment.start.y,
          segment.end.x,
          segment.end.y,
        );
      }
    }
  }

  private clear(): void {
    this.frameGraphics.clear();
    this.cellGraphics.clear();
    this.glowGraphics.clear();
  }
}
