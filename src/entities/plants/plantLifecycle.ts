import type { PickupResourceId, PlantState } from '@/game/types';

export interface PlantLifecycleConfig {
  chewSeconds: number;
  cooldownSeconds: number;
  regrowSeconds: number;
  baseGrowthScale: number;
  harvestOutputs: readonly PickupResourceId[];
}

export interface PlantLifecycleSnapshot {
  state: PlantState;
  stateElapsed: number;
}

export interface PlantLifecycleStepResult {
  state: PlantState;
  stateElapsed: number;
  growthScale: number;
  emittedHarvestOutputs: PickupResourceId[] | null;
}

export function canPlantHarvest(state: PlantState): boolean {
  return state === 'grown';
}

export function shouldBeginPlantHarvest(
  state: PlantState,
  insideVacuumCone: boolean,
  mouthDistancePx: number,
  gatherRadiusPx: number,
): boolean {
  return (
    canPlantHarvest(state) &&
    insideVacuumCone &&
    mouthDistancePx <= gatherRadiusPx
  );
}

export function beginPlantChewing(state: PlantState): PlantState {
  return canPlantHarvest(state) ? 'chewing' : state;
}

export function getPlantGrowthScale(
  state: PlantState,
  stateElapsed: number,
  config: Pick<PlantLifecycleConfig, 'chewSeconds' | 'regrowSeconds' | 'baseGrowthScale'>,
): number {
  if (state === 'grown') {
    return 1;
  }

  if (state === 'cooldown') {
    return config.baseGrowthScale;
  }

  if (state === 'regrowing') {
    if (config.regrowSeconds <= 0) {
      return 1;
    }

    return Math.min(
      1,
      config.baseGrowthScale +
        (1 - config.baseGrowthScale) * (stateElapsed / config.regrowSeconds),
    );
  }

  if (config.chewSeconds <= 0) {
    return 1;
  }

  const bite = 0.5 + 0.5 * Math.sin((stateElapsed / config.chewSeconds) * Math.PI * 6);
  return 1 - bite * 0.08;
}

export function stepPlantLifecycle(
  snapshot: PlantLifecycleSnapshot,
  deltaSeconds: number,
  config: PlantLifecycleConfig,
): PlantLifecycleStepResult {
  const nextElapsed = snapshot.stateElapsed + deltaSeconds;

  if (snapshot.state === 'chewing' && nextElapsed >= config.chewSeconds) {
    return {
      state: 'cooldown',
      stateElapsed: 0,
      growthScale: config.baseGrowthScale,
      emittedHarvestOutputs: [...config.harvestOutputs],
    };
  }

  if (snapshot.state === 'cooldown' && nextElapsed >= config.cooldownSeconds) {
    return {
      state: 'regrowing',
      stateElapsed: 0,
      growthScale: config.baseGrowthScale,
      emittedHarvestOutputs: null,
    };
  }

  if (snapshot.state === 'regrowing' && nextElapsed >= config.regrowSeconds) {
    return {
      state: 'grown',
      stateElapsed: 0,
      growthScale: 1,
      emittedHarvestOutputs: null,
    };
  }

  return {
    state: snapshot.state,
    stateElapsed: nextElapsed,
    growthScale: getPlantGrowthScale(snapshot.state, nextElapsed, config),
    emittedHarvestOutputs: null,
  };
}

export function shouldOccupyPurifiedHex(
  roll: number,
  occupancyChance: number,
): boolean {
  return roll < occupancyChance;
}
