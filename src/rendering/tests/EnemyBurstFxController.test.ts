import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { GameEvents } from '@/game/events';
import { EnemyBurstFxController } from '@/rendering/enemyBurstFx';

describe('EnemyBurstFxController', () => {
  it('creates bursts from enemy kill events and can clear or detach cleanly', () => {
    const eventBus = new EventEmitter();
    const controller = new EnemyBurstFxController(
      eventBus as never,
      () => 0.5,
    );

    eventBus.emit(GameEvents.enemyKilled, {
      enemyType: 'jellyfish',
      x: 42,
      y: 18,
    });

    expect(controller.getActiveBurstCount()).toBe(1);

    controller.update(2);
    expect(controller.getActiveBurstCount()).toBe(0);

    eventBus.emit(GameEvents.enemyKilled, {
      enemyType: 'leech',
      x: -4,
      y: 9,
    });
    expect(controller.getActiveBurstCount()).toBe(1);

    controller.clear();
    expect(controller.getActiveBurstCount()).toBe(0);

    controller.destroy();
    eventBus.emit(GameEvents.enemyKilled, {
      enemyType: 'jellyfish',
      x: 0,
      y: 0,
    });
    expect(controller.getActiveBurstCount()).toBe(0);
  });
});
