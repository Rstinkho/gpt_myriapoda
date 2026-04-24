import type { WorldProgressSnapshot } from '@/game/types';
import type {
  ProgressMetricId,
  WorldProgressProfileDefinition,
  WorldProgressStageDefinition,
} from '@/progression/progressionData';

export interface WorldProgressAdvanceResult {
  readonly profileId: string;
  readonly stageChanged: boolean;
  readonly profileCompleted: boolean;
  readonly previousStageId: string | null;
  readonly currentStageId: string | null;
}

function createAdvanceResult(
  profileId: string,
  previousStageId: string | null,
  currentStageId: string | null,
  stageChanged: boolean,
  profileCompleted: boolean,
): WorldProgressAdvanceResult {
  return {
    profileId,
    stageChanged,
    profileCompleted,
    previousStageId,
    currentStageId,
  };
}

export class WorldProgressionController {
  private profile: WorldProgressProfileDefinition;
  private stageIndex = 0;
  private cycle = 0;
  private readonly stageCounts = new Map<ProgressMetricId, number>();

  constructor(profile: WorldProgressProfileDefinition) {
    this.profile = profile;
  }

  getProfile(): WorldProgressProfileDefinition {
    return this.profile;
  }

  getCurrentStage(): WorldProgressStageDefinition | null {
    return this.profile.stages[this.stageIndex] ?? null;
  }

  getMetricValue(metricId: ProgressMetricId): number {
    return this.stageCounts.get(metricId) ?? 0;
  }

  switchProfile(
    profile: WorldProgressProfileDefinition,
    options: { stageIndex?: number; cycle?: number } = {},
  ): void {
    this.profile = profile;
    this.stageIndex = Math.max(0, Math.min(profile.stages.length - 1, options.stageIndex ?? 0));
    this.cycle = Math.max(0, options.cycle ?? 0);
    this.stageCounts.clear();
  }

  recordMetric(metricId: ProgressMetricId, amount = 1): WorldProgressAdvanceResult {
    const currentStage = this.getCurrentStage();
    if (!currentStage) {
      return createAdvanceResult(this.profile.id, null, null, false, false);
    }

    const nextValue = this.getMetricValue(metricId) + Math.max(0, amount);
    this.stageCounts.set(metricId, nextValue);
    return this.evaluateStageCompletion();
  }

  getSnapshot(): WorldProgressSnapshot {
    const stage = this.getCurrentStage();
    if (!stage) {
      return {
        profileId: this.profile.id,
        profileLabel: this.profile.label,
        stageId: 'complete',
        stageTitle: 'Complete',
        stageSubtitle: '',
        objectiveHeader: '',
        stageIndex: 0,
        totalStages: 0,
        cycle: this.cycle,
        completedObjectiveCount: 0,
        objectiveCount: 0,
        progress01: 1,
        isTutorial: this.profile.isTutorial,
        objectives: [],
      };
    }

    const objectives = stage.objectives.map((objective) => {
      const current = Math.min(objective.target, this.getMetricValue(objective.metricId));
      return {
        id: objective.id,
        label: objective.label,
        current,
        target: objective.target,
        completed: current >= objective.target,
        showCounter: objective.showCounter ?? objective.target > 1,
      };
    });
    const completedObjectiveCount = objectives.filter((objective) => objective.completed).length;
    const objectiveCount = Math.max(1, objectives.length);

    return {
      profileId: this.profile.id,
      profileLabel: this.profile.label,
      stageId: stage.id,
      stageTitle: stage.title,
      stageSubtitle: stage.subtitle,
      objectiveHeader: stage.objectiveHeader,
      stageIndex: this.stageIndex + 1,
      totalStages: this.profile.stages.length,
      cycle: this.cycle,
      completedObjectiveCount,
      objectiveCount: objectives.length,
      progress01: completedObjectiveCount / objectiveCount,
      isTutorial: this.profile.isTutorial,
      objectives,
    };
  }

  private evaluateStageCompletion(): WorldProgressAdvanceResult {
    const currentStage = this.getCurrentStage();
    if (!currentStage) {
      return createAdvanceResult(this.profile.id, null, null, false, false);
    }

    const stageComplete = currentStage.objectives.every((objective) => {
      return this.getMetricValue(objective.metricId) >= objective.target;
    });
    if (!stageComplete) {
      return createAdvanceResult(
        this.profile.id,
        currentStage.id,
        currentStage.id,
        false,
        false,
      );
    }

    const previousStageId = currentStage.id;
    const lastStageIndex = this.profile.stages.length - 1;
    if (this.stageIndex >= lastStageIndex) {
      if (this.profile.repeat && this.profile.stages.length > 0) {
        this.stageIndex = 0;
        this.cycle += 1;
        this.stageCounts.clear();
        return createAdvanceResult(
          this.profile.id,
          previousStageId,
          this.getCurrentStage()?.id ?? null,
          true,
          true,
        );
      }

      return createAdvanceResult(this.profile.id, previousStageId, null, true, true);
    }

    this.stageIndex += 1;
    this.stageCounts.clear();
    return createAdvanceResult(
      this.profile.id,
      previousStageId,
      this.getCurrentStage()?.id ?? null,
      true,
      false,
    );
  }
}
