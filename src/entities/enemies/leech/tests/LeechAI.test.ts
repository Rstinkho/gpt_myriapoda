import { describe, expect, it } from 'vitest';
import { tuning } from '@/game/tuning';
import {
  advanceLeechDetachProgress,
  pickLeechLatchSlot,
  stepLeechState,
} from '@/entities/enemies/leech';

describe('LeechAI', () => {
  it('assigns unique stomach latch slots across multiple leeches', () => {
    const occupied = new Set<number>();
    const slots: number[] = [];

    for (let index = 0; index < tuning.leechLatchSlotCount; index += 1) {
      const slot = pickLeechLatchSlot(occupied, tuning.leechLatchSlotCount);
      expect(slot).not.toBeNull();
      occupied.add(slot!);
      slots.push(slot!);
    }

    expect(new Set(slots).size).toBe(tuning.leechLatchSlotCount);
    expect(pickLeechLatchSlot(occupied, tuning.leechLatchSlotCount)).toBeNull();
  });

  it('transitions from seeking to latched to drained out and then detached', () => {
    const latched = stepLeechState(
      {
        state: 'seeking',
        attachedLatchSlotIndex: null,
        drainTimer: tuning.leechDrainIntervalSeconds,
        detachProgress: 0,
        recoveryTimer: 0,
      },
      {
        deltaSeconds: tuning.fixedStepSeconds,
        stomachHasStoredParticles: true,
        canLatch: true,
        withinLatchDistance: true,
        headSpeedRatio: 0,
        dashShakeStrength: 0,
      },
    );

    expect(latched.state).toBe('latched');
    expect(latched.didLatch).toBe(true);

    const drainedOut = stepLeechState(latched, {
      deltaSeconds: tuning.fixedStepSeconds,
      stomachHasStoredParticles: false,
      canLatch: true,
      withinLatchDistance: true,
      headSpeedRatio: 0,
      dashShakeStrength: 0,
    });
    expect(drainedOut.state).toBe('drainedOut');

    const detached = stepLeechState(drainedOut, {
      deltaSeconds: tuning.leechDrainOutSeconds,
      stomachHasStoredParticles: false,
      canLatch: false,
      withinLatchDistance: false,
      headSpeedRatio: 0,
      dashShakeStrength: 0,
    });
    expect(detached.state).toBe('detached');
    expect(detached.didDetach).toBe(true);
  });

  it('builds deterministic detach progress from motion and dash shake', () => {
    const motionOnly = advanceLeechDetachProgress(0, 0.9, 0, 1);
    const dashOnly = advanceLeechDetachProgress(0, 0, 1, tuning.dashShakeSeconds);

    expect(motionOnly).toBeGreaterThan(0);
    expect(dashOnly).toBeCloseTo(tuning.leechDetachDashImpulse, 5);

    const state = {
      state: 'latched' as const,
      attachedLatchSlotIndex: 0,
      drainTimer: tuning.leechDrainIntervalSeconds,
      detachProgress: 0,
      recoveryTimer: 0,
    };

    const detached = stepLeechState(state, {
      deltaSeconds: tuning.dashShakeSeconds,
      stomachHasStoredParticles: true,
      canLatch: true,
      withinLatchDistance: true,
      headSpeedRatio: 0.96,
      dashShakeStrength: 1,
    });

    expect(detached.state).toBe('detached');
  });
});
