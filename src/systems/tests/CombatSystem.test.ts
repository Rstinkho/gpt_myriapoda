import { describe, expect, it } from 'vitest';
import * as planck from 'planck';
import type { Enemy } from '@/entities/enemies/Enemy';
import { getEnemyTargetPriority } from '@/systems/CombatSystem';

function createEnemy(overrides: Partial<Enemy>): Enemy {
  const world = new planck.World({ gravity: planck.Vec2(0, 0) });
  const body = world.createBody({
    type: 'dynamic',
    position: planck.Vec2(0, 0),
  });

  return {
    id: 'enemy',
    type: 'jellyfish',
    body,
    health: 1,
    radiusPx: 12,
    updateVisual() {},
    destroy() {},
    ...overrides,
  } as Enemy;
}

describe('CombatSystem', () => {
  it('prioritizes latched leeches above roaming enemies', () => {
    const jellyfish = createEnemy({ id: 'jelly', type: 'jellyfish' });
    const roamingLeech = createEnemy({
      id: 'leech-roaming',
      type: 'leech',
      state: 'seeking',
      attachedLatchSlotIndex: null,
      drainTimer: 1,
      detachProgress: 0,
      recoveryTimer: 0,
    });
    const latchedLeech = createEnemy({
      id: 'leech-latched',
      type: 'leech',
      state: 'latched',
      attachedLatchSlotIndex: 1,
      drainTimer: 1,
      detachProgress: 0.2,
      recoveryTimer: 0,
    });

    expect(getEnemyTargetPriority(latchedLeech)).toBeGreaterThan(
      getEnemyTargetPriority(jellyfish),
    );
    expect(getEnemyTargetPriority(latchedLeech)).toBeGreaterThan(
      getEnemyTargetPriority(roamingLeech),
    );
  });
});
