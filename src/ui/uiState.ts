import type {
  PickupResourceId,
  NutrientPickupTier,
  UiMode,
  UiStomachParticleSnapshot,
} from '@/game/types';
import {
  getPickupTierFromResource,
  nutrientPickupTiers,
} from '@/entities/pickups/PickupRegistry';

export interface StomachParticleRenderSource {
  id: string;
  resourceId: PickupResourceId;
  radiusMeters: number;
  position: {
    x: number;
    y: number;
  };
  angle: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function cycleUiMode(mode: UiMode): UiMode {
  if (mode === 'inspect') {
    return 'panel';
  }

  if (mode === 'panel') {
    return 'minimal';
  }

  return 'inspect';
}

export function showsWorldDebug(mode: UiMode): boolean {
  return mode === 'inspect';
}

export function showsStatusPanel(mode: UiMode): boolean {
  return mode !== 'minimal';
}

export function getModeDotStates(mode: UiMode): [boolean, boolean] {
  if (mode === 'inspect') {
    return [true, true];
  }

  if (mode === 'panel') {
    return [true, false];
  }

  return [false, false];
}

export function getLimbCooldownProgress(
  attackCooldownSeconds: number,
  maxCooldownSeconds: number,
): number {
  if (maxCooldownSeconds <= 0) {
    return 1;
  }

  return clamp(1 - attackCooldownSeconds / maxCooldownSeconds, 0, 1);
}

function createEmptyPickupCounts(): Record<NutrientPickupTier, number> {
  return {
    basic: 0,
    advanced: 0,
    rare: 0,
  };
}

export function getPickupCountsByTier(
  particles: ReadonlyArray<{ resourceId: PickupResourceId }>,
): Record<NutrientPickupTier, number> {
  const counts = createEmptyPickupCounts();
  for (const particle of particles) {
    const tier = getPickupTierFromResource(particle.resourceId);
    if (tier === 'harmful') {
      continue;
    }
    counts[tier] += 1;
  }

  return counts;
}

export function createUiStomachParticleSnapshots(
  particles: ReadonlyArray<StomachParticleRenderSource>,
  chamberRadiusMeters: number,
  containmentMarginMeters: number,
): UiStomachParticleSnapshot[] {
  const usableRadius = Math.max(0.001, chamberRadiusMeters - containmentMarginMeters);

  return particles.map((particle) => ({
    id: particle.id,
    resourceId: particle.resourceId,
    localX: clamp(particle.position.x / usableRadius, -1, 1),
    localY: clamp(particle.position.y / usableRadius, -1, 1),
    angle: particle.angle,
    radius: clamp(particle.radiusMeters / usableRadius, 0.04, 0.4),
  }));
}

export function getPickupCountEntries(
  pickupCounts: Record<NutrientPickupTier, number>,
): Array<{ tier: NutrientPickupTier; count: number }> {
  return nutrientPickupTiers.map((tier) => ({
    tier,
    count: pickupCounts[tier],
  }));
}
