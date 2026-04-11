export interface VectorLike {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dampAngle(current: number, target: number, factor: number): number {
  const delta = normalizeAngle(target - current);
  return current + delta * factor;
}

export function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

export function distance(a: VectorLike, b: VectorLike): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function rotateVector(x: number, y: number, angle: number): VectorLike {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function magnitude(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function normalize(x: number, y: number): VectorLike {
  const mag = magnitude(x, y);
  if (mag === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / mag, y: y / mag };
}
