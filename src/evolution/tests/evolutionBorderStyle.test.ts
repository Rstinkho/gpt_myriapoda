import { describe, expect, it } from 'vitest';
import {
  buildJitteredRoundedRectPolyline,
  deriveJitterSeed,
} from '@/evolution/evolutionBorderStyle';

describe('evolutionBorderStyle', () => {
  it('produces a deterministic polyline for a given seed', () => {
    const a = buildJitteredRoundedRectPolyline({
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      radius: 10,
      seed: 1234,
      samples: 32,
    });
    const b = buildJitteredRoundedRectPolyline({
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      radius: 10,
      seed: 1234,
      samples: 32,
    });

    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i].x).toBeCloseTo(b[i].x, 12);
      expect(a[i].y).toBeCloseTo(b[i].y, 12);
    }
  });

  it('produces distinct polylines for different seeds', () => {
    const a = buildJitteredRoundedRectPolyline({
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      radius: 8,
      seed: 1,
      samples: 32,
    });
    const b = buildJitteredRoundedRectPolyline({
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      radius: 8,
      seed: 999,
      samples: 32,
    });
    let anyDifference = false;
    for (let i = 0; i < a.length; i += 1) {
      if (Math.abs(a[i].x - b[i].x) > 1e-6 || Math.abs(a[i].y - b[i].y) > 1e-6) {
        anyDifference = true;
        break;
      }
    }
    expect(anyDifference).toBe(true);
  });

  it('keeps jittered points within the configured magnitude of the underlying rect', () => {
    const opts = {
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      radius: 8,
      seed: 42,
      jitter: 1,
      samples: 32,
    };
    const pts = buildJitteredRoundedRectPolyline(opts);
    // All points must lie within a 3-pixel band around the original rect,
    // allowing for the jitter amplitude plus normal corner curvature.
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(-2);
      expect(p.x).toBeLessThanOrEqual(102);
      expect(p.y).toBeGreaterThanOrEqual(-2);
      expect(p.y).toBeLessThanOrEqual(52);
    }
  });

  it('derives a stable seed from a string id', () => {
    const a = deriveJitterSeed('spire');
    const b = deriveJitterSeed('spire');
    const c = deriveJitterSeed('dome');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
