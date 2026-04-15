import { describe, expect, it, vi } from 'vitest';
import { GrowthSystem } from '@/systems/GrowthSystem';

describe('GrowthSystem', () => {
  it('no longer repairs limbs or body circles from stored matter automatically', () => {
    const system = new GrowthSystem();
    const myriapoda = {
      body: {
        restoreLostSegment: vi.fn(),
        addSegment: vi.fn(),
      },
      limbs: {
        restoreNextDestroyedLimb: vi.fn(),
      },
      stomach: {
        spend: vi.fn(),
      },
    };

    system.update(myriapoda as never);

    expect(myriapoda.body.restoreLostSegment).not.toHaveBeenCalled();
    expect(myriapoda.body.addSegment).not.toHaveBeenCalled();
    expect(myriapoda.limbs.restoreNextDestroyedLimb).not.toHaveBeenCalled();
    expect(myriapoda.stomach.spend).not.toHaveBeenCalled();
  });
});
