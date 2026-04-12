import { describe, expect, it } from 'vitest';
import {
  findTopEvolutionPartAtPoint,
  getEvolutionPartLabel,
  isSameEvolutionPartId,
} from '@/evolution/myriapodaSelection';

describe('myriapodaSelection', () => {
  it('prefers the tightest matching region under the pointer', () => {
    const match = findTopEvolutionPartAtPoint(
      [
        {
          id: { type: 'segment', index: 2 },
          label: 'Body Circle 3',
          shape: { kind: 'circle', x: 100, y: 100, radius: 30 },
        },
        {
          id: 'stomach',
          label: 'Stomach',
          shape: { kind: 'circle', x: 100, y: 100, radius: 18 },
        },
      ],
      103,
      102,
    );

    expect(match?.id).toBe('stomach');
  });

  it('keeps stomach selection authoritative over overlapping body circles', () => {
    const match = findTopEvolutionPartAtPoint(
      [
        {
          id: { type: 'segment', index: 3 },
          label: 'Body Circle 4',
          shape: { kind: 'circle', x: 180, y: 120, radius: 12 },
        },
        {
          id: 'stomach',
          label: 'Stomach',
          shape: { kind: 'circle', x: 180, y: 120, radius: 24 },
        },
      ],
      180,
      120,
    );

    expect(match?.id).toBe('stomach');
  });

  it('matches capsule regions for limb-like selections', () => {
    const match = findTopEvolutionPartAtPoint(
      [
        {
          id: { type: 'limb', index: 1 },
          label: 'Limb 2',
          shape: { kind: 'capsule', ax: 40, ay: 40, bx: 140, by: 40, radius: 10 },
        },
      ],
      96,
      46,
    );

    expect(match?.id).toEqual({ type: 'limb', index: 1 });
  });

  it('compares stable evolution part ids by semantic identity', () => {
    expect(isSameEvolutionPartId({ type: 'limb', index: 0 }, { type: 'limb', index: 0 })).toBe(
      true,
    );
    expect(isSameEvolutionPartId({ type: 'segment', index: 1 }, { type: 'segment', index: 2 })).toBe(
      false,
    );
    expect(getEvolutionPartLabel({ type: 'segment', index: 4 })).toBe('Body Circle 5');
  });
});
