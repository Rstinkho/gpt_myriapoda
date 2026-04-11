import { describe, expect, it } from 'vitest';
import {
  advanceDisplayFillProgress,
  sampleExpansionDisplayProgress,
  sampleStageAnimation,
} from '@/rendering/worldAnimationMath';

describe('worldAnimationMath', () => {
  it('eases display fill toward the target instead of snapping', () => {
    expect(advanceDisplayFillProgress(0.2, 0.8, 0.12)).toBeCloseTo(0.272, 5);
  });

  it('surges the border to full before easing back to overflow progress', () => {
    expect(sampleExpansionDisplayProgress(0.68, 0.14, 0.1)).toBeGreaterThan(0.68);
    expect(sampleExpansionDisplayProgress(0.68, 0.14, 0.4)).toBeCloseTo(1, 5);
    expect(sampleExpansionDisplayProgress(0.68, 0.14, 1)).toBeCloseTo(0.14, 5);
  });

  it('peaks spacing early and settles rotation through the rebound sequence', () => {
    expect(sampleStageAnimation(0).spacingBreath).toBeCloseTo(0, 5);
    expect(sampleStageAnimation(0.11).spacingBreath).toBeCloseTo(1, 5);
    expect(sampleStageAnimation(0.22).spacingBreath).toBeCloseTo(0, 5);

    expect(sampleStageAnimation(0.55).rotation).toBeCloseTo(Math.PI * 2, 5);
    expect(sampleStageAnimation(0.75).rotation).toBeCloseTo(-Math.PI * 0.6, 5);
    expect(sampleStageAnimation(0.9).rotation).toBeCloseTo(Math.PI * 0.2, 5);
    expect(sampleStageAnimation(1).rotation).toBeCloseTo(0, 5);
  });
});
