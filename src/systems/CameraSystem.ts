import Phaser from 'phaser';
import type * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { CameraImpulsePayload, MoveIntent } from '@/game/types';
import { vec2ToPixels } from '@/physics/PhysicsUtils';

export class CameraSystem {
  private elapsed = 0;
  private impulseTimer = 0;
  private impulseDuration = 0;
  private impulseZoom = 0;
  private impulseShake = 0;
  private expansionElapsed: number = tuning.expansionAnimationSeconds;

  constructor(private readonly scene: Phaser.Scene) {}

  addImpulse(payload: CameraImpulsePayload): void {
    const intensity = payload.intensity ?? 0;
    const zoom = payload.zoom ?? intensity * 6;
    const shake = payload.shake ?? intensity * 420;

    this.impulseDuration = Math.max(this.impulseDuration, payload.duration);
    this.impulseTimer = Math.max(this.impulseTimer, payload.duration);
    this.impulseZoom = Math.max(this.impulseZoom, zoom);
    this.impulseShake = Math.max(this.impulseShake, shake);
  }

  triggerExpansion(): void {
    this.expansionElapsed = 0;
    this.impulseZoom = Math.max(this.impulseZoom, tuning.cameraExpansionZoom * 0.65);
    this.impulseShake = Math.max(this.impulseShake, tuning.cameraExpansionShake * 0.45);
  }

  update(headBody: planck.Body, intent: MoveIntent): void {
    this.elapsed += tuning.fixedStepSeconds;
    this.expansionElapsed = Math.min(
      tuning.expansionAnimationSeconds,
      this.expansionElapsed + tuning.fixedStepSeconds,
    );
    this.impulseTimer = Math.max(0, this.impulseTimer - tuning.fixedStepSeconds);
    this.impulseZoom = Phaser.Math.Linear(this.impulseZoom, 0, tuning.cameraZoomDecay);
    this.impulseShake = Phaser.Math.Linear(this.impulseShake, 0, tuning.cameraShakeDecay);

    const camera = this.scene.cameras.main;
    const headPosition = vec2ToPixels(headBody.getPosition());
    const lookAheadScale = intent.thrust * tuning.cameraLookAhead;
    const lookAhead = {
      x: Math.cos(intent.aimAngle) * lookAheadScale,
      y: Math.sin(intent.aimAngle) * lookAheadScale,
    };
    const targetX = headPosition.x + lookAhead.x;
    const targetY = headPosition.y + lookAhead.y;

    const expansionProgress =
      tuning.expansionAnimationSeconds <= 0
        ? 1
        : this.expansionElapsed / tuning.expansionAnimationSeconds;
    const expansionEnvelope = Math.sin(expansionProgress * Math.PI);
    const shakeEnvelope =
      this.impulseDuration > 0 ? this.impulseTimer / this.impulseDuration : 0;
    const totalShake =
      this.impulseShake * shakeEnvelope + expansionEnvelope * tuning.cameraExpansionShake;
    const shakeOffset = {
      x: Math.cos(this.elapsed * 34) * totalShake,
      y: Math.sin(this.elapsed * 39 + 0.8) * totalShake * 0.82,
    };

    camera.scrollX +=
      (((targetX - camera.width / 2) + shakeOffset.x) - camera.scrollX) * tuning.cameraLerp;
    camera.scrollY +=
      (((targetY - camera.height / 2) + shakeOffset.y) - camera.scrollY) * tuning.cameraLerp;

    const targetZoom = Phaser.Math.Clamp(
      1 -
        intent.thrust * tuning.cameraMotionZoomOut +
        this.impulseZoom +
        expansionEnvelope * tuning.cameraExpansionZoom,
      tuning.cameraMinZoom,
      tuning.cameraMaxZoom,
    );
    camera.setZoom(camera.zoom + (targetZoom - camera.zoom) * 0.16);
  }
}
