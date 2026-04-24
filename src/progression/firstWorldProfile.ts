import type { WorldProgressProfileDefinition } from '@/progression/progressionData';
import { createCollectedResourceMetric } from '@/progression/progressionData';

export const firstWorldProgressProfile: WorldProgressProfileDefinition = {
  id: 'first-world',
  label: 'First World',
  isTutorial: false,
  repeat: true,
  stages: [
    {
      id: 'surface-foothold',
      title: 'First World',
      subtitle: 'Push beyond the tutorial colony and stabilize the next region.',
      objectiveHeader: 'Advance this world by action',
      objectives: [
        {
          id: 'first-world-conquer',
          label: 'Conquer 1 hex',
          metricId: 'conquestCompleted',
          target: 1,
        },
        {
          id: 'first-world-kills',
          label: 'Kill 6 enemies',
          metricId: 'enemyKilledAny',
          target: 6,
          showCounter: true,
        },
        {
          id: 'first-world-biomass',
          label: 'Collect 20 biomass',
          metricId: createCollectedResourceMetric('biomass'),
          target: 20,
          showCounter: true,
        },
      ],
    },
  ],
};
