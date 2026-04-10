import type {
  HudSnapshot,
  MatterShape,
  PickupType,
  UiMode,
  UiStomachParticleSnapshot,
} from '@/game/types';

export interface StomachParticleRenderSource {
  id: string;
  shape: MatterShape;
  color: number;
  radiusMeters: number;
  position: {
    x: number;
    y: number;
  };
  angle: number;
}

const pickupTypes: PickupType[] = ['triangle', 'crystal', 'bone'];

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

export function createEmptyPickupCounts(): Record<PickupType, number> {
  return {
    triangle: 0,
    crystal: 0,
    bone: 0,
  };
}

export function getPickupCountsByType(
  particles: ReadonlyArray<{ shape: MatterShape }>,
): Record<PickupType, number> {
  const counts = createEmptyPickupCounts();
  for (const particle of particles) {
    counts[particle.shape] += 1;
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
    shape: particle.shape,
    color: particle.color,
    localX: clamp(particle.position.x / usableRadius, -1, 1),
    localY: clamp(particle.position.y / usableRadius, -1, 1),
    angle: particle.angle,
    radius: clamp(particle.radiusMeters / usableRadius, 0.04, 0.4),
  }));
}

export function isHudDebugEnabled(snapshot: Pick<HudSnapshot, 'uiMode'>): boolean {
  return showsWorldDebug(snapshot.uiMode);
}

export function getPickupCountEntries(
  pickupCounts: Record<PickupType, number>,
): Array<{ type: PickupType; count: number }> {
  return pickupTypes.map((type) => ({
    type,
    count: pickupCounts[type],
  }));
}
