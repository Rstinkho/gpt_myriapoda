import { clamp } from '@/utils/math';
import type { HexCell, WorldBounds } from '@/game/types';

export interface ManualZoomBiasResult {
  manualZoomFactor: number;
  zoom: number;
}

export function computeWorldBounds(cells: HexCell[], padding: number): WorldBounds {
  if (cells.length === 0) {
    return {
      minX: -padding,
      maxX: padding,
      minY: -padding,
      maxY: padding,
      centerX: 0,
      centerY: 0,
      width: padding * 2,
      height: padding * 2,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cell of cells) {
    minX = Math.min(minX, cell.centerX);
    maxX = Math.max(maxX, cell.centerX);
    minY = Math.min(minY, cell.centerY);
    maxY = Math.max(maxY, cell.centerY);
  }

  const paddedMinX = minX - padding;
  const paddedMaxX = maxX + padding;
  const paddedMinY = minY - padding;
  const paddedMaxY = maxY + padding;

  return {
    minX: paddedMinX,
    maxX: paddedMaxX,
    minY: paddedMinY,
    maxY: paddedMaxY,
    centerX: (paddedMinX + paddedMaxX) * 0.5,
    centerY: (paddedMinY + paddedMaxY) * 0.5,
    width: Math.max(1, paddedMaxX - paddedMinX),
    height: Math.max(1, paddedMaxY - paddedMinY),
  };
}

export function computeFitZoom(
  viewportWidth: number,
  viewportHeight: number,
  bounds: WorldBounds,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return 1;
  }

  return Math.min(
    viewportWidth / Math.max(1, bounds.width),
    viewportHeight / Math.max(1, bounds.height),
  );
}

export function applyManualZoomBias(
  baseZoom: number,
  wheelInput: number,
  previousFactor: number,
  step: number,
  minFactor: number,
  maxFactor: number,
): ManualZoomBiasResult {
  const normalizedWheel = clamp(wheelInput / 100, -6, 6);
  const nextFactor = clamp(
    previousFactor * Math.exp(-normalizedWheel * step),
    minFactor,
    maxFactor,
  );

  return {
    manualZoomFactor: nextFactor,
    zoom: baseZoom * nextFactor,
  };
}
