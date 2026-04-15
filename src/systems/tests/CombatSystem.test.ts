import { describe, expect, it, vi } from 'vitest';
import * as planck from 'planck';
import type { Enemy } from '@/entities/enemies/Enemy';
import { CombatSystem, canEnemyReceiveLimbDamage, getEnemyTargetPriority } from '@/systems/CombatSystem';

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

  it('excludes shelled shellbacks from limb combat targeting', () => {
    const shelledShellback = createEnemy({
      id: 'shellback-shelled',
      type: 'shellback',
      guardCellKey: '0,0',
      guardCenterX: 0,
      guardCenterY: 0,
      shellState: 'shelled',
      shellTimer: 1,
      attackState: 'idle',
      attackTimer: 0,
      attackTarget: null,
      activeClaw: 'left',
      isVulnerable: false,
      phaseSeed: 0,
    });
    const exposedShellback = createEnemy({
      id: 'shellback-exposed',
      type: 'shellback',
      guardCellKey: '0,0',
      guardCenterX: 0,
      guardCenterY: 0,
      shellState: 'exposed',
      shellTimer: 1,
      attackState: 'idle',
      attackTimer: 0,
      attackTarget: null,
      activeClaw: 'left',
      isVulnerable: true,
      phaseSeed: 0,
    });

    expect(canEnemyReceiveLimbDamage(shelledShellback)).toBe(false);
    expect(canEnemyReceiveLimbDamage(exposedShellback)).toBe(true);
  });

  it('only applies one limb hit per strike update so shellbacks keep their 5 HP pacing', () => {
    const world = new planck.World({ gravity: planck.Vec2(0, 0) });
    const destroySpy = vi.fn();
    const enemy = createEnemy({
      id: 'shellback-exposed',
      type: 'shellback',
      health: 5,
      radiusPx: 15,
      guardCellKey: '0,0',
      guardCenterX: 0,
      guardCenterY: 0,
      shellState: 'exposed',
      shellTimer: 1,
      attackState: 'idle',
      attackTimer: 0,
      attackTarget: null,
      activeClaw: 'left',
      isVulnerable: true,
      phaseSeed: 0,
      destroy: destroySpy,
    });
    const myriapoda = {
      limbs: {
        limbs: [
          {
            id: 'limb-1',
            body: {} as never,
            state: { name: 'extend', timer: 0.1, duration: 0.2, targetId: enemy.id },
            desiredTarget: { x: 0, y: 0 },
          },
        ],
        isLimbReady: vi.fn(() => false),
        getStrikePose: vi.fn(() => ({
          rootPixels: { x: -8, y: 0 },
          tipPixels: { x: -4, y: 0 },
          direction: { x: 1, y: 0 },
        })),
        setTarget: vi.fn(),
        releaseAttack: vi.fn(),
        update: vi.fn(),
      },
      body: {},
    };
    const collisions = {
      drainLimbHits: vi.fn(() => [
        { limbId: 'limb-1', enemyId: enemy.id },
        { limbId: 'limb-1', enemyId: enemy.id },
        { limbId: 'limb-1', enemyId: enemy.id },
      ]),
      forgetEnemy: vi.fn(),
    };
    const system = new CombatSystem({ emit: vi.fn() } as never);
    (system as unknown as { activeLimbId: string | null }).activeLimbId = 'limb-1';
    (system as unknown as { activeEnemyId: string | null }).activeEnemyId = enemy.id;

    system.update(
      myriapoda as never,
      new Map([[enemy.id, enemy]]),
      collisions as never,
      world,
    );

    expect(enemy.health).toBe(4);
    expect(destroySpy).not.toHaveBeenCalled();
    expect(myriapoda.limbs.update).toHaveBeenCalled();

    myriapoda.limbs.limbs[0].state = {
      name: 'hit',
      timer: 0.1,
      duration: 0.2,
      targetId: enemy.id,
    };
    (system as unknown as { activeLimbId: string | null }).activeLimbId = 'limb-1';
    (system as unknown as { activeEnemyId: string | null }).activeEnemyId = enemy.id;

    system.update(
      myriapoda as never,
      new Map([[enemy.id, enemy]]),
      collisions as never,
      world,
    );

    expect(enemy.health).toBe(4);
  });
});
