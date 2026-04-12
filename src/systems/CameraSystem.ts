import * as Phaser from 'phaser';
import type * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { CameraImpulsePayload, MoveIntent, WorldBounds } from '@/game/types';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import {
  applyManualZoomBias,
  computeFitZoom,
} from '@/systems/cameraMath';

export class CameraSystem {
  private elapsed = 0;
  private impulseTimer = 0;
  private impulseDuration = 0;
  private impulseZoom = 0;
  private impulseShake = 0;
  private expansionElapsed: number = tuning.expansionAnimationSeconds;
  private manualZoomFactor = 1;

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

  update(
    headBody: planck.Body,
    intent: MoveIntent,
    worldBounds: WorldBounds,
    wheelDeltaY: number,
    deltaSeconds: number,
  ): void {
    const stepSeconds = Math.max(0.0001, deltaSeconds);
    this.elapsed += stepSeconds;
    this.expansionElapsed = Math.min(
      tuning.expansionAnimationSeconds,
      this.expansionElapsed + stepSeconds,
    );
    this.impulseTimer = Math.max(0, this.impulseTimer - stepSeconds);
    this.impulseZoom = Phaser.Math.Linear(this.impulseZoom, 0, tuning.cameraZoomDecay);
    this.impulseShake = Phaser.Math.Linear(this.impulseShake, 0, tuning.cameraShakeDecay);

    const camera = this.scene.cameras.main;
    const headPosition = vec2ToPixels(headBody.getPosition());
    const lookAheadScale = intent.thrust * tuning.cameraLookAhead;
    const lookAhead = {
      x: Math.cos(intent.aimAngle) * lookAheadScale,
      y: Math.sin(intent.aimAngle) * lookAheadScale,
    };
    const expansionAnimating =
      tuning.expansionAnimationSeconds > 0 &&
      this.expansionElapsed < tuning.expansionAnimationSeconds;

    const playerTarget = {
      x: headPosition.x + lookAhead.x,
      y: headPosition.y + lookAhead.y,
    };
    const lookTarget = expansionAnimating
      ? { x: worldBounds.centerX, y: worldBounds.centerY }
      : playerTarget;

    const expansionProgress =
      tuning.expansionAnimationSeconds <= 0
        ? 1
        : this.expansionElapsed / tuning.expansionAnimationSeconds;
    const expansionEnvelope = Math.sin(expansionProgress * Math.PI);
    const leadFrac = tuning.expansionLeadOutFraction;
    const leadOutEnvelope =
      expansionAnimating &&
      leadFrac > 0.0001 &&
      expansionProgress < leadFrac
        ? (1 - expansionProgress / leadFrac) ** 1.25
        : 0;
    const expansionLeadOut = expansionAnimating
      ? leadOutEnvelope * tuning.cameraExpansionLeadOutZoom
      : 0;
    const shakeEnvelope =
      this.impulseDuration > 0 ? this.impulseTimer / this.impulseDuration : 0;
    const expansionShakeMul = expansionAnimating ? tuning.cameraExpansionShakeScale : 1;
    const totalShake =
      this.impulseShake * shakeEnvelope +
      expansionEnvelope * tuning.cameraExpansionShake * expansionShakeMul;
    const shakeOffset = {
      x: Math.cos(this.elapsed * 34) * totalShake,
      y: Math.sin(this.elapsed * 39 + 0.8) * totalShake * 0.82,
    };

    const fitZoom = computeFitZoom(camera.width, camera.height, worldBounds);
    const baseZoom = Phaser.Math.Clamp(
      Math.min(tuning.cameraPreferredZoom, fitZoom),
      tuning.cameraAbsoluteMinZoom,
      tuning.cameraAbsoluteMaxZoom,
    );
    const manualZoom = expansionAnimating
      ? {
          zoom: Phaser.Math.Clamp(
            baseZoom +
              (tuning.cameraAbsoluteMinZoom - baseZoom) * tuning.cameraExpansionZoomOutBlend,
            tuning.cameraAbsoluteMinZoom,
            tuning.cameraAbsoluteMaxZoom,
          ),
          manualZoomFactor: this.manualZoomFactor,
        }
      : applyManualZoomBias(
          baseZoom,
          wheelDeltaY,
          this.manualZoomFactor,
          tuning.cameraWheelStep,
          tuning.cameraWheelMinFactor,
          tuning.cameraWheelMaxFactor,
        );
    this.manualZoomFactor = manualZoom.manualZoomFactor;

    const targetZoom = Phaser.Math.Clamp(
      manualZoom.zoom -
        (expansionAnimating ? 0 : intent.thrust * tuning.cameraMotionZoomOut) +
        this.impulseZoom +
        (expansionAnimating ? 0 : expansionEnvelope * tuning.cameraExpansionZoom) -
        expansionLeadOut,
      tuning.cameraAbsoluteMinZoom,
      tuning.cameraAbsoluteMaxZoom,
    );
    const smoothedZoom = camera.zoom + (targetZoom - camera.zoom) * 0.16;
    const targetScroll = {
      x: lookTarget.x - camera.width * 0.5 / smoothedZoom + shakeOffset.x,
      y: lookTarget.y - camera.height * 0.5 / smoothedZoom + shakeOffset.y,
    };

    const scrollLerp = expansionAnimating
      ? tuning.cameraExpansionFollowLerp
      : tuning.cameraLerp;
    camera.scrollX += (targetScroll.x - camera.scrollX) * scrollLerp;
    camera.scrollY += (targetScroll.y - camera.scrollY) * scrollLerp;
    camera.setZoom(smoothedZoom);
  }
}
