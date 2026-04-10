export interface GrowthResult {
  nextStoredPickups: number;
  segmentsAdded: number;
}

export function resolveGrowth(
  storedPickups: number,
  currentSegments: number,
  maxSegments: number,
  pickupsPerSegment: number,
): GrowthResult {
  let nextStoredPickups = storedPickups;
  let nextSegments = currentSegments;

  while (nextStoredPickups >= pickupsPerSegment && nextSegments < maxSegments) {
    nextStoredPickups -= pickupsPerSegment;
    nextSegments += 1;
  }

  return {
    nextStoredPickups,
    segmentsAdded: nextSegments - currentSegments,
  };
}
