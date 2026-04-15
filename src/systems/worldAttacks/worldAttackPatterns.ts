import { tuning } from '@/game/tuning';
import type { EnemySpawnContext, EnemyType, HexCell } from '@/game/types';

export type WorldAttackId = 'conquestLeechPack';

export interface WorldAttackSpawn extends EnemySpawnContext {
  attackId: WorldAttackId;
  enemyType: EnemyType;
}

export interface WorldAttackWaveContext {
  targetCell: HexCell;
  remainingKills: number;
  randomFloat?: () => number;
}

export interface WorldAttackDefinition {
  id: WorldAttackId;
  createWave(context: WorldAttackWaveContext): WorldAttackSpawn[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sampleRandom(randomFloat?: () => number): number {
  return clamp((randomFloat ?? Math.random)(), 0, 0.999999);
}

function chooseWaveSize(remainingKills: number, randomFloat?: () => number): number {
  const maxWaveSize = Math.min(tuning.conquerLeechWaveMaxSize, remainingKills);
  const minWaveSize = Math.min(tuning.conquerLeechWaveMinSize, maxWaveSize);
  if (maxWaveSize <= minWaveSize) {
    return maxWaveSize;
  }

  const waveSpan = maxWaveSize - minWaveSize + 1;
  return minWaveSize + Math.floor(sampleRandom(randomFloat) * waveSpan);
}

function createConquestLeechPackWave(
  context: WorldAttackWaveContext,
): WorldAttackSpawn[] {
  const waveSize = chooseWaveSize(context.remainingKills, context.randomFloat);
  if (waveSize <= 0) {
    return [];
  }

  const approachAngle = sampleRandom(context.randomFloat) * Math.PI * 2;
  const packDistance =
    tuning.worldHexSize * tuning.conquerLeechAttackSpawnRadiusMultiplier;
  const packCenterX = context.targetCell.centerX + Math.cos(approachAngle) * packDistance;
  const packCenterY = context.targetCell.centerY + Math.sin(approachAngle) * packDistance;
  const tangentX = -Math.sin(approachAngle);
  const tangentY = Math.cos(approachAngle);
  const halfWave = (waveSize - 1) * 0.5;

  return Array.from({ length: waveSize }, (_, index) => {
    const lateralIndex = index - halfWave;
    const jitter =
      (sampleRandom(context.randomFloat) - 0.5) * tuning.conquerLeechAttackPackJitterPx;
    const lateralOffset =
      lateralIndex * tuning.conquerLeechAttackPackSpacingPx + jitter;

    return {
      attackId: 'conquestLeechPack',
      enemyType: 'leech',
      cell: context.targetCell,
      x: packCenterX + tangentX * lateralOffset,
      y: packCenterY + tangentY * lateralOffset,
      enemySpeedMultiplier: tuning.conquerLeechAttackSpeedMultiplier,
    };
  });
}

export const worldAttackDefinitions: Record<WorldAttackId, WorldAttackDefinition> = {
  conquestLeechPack: {
    id: 'conquestLeechPack',
    createWave: createConquestLeechPackWave,
  },
};

export function createWorldAttackWave(
  attackId: WorldAttackId,
  context: WorldAttackWaveContext,
): WorldAttackSpawn[] {
  return worldAttackDefinitions[attackId].createWave(context);
}
