import { textureKeys } from '@/game/assets';
import type {
  EvolutionPartId,
  PickupResourceId,
  ResourceCost,
} from '@/game/types';

export type EvolutionUpgradeFamily = 'head' | 'stomach' | 'hands' | 'circles';
export type EvolutionWorldActionId = 'conquer' | 'probe' | 'seed' | 'anchor';
export type EvolutionWorldActionIcon = 'conquer' | 'probe' | 'purify' | 'seed' | 'anchor';

export interface EvolutionUpgradeNodeDefinition {
  id: string;
  label: string;
  description: string;
  cost: ResourceCost;
  column: number;
  row: number;
  locked: boolean;
  iconKey?: string;
}

export interface EvolutionWorldActionDefinition {
  id: EvolutionWorldActionId;
  title: string;
  description: string;
  icon: EvolutionWorldActionIcon;
  cost?: ResourceCost;
  locked: boolean;
}

export interface EvolutionWorldBuildingDefinition {
  id: string;
  name: string;
  description: string;
  cost: ResourceCost;
  requirement: string;
}

export interface ResourceCostIconEntry {
  readonly resourceId: PickupResourceId;
  readonly textureKey: string;
  readonly amount: number;
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

/**
 * Returns a list of `{ resourceId, textureKey, amount }` entries for rendering a
 * cost as `[icon] N  [icon] M` instead of `formatResourceCost`'s uppercase text.
 * Filters out zero/missing amounts and preserves a stable order.
 */
export function formatResourceCostIconPairs(cost: ResourceCost): ResourceCostIconEntry[] {
  const order: PickupResourceId[] = ['biomass', 'tissue', 'structuralCell', 'parasite'];
  const entries: ResourceCostIconEntry[] = [];
  for (const resourceId of order) {
    const amount = cost[resourceId];
    if (typeof amount !== 'number' || amount <= 0) {
      continue;
    }
    entries.push({
      resourceId,
      textureKey: textureKeys.resourceIcons[resourceId],
      amount,
    });
  }
  return entries;
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

type UpgradeCatalogEntry = Pick<
  EvolutionUpgradeNodeDefinition,
  'id' | 'label' | 'description' | 'cost'
>;

const upgradeCatalogByFamily: Record<EvolutionUpgradeFamily, UpgradeCatalogEntry[]> = {
  head: [
    {
      id: 'core',
      label: 'Cranial sheath',
      description: 'Hardens the head plate, protecting sensory nerves from direct impact.',
      cost: { biomass: 8 },
    },
    {
      id: 'tier-1a',
      label: 'Sight pits',
      description: 'Grows twin photo-pits that widen the myriapoda\'s threat-detection cone.',
      cost: { biomass: 12 },
    },
    {
      id: 'tier-1b',
      label: 'Bite ridge',
      description: 'Fuses a serrated ridge along the jawline, increasing close-bite damage.',
      cost: { biomass: 10, tissue: 2 },
    },
    {
      id: 'tier-2a',
      label: 'Pulse snout',
      description: 'Emits a low-frequency pulse that briefly staggers nearby predators.',
      cost: { biomass: 18, tissue: 4 },
    },
    {
      id: 'tier-2b',
      label: 'Threat halo',
      description: 'A bioluminescent halo marks hostile signatures within the hex.',
      cost: { biomass: 16, tissue: 5 },
    },
    {
      id: 'tier-2c',
      label: 'Dash visor',
      description: 'A reactive visor sharpens vision during dashes and reduces lens glare.',
      cost: { biomass: 14, tissue: 6 },
    },
    {
      id: 'tier-3a',
      label: 'Hunter crown',
      description: 'Grows a crown of sensory spines that locks onto fleeing prey.',
      cost: { biomass: 24, tissue: 8 },
    },
    {
      id: 'tier-3b',
      label: 'Needle maw',
      description: 'Extrudes a needle jaw that pierces hardened shells on a charged bite.',
      cost: { biomass: 20, tissue: 8, structuralCell: 2 },
    },
    {
      id: 'tier-3c',
      label: 'Echo horn',
      description: 'A resonant horn disorients enemies, briefly scrambling their AI.',
      cost: { biomass: 18, tissue: 10, structuralCell: 2 },
    },
  ],
  stomach: [
    {
      id: 'core',
      label: 'Storage membrane',
      description: 'Toughens the stomach lining, allowing nutrients to be held longer.',
      cost: { biomass: 8 },
    },
    {
      id: 'tier-1a',
      label: 'Acid folds',
      description: 'Deepens gastric folds, speeding the digestion of tough biomass.',
      cost: { biomass: 12, tissue: 2 },
    },
    {
      id: 'tier-1b',
      label: 'Reserve pouch',
      description: 'Adds a secondary pouch that expands total stomach capacity.',
      cost: { biomass: 14 },
    },
    {
      id: 'tier-2a',
      label: 'Filter gate',
      description: 'A selective gate routes harmful parasites into a purge channel.',
      cost: { biomass: 18, tissue: 4 },
    },
    {
      id: 'tier-2b',
      label: 'Toxin sieve',
      description: 'Neutralises low-grade toxins before they reach the bloodstream.',
      cost: { biomass: 16, tissue: 5 },
    },
    {
      id: 'tier-2c',
      label: 'Hive stomach',
      description: 'Splits digestion into chambers, improving throughput under heavy load.',
      cost: { biomass: 20, tissue: 6 },
    },
    {
      id: 'tier-3a',
      label: 'Archive sac',
      description: 'Stores residual structural cells that regenerate lost tissue over time.',
      cost: { biomass: 26, tissue: 8 },
    },
    {
      id: 'tier-3b',
      label: 'Warden gut',
      description: 'Hardened muscle walls shield the stomach from internal damage bursts.',
      cost: { biomass: 24, tissue: 8, structuralCell: 2 },
    },
    {
      id: 'tier-3c',
      label: 'Deep vault',
      description: 'A pressurised vault preserves rare resources across long hex traversals.',
      cost: { biomass: 22, tissue: 10, structuralCell: 3 },
    },
  ],
  hands: [
    {
      id: 'core',
      label: 'Hand sockets',
      description: 'Reinforces the limb sockets so hands attach with less swing recoil.',
      cost: { biomass: 8 },
    },
    {
      id: 'tier-1a',
      label: 'Grip barbs',
      description: 'Tiny barbs along each digit improve grip on slick or shelled prey.',
      cost: { biomass: 10, tissue: 2 },
    },
    {
      id: 'tier-1b',
      label: 'Volt tendons',
      description: 'Conductive tendons release a brief shock on strike contact.',
      cost: { biomass: 12, tissue: 3 },
    },
    {
      id: 'tier-2a',
      label: 'Reach coils',
      description: 'Elastic coils extend strike range without sacrificing recovery speed.',
      cost: { biomass: 16, tissue: 4 },
    },
    {
      id: 'tier-2b',
      label: 'Twin strikes',
      description: 'Enables a rapid two-hit combo that staggers lighter targets.',
      cost: { biomass: 18, tissue: 5 },
    },
    {
      id: 'tier-2c',
      label: 'Latch hooks',
      description: 'Hooked tips can latch onto enemies, pinning them for a follow-up strike.',
      cost: { biomass: 14, tissue: 6 },
    },
    {
      id: 'tier-3a',
      label: 'Storm palms',
      description: 'A charged palm strike arcs electricity to nearby hostiles on hit.',
      cost: { biomass: 24, tissue: 8 },
    },
    {
      id: 'tier-3b',
      label: 'Reaper fans',
      description: 'Bladed fan extensions scythe across multiple foes in a single swing.',
      cost: { biomass: 20, tissue: 8, structuralCell: 2 },
    },
    {
      id: 'tier-3c',
      label: 'Siege claws',
      description: 'Heavy claws crush structural shells, unlocking reinforced enemies.',
      cost: { biomass: 22, tissue: 9, structuralCell: 2 },
    },
  ],
  circles: [
    {
      id: 'core',
      label: 'Somatic rings',
      description: 'Strengthens the myriapoda\'s body rings, increasing baseline hit points.',
      cost: { biomass: 8 },
    },
    {
      id: 'tier-1a',
      label: 'Shell weave',
      description: 'Weaves a chitin lattice across each segment, reducing glancing damage.',
      cost: { biomass: 10, tissue: 2 },
    },
    {
      id: 'tier-1b',
      label: 'Muscle braids',
      description: 'Braided muscle bundles improve dash acceleration and turn rate.',
      cost: { biomass: 12, tissue: 2 },
    },
    {
      id: 'tier-2a',
      label: 'Anchor ribs',
      description: 'Flared ribs anchor the body during strikes, damping knockback.',
      cost: { biomass: 18, tissue: 4 },
    },
    {
      id: 'tier-2b',
      label: 'Spine vents',
      description: 'Vents along the spine release brief thrust bursts between segments.',
      cost: { biomass: 16, tissue: 5 },
    },
    {
      id: 'tier-2c',
      label: 'Mass belts',
      description: 'Adds inertial belts that stabilise the tail during heavy whips.',
      cost: { biomass: 14, tissue: 6 },
    },
    {
      id: 'tier-3a',
      label: 'Fortress coils',
      description: 'The body can curl into a defensive fortress, halving incoming damage.',
      cost: { biomass: 22, tissue: 8 },
    },
    {
      id: 'tier-3b',
      label: 'Siege body',
      description: 'Dense structural cells turn every segment into a battering ram.',
      cost: { biomass: 20, tissue: 8, structuralCell: 2 },
    },
    {
      id: 'tier-3c',
      label: 'Titan circles',
      description: 'The apex form: each ring thickens, boosting mass, armour, and reach.',
      cost: { biomass: 24, tissue: 10, structuralCell: 3 },
    },
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
    description: 'Claim the selected hex. The myriapoda must linger inside while converting it.',
    icon: 'conquer',
    cost: { biomass: 30 },
    locked: false,
  },
  {
    id: 'probe',
    title: 'Probe sector',
    description: 'Sends a probe to reveal threats, resources, and terrain in an unseen sector.',
    icon: 'probe',
    locked: true,
  },
  {
    id: 'seed',
    title: 'Seed colony',
    description: 'Plants a seed colony on an owned hex, slowly generating biomass over time.',
    icon: 'seed',
    locked: true,
  },
  {
    id: 'anchor',
    title: 'Anchor route',
    description: 'Anchors a travel route between two owned hexes, speeding future traversal.',
    icon: 'anchor',
    locked: true,
  },
] as const;

export const evolutionWorldBuildingDefs: readonly EvolutionWorldBuildingDefinition[] = [
  {
    id: 'spire',
    name: 'Crystal Spire',
    description: 'Focuses ambient bio-energy into a slow stream of structural cells.',
    cost: { biomass: 20, tissue: 4 },
    requirement: 'Owned hex',
  },
  {
    id: 'dome',
    name: 'Bio Dome',
    description: 'A sealed dome that shelters tissue growth, boosting passive regeneration.',
    cost: { biomass: 24, tissue: 6 },
    requirement: 'Owned hex',
  },
  {
    id: 'foundry',
    name: 'Foundry',
    description: 'Refines raw biomass into tissue, trading throughput for higher-tier matter.',
    cost: { biomass: 28, tissue: 8 },
    requirement: 'Owned hex',
  },
  {
    id: 'relay',
    name: 'Relay',
    description: 'Relays sensory data across owned hexes, extending the alert network.',
    cost: { biomass: 18, tissue: 5 },
    requirement: 'Owned hex',
  },
  {
    id: 'bastion',
    name: 'Bastion',
    description: 'Fortifies an owned hex, slowing enemy incursions and contested decay.',
    cost: { biomass: 26, tissue: 8, structuralCell: 1 },
    requirement: 'Owned hex',
  },
  {
    id: 'silo',
    name: 'Silo',
    description: 'Stores surplus biomass, raising the colony\'s maximum reserves.',
    cost: { biomass: 22, tissue: 6 },
    requirement: 'Owned hex',
  },
  {
    id: 'spore',
    name: 'Spore Nest',
    description: 'Releases spores that interfere with parasite spawning in adjacent hexes.',
    cost: { biomass: 20, tissue: 7 },
    requirement: 'Owned hex',
  },
  {
    id: 'prism',
    name: 'Prism Gate',
    description: 'Opens a prismatic gate that transmits structural cells between built hexes.',
    cost: { biomass: 30, tissue: 10, structuralCell: 2 },
    requirement: 'Owned hex',
  },
] as const;
