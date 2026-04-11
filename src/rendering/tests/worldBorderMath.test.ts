import { describe, expect, it } from 'vitest';
import {
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
});
