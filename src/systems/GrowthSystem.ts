import { tuning } from '@/game/tuning';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';

export class GrowthSystem {
  update(myriapoda: Myriapoda): void {
    while (
      myriapoda.stomach.particles.length >= tuning.growthPickupsPerSegment &&
      myriapoda.body.segments.length < tuning.maxSegments
    ) {
      myriapoda.body.addSegment();
      myriapoda.stomach.consumePickupsForGrowth(tuning.growthPickupsPerSegment);
    }
  }
}
