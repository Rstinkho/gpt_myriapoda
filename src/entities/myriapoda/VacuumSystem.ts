import { tuning } from '@/game/tuning';
import { clamp, lerp } from '@/utils/math';

export class VacuumSystem {
  nearbyPickupIds = new Set<string>();
  activePickupCount = 0;
  mouthPosition = { x: 0, y: 0 };
  coneAngle = 0;
  suctionAmount = 0;
  consumePulseTimer = 0;

  beginFrame(mouthPosition: { x: number; y: number }, coneAngle: number, deltaSeconds: number): void {
    this.mouthPosition = { ...mouthPosition };
    this.coneAngle = coneAngle;
    this.activePickupCount = 0;
    this.nearbyPickupIds.clear();
    this.consumePulseTimer = Math.max(0, this.consumePulseTimer - deltaSeconds);
  }

  registerActivePickup(pickupId: string): void {
    this.nearbyPickupIds.add(pickupId);
    this.activePickupCount = this.nearbyPickupIds.size;
  }

  completeFrame(): void {
    const targetSuction = clamp(
      this.activePickupCount / tuning.vacuumPickupCountForMaxSuction,
      0,
      1,
    );
    this.suctionAmount = lerp(this.suctionAmount, targetSuction, tuning.vacuumSuctionLerp);
    if (targetSuction === 0 && this.suctionAmount < 0.01) {
      this.suctionAmount = 0;
    }
  }

  triggerConsumePulse(): void {
    this.consumePulseTimer = tuning.vacuumConsumePulseSeconds;
  }
}
