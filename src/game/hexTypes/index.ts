import type { HexTypeId } from '@/game/types';
import { corridorHexType } from '@/game/hexTypes/corridor';
import { corruptedHexType } from '@/game/hexTypes/corrupted';
import { deadHexType } from '@/game/hexTypes/dead';
import { enrichedHexType } from '@/game/hexTypes/enriched';
import { purifiedHexType } from '@/game/hexTypes/purified';
import { restoringHexType } from '@/game/hexTypes/restoring';

export interface HexTypeDefinition {
  id: HexTypeId;
  producesPlants: boolean;
  shadowColor: number;
  fillColor: number;
  reactiveColor: number;
  glowColor: number;
  strokeColor: number;
  contourColor: number;
}

export const hexTypes = [
  deadHexType,
  restoringHexType,
  purifiedHexType,
  enrichedHexType,
  corruptedHexType,
  corridorHexType,
] as const satisfies readonly HexTypeDefinition[];

export const hexTypeDefinitions = Object.fromEntries(
  hexTypes.map((definition) => [definition.id, definition]),
) as Record<HexTypeId, HexTypeDefinition>;

export function getHexTypeDefinition(type: HexTypeId): HexTypeDefinition {
  return hexTypeDefinitions[type];
}
