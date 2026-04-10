export interface StageAnimationSample {
  spacingBreath: number;
  rotation: number;
  revealProgress: number;
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

export function sampleStageAnimation(progress: number): StageAnimationSample {
  const clampedProgress = clamp01(progress);

  let spacingBreath = 0;
  if (clampedProgress <= 0.22) {
    spacingBreath = Math.sin(rangeProgress(clampedProgress, 0, 0.22) * Math.PI);
  }

  let rotation = 0;
  if (clampedProgress <= 0.55) {
    rotation = lerp(0, fullTurn, easeInOutCubic(rangeProgress(clampedProgress, 0, 0.55)));
  } else if (clampedProgress <= 0.75) {
    rotation = lerp(
      fullTurn,
      counterSwingRotation,
      easeInOutCubic(rangeProgress(clampedProgress, 0.55, 0.75)),
    );
  } else if (clampedProgress <= 0.9) {
    rotation = lerp(
      counterSwingRotation,
      reboundRotation,
      easeInOutCubic(rangeProgress(clampedProgress, 0.75, 0.9)),
    );
  } else {
    rotation = lerp(
      reboundRotation,
      0,
      easeInOutCubic(rangeProgress(clampedProgress, 0.9, 1)),
    );
  }

  const revealProgress =
    clampedProgress < 0.78 ? 0 : easeOutCubic(rangeProgress(clampedProgress, 0.78, 0.96));

  return {
    spacingBreath,
    rotation,
    revealProgress,
  };
}
