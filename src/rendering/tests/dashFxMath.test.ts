import { describe, expect, it } from 'vitest';
import { sampleDashRearAnchor } from '@/rendering/dashFxMath';

describe('dashFxMath', () => {
  it('keeps the rear anchor behind the tail relative to dash direction', () => {
    const tailTip = { x: -92, y: 0 };
    const anchor = sampleDashRearAnchor(
      tailTip,
      { x: 1, y: 0 },
      {
        baseOffsetPx: 10,
        extraOffsetPx: 12,
        motionStrength: 1,
      },
    );

    const dashDot = (anchor.x - tailTip.x) * 1 + (anchor.y - tailTip.y) * 0;
    expect(dashDot).toBeLessThan(0);
  });

  it('pushes the rear anchor farther back as motion strength increases', () => {
    const tailTip = { x: -92, y: 0 };
    const low = sampleDashRearAnchor(
      tailTip,
      { x: 1, y: 0 },
      {
        baseOffsetPx: 10,
        extraOffsetPx: 12,
        motionStrength: 0.1,
      },
    );
    const high = sampleDashRearAnchor(
      tailTip,
      { x: 1, y: 0 },
      {
        baseOffsetPx: 10,
        extraOffsetPx: 12,
        motionStrength: 1,
      },
    );

    expect(high.x).toBeLessThan(low.x);
    expect(high.y).toBeCloseTo(low.y, 5);
  });
});
