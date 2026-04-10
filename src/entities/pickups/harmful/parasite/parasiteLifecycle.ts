export interface ParasiteWorldLifecycleState {
  alphaMultiplier: number;
  scaleXMultiplier: number;
  scaleYMultiplier: number;
  isDespawning: boolean;
  isExpired: boolean;
}

export function sampleParasiteWorldLifecycle(
  ageSeconds: number,
  lifetimeSeconds: number,
  despawnAnimationSeconds: number,
): ParasiteWorldLifecycleState {
  if (ageSeconds >= lifetimeSeconds) {
    return {
      alphaMultiplier: 0,
      scaleXMultiplier: 0,
      scaleYMultiplier: 0,
      isDespawning: true,
      isExpired: true,
    };
  }

  const despawnStart = Math.max(0, lifetimeSeconds - despawnAnimationSeconds);
  if (ageSeconds <= despawnStart || despawnAnimationSeconds <= 0) {
    return {
      alphaMultiplier: 1,
      scaleXMultiplier: 1,
      scaleYMultiplier: 1,
      isDespawning: false,
      isExpired: false,
    };
  }

  const progress = Math.min(
    1,
    (ageSeconds - despawnStart) / Math.max(0.0001, despawnAnimationSeconds),
  );
  const inverse = 1 - progress;

  return {
    alphaMultiplier: 0.18 + inverse * 0.82,
    scaleXMultiplier: 0.26 + inverse * 0.74,
    scaleYMultiplier: 0.12 + inverse * 0.88,
    isDespawning: true,
    isExpired: false,
  };
}
