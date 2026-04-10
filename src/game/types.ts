import type Phaser from 'phaser';
import type * as planck from 'planck';

export type MatterShape = 'triangle' | 'crystal' | 'bone';
export type EnemyType = 'jellyfish';
export type PickupType = MatterShape;
export type UiMode = 'inspect' | 'panel' | 'minimal';

export type CollisionTag =
  | 'head-body'
  | 'head-vacuum'
  | 'head-threat'
  | 'limb-segment'
  | 'limb-tip'
  | 'enemy-body'
  | 'pickup-body';

export interface InputSnapshot {
  pointerWorldX: number;
  pointerWorldY: number;
  pointerDown: boolean;
  moveX: number;
  moveY: number;
}

export interface MoveIntent {
  aimAngle: number;
  thrust: number;
  strafeX: number;
  strafeY: number;
}

export interface Segment {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface MatterPacket {
  id: string;
  shape: MatterShape;
  color: number;
  progress: number;
  digestValue: number;
}

export interface HexCoord {
  q: number;
  r: number;
}

export interface HexCell {
  coord: HexCoord;
  centerX: number;
  centerY: number;
  unlocked: boolean;
}

export interface ExpansionEvent {
  stage: number;
  newCells: HexCell[];
}

export interface WorldRenderSnapshot {
  cells: HexCell[];
  stage: number;
  fillLevel: number;
  fillThreshold: number;
  hexSize: number;
  focusX: number;
  focusY: number;
}

export interface CameraImpulsePayload {
  duration: number;
  intensity?: number;
  shake?: number;
  zoom?: number;
}

export interface FixtureMeta {
  tag: CollisionTag;
  entityId: string;
  ownerId?: string;
}

export interface PhysicsSpriteBinding {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  body: planck.Body;
}

export interface UiStomachParticleSnapshot {
  id: string;
  shape: MatterShape;
  color: number;
  localX: number;
  localY: number;
  angle: number;
  radius: number;
}

export interface HudSnapshot {
  uiMode: UiMode;
  storedPickups: number;
  spentPickups: number;
  growthPickupGoal: number;
  fillLevel: number;
  fillThreshold: number;
  stage: number;
  segments: number;
  enemies: number;
  pickups: number;
  attackCooldown: number;
  limbCooldownProgress: number;
  limbReady: boolean;
  activeLimbId: string | null;
  pickupCounts: Record<PickupType, number>;
  stomachParticles: UiStomachParticleSnapshot[];
  debug: boolean;
}
