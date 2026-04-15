import { describe, expect, it } from 'vitest';
import * as planck from 'planck';
import { BodyChain } from '@/entities/myriapoda/BodyChain';
import { LimbController } from '@/entities/myriapoda/LimbController';

describe('LimbController', () => {
  it('tracks destroyed limb slots so HUD and snapshots can reflect total limb loss', () => {
    const world = new planck.World({ gravity: planck.Vec2(0, 0) });
    const bodyChain = new BodyChain(0, 0);
    const controller = new LimbController(world, bodyChain);

    expect(controller.hasAttackCapableLimb()).toBe(true);

    for (const limb of controller.limbs) {
      controller.destroyLimb(limb.id);
    }

    expect(controller.hasAttackCapableLimb()).toBe(false);
    expect(controller.getDestroyedLimbIndices()).toEqual([0, 1, 2, 3]);
  });
});
