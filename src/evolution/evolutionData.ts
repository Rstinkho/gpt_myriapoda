import type {
  EvolutionPartId,
  ResourceCost,
} from '@/game/types';

export type EvolutionUpgradeFamily = 'head' | 'stomach' | 'hands' | 'circles';
export type EvolutionWorldActionId = 'conquer' | 'probe' | 'seed' | 'anchor';
export type EvolutionWorldActionIcon = 'conquer' | 'probe' | 'purify' | 'seed' | 'anchor';

export interface EvolutionUpgradeNodeDefinition {
  id: string;
  label: string;
  cost: ResourceCost;
  column: number;
  row: number;
  locked: boolean;
}

export interface EvolutionWorldActionDefinition {
  id: EvolutionWorldActionId;
  title: string;
  icon: EvolutionWorldActionIcon;
  cost?: ResourceCost;
  locked: boolean;
}

export interface EvolutionWorldBuildingDefinition {
  id: string;
  name: string;
  cost: ResourceCost;
  requirement: string;
}

function formatResourceChunk(resourceId: string, amount: number): string {
  return `${amount} ${resourceId.replace(/([A-Z])/g, ' $1').toUpperCase()}`;
}

export function formatResourceCost(cost: ResourceCost): string {
  const parts = Object.entries(cost)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resourceId, amount]) => formatResourceChunk(resourceId, amount));
  return parts.length > 0 ? parts.join('  |  ') : 'NO COST';
}

const upgradeNodeFrames = [
  { id: 'core', column: 0, row: 0, locked: false },
  { id: 'tier-1a', column: 1, row: 0, locked: true },
  { id: 'tier-1b', column: 1, row: 1, locked: true },
  { id: 'tier-2a', column: 2, row: 0, locked: true },
  { id: 'tier-2b', column: 2, row: 1, locked: true },
  { id: 'tier-2c', column: 2, row: 2, locked: true },
  { id: 'tier-3a', column: 3, row: 0, locked: true },
  { id: 'tier-3b', column: 3, row: 1, locked: true },
  { id: 'tier-3c', column: 3, row: 2, locked: true },
] as const;

const upgradeCatalogByFamily: Record<EvolutionUpgradeFamily, Array<Pick<EvolutionUpgradeNodeDefinition, 'id' | 'label' | 'cost'>>> = {
  head: [
    { id: 'core', label: 'Cranial sheath', cost: { biomass: 8 } },
    { id: 'tier-1a', label: 'Sight pits', cost: { biomass: 12 } },
    { id: 'tier-1b', label: 'Bite ridge', cost: { biomass: 10, tissue: 2 } },
    { id: 'tier-2a', label: 'Pulse snout', cost: { biomass: 18, tissue: 4 } },
    { id: 'tier-2b', label: 'Threat halo', cost: { biomass: 16, tissue: 5 } },
    { id: 'tier-2c', label: 'Dash visor', cost: { biomass: 14, tissue: 6 } },
    { id: 'tier-3a', label: 'Hunter crown', cost: { biomass: 24, tissue: 8 } },
    { id: 'tier-3b', label: 'Needle maw', cost: { biomass: 20, tissue: 8, structuralCell: 2 } },
    { id: 'tier-3c', label: 'Echo horn', cost: { biomass: 18, tissue: 10, structuralCell: 2 } },
  ],
  stomach: [
    { id: 'core', label: 'Storage membrane', cost: { biomass: 8 } },
    { id: 'tier-1a', label: 'Acid folds', cost: { biomass: 12, tissue: 2 } },
    { id: 'tier-1b', label: 'Reserve pouch', cost: { biomass: 14 } },
    { id: 'tier-2a', label: 'Filter gate', cost: { biomass: 18, tissue: 4 } },
    { id: 'tier-2b', label: 'Toxin sieve', cost: { biomass: 16, tissue: 5 } },
    { id: 'tier-2c', label: 'Hive stomach', cost: { biomass: 20, tissue: 6 } },
    { id: 'tier-3a', label: 'Archive sac', cost: { biomass: 26, tissue: 8 } },
    { id: 'tier-3b', label: 'Warden gut', cost: { biomass: 24, tissue: 8, structuralCell: 2 } },
    { id: 'tier-3c', label: 'Deep vault', cost: { biomass: 22, tissue: 10, structuralCell: 3 } },
  ],
  hands: [
    { id: 'core', label: 'Hand sockets', cost: { biomass: 8 } },
    { id: 'tier-1a', label: 'Grip barbs', cost: { biomass: 10, tissue: 2 } },
    { id: 'tier-1b', label: 'Volt tendons', cost: { biomass: 12, tissue: 3 } },
    { id: 'tier-2a', label: 'Reach coils', cost: { biomass: 16, tissue: 4 } },
    { id: 'tier-2b', label: 'Twin strikes', cost: { biomass: 18, tissue: 5 } },
    { id: 'tier-2c', label: 'Latch hooks', cost: { biomass: 14, tissue: 6 } },
    { id: 'tier-3a', label: 'Storm palms', cost: { biomass: 24, tissue: 8 } },
    { id: 'tier-3b', label: 'Reaper fans', cost: { biomass: 20, tissue: 8, structuralCell: 2 } },
    { id: 'tier-3c', label: 'Siege claws', cost: { biomass: 22, tissue: 9, structuralCell: 2 } },
  ],
  circles: [
    { id: 'core', label: 'Somatic rings', cost: { biomass: 8 } },
    { id: 'tier-1a', label: 'Shell weave', cost: { biomass: 10, tissue: 2 } },
    { id: 'tier-1b', label: 'Muscle braids', cost: { biomass: 12, tissue: 2 } },
    { id: 'tier-2a', label: 'Anchor ribs', cost: { biomass: 18, tissue: 4 } },
    { id: 'tier-2b', label: 'Spine vents', cost: { biomass: 16, tissue: 5 } },
    { id: 'tier-2c', label: 'Mass belts', cost: { biomass: 14, tissue: 6 } },
    { id: 'tier-3a', label: 'Fortress coils', cost: { biomass: 22, tissue: 8 } },
    { id: 'tier-3b', label: 'Siege body', cost: { biomass: 20, tissue: 8, structuralCell: 2 } },
    { id: 'tier-3c', label: 'Titan circles', cost: { biomass: 24, tissue: 10, structuralCell: 3 } },
  ],
};

export function getEvolutionUpgradeFamily(partId: EvolutionPartId | null): EvolutionUpgradeFamily {
  if (!partId || partId === 'head') {
    return 'head';
  }
  if (partId === 'stomach') {
    return 'stomach';
  }
  if (partId === 'tail') {
    return 'circles';
  }
  return partId.type === 'limb' ? 'hands' : 'circles';
}

export function getEvolutionUpgradeNodes(
  family: EvolutionUpgradeFamily,
): EvolutionUpgradeNodeDefinition[] {
  const catalog = upgradeCatalogByFamily[family];
  return upgradeNodeFrames.map((frame) => {
    const node = catalog.find((candidate) => candidate.id === frame.id);
    if (!node) {
      throw new Error(`Missing upgrade node ${frame.id} for family ${family}`);
    }
    return {
      ...frame,
      ...node,
    };
  });
}

export const evolutionWorldActionDefs: readonly EvolutionWorldActionDefinition[] = [
  {
    id: 'conquer',
    title: 'Conquer hex',
    icon: 'conquer',
    cost: { biomass: 30 },
    locked: false,
  },
  {
    id: 'probe',
    title: 'Probe sector',
    icon: 'probe',
    locked: true,
  },
  {
    id: 'seed',
    title: 'Seed colony',
    icon: 'seed',
    locked: true,
  },
  {
    id: 'anchor',
    title: 'Anchor route',
    icon: 'anchor',
    locked: true,
  },
] as const;

export const evolutionWorldBuildingDefs: readonly EvolutionWorldBuildingDefinition[] = [
  { id: 'spire', name: 'Crystal Spire', cost: { biomass: 20, tissue: 4 }, requirement: 'Owned hex' },
  { id: 'dome', name: 'Bio Dome', cost: { biomass: 24, tissue: 6 }, requirement: 'Owned hex' },
  { id: 'foundry', name: 'Foundry', cost: { biomass: 28, tissue: 8 }, requirement: 'Owned hex' },
  { id: 'relay', name: 'Relay', cost: { biomass: 18, tissue: 5 }, requirement: 'Owned hex' },
  { id: 'bastion', name: 'Bastion', cost: { biomass: 26, tissue: 8, structuralCell: 1 }, requirement: 'Owned hex' },
  { id: 'silo', name: 'Silo', cost: { biomass: 22, tissue: 6 }, requirement: 'Owned hex' },
  { id: 'spore', name: 'Spore Nest', cost: { biomass: 20, tissue: 7 }, requirement: 'Owned hex' },
  { id: 'prism', name: 'Prism Gate', cost: { biomass: 30, tissue: 10, structuralCell: 2 }, requirement: 'Owned hex' },
] as const;
