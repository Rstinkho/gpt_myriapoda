import { textureKeys } from '@/game/assets';
import type { MatterShape, PickupType } from '@/game/types';

export interface PickupDefinition {
  type: PickupType;
  textureKey: string;
  color: number;
  digestValue: number;
  radius: number;
  shape: MatterShape;
}

export const pickupDefinitions: Record<PickupType, PickupDefinition> = {
  triangle: {
    type: 'triangle',
    textureKey: textureKeys.pickupTriangle,
    color: 0xe9db75,
    digestValue: 2,
    radius: 9,
    shape: 'triangle',
  },
  crystal: {
    type: 'crystal',
    textureKey: textureKeys.pickupCrystal,
    color: 0x78d8ff,
    digestValue: 3,
    radius: 9.75,
    shape: 'crystal',
  },
  bone: {
    type: 'bone',
    textureKey: textureKeys.pickupBone,
    color: 0xf4e3c6,
    digestValue: 4,
    radius: 10.5,
    shape: 'bone',
  },
};
