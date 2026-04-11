import { tuning } from '@/game/tuning';
import type { Segment, StomachLatchPoint } from '@/game/types';
import { updateFollowSegments } from '@/entities/myriapoda/followChainMath';
import { metersToPixels } from '@/physics/PhysicsUtils';
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

  update(
    headX: number,
    headY: number,
    headAngle: number,
    dashMotion?: { shakeStrength: number; motionStrength: number; phase: number },
  ): void {
    const leadX = headX - Math.cos(headAngle) * tuning.headToBodyOffsetPx;
    const leadY = headY - Math.sin(headAngle) * tuning.headToBodyOffsetPx;
    const nextSegments = updateFollowSegments(this.segments, leadX, leadY, headAngle, {
      spacing: tuning.segmentSpacing,
      stiffness: 0.9,
    });
    if (
      dashMotion &&
      (dashMotion.shakeStrength > 0 || dashMotion.motionStrength > 0)
    ) {
      this.applyDashMotion(nextSegments, dashMotion);
    }
    this.segments = nextSegments;
  }

  getStomachSegmentIndex(): number {
    return Math.max(0, this.segments.length - 2);
  }

  getStomachAnchor(): Segment {
    return this.segments[this.getStomachSegmentIndex()];
  }

  getStomachLatchPoint(
    slotIndex: number,
    slotCount: number = tuning.leechLatchSlotCount,
  ): StomachLatchPoint {
    const stomach = this.getStomachAnchor();
    const rearAngle = stomach.angle + Math.PI;
    const spread = Math.PI * 0.8;
    const normalizedSlotCount = Math.max(1, slotCount);
    const slotProgress =
      normalizedSlotCount === 1
        ? 0.5
        : slotIndex / Math.max(1, normalizedSlotCount - 1);
    const worldAngle = rearAngle - spread * 0.5 + spread * slotProgress;
    const radiusPx = metersToPixels(tuning.stomachRadiusMeters);

    return {
      x: stomach.x + Math.cos(worldAngle) * radiusPx,
      y: stomach.y + Math.sin(worldAngle) * radiusPx,
      angle: worldAngle,
      slotIndex,
    };
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

  private applyDashMotion(
    segments: Segment[],
    dashMotion: { shakeStrength: number; motionStrength: number; phase: number },
  ): void {
    const stomachIndex = this.getStomachSegmentIndex();
    const startIndex = Math.max(1, stomachIndex - 1);
    const tailSpan = Math.max(1, segments.length - startIndex);

    for (let index = startIndex; index < segments.length; index += 1) {
      const segment = segments[index];
      const tailWeight = (index - startIndex + 1) / tailSpan;
      const travelPhase =
        dashMotion.phase * tuning.dashWaveFrequency -
        tailWeight * tuning.dashWaveTravel +
        index * 0.22;
      const glideWave =
        Math.sin(travelPhase) +
        Math.sin(travelPhase * 0.58 + 0.9) * 0.35;
      const glideAmplitude =
        (tuning.dashWaveAmplitudeStomachPx +
          (tuning.dashWaveAmplitudeTailPx - tuning.dashWaveAmplitudeStomachPx) *
            tailWeight) *
        dashMotion.motionStrength;
      const kickWave =
        Math.sin(dashMotion.phase * (tuning.dashWaveFrequency * 1.8) + index * 0.85) *
        tuning.dashShakeAmplitudePx *
        dashMotion.shakeStrength *
        (0.4 + tailWeight * 0.6);
      const lateralWave = glideWave * glideAmplitude + kickWave * 0.35;

      segment.x += -Math.sin(segment.angle) * lateralWave;
      segment.y += Math.cos(segment.angle) * lateralWave;
    }
  }
}
