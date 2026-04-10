import type {
  HexTypeId,
  PickupResourceId,
  PlantType,
} from '@/game/types';

export interface PlantDefinition {
  type: PlantType;
  displayName: string;
  cooldownSeconds: number;
  spawnableHexTypes: readonly HexTypeId[];
  harvestOutputs: readonly PickupResourceId[];
  implemented: boolean;
}

export const plantDefinitions: Record<PlantType, PlantDefinition> = {
  fiberPlant: {
    type: 'fiberPlant',
    displayName: 'Fiber Plant',
    cooldownSeconds: 18,
    spawnableHexTypes: ['purified'],
    harvestOutputs: ['biomass', 'biomass'],
    implemented: true,
  },
  sparkBloom: {
    type: 'sparkBloom',
    displayName: 'Spark Bloom',
    cooldownSeconds: 18,
    spawnableHexTypes: ['purified'],
    harvestOutputs: [],
    implemented: false,
  },
  boneMoss: {
    type: 'boneMoss',
    displayName: 'Bone Moss',
    cooldownSeconds: 18,
    spawnableHexTypes: ['purified'],
    harvestOutputs: [],
    implemented: false,
  },
  contaminatedVariant: {
    type: 'contaminatedVariant',
    displayName: 'Contaminated Variant',
    cooldownSeconds: 18,
    spawnableHexTypes: ['purified'],
    harvestOutputs: [],
    implemented: false,
  },
};

export function getPlantDefinition(type: PlantType): PlantDefinition {
  return plantDefinitions[type];
}
