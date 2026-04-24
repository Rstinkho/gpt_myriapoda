import { describe, expect, it } from 'vitest';
import { WorldProgressionController } from '@/progression/WorldProgressionController';
import { firstWorldProgressProfile } from '@/progression/firstWorldProfile';
import {
  createBuildingPlacedMetric,
  createCollectedResourceMetric,
  createEnemyKillMetric,
} from '@/progression/progressionData';
import { tutorialProgressProfile } from '@/tutorial/tutorialData';

describe('WorldProgressionController', () => {
  it('advances from tutorial stage 1 only after every objective is complete', () => {
    const controller = new WorldProgressionController(tutorialProgressProfile);

    controller.recordMetric('movementDistancePx', 360);
    controller.recordMetric('dashUsed');
    controller.recordMetric(createEnemyKillMetric('jellyfish'));
    let result = controller.recordMetric(createEnemyKillMetric('jellyfish'));

    expect(result.stageChanged).toBe(false);
    expect(controller.getSnapshot().stageId).toBe('tutorial-stage-1');

    result = controller.recordMetric(createCollectedResourceMetric('biomass'));

    expect(result.stageChanged).toBe(true);
    expect(result.previousStageId).toBe('tutorial-stage-1');
    expect(result.currentStageId).toBe('tutorial-stage-2');
    expect(controller.getSnapshot().stageId).toBe('tutorial-stage-2');
    expect(controller.getMetricValue('movementDistancePx')).toBe(0);
  });

  it('tracks the Crystal Spire and segment purchase objectives for tutorial stage 4', () => {
    const controller = new WorldProgressionController(tutorialProgressProfile);
    controller.switchProfile(tutorialProgressProfile, { stageIndex: 3 });

    controller.recordMetric(createBuildingPlacedMetric('spire'));
    const result = controller.recordMetric('segmentPurchased');

    expect(result.stageChanged).toBe(true);
    expect(result.previousStageId).toBe('tutorial-stage-4');
    expect(result.currentStageId).toBe('tutorial-stage-5');
    expect(controller.getSnapshot().stageId).toBe('tutorial-stage-5');
  });

  it('loops repeatable first-world progression back to the first stage', () => {
    const controller = new WorldProgressionController(firstWorldProgressProfile);

    controller.recordMetric('conquestCompleted');
    controller.recordMetric('enemyKilledAny', 6);
    const result = controller.recordMetric(createCollectedResourceMetric('biomass'), 20);

    expect(result.stageChanged).toBe(true);
    expect(result.profileCompleted).toBe(true);
    expect(result.currentStageId).toBe('surface-foothold');
    expect(controller.getSnapshot().stageId).toBe('surface-foothold');
    expect(controller.getSnapshot().cycle).toBe(1);
    expect(controller.getSnapshot().completedObjectiveCount).toBe(0);
  });
});
