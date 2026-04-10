export interface TargetCandidate {
  id: string;
  distanceSq: number;
  health: number;
  threateningHead: boolean;
}

export function selectTarget(candidates: TargetCandidate[]): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((left, right) => {
    if (left.threateningHead !== right.threateningHead) {
      return left.threateningHead ? -1 : 1;
    }
    if (left.distanceSq !== right.distanceSq) {
      return left.distanceSq - right.distanceSq;
    }
    if (left.health !== right.health) {
      return left.health - right.health;
    }
    return left.id.localeCompare(right.id);
  });

  return sorted[0]?.id ?? null;
}
