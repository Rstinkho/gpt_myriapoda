import { describe, expect, it } from 'vitest';
import { HexGrid } from '@/entities/world/HexGrid';
import { tuning } from '@/game/tuning';
import { createWorldAttackWave } from '@/systems/worldAttacks';

describe('worldAttackPatterns', () => {
  it('builds outside-hex leech raid waves with grouped spawns and a speed multiplier', () => {
    const grid = new HexGrid(tuning.worldHexSize);
    const targetCell = grid.createCell({ q: 0, r: 0 });
    const randomValues = [0.9, 0.25, 0.1, 0.5, 0.8];
    const wave = createWorldAttackWave('conquestLeechPack', {
      targetCell,
      remainingKills: 10,
      randomFloat: () => randomValues.shift() ?? 0.5,
    });

    expect(wave).toHaveLength(3);
    for (const spawn of wave) {
      expect(spawn.attackId).toBe('conquestLeechPack');
      expect(spawn.enemyType).toBe('leech');
      expect(spawn.enemySpeedMultiplier).toBe(tuning.conquerLeechAttackSpeedMultiplier);
      expect(
        Math.hypot(spawn.x - targetCell.centerX, spawn.y - targetCell.centerY),
      ).toBeGreaterThan(tuning.worldHexSize);
    }
  });

  it('shrinks the wave when fewer kills remain than the usual raid size', () => {
    const grid = new HexGrid(tuning.worldHexSize);
    const targetCell = grid.createCell({ q: 0, r: 0 });
    const wave = createWorldAttackWave('conquestLeechPack', {
      targetCell,
      remainingKills: 1,
      randomFloat: () => 0.99,
    });

    expect(wave).toHaveLength(1);
  });
});
