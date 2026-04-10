export interface JellyfishSteering {
  forceX: number;
  forceY: number;
}

export interface EnemyVelocity {
  x: number;
  y: number;
}

export function getJellyfishPhaseSeed(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return (hash % 360) * (Math.PI / 180);
}

export function createJellyfishSteering(
  source: { x: number; y: number },
  target: { x: number; y: number },
  strength: number,
  elapsedSeconds: number,
  phaseSeed: number,
): JellyfishSteering {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const direction = {
    x: dx / distance,
    y: dy / distance,
  };
  const normal = {
    x: -direction.y,
    y: direction.x,
  };
  const pulse = 0.72 + Math.max(0, Math.sin(elapsedSeconds * 3.2 + phaseSeed)) * 0.52;
  const drift = Math.sin(elapsedSeconds * 1.8 + phaseSeed * 1.7);
  const chaseForce = strength * pulse;
  const driftForce = strength * 0.28 * drift;

  return {
    forceX: direction.x * chaseForce + normal.x * driftForce,
    forceY: direction.y * chaseForce + normal.y * driftForce,
  };
}

export function clampEnemyVelocity(
  velocity: EnemyVelocity,
  maxSpeed: number,
): EnemyVelocity {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= maxSpeed) {
    return velocity;
  }

  const scale = maxSpeed / Math.max(speed, 0.0001);
  return {
    x: velocity.x * scale,
    y: velocity.y * scale,
  };
}
