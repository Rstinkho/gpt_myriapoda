import type { MatterPacket } from '@/game/types';

export interface DigestStepResult {
  packets: MatterPacket[];
  digested: MatterPacket[];
}

export function stepDigestion(
  packets: MatterPacket[],
  deltaSeconds: number,
  speed: number,
  segmentCount: number,
): DigestStepResult {
  const digested: MatterPacket[] = [];
  const active: MatterPacket[] = [];

  for (const packet of packets) {
    const next = {
      ...packet,
      progress: packet.progress + deltaSeconds * speed,
    };

    if (next.progress >= segmentCount - 0.25) {
      digested.push(next);
    } else {
      active.push(next);
    }
  }

  return {
    packets: active,
    digested,
  };
}
