import type Phaser from 'phaser';
import type * as planck from 'planck';

export type PickupTier = 'basic' | 'advanced' | 'rare';
export type PickupResourceId = 'biomass' | 'tissue' | 'structuralCell';
export type EnemyType = 'jellyfish';
export type UiMode = 'inspect' | 'panel' | 'minimal';

export interface PickupPalette {
  base: number;
  shadow: number;
  highlight: number;
  detail: number;
  glow?: number;
}

export interface PickupAnimationProfile {
  pulseSpeed: number;
  shimmerSpeed: number;
  scaleAmplitude: number;
  alphaAmplitude: number;
  rotationAmplitude: number;
  glowAlpha: number;
}

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
  resourceId: PickupResourceId;
  tier: PickupTier;
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
  resourceId: PickupResourceId;
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
  pickupCounts: Record<PickupTier, number>;
  stomachParticles: UiStomachParticleSnapshot[];
  debug: boolean;
}
