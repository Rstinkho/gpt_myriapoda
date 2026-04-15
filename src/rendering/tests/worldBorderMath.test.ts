import { describe, expect, it } from 'vitest';
import {
  createDashedLineSegments,
  createExposedHexEdges,
  createProgressBorderEdges,
  createProgressBorderSlice,
  getBorderLength,
} from '@/rendering/worldBorderMath';
import { HexGrid } from '@/entities/world/HexGrid';

describe('worldBorderMath', () => {
  const grid = new HexGrid(10);
  const borderEdges = createExposedHexEdges(grid.createDisk(1), 10);

  it('collects only exposed hex sides from the current field', () => {
    expect(borderEdges).toHaveLength(18);
  });

  it('returns no border progress at 0 percent', () => {
    expect(createProgressBorderEdges(borderEdges, 0)).toHaveLength(0);
  });

  it('covers half the perimeter at 50 percent progress', () => {
    const progressEdges = createProgressBorderEdges(borderEdges, 0.5);
    expect(getBorderLength(progressEdges)).toBeCloseTo(getBorderLength(borderEdges) * 0.5, 5);
  });

  it('completes the full perimeter at 100 percent progress', () => {
    const progressEdges = createProgressBorderEdges(borderEdges, 1);
    expect(getBorderLength(progressEdges)).toBeCloseTo(getBorderLength(borderEdges), 5);
  });

  it('creates partial slices across the border perimeter', () => {
    const progressEdges = createProgressBorderSlice(borderEdges, 0.5, 0.75);
    expect(getBorderLength(progressEdges)).toBeCloseTo(getBorderLength(borderEdges) * 0.25, 5);
  });

  it('creates animated dashed slices along a border edge', () => {
    const segments = createDashedLineSegments(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      20,
      10,
      5,
    );

    expect(segments.length).toBeGreaterThan(2);
    expect(getBorderLength(segments)).toBeGreaterThan(40);
    expect(getBorderLength(segments)).toBeLessThan(100);
  });
});
