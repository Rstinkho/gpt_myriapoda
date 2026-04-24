import type {
  EnemyType,
  PickupResourceId,
  WorldBuildingId,
} from '@/game/types';

export type ProgressMetricId =
  | 'movementDistancePx'
  | 'dashUsed'
  | 'enemyKilledAny'
  | 'plantHarvestStarted'
  | 'conquestCompleted'
  | 'segmentPurchased'
  | `enemyKilled:${EnemyType}`
  | `resourceCollected:${PickupResourceId}`
  | `buildingPlaced:${WorldBuildingId}`;

export interface WorldProgressObjectiveDefinition {
  id: string;
  label: string;
  metricId: ProgressMetricId;
  target: number;
  showCounter?: boolean;
}

export interface WorldProgressStageDefinition {
  id: string;
  title: string;
  subtitle: string;
  objectiveHeader: string;
  objectives: readonly WorldProgressObjectiveDefinition[];
}

export interface WorldProgressProfileDefinition {
  id: string;
  label: string;
  isTutorial: boolean;
  repeat: boolean;
  stages: readonly WorldProgressStageDefinition[];
}

export function createEnemyKillMetric(enemyType: EnemyType): ProgressMetricId {
  return `enemyKilled:${enemyType}`;
}

export function createCollectedResourceMetric(
  resourceId: PickupResourceId,
): ProgressMetricId {
  return `resourceCollected:${resourceId}`;
}

export function createBuildingPlacedMetric(
  buildingId: WorldBuildingId,
): ProgressMetricId {
  return `buildingPlaced:${buildingId}`;
}
