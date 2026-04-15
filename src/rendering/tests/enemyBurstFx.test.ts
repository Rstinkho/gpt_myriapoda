import { describe, expect, it } from 'vitest';
import { jellyfishDefinition } from '@/entities/enemies/jellyfish/definition';
import { shellbackDefinition } from '@/entities/enemies/shellback/definition';
import {
  advanceEnemyBurst,
  createEnemyBurst,
  resolveEnemyFxPalette,
} from '@/rendering/enemyBurstFx';

describe('enemyBurstFx', () => {
  it('resolves enemy palettes from the current enemy visual colors', () => {
    expect(resolveEnemyFxPalette('jellyfish')).toMatchObject({
      glowColor: jellyfishDefinition.bloomColor,
      bubbleFill: jellyfishDefinition.bellHighlightColor,
      bubbleOutline: jellyfishDefinition.bellOutlineColor,
    });
    expect(resolveEnemyFxPalette('leech')).toMatchObject({
      glowColor: 0xe8b8b0,
      bubbleFill: 0xf6d9cf,
      bubbleOutline: 0xf9e5d9,
    });
    expect(resolveEnemyFxPalette('shellback')).toMatchObject({
      glowColor: shellbackDefinition.attackTelegraphColor,
      bubbleFill: shellbackDefinition.fleshLayerColor,
      bubbleOutline: shellbackDefinition.hitPointColor,
    });
  });

  it('creates bursts with both shards and bubbles and expires them on schedule', () => {
    const burst = createEnemyBurst('leech', 12, -6, () => 0.5);

    expect(burst.shards.length).toBeGreaterThan(0);
    expect(burst.bubbles.length).toBeGreaterThan(0);
    expect(burst.lifetimeSeconds).toBeGreaterThan(0);

    const almostExpired = advanceEnemyBurst(burst, burst.lifetimeSeconds - 0.01);
    expect(almostExpired).not.toBeNull();
    expect(advanceEnemyBurst(almostExpired!, 0.02)).toBeNull();
  });
});
