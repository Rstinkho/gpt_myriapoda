import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { InputSnapshot, MoveIntent } from '@/game/types';
import { normalizeAngle } from '@/utils/math';

export class MovementSystem {
  private intent: MoveIntent = {
    aimAngle: 0,
    thrust: 0,
    strafeX: 0,
    strafeY: 0,
  };

  update(headBody: planck.Body, input: InputSnapshot): MoveIntent {
    const inputMagnitude = Math.hypot(input.moveX, input.moveY);
    const thrust = Math.min(1, inputMagnitude);
    const inputDirection =
      thrust > 0.001
        ? {
            x: input.moveX / Math.max(inputMagnitude, 0.0001),
            y: input.moveY / Math.max(inputMagnitude, 0.0001),
          }
        : null;

    const currentAngle = headBody.getAngle();
    const currentVelocity = headBody.getLinearVelocity();
    const currentSpeed = Math.hypot(currentVelocity.x, currentVelocity.y);
    const travelAngle = currentSpeed > 0.04 ? Math.atan2(currentVelocity.y, currentVelocity.x) : currentAngle;
    const desiredAngle = inputDirection ? Math.atan2(inputDirection.y, inputDirection.x) : travelAngle;
    const nextAngle =
      currentAngle +
      normalizeAngle(desiredAngle - currentAngle) * (inputDirection ? tuning.turnLerp : tuning.turnLerp * 0.42);
    headBody.setTransform(headBody.getPosition(), nextAngle);
    headBody.setAngularVelocity(0);

    const desiredVelocity = planck.Vec2(
      (inputDirection?.x ?? 0) * tuning.moveSpeed * thrust,
      (inputDirection?.y ?? 0) * tuning.moveSpeed * thrust,
    );
    const blend = inputDirection ? tuning.moveAcceleration : tuning.moveDeceleration;
    const nextVelocity = planck.Vec2(
      currentVelocity.x + (desiredVelocity.x - currentVelocity.x) * blend,
      currentVelocity.y + (desiredVelocity.y - currentVelocity.y) * blend,
    );
    const speed = Math.hypot(nextVelocity.x, nextVelocity.y);
    if (speed > tuning.maxSpeed) {
      const scale = tuning.maxSpeed / speed;
      nextVelocity.x *= scale;
      nextVelocity.y *= scale;
    } else if (!inputDirection && speed < 0.007) {
      nextVelocity.x = 0;
      nextVelocity.y = 0;
    }
    headBody.setLinearVelocity(nextVelocity);

    const resultingSpeed = Math.hypot(nextVelocity.x, nextVelocity.y);
    const resultingAngle = resultingSpeed > 0.04 ? Math.atan2(nextVelocity.y, nextVelocity.x) : nextAngle;
    const normalizedVelocity =
      resultingSpeed > 0.001
        ? { x: nextVelocity.x / resultingSpeed, y: nextVelocity.y / resultingSpeed }
        : { x: 0, y: 0 };

    this.intent = {
      aimAngle: resultingAngle,
      thrust: Math.min(1, resultingSpeed / tuning.maxSpeed),
      strafeX: normalizedVelocity.x,
      strafeY: normalizedVelocity.y,
    };

    return this.intent;
  }

  getIntent(): MoveIntent {
    return this.intent;
  }
}
