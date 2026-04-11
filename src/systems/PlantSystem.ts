import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import { appendParasiteBonusDrop } from '@/entities/pickups/harmful';
import { getPickupTierFromResource } from '@/entities/pickups/PickupRegistry';
import type { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import type { Plant } from '@/entities/plants/Plant';
import type { Pickup } from '@/entities/pickups/Pickup';
import type { PickupFactory } from '@/entities/pickups/PickupFactory';
import { pixelsToMeters } from '@/physics/PhysicsUtils';
import {
  isInsideVacuumCone,
  resolveVacuumPull,
} from '@/systems/vacuumMath';
import { distance } from '@/utils/math';
import { randomBetween } from '@/utils/random';

interface PlantGatherCue {
  x: number;
  y: number;
  radius: number;
  intensity: number;
}

export class PlantSystem {
  private gatherCue: PlantGatherCue | null = null;

  constructor(private readonly eventBus: Phaser.Events.EventEmitter) {}

  getGatherCue(): PlantGatherCue | null {
    return this.gatherCue;
  }

  clearGatherCue(): void {
    this.gatherCue = null;
  }

  update(
    myriapoda: Myriapoda,
    plants: Map<string, Plant>,
    nearbyPlantIds: Set<string>,
    pickups: Map<string, Pickup>,
    pickupFactory: PickupFactory,
  ): void {
    const headPosition = {
      x: myriapoda.head.body.getPosition().x * tuning.pixelsPerMeter,
      y: myriapoda.head.body.getPosition().y * tuning.pixelsPerMeter,
    };
    const headAngle = myriapoda.head.body.getAngle();
    const mouthPosition = {
      x: headPosition.x + Math.cos(headAngle) * tuning.headRadius * 1.05,
      y: headPosition.y + Math.sin(headAngle) * tuning.headRadius * 1.05,
    };
    const mouthWorldPosition = {
      x:
        myriapoda.head.body.getPosition().x +
        Math.cos(headAngle) * pixelsToMeters(tuning.headRadius * 1.05),
      y:
        myriapoda.head.body.getPosition().y +
        Math.sin(headAngle) * pixelsToMeters(tuning.headRadius * 1.05),
    };
    let nextGatherCue: PlantGatherCue | null = null;
    let nearestCueDistance = Number.POSITIVE_INFINITY;

    for (const plantId of nearbyPlantIds) {
      const plant = plants.get(plantId);
      if (!plant) {
        continue;
      }

      const plantPixels = plant.getVacuumPointPixels();
      if (
        !isInsideVacuumCone(
          plantPixels,
          headPosition,
          headAngle,
          tuning.vacuumConeLength,
          tuning.headEatConeHalfAngle,
        )
      ) {
        continue;
      }

      const mouthDistance = distance(plantPixels, mouthPosition);
      if (plant.isHarvestable() || plant.state === 'chewing') {
        const proximity = Math.max(
          0,
          1 - mouthDistance / Math.max(1, tuning.plantGatherRadiusPx),
        );
        if (mouthDistance < nearestCueDistance) {
          nearestCueDistance = mouthDistance;
          nextGatherCue = {
            x: mouthPosition.x,
            y: mouthPosition.y,
            radius: tuning.plantGatherRadiusPx,
            intensity: 0.38 + proximity * 0.62,
          };
        }
      }
      if (mouthDistance <= tuning.plantGatherRadiusPx && plant.beginChewing()) {
        this.eventBus.emit(GameEvents.cameraImpulse, {
          duration: 0.12,
          zoom: tuning.cameraPickupZoom * 0.8,
          shake: tuning.cameraPickupShake * 0.8,
        });
        continue;
      }

      const pull = resolveVacuumPull(
        plantPixels,
        mouthPosition,
        tuning.plantGatherRadiusPx,
        tuning.vacuumConeLength,
      );
      const plantWorldPosition = plant.getVacuumPointWorld();
      const dx = mouthWorldPosition.x - plantWorldPosition.x;
      const dy = mouthWorldPosition.y - plantWorldPosition.y;
      plant.applyVacuumForce({
        x: dx * tuning.plantVacuumForce * pull.forceScale,
        y: dy * tuning.plantVacuumForce * pull.forceScale,
      });
    }
    this.gatherCue = nextGatherCue;

    for (const plant of plants.values()) {
      const outputs = plant.step(tuning.fixedStepSeconds);
      if (!outputs) {
        continue;
      }

      const origin = plant.getDropOriginPixels();
      const drops = appendParasiteBonusDrop(
        outputs,
        Math.random(),
        tuning.parasiteDropChance,
      );
      for (const resourceId of drops) {
        const angle = randomBetween(0, Math.PI * 2);
        const distancePx = randomBetween(
          tuning.plantDropScatterDistanceMin,
          tuning.plantDropScatterDistanceMax,
        );
        const pickup = pickupFactory.create(
          origin.x + Math.cos(angle) * distancePx,
          origin.y + Math.sin(angle) * distancePx,
          getPickupTierFromResource(resourceId),
          {
            resourceId,
            alpha: 0.9,
            impulse: {
              x:
                Math.cos(angle) *
                randomBetween(
                  tuning.plantDropScatterForceMin,
                  tuning.plantDropScatterForceMax,
                ),
              y:
                Math.sin(angle) *
                randomBetween(
                  tuning.plantDropScatterForceMin,
                  tuning.plantDropScatterForceMax,
                ),
            },
          },
        );
        pickups.set(pickup.id, pickup);
      }
    }
  }
}
