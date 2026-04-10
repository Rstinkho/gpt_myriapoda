import * as planck from 'planck';
import { tuning } from '@/game/tuning';

export function metersToPixels(value: number): number {
  return value * tuning.pixelsPerMeter;
}

export function pixelsToMeters(value: number): number {
  return value / tuning.pixelsPerMeter;
}

export function vec2FromPixels(x: number, y: number): planck.Vec2 {
  return planck.Vec2(pixelsToMeters(x), pixelsToMeters(y));
}

export function vec2ToPixels(vector: planck.Vec2): { x: number; y: number } {
  return {
    x: metersToPixels(vector.x),
    y: metersToPixels(vector.y),
  };
}
