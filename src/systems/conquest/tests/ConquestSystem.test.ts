import { describe, expect, it, vi } from 'vitest';
import { HexWorld } from '@/entities/world/HexWorld';
import { tuning } from '@/game/tuning';
import { ConquestSystem } from '@/systems/conquest/ConquestSystem';

function createEnemyFactory() {
  let serial = 0;
  return {
    create: vi.fn((_spawn, type = 'leech') => {
      serial += 1;
      return {
        id: `enemy-${serial}`,
        type,
      };
    }),
  };
}

describe('ConquestSystem', () => {
  it('advances occupancy only while the player is inside the target hex and spawns raid waves outside it', () => {
    const world = new HexWorld(() => 0);
    const target = world.cells.find((cell) => cell.type === 'dead');
    const enemies = new Map();
    const enemyFactory = createEnemyFactory();
    const system = new ConquestSystem(
      enemyFactory as never,
      enemies as never,
      () => 0.9,
    );

    expect(target).toBeDefined();
    expect(system.start(world, target!.coord)).toBe(true);

    system.update(world, { x: 9999, y: 9999 });
    expect(system.getSnapshot()?.occupiedSeconds).toBe(0);

    system.update(world, { x: target!.centerX, y: target!.centerY });
    expect(system.getSnapshot()?.occupiedSeconds).toBe(tuning.fixedStepSeconds);
    expect(enemyFactory.create).toHaveBeenCalledTimes(3);
    for (const [spawn, enemyType] of enemyFactory.create.mock.calls) {
      expect(enemyType).toBe('leech');
      expect(spawn.enemySpeedMultiplier).toBe(tuning.conquerLeechAttackSpeedMultiplier);
      expect(
        Math.hypot(spawn.x - target!.centerX, spawn.y - target!.centerY),
      ).toBeGreaterThan(tuning.worldHexSize);
    }
  });

  it('completes conquest after the occupancy and kill goals are both met', () => {
    const world = new HexWorld(() => 0);
    const target = world.cells.find((cell) => cell.type === 'dead');
    const enemies = new Map<string, { id: string; type: string }>();
    const enemyFactory = createEnemyFactory();
    const system = new ConquestSystem(
      enemyFactory as never,
      enemies as never,
      () => 0.1,
    );

    expect(target).toBeDefined();
    expect(system.start(world, target!.coord)).toBe(true);

    while ((system.getSnapshot()?.killCount ?? 0) < tuning.conquerKillGoal) {
      system.update(world, { x: target!.centerX, y: target!.centerY });
      for (const enemyId of [...enemies.keys()]) {
        enemies.delete(enemyId);
        system.handleEnemyKilled({ enemyId });
      }
    }

    const occupancyFrames = Math.ceil(
      tuning.conquerOccupancySeconds / tuning.fixedStepSeconds,
    );
    let completedCoord = null;
    for (let frame = 0; frame < occupancyFrames; frame += 1) {
      completedCoord = system.update(world, { x: target!.centerX, y: target!.centerY });
      if (completedCoord) {
        break;
      }
    }

    expect(completedCoord).toEqual(target!.coord);
    expect(world.getOwnedCell()?.coord).toEqual(target!.coord);
    expect(world.getOwnedCell()?.buildable).toBe(true);
    expect(system.getSnapshot()).toBeNull();
  });
});
