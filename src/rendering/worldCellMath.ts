function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getPlayerInfluence(
  cellX: number,
  cellY: number,
  focusX: number,
  focusY: number,
  influenceRadius: number,
): number {
  if (influenceRadius <= 0) {
    return 0;
  }

  const distance = Math.hypot(cellX - focusX, cellY - focusY);
  const normalized = clamp01(distance / influenceRadius);
  const smooth = normalized * normalized * (3 - 2 * normalized);
  return 1 - smooth;
}
