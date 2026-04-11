import { describe, expect, it } from 'vitest';
import { tuning } from '@/game/tuning';
import { VacuumSystem } from '@/entities/myriapoda/VacuumSystem';

describe('entity VacuumSystem', () => {
  it('tracks active pickups and smooths suction state', () => {
    const vacuum = new VacuumSystem();

    vacuum.beginFrame({ x: 8, y: 4 }, 0.4, tuning.fixedStepSeconds);
    expect(vacuum.activePickupCount).toBe(0);
    expect(vacuum.nearbyPickupIds.size).toBe(0);

    vacuum.registerActivePickup('pickup-a');
    vacuum.registerActivePickup('pickup-b');
    vacuum.completeFrame();

    expect(vacuum.activePickupCount).toBe(2);
    expect(vacuum.nearbyPickupIds.has('pickup-a')).toBe(true);
    expect(vacuum.nearbyPickupIds.has('pickup-b')).toBe(true);
    expect(vacuum.suctionAmount).toBeGreaterThan(0);

    const previousSuction = vacuum.suctionAmount;
    vacuum.beginFrame({ x: 10, y: 6 }, 0.6, tuning.fixedStepSeconds);
    vacuum.completeFrame();

    expect(vacuum.activePickupCount).toBe(0);
    expect(vacuum.nearbyPickupIds.size).toBe(0);
    expect(vacuum.suctionAmount).toBeLessThan(previousSuction);
  });

  it('triggers and decays the consume pulse timer', () => {
    const vacuum = new VacuumSystem();
    vacuum.triggerConsumePulse();

    expect(vacuum.consumePulseTimer).toBe(tuning.vacuumConsumePulseSeconds);

    vacuum.beginFrame({ x: 0, y: 0 }, 0, tuning.fixedStepSeconds);
    expect(vacuum.consumePulseTimer).toBeLessThan(tuning.vacuumConsumePulseSeconds);
  });
});
