import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { DashStateSnapshot, MoveIntent } from '@/game/types';

export class DashSystem {
  private cooldownRemaining = 0;
  private activeTimer = 0;
  private motionTimer = 0;
  private shakeTimer = 0;
  private directionX = 1;
  private directionY = 0;
  private elapsedSeconds = 0;

  step(
    headBody: planck.Body,
    moveIntent: MoveIntent,
    dashRequested: boolean,
  ): boolean {
    this.elapsedSeconds += tuning.fixedStepSeconds;
    this.cooldownRemaining = Math.max(
      0,
      this.cooldownRemaining - tuning.fixedStepSeconds,
    );
    this.activeTimer = Math.max(0, this.activeTimer - tuning.fixedStepSeconds);
    this.motionTimer = Math.max(0, this.motionTimer - tuning.fixedStepSeconds);
    this.shakeTimer = Math.max(0, this.shakeTimer - tuning.fixedStepSeconds);

    let started = false;
    if (dashRequested && this.cooldownRemaining === 0) {
      this.beginDash(moveIntent, headBody.getAngle());
      started = true;
    }

    if (this.activeTimer > 0) {
      this.applyDashVelocity(headBody);
    }

    return started;
  }

  getStateSnapshot(): DashStateSnapshot {
    return {
      cooldownSeconds: this.cooldownRemaining,
      cooldownProgress:
        tuning.dashCooldownSeconds <= 0
          ? 1
          : Math.max(
              0,
              Math.min(
                1,
                1 - this.cooldownRemaining / tuning.dashCooldownSeconds,
              ),
            ),
      isReady: this.cooldownRemaining === 0,
      isActive: this.activeTimer > 0,
      shakeStrength: this.sampleRemainingEnvelope(
        this.shakeTimer,
        tuning.dashShakeSeconds,
      ),
      motionStrength: this.sampleRemainingEnvelope(
        this.motionTimer,
        tuning.dashMotionSeconds,
      ),
      phase: this.elapsedSeconds,
      directionX: this.directionX,
      directionY: this.directionY,
    };
  }

  private beginDash(moveIntent: MoveIntent, fallbackAngle: number): void {
    if (moveIntent.thrust > 0.08) {
      this.directionX = moveIntent.strafeX;
      this.directionY = moveIntent.strafeY;
    } else {
      this.directionX = Math.cos(fallbackAngle);
      this.directionY = Math.sin(fallbackAngle);
    }

    this.activeTimer = tuning.dashActiveSeconds;
    this.motionTimer = tuning.dashMotionSeconds;
    this.shakeTimer = tuning.dashShakeSeconds;
    this.cooldownRemaining = tuning.dashCooldownSeconds;
  }

  private applyDashVelocity(headBody: planck.Body): void {
    const currentVelocity = headBody.getLinearVelocity();
    const progress =
      tuning.dashActiveSeconds <= 0
        ? 1
        : 1 - this.activeTimer / tuning.dashActiveSeconds;
    const attack = Math.min(1, progress / 0.22);
    const release = Math.max(0, 1 - progress);
    const pulse = Math.sin(attack * Math.PI * 0.5) * Math.sqrt(release);
    const forwardSpeed =
      tuning.dashGlideSpeed + (tuning.dashSpeed - tuning.dashGlideSpeed) * pulse;
    const alongDash =
      currentVelocity.x * this.directionX + currentVelocity.y * this.directionY;
    const carryX = currentVelocity.x - alongDash * this.directionX;
    const carryY = currentVelocity.y - alongDash * this.directionY;
    const targetVelocity = {
      x: this.directionX * forwardSpeed + carryX * tuning.dashVelocityCarry,
      y: this.directionY * forwardSpeed + carryY * tuning.dashVelocityCarry,
    };
    const velocityLerp = tuning.dashVelocityLerp + pulse * 0.12;

    headBody.setLinearVelocity(
      planck.Vec2(
        currentVelocity.x + (targetVelocity.x - currentVelocity.x) * velocityLerp,
        currentVelocity.y + (targetVelocity.y - currentVelocity.y) * velocityLerp,
      ),
    );
  }

  private sampleRemainingEnvelope(remaining: number, duration: number): number {
    if (duration <= 0) {
      return 0;
    }

    const ratio = Math.max(0, Math.min(1, remaining / duration));
    return Math.sin(ratio * Math.PI * 0.5);
  }
}
