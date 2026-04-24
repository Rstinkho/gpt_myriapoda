import type {
  EnemyType,
  HexCoord,
  PickupResourceId,
  PlantType,
} from '@/game/types';
import type { WorldProgressProfileDefinition } from '@/progression/progressionData';
import {
  createBuildingPlacedMetric,
  createCollectedResourceMetric,
  createEnemyKillMetric,
} from '@/progression/progressionData';
import {
  tutorialConquestCoord,
  tutorialLoosePickupCoord,
  tutorialPlantCoord,
  tutorialShellbackCoord,
} from '@/tutorial/tutorialWorldPresets';

export interface TutorialConquestRules {
  occupiedSeconds: number;
  killGoal: number;
  biomassCost: number;
}

export interface TutorialEnemySpawn {
  id: string;
  type: EnemyType;
  coord: HexCoord;
  dropOverride?: PickupResourceId[];
}

export interface TutorialPlantSpawn {
  id: string;
  type: PlantType;
  coord: HexCoord;
}

export interface TutorialPickupSpawn {
  id: string;
  resourceId: PickupResourceId;
  coord: HexCoord;
  count: number;
  scatterRadiusPx: number;
}

export interface TutorialStageScript {
  conquestTargetCoord?: HexCoord;
  enemies?: readonly TutorialEnemySpawn[];
  plants?: readonly TutorialPlantSpawn[];
  pickups?: readonly TutorialPickupSpawn[];
  completionRewards?: readonly TutorialPickupSpawn[];
}

export const tutorialConquestRules: TutorialConquestRules = {
  occupiedSeconds: 12,
  killGoal: 3,
  biomassCost: 0,
};

export const tutorialProgressProfile: WorldProgressProfileDefinition = {
  id: 'tutorial',
  label: 'Tutorial',
  isTutorial: true,
  repeat: false,
  stages: [
    {
      id: 'tutorial-stage-1',
      title: 'Tutorial Stage 1',
      subtitle: 'Learn the controls, strike back, and absorb your first biomass.',
      objectiveHeader: 'Complete all tutorial tasks',
      objectives: [
        {
          id: 'tutorial-move',
          label: 'Move around',
          metricId: 'movementDistancePx',
          target: 360,
          showCounter: true,
        },
        {
          id: 'tutorial-dash',
          label: 'Press dash',
          metricId: 'dashUsed',
          target: 1,
        },
        {
          id: 'tutorial-jellyfish',
          label: 'Kill 2 jellyfish',
          metricId: createEnemyKillMetric('jellyfish'),
          target: 2,
          showCounter: true,
        },
        {
          id: 'tutorial-first-biomass',
          label: 'Collect your first biomass',
          metricId: createCollectedResourceMetric('biomass'),
          target: 1,
        },
      ],
    },
    {
      id: 'tutorial-stage-2',
      title: 'Tutorial Stage 2',
      subtitle: 'Harvest your first plant, survive a leech, and stock the colony.',
      objectiveHeader: 'Build resource momentum',
      objectives: [
        {
          id: 'tutorial-first-plant',
          label: 'Vacuum the first plant',
          metricId: 'plantHarvestStarted',
          target: 1,
        },
        {
          id: 'tutorial-leech',
          label: 'Kill 1 leech',
          metricId: createEnemyKillMetric('leech'),
          target: 1,
        },
        {
          id: 'tutorial-stage-2-biomass',
          label: 'Collect 30 biomass',
          metricId: createCollectedResourceMetric('biomass'),
          target: 30,
          showCounter: true,
        },
      ],
    },
    {
      id: 'tutorial-stage-3',
      title: 'Tutorial Stage 3',
      subtitle: 'Claim the first colony hex and hold it long enough to convert it.',
      objectiveHeader: 'Secure the tutorial frontier',
      objectives: [
        {
          id: 'tutorial-first-conquest',
          label: 'Conquer the marked hex (Press E for strategic UI)',
          metricId: 'conquestCompleted',
          target: 1,
        },
      ],
    },
    {
      id: 'tutorial-stage-4',
      title: 'Tutorial Stage 4',
      subtitle: 'Anchor the colony with a Crystal Spire and expand the body once.',
      objectiveHeader: 'Establish the colony heart',
      objectives: [
        {
          id: 'tutorial-build-spire',
          label: 'Build the Crystal Spire',
          metricId: createBuildingPlacedMetric('spire'),
          target: 1,
        },
        {
          id: 'tutorial-segment',
          label: 'Purchase 1 new segment',
          metricId: 'segmentPurchased',
          target: 1,
        },
      ],
    },
    {
      id: 'tutorial-stage-5',
      title: 'Tutorial Stage 5',
      subtitle: 'Defeat the shellback and open two more hexes before the corridor appears.',
      objectiveHeader: 'Finish the tutorial colony',
      objectives: [
        {
          id: 'tutorial-shellback',
          label: 'Kill the shellback',
          metricId: createEnemyKillMetric('shellback'),
          target: 1,
        },
        {
          id: 'tutorial-more-conquests',
          label: 'Conquer 2 more hexes',
          metricId: 'conquestCompleted',
          target: 2,
          showCounter: true,
        },
      ],
    },
  ],
};

export const tutorialStageScripts: Record<string, TutorialStageScript> = {
  'tutorial-stage-1': {
    enemies: [
      {
        id: 'stage-1-jellyfish-a',
        type: 'jellyfish',
        coord: { q: 0, r: 0 },
        dropOverride: ['biomass', 'biomass', 'biomass'],
      },
      {
        id: 'stage-1-jellyfish-b',
        type: 'jellyfish',
        coord: { q: 0, r: 1 },
        dropOverride: ['biomass', 'biomass', 'biomass'],
      },
    ],
  },
  'tutorial-stage-2': {
    enemies: [
      {
        id: 'stage-2-leech',
        type: 'leech',
        coord: { q: 1, r: -1 },
        dropOverride: [],
      },
    ],
    plants: [
      {
        id: 'stage-2-plant',
        type: 'fiberPlant',
        coord: tutorialPlantCoord,
      },
    ],
    pickups: [
      {
        id: 'stage-2-biomass-cluster-a',
        resourceId: 'biomass',
        coord: tutorialPlantCoord,
        count: 14,
        scatterRadiusPx: 54,
      },
      {
        id: 'stage-2-biomass-cluster-b',
        resourceId: 'biomass',
        coord: tutorialLoosePickupCoord,
        count: 14,
        scatterRadiusPx: 60,
      },
    ],
  },
  'tutorial-stage-3': {
    conquestTargetCoord: tutorialConquestCoord,
    completionRewards: [
      {
        id: 'stage-3-biomass-reward',
        resourceId: 'biomass',
        coord: tutorialConquestCoord,
        count: 14,
        scatterRadiusPx: 68,
      },
    ],
  },
  'tutorial-stage-4': {},
  'tutorial-stage-5': {
    enemies: [
      {
        id: 'stage-5-shellback',
        type: 'shellback',
        coord: tutorialShellbackCoord,
        dropOverride: [],
      },
    ],
  },
};
