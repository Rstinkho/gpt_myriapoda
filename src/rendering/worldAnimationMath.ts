import { tuning } from '@/game/tuning';

export interface StageAnimationSample {
  spacingBreath: number;
  rotation: number;
  revealProgress: number;
  /** 0..1 while expansion is in the pre-rotation cyan-rim phase; omitted once rotation begins. */
  cyanPrime?: number;
}

const fullTurn = Math.PI * 2;
const counterSwingRotation = -fullTurn * 0.3;
const reboundRotation = fullTurn * 0.1;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function easeInOutCubic(t: number): number {
  if (t < 0.5) {
    return 4 * t * t * t;
  }

  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function rangeProgress(value: number, start: number, end: number): number {
  if (end <= start) {
    return value >= end ? 1 : 0;
  }

  return clamp01((value - start) / (end - start));
}

export function advanceDisplayFillProgress(
  currentProgress: number,
  targetProgress: number,
  lerpRate: number,
): number {
  const current = clamp01(currentProgress);
  const target = clamp01(targetProgress);
  const rate = clamp01(lerpRate);
  return lerp(current, target, rate);
}

export function sampleExpansionDisplayProgress(
  startProgress: number,
  overflowProgress: number,
  progress: number,
): number {
  const clampedProgress = clamp01(progress);
  const start = clamp01(startProgress);
  const overflow = clamp01(overflowProgress);

  if (clampedProgress <= 0.18) {
    return lerp(start, 1, easeInOutCubic(rangeProgress(clampedProgress, 0, 0.18)));
  }

  if (clampedProgress <= 0.78) {
    return 1;
  }

  return lerp(1, overflow, easeInOutCubic(rangeProgress(clampedProgress, 0.78, 1)));
}

/**
 * @param cyanPrimeEnd — when > 0, the first this fraction of the timeline is cyan-rim only (no rotation).
 *   Pass `0` in tests to use the legacy timeline without a cyan prime segment.
 */
export function sampleStageAnimation(
  progress: number,
  cyanPrimeEnd: number = tuning.expansionCyanPrimeFraction,
): StageAnimationSample {
  const clampedProgress = clamp01(progress);
  const cEnd = clamp01(cyanPrimeEnd);

  if (cEnd > 0.0001 && clampedProgress < cEnd) {
    return {
      spacingBreath: 0,
      rotation: 0,
      revealProgress: 0,
      cyanPrime: rangeProgress(clampedProgress, 0, cEnd),
    };
  }

  const main = cEnd >= 0.9999 ? clampedProgress : rangeProgress(clampedProgress, cEnd, 1);

  let spacingBreath = 0;
  if (main <= 0.22) {
    spacingBreath = Math.sin(rangeProgress(main, 0, 0.22) * Math.PI);
  }

  let rotation = 0;
  if (main <= 0.55) {
    rotation = lerp(0, fullTurn, easeInOutCubic(rangeProgress(main, 0, 0.55)));
  } else if (main <= 0.75) {
    rotation = lerp(
      fullTurn,
      counterSwingRotation,
      easeInOutCubic(rangeProgress(main, 0.55, 0.75)),
    );
  } else if (main <= 0.9) {
    rotation = lerp(
      counterSwingRotation,
      reboundRotation,
      easeInOutCubic(rangeProgress(main, 0.75, 0.9)),
    );
  } else {
    rotation = lerp(reboundRotation, 0, easeInOutCubic(rangeProgress(main, 0.9, 1)));
  }

  const revealProgress = main < 0.78 ? 0 : easeOutCubic(rangeProgress(main, 0.78, 0.96));

  return {
    spacingBreath,
    rotation,
    revealProgress,
  };
}
