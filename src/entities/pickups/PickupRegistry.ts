import type Phaser from 'phaser';
import type {
  PickupAnimationProfile,
  PickupPalette,
  PickupResourceId,
  PickupTier,
} from '@/game/types';
import { tissuePickupDefinition } from '@/entities/pickups/advanced';
import { biomassPickupDefinition } from '@/entities/pickups/basic';
import { structuralCellPickupDefinition } from '@/entities/pickups/rare';
import type { PickupParticleRenderOptions } from '@/entities/pickups/PickupVisuals';

export interface PickupDefinition {
  tier: PickupTier;
  resourceId: PickupResourceId;
  textureKey: string;
  digestValue: number;
  radius: number;
  palette: PickupPalette;
  animationProfile?: PickupAnimationProfile;
  buildTexture: (graphics: Phaser.GameObjects.Graphics, size: number) => void;
  drawParticle: (
    graphics: Phaser.GameObjects.Graphics,
    options: PickupParticleRenderOptions,
  ) => void;
}

export const pickupTiers: PickupTier[] = ['basic', 'advanced', 'rare'];

export const pickupDefinitions = [
  biomassPickupDefinition,
  tissuePickupDefinition,
  structuralCellPickupDefinition,
] as const satisfies readonly PickupDefinition[];

export const pickupResourceIds = pickupDefinitions.map(
  (definition) => definition.resourceId,
) as PickupResourceId[];

export const pickupDefinitionsByResource = Object.fromEntries(
  pickupDefinitions.map((definition) => [definition.resourceId, definition]),
) as Record<PickupResourceId, PickupDefinition>;

export const defaultPickupResourceByTier: Record<PickupTier, PickupResourceId> = {
  basic: 'biomass',
  advanced: 'tissue',
  rare: 'structuralCell',
};

export const defaultPickupDefinitionByTier: Record<PickupTier, PickupDefinition> = {
  basic: pickupDefinitionsByResource.biomass,
  advanced: pickupDefinitionsByResource.tissue,
  rare: pickupDefinitionsByResource.structuralCell,
};

export function getPickupDefinition(resourceId: PickupResourceId): PickupDefinition {
  return pickupDefinitionsByResource[resourceId];
}

export function getDefaultPickupResourceId(tier: PickupTier): PickupResourceId {
  return defaultPickupResourceByTier[tier];
}

export function getDefaultPickupDefinition(tier: PickupTier): PickupDefinition {
  return defaultPickupDefinitionByTier[tier];
}

export function getPickupTierFromResource(resourceId: PickupResourceId): PickupTier {
  return pickupDefinitionsByResource[resourceId].tier;
}
