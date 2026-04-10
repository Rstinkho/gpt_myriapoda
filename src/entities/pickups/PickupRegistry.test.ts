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

  it('registers parasite as a harmful pickup with stomach hazard metadata', () => {
    const definition = getPickupDefinition('parasite');

    expect(definition.tier).toBe('harmful');
    expect(definition.isHarmful).toBe(true);
    expect(definition.textureKey).toBe('pickup-harmful-parasite');
    expect(definition.digestValue).toBe(0);
    expect(definition.worldLifetimeSeconds).toBe(10);
    expect(definition.despawnAnimationSeconds).toBeGreaterThan(0);
    expect(definition.stomachEffect).toBe('parasite');
  });
});
