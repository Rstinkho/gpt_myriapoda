import { describe, expect, it } from 'vitest';
import {
  getDefaultPickupDefinition,
  getDefaultPickupResourceId,
  getPickupDefinition,
  getPickupTierFromResource,
  pickupTiers,
} from '@/entities/pickups/PickupRegistry';

describe('PickupRegistry', () => {
  it('provides a default resource definition for every tier', () => {
    for (const tier of pickupTiers) {
      const resourceId = getDefaultPickupResourceId(tier);
      const definition = getDefaultPickupDefinition(tier);

      expect(definition.resourceId).toBe(resourceId);
      expect(getPickupTierFromResource(resourceId)).toBe(tier);
      expect(definition.textureKey).toMatch(/^pickup-/);
    }
  });

  it('marks the rare structural cell as the animated premium pickup', () => {
    const definition = getPickupDefinition('structuralCell');

    expect(definition.tier).toBe('rare');
    expect(definition.animationProfile).toBeDefined();
    expect(definition.textureKey).toBe('pickup-rare-structural-cell');
    expect(definition.digestValue).toBe(4);
  });
});
