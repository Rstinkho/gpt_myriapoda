import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';

export class FollowChainSystem {
  update(myriapoda: Myriapoda): void {
    const position = vec2ToPixels(myriapoda.head.body.getPosition());
    myriapoda.body.update(position.x, position.y, myriapoda.head.body.getAngle());
  }
}
