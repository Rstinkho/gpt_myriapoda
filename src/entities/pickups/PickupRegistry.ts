import type * as Phaser from 'phaser';
import type {
  PickupAnimationProfile,
  PickupPalette,
  PickupResourceId,
  PickupTier,
} from '@/game/types';
import { tissuePickupDefinition } from '@/entities/pickups/advanced';
import { biomassPickupDefinition } from '@/entities/pickups/basic';
import { parasitePickupDefinition } from '@/entities/pickups/harmful';
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
  isHarmful: boolean;
  worldLifetimeSeconds?: number;
  despawnAnimationSeconds?: number;
  stomachEffect?: 'parasite';
  buildTexture: (graphics: Phaser.GameObjects.Graphics, size: number) => void;
  drawParticle: (
    graphics: Phaser.GameObjects.Graphics,
    options: PickupParticleRenderOptions,
  ) => void;
}

export const pickupTiers: PickupTier[] = ['basic', 'advanced', 'rare', 'harmful'];
export const nutrientPickupTiers = ['basic', 'advanced', 'rare'] as const;

export const pickupDefinitions = [
  biomassPickupDefinition,
  tissuePickupDefinition,
  structuralCellPickupDefinition,
  parasitePickupDefinition,
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
  harmful: 'parasite',
};

export const defaultPickupDefinitionByTier: Record<PickupTier, PickupDefinition> = {
  basic: pickupDefinitionsByResource.biomass,
  advanced: pickupDefinitionsByResource.tissue,
  rare: pickupDefinitionsByResource.structuralCell,
  harmful: pickupDefinitionsByResource.parasite,
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
