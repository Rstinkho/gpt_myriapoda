import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { BodyChain } from '@/entities/myriapoda/BodyChain';
import { pixelsToMeters, vec2ToPixels } from '@/physics/PhysicsUtils';
import type { DashStateSnapshot } from '@/game/types';

export class TailController {
  readonly guideBody: planck.Body;
  readonly tipBody: planck.Body;
  readonly motorJoint: planck.MotorJoint;
  private elapsed = 0;

  constructor(world: planck.World, bodyChain: BodyChain) {
    const tailAnchor = bodyChain.getTailAnchor();
    const tailTipPixels = {
      x: tailAnchor.x - Math.cos(tailAnchor.angle) * tuning.tailLengthPx,
      y: tailAnchor.y - Math.sin(tailAnchor.angle) * tuning.tailLengthPx,
    };

    this.guideBody = world.createBody({
      position: planck.Vec2(0, 0),
    });
    this.tipBody = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(pixelsToMeters(tailTipPixels.x), pixelsToMeters(tailTipPixels.y)),
      linearDamping: 2.8,
      angularDamping: 7.2,
    });
    this.tipBody.createFixture({
      shape: planck.Circle(pixelsToMeters(tuning.tailRadiusPx)),
      density: 0.24,
      friction: 0.2,
      restitution: 0.05,
      isSensor: true,
    });

    this.motorJoint = world.createJoint(
      planck.MotorJoint(
        {
          maxForce: tuning.tailMotorForce,
          maxTorque: tuning.tailMotorTorque,
          correctionFactor: tuning.tailCorrectionFactor,
          linearOffset: planck.Vec2(
            pixelsToMeters(tailTipPixels.x),
            pixelsToMeters(tailTipPixels.y),
          ),
          angularOffset: tailAnchor.angle,
        },
        this.guideBody,
        this.tipBody,
      ),
    ) as planck.MotorJoint;
  }

  update(
    deltaSeconds: number,
    bodyChain: BodyChain,
    dashState?: DashStateSnapshot,
  ): void {
    this.elapsed += deltaSeconds;
    const anchor = bodyChain.getTailAnchor();
    const tangent = {
      x: Math.cos(anchor.angle),
      y: Math.sin(anchor.angle),
    };
    const normal = {
      x: -tangent.y,
      y: tangent.x,
    };
    const baseSway = Math.sin(this.elapsed * 3.8) * tuning.tailSwayPx;
    const dashWave =
      Math.sin((dashState?.phase ?? this.elapsed) * tuning.dashWaveFrequency * 0.78 + 0.6) *
      tuning.tailDashSwayPx *
      (dashState?.motionStrength ?? 0);
    const dashKick =
      Math.sin((dashState?.phase ?? this.elapsed) * tuning.dashWaveFrequency * 1.6 + 1.2) *
      tuning.tailDashSwayPx *
      0.22 *
      (dashState?.shakeStrength ?? 0);
    const directionalBias =
      ((normal.x * (dashState?.directionX ?? 0) + normal.y * (dashState?.directionY ?? 0)) *
        tuning.tailDashSwayPx *
        0.18 *
        (dashState?.motionStrength ?? 0));
    const sway = baseSway + dashWave + dashKick + directionalBias;
    const targetPixels = {
      x: anchor.x - tangent.x * tuning.tailLengthPx + normal.x * sway,
      y: anchor.y - tangent.y * tuning.tailLengthPx + normal.y * sway,
    };

    this.motorJoint.setLinearOffset(
      planck.Vec2(
        pixelsToMeters(targetPixels.x),
        pixelsToMeters(targetPixels.y),
      ),
    );
    const dashSwing =
      Math.sin((dashState?.phase ?? this.elapsed) * tuning.dashWaveFrequency * 0.64 + 0.4) *
      tuning.tailDashAngularSwing *
      (dashState?.motionStrength ?? 0);
    this.motorJoint.setAngularOffset(
      anchor.angle + Math.sin(this.elapsed * 2.9) * 0.38 + dashSwing,
    );
  }

  getTipPixels(): { x: number; y: number } {
    return vec2ToPixels(this.tipBody.getPosition());
  }
}
