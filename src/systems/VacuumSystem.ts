import Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { Pickup } from '@/entities/pickups/Pickup';
import { CollisionRegistry } from '@/physics/CollisionRegistry';
import { pixelsToMeters, vec2ToPixels } from '@/physics/PhysicsUtils';
import { isInsideVacuumCone, resolveVacuumPull } from '@/systems/vacuumMath';

export class VacuumSystem {
  constructor(private readonly eventBus: Phaser.Events.EventEmitter) {}

  update(
    myriapoda: Myriapoda,
    pickups: Map<string, Pickup>,
    nearbyPickupIds: Set<string>,
    world: planck.World,
    collisions: CollisionRegistry,
  ): void {
    const headPosition = vec2ToPixels(myriapoda.head.body.getPosition());
    const headAngle = myriapoda.head.body.getAngle();
    const mouthPosition = {
      x: headPosition.x + Math.cos(headAngle) * tuning.headRadius * 1.05,
      y: headPosition.y + Math.sin(headAngle) * tuning.headRadius * 1.05,
    };
    const headWorldPosition = myriapoda.head.body.getPosition();
    const mouthWorldPosition = {
      x: headWorldPosition.x + Math.cos(headAngle) * pixelsToMeters(tuning.headRadius * 1.05),
      y: headWorldPosition.y + Math.sin(headAngle) * pixelsToMeters(tuning.headRadius * 1.05),
    };
    myriapoda.vacuum.beginFrame(mouthPosition, headAngle, tuning.fixedStepSeconds);

    for (const pickupId of nearbyPickupIds) {
      const pickup = pickups.get(pickupId);
      if (!pickup) {
        continue;
      }

      const pickupPosition = vec2ToPixels(pickup.body.getPosition());
      if (!isInsideVacuumCone(
        pickupPosition,
        headPosition,
        headAngle,
        tuning.vacuumConeLength,
        tuning.headEatConeHalfAngle,
      )) {
        continue;
      }

      myriapoda.vacuum.registerActivePickup(pickupId);
      const pull = resolveVacuumPull(
        { x: pickupPosition.x, y: pickupPosition.y },
        mouthPosition,
        tuning.absorbRadius,
        tuning.vacuumConeLength,
      );

      if (pull.shouldAbsorb) {
        myriapoda.stomach.add(pickup.resourceId);
        nearbyPickupIds.delete(pickupId);
        collisions.forgetPickup(pickupId);
        pickup.destroy(world);
        pickups.delete(pickupId);
        myriapoda.vacuum.triggerConsumePulse();
        this.eventBus.emit(GameEvents.pickupAbsorbed, {
          pickupId,
          digestValue: pickup.definition.digestValue,
        });
        this.eventBus.emit(GameEvents.cameraImpulse, {
          duration: 0.08,
          zoom: tuning.cameraPickupZoom,
          shake: tuning.cameraPickupShake,
        });
        continue;
      }

      const pickupBodyPosition = pickup.body.getPosition();
      const dx = mouthWorldPosition.x - pickupBodyPosition.x;
      const dy = mouthWorldPosition.y - pickupBodyPosition.y;
      pickup.body.applyForceToCenter(
        planck.Vec2(dx * tuning.pickupVacuumForce * pull.forceScale, dy * tuning.pickupVacuumForce * pull.forceScale),
        true,
      );
    }
    myriapoda.vacuum.completeFrame();
  }
}
