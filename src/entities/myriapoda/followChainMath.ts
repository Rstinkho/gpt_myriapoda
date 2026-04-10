import type { Segment } from '@/game/types';
import { clamp } from '@/utils/math';

export interface FollowChainOptions {
  spacing: number;
  stiffness: number;
}

export function updateFollowSegments(
  segments: Segment[],
  headX: number,
  headY: number,
  headAngle: number,
  options: FollowChainOptions,
): Segment[] {
  const next = segments.map((segment) => ({ ...segment }));

  next[0].x = headX;
  next[0].y = headY;
  next[0].angle = headAngle;

  for (let index = 1; index < next.length; index += 1) {
    const leader = next[index - 1];
    const current = next[index];
    const dx = current.x - leader.x;
    const dy = current.y - leader.y;
    const distance = Math.max(0.0001, Math.hypot(dx, dy));
    const targetX = leader.x + (dx / distance) * options.spacing;
    const targetY = leader.y + (dy / distance) * options.spacing;

    current.x += (targetX - current.x) * clamp(options.stiffness, 0, 1);
    current.y += (targetY - current.y) * clamp(options.stiffness, 0, 1);
    current.angle = Math.atan2(leader.y - current.y, leader.x - current.x);
  }

  return next;
}
