import type { Segment } from '@/game/types';
import { clamp } from '@/utils/math';

export interface FollowChainOptions {
  spacing: number;
  stiffness: number;
}

/**
 * Advances a follow-chain (head drags a tail of segments toward it, each maintaining a
 * target spacing from its leader).
 *
 * Runs 60 times per second on the body chain (up to 30 segments), so this is on the
 * hottest path in the game loop. The previous implementation cloned the input array
 * and every segment inside it — that was the single biggest source of per-fixed-step
 * allocation (hundreds of `{x,y,angle,radius}` objects/sec). The caller (`BodyChain.update`)
 * assigned the result right back to its own field, so the immutability was never useful.
 *
 * Now mutates `segments` in place and returns the same reference, eliminating all
 * allocation here.
 */
export function updateFollowSegments(
  segments: Segment[],
  headX: number,
  headY: number,
  headAngle: number,
  options: FollowChainOptions,
): Segment[] {
  if (segments.length === 0) {
    return segments;
  }

  const stiffness = clamp(options.stiffness, 0, 1);

  const first = segments[0];
  first.x = headX;
  first.y = headY;
  first.angle = headAngle;

  for (let index = 1; index < segments.length; index += 1) {
    const leader = segments[index - 1];
    const current = segments[index];
    const dx = current.x - leader.x;
    const dy = current.y - leader.y;
    const distance = Math.max(0.0001, Math.hypot(dx, dy));
    const targetX = leader.x + (dx / distance) * options.spacing;
    const targetY = leader.y + (dy / distance) * options.spacing;

    current.x += (targetX - current.x) * stiffness;
    current.y += (targetY - current.y) * stiffness;
    current.angle = Math.atan2(leader.y - current.y, leader.x - current.x);
  }

  return segments;
}
