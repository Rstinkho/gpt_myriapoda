import { tuning } from '@/game/tuning';
import type { Segment } from '@/game/types';
import { updateFollowSegments } from '@/entities/myriapoda/followChainMath';
import { lerp } from '@/utils/math';

export class BodyChain {
  segments: Segment[];

  constructor(initialX: number, initialY: number) {
    this.segments = Array.from({ length: tuning.initialSegments }, (_, index) => {
      const t = index / Math.max(1, tuning.initialSegments - 1);
      return {
        x: initialX - tuning.headToBodyOffsetPx - index * tuning.segmentSpacing,
        y: initialY,
        angle: 0,
        radius: lerp(tuning.segmentRadiusStart, tuning.segmentRadiusEnd, t),
      };
    });
  }

  update(headX: number, headY: number, headAngle: number): void {
    const leadX = headX - Math.cos(headAngle) * tuning.headToBodyOffsetPx;
    const leadY = headY - Math.sin(headAngle) * tuning.headToBodyOffsetPx;
    this.segments = updateFollowSegments(this.segments, leadX, leadY, headAngle, {
      spacing: tuning.segmentSpacing,
      stiffness: 0.9,
    });
  }

  getStomachSegmentIndex(): number {
    return Math.max(0, this.segments.length - 2);
  }

  getStomachAnchor(): Segment {
    return this.segments[this.getStomachSegmentIndex()];
  }

  getTailAnchor(): Segment {
    return this.segments[this.segments.length - 1];
  }

  sampleAlongBody(ratio: number): Segment {
    if (this.segments.length === 1) {
      return { ...this.segments[0] };
    }

    const scaledIndex = Math.max(0, Math.min(this.segments.length - 1, ratio * (this.segments.length - 1)));
    const leftIndex = Math.floor(scaledIndex);
    const rightIndex = Math.min(this.segments.length - 1, leftIndex + 1);
    const t = scaledIndex - leftIndex;
    const left = this.segments[leftIndex];
    const right = this.segments[rightIndex];

    return {
      x: lerp(left.x, right.x, t),
      y: lerp(left.y, right.y, t),
      angle: lerp(left.angle, right.angle, t),
      radius: lerp(left.radius, right.radius, t),
    };
  }

  addSegment(): void {
    const last = this.segments[this.segments.length - 1];
    this.segments.push({
      ...last,
      x: last.x - Math.cos(last.angle) * tuning.segmentSpacing,
      y: last.y - Math.sin(last.angle) * tuning.segmentSpacing,
      radius: Math.max(tuning.segmentRadiusEnd, last.radius - 1.2),
    });
  }
}
