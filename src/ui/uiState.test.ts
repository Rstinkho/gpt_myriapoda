import { describe, expect, it } from 'vitest';
import {
  createUiStomachParticleSnapshots,
  cycleUiMode,
  getLimbCooldownProgress,
  getModeDotStates,
  getPickupCountsByType,
  showsStatusPanel,
  showsWorldDebug,
} from '@/ui/uiState';

describe('uiState', () => {
  it('cycles ui modes in the requested order', () => {
    expect(cycleUiMode('inspect')).toBe('panel');
    expect(cycleUiMode('panel')).toBe('minimal');
    expect(cycleUiMode('minimal')).toBe('inspect');
  });

  it('enables world debug only for inspect mode', () => {
    expect(showsWorldDebug('inspect')).toBe(true);
    expect(showsWorldDebug('panel')).toBe(false);
    expect(showsWorldDebug('minimal')).toBe(false);
    expect(showsStatusPanel('inspect')).toBe(true);
    expect(showsStatusPanel('panel')).toBe(true);
    expect(showsStatusPanel('minimal')).toBe(false);
    expect(getModeDotStates('inspect')).toEqual([true, true]);
    expect(getModeDotStates('panel')).toEqual([true, false]);
    expect(getModeDotStates('minimal')).toEqual([false, false]);
  });

  it('clamps limb cooldown progress between zero and one', () => {
    expect(getLimbCooldownProgress(0, 3)).toBe(1);
    expect(getLimbCooldownProgress(1.5, 3)).toBeCloseTo(0.5, 5);
    expect(getLimbCooldownProgress(4, 3)).toBe(0);
  });

  it('aggregates stored pickup counts by shape', () => {
    expect(
      getPickupCountsByType([
        { shape: 'triangle' },
        { shape: 'bone' },
        { shape: 'triangle' },
        { shape: 'crystal' },
      ]),
    ).toEqual({
      triangle: 2,
      crystal: 1,
      bone: 1,
    });
  });

  it('creates render-safe ui stomach particle snapshots', () => {
    const snapshots = createUiStomachParticleSnapshots(
      [
        {
          id: 'a',
          shape: 'triangle',
          color: 0xffffff,
          radiusMeters: 0.08,
          position: { x: 0.2, y: -0.25 },
          angle: 0.4,
        },
        {
          id: 'b',
          shape: 'bone',
          color: 0xff00aa,
          radiusMeters: 0.05,
          position: { x: 2, y: -2 },
          angle: -0.2,
        },
      ],
      0.64,
      0.04,
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      id: 'a',
      shape: 'triangle',
      color: 0xffffff,
      angle: 0.4,
    });
    expect(snapshots[0].localX).toBeGreaterThan(0);
    expect(snapshots[0].localY).toBeLessThan(0);
    expect(snapshots[1].localX).toBe(1);
    expect(snapshots[1].localY).toBe(-1);
    expect(snapshots[0].radius).toBeGreaterThan(0);
  });
});
