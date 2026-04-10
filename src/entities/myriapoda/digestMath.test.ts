import { describe, expect, it } from 'vitest';
import { stepDigestion } from '@/entities/myriapoda/digestMath';

describe('digestMath', () => {
  it('digests matter packets after they pass the body length', () => {
    const result = stepDigestion(
      [
        {
          id: 'a',
          shape: 'triangle',
          color: 0xffffff,
          progress: 11.8,
          digestValue: 2,
        },
      ],
      0.2,
      2,
      12,
    );

    expect(result.packets).toHaveLength(0);
    expect(result.digested).toHaveLength(1);
  });
});
