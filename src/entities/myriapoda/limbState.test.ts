import { describe, expect, it } from 'vitest';
import { createIdleLimbState, stepLimbState } from '@/entities/myriapoda/limbState';
import { tuning } from '@/game/tuning';

describe('limbState', () => {
  it('cycles from idle to extend to retract to cooldown idle', () => {
    let state = createIdleLimbState();
    state.targetId = 'enemy';
    state = stepLimbState(state, 0.01, 0.5, true, false);
    expect(state.name).toBe('extend');

    state = stepLimbState(state, tuning.limbExtendSeconds + 0.02, 0.5, true, false);
    expect(state.name).toBe('retract');

    state = stepLimbState(state, tuning.limbRetractSeconds + 0.02, 0.5, false, false);
    expect(state.name).toBe('idle');
    expect(state.timer).toBeCloseTo(0.5, 3);
  });
});
