import type { UiStomachParasiteSnapshot } from '@/game/types';

export interface ActiveParasite {
  id: string;
  elapsedSeconds: number;
  nextConsumeAtSeconds: number;
  phaseSeed: number;
  orbitRadius: number;
  orbitSpeed: number;
  swaySpeed: number;
  baseAngle: number;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeHash(hash: number): number {
  return hash / 0xffffffff;
}

export function createActiveParasite(id: string): ActiveParasite {
  const hash = hashString(id);
  const phaseSeed = normalizeHash(hash ^ 0x9e3779b9) * Math.PI * 2;
  const orbitSeed = normalizeHash(hash ^ 0x7f4a7c15);
  const speedSeed = normalizeHash(hash ^ 0x6a09e667);

  return {
    id,
    elapsedSeconds: 0,
    nextConsumeAtSeconds: 2,
    phaseSeed,
    orbitRadius: 0.18 + orbitSeed * 0.22,
    orbitSpeed: 0.9 + speedSeed * 0.8,
    swaySpeed: 1.6 + orbitSeed * 1.2,
    baseAngle: normalizeHash(hash ^ 0x3c6ef372) * Math.PI * 2,
  };
}

export function stepActiveParasites(
  parasites: ReadonlyArray<ActiveParasite>,
  deltaSeconds: number,
  lifetimeSeconds: number,
  consumeIntervalSeconds: number,
  consumeOldestPickup: () => boolean,
): ActiveParasite[] {
  const nextParasites: ActiveParasite[] = [];

  for (const parasite of parasites) {
    const nextElapsed = Math.min(
      lifetimeSeconds,
      parasite.elapsedSeconds + deltaSeconds,
    );
    let nextConsumeAtSeconds = parasite.nextConsumeAtSeconds;

    while (
      nextConsumeAtSeconds <= lifetimeSeconds &&
      nextConsumeAtSeconds <= nextElapsed
    ) {
      consumeOldestPickup();
      nextConsumeAtSeconds += consumeIntervalSeconds;
    }

    if (nextElapsed < lifetimeSeconds) {
      nextParasites.push({
        ...parasite,
        elapsedSeconds: nextElapsed,
        nextConsumeAtSeconds,
      });
    }
  }

  return nextParasites;
}

export function createParasiteAlertProgress(
  activeCount: number,
  elapsedSeconds: number,
): number {
  if (activeCount <= 0) {
    return 0;
  }

  const blink = 0.5 + 0.5 * Math.sin(elapsedSeconds * 8.6);
  return Math.min(1, (0.36 + blink * 0.64) * (0.72 + activeCount * 0.16));
}

export function createUiParasiteSnapshots(
  parasites: ReadonlyArray<ActiveParasite>,
): UiStomachParasiteSnapshot[] {
  return parasites.map((parasite) => {
    const travelAngle =
      parasite.baseAngle + parasite.elapsedSeconds * parasite.orbitSpeed;
    const sway =
      Math.sin(parasite.elapsedSeconds * parasite.swaySpeed + parasite.phaseSeed) *
      0.12;
    const localX = Math.cos(travelAngle) * parasite.orbitRadius + sway * 0.4;
    const localY = Math.sin(travelAngle) * parasite.orbitRadius * 0.88 + sway;
    const tangentAngle =
      travelAngle +
      Math.PI / 2 +
      Math.cos(
        parasite.elapsedSeconds * (parasite.swaySpeed * 0.8) + parasite.phaseSeed,
      ) *
        0.28;

    return {
      id: parasite.id,
      localX,
      localY,
      angle: tangentAngle,
      radius: 0.18,
    };
  });
}
