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
    const t = (p: number) => sampleStageAnimation(p, 0);

    expect(t(0).spacingBreath).toBeCloseTo(0, 5);
    expect(t(0.11).spacingBreath).toBeCloseTo(1, 5);
    expect(t(0.22).spacingBreath).toBeCloseTo(0, 5);

    expect(t(0.55).rotation).toBeCloseTo(Math.PI * 2, 5);
    expect(t(0.75).rotation).toBeCloseTo(-Math.PI * 0.6, 5);
    expect(t(0.9).rotation).toBeCloseTo(Math.PI * 0.2, 5);
    expect(t(1).rotation).toBeCloseTo(0, 5);
  });

  it('holds cyan prime phase before rotation when cyanPrimeEnd > 0', () => {
    const s = sampleStageAnimation(0.05, 0.14);
    expect(s.rotation).toBeCloseTo(0, 5);
    expect(s.spacingBreath).toBeCloseTo(0, 5);
    expect(s.revealProgress).toBeCloseTo(0, 5);
    expect(s.cyanPrime).toBeDefined();
    expect(s.cyanPrime!).toBeGreaterThan(0);
    expect(s.cyanPrime!).toBeLessThan(1);

    const after = sampleStageAnimation(0.5, 0.14);
    expect(after.cyanPrime).toBeUndefined();
    expect(Math.abs(after.rotation)).toBeGreaterThan(0.5);
  });
});
