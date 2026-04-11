import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import type { DashStateSnapshot } from '@/game/types';

export class FollowChainSystem {
  private elapsed = 0;

  update(myriapoda: Myriapoda, dashState?: DashStateSnapshot): void {
    this.elapsed += 1;
    const position = vec2ToPixels(myriapoda.head.body.getPosition());
    myriapoda.body.update(position.x, position.y, myriapoda.head.body.getAngle(), {
      shakeStrength: dashState?.shakeStrength ?? 0,
      motionStrength: dashState?.motionStrength ?? 0,
      phase: dashState?.phase ?? this.elapsed * 0.12,
    });
  }
}
