import { describe, expect, it } from 'vitest';
import { sampleParasiteWorldLifecycle } from '@/entities/pickups/harmful/parasite';

describe('parasiteLifecycle', () => {
  it('stays fully visible before the despawn window', () => {
    expect(sampleParasiteWorldLifecycle(7.9, 10, 1.4)).toEqual({
      alphaMultiplier: 1,
      scaleXMultiplier: 1,
      scaleYMultiplier: 1,
      isDespawning: false,
      isExpired: false,
    });
  });

  it('shrivels during the despawn window before expiry', () => {
    const lifecycle = sampleParasiteWorldLifecycle(9.4, 10, 1.4);

    expect(lifecycle.isDespawning).toBe(true);
    expect(lifecycle.isExpired).toBe(false);
    expect(lifecycle.alphaMultiplier).toBeLessThan(1);
    expect(lifecycle.scaleXMultiplier).toBeLessThan(1);
    expect(lifecycle.scaleYMultiplier).toBeLessThan(1);
  });

  it('expires once its world lifetime is over', () => {
    expect(sampleParasiteWorldLifecycle(10, 10, 1.4)).toEqual({
      alphaMultiplier: 0,
      scaleXMultiplier: 0,
      scaleYMultiplier: 0,
      isDespawning: true,
      isExpired: true,
    });
  });
});
