import { describe, expect, it } from 'vitest';
import {
  evolutionWorldActionDefs,
  evolutionWorldBuildingDefs,
  formatResourceCostIconPairs,
  getEvolutionUpgradeNodes,
} from '@/evolution/evolutionData';
import { textureKeys } from '@/game/assets';

describe('formatResourceCostIconPairs', () => {
  it('returns one entry per non-zero resource in stable order', () => {
    const pairs = formatResourceCostIconPairs({ biomass: 8, tissue: 2 });
    expect(pairs).toEqual([
      { resourceId: 'biomass', textureKey: textureKeys.resourceIcons.biomass, amount: 8 },
      { resourceId: 'tissue', textureKey: textureKeys.resourceIcons.tissue, amount: 2 },
    ]);
  });

  it('drops zero and missing amounts', () => {
    const pairs = formatResourceCostIconPairs({ biomass: 0, tissue: 5 });
    expect(pairs).toHaveLength(1);
    expect(pairs[0].resourceId).toBe('tissue');
    expect(pairs[0].amount).toBe(5);
  });

  it('returns an empty array for an empty cost map', () => {
    expect(formatResourceCostIconPairs({})).toEqual([]);
  });

  it('preserves biomass, tissue, structuralCell, parasite ordering', () => {
    const pairs = formatResourceCostIconPairs({
      parasite: 1,
      structuralCell: 2,
      tissue: 3,
      biomass: 4,
    });
    expect(pairs.map((p) => p.resourceId)).toEqual([
      'biomass',
      'tissue',
      'structuralCell',
      'parasite',
    ]);
  });
});

describe('evolution data descriptions', () => {
  it('populates a non-empty description on every upgrade node for every family', () => {
    for (const family of ['head', 'stomach', 'hands', 'circles'] as const) {
      const nodes = getEvolutionUpgradeNodes(family);
      expect(nodes).toHaveLength(9);
      for (const node of nodes) {
        expect(node.description.length).toBeGreaterThan(10);
      }
    }
  });

  it('populates descriptions on world action and building defs', () => {
    for (const def of evolutionWorldActionDefs) {
      expect(def.description.length).toBeGreaterThan(10);
    }
    for (const def of evolutionWorldBuildingDefs) {
      expect(def.description.length).toBeGreaterThan(10);
    }
  });
});
