import type * as Phaser from 'phaser';
import type * as planck from 'planck';

export type PickupTier = 'basic' | 'advanced' | 'rare' | 'harmful';
export type NutrientPickupTier = Exclude<PickupTier, 'harmful'>;
export type PickupResourceId =
  | 'biomass'
  | 'tissue'
  | 'structuralCell'
  | 'parasite';
export type EnemyType = 'jellyfish' | 'leech';
export type HexTypeId = 'dead' | 'restoring' | 'purified' | 'corrupted' | 'corridor';
export type PlantType =
  | 'fiberPlant'
  | 'sparkBloom'
  | 'boneMoss'
  | 'contaminatedVariant';
export type PlantState = 'grown' | 'chewing' | 'cooldown' | 'regrowing';
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
  | 'pickup-body'
  | 'plant-body';

export interface InputSnapshot {
  pointerWorldX: number;
  pointerWorldY: number;
  pointerDown: boolean;
  moveX: number;
  moveY: number;
  wheelDeltaY: number;
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

export interface StomachLatchPoint {
  x: number;
  y: number;
  angle: number;
  slotIndex: number;
}

export interface DashStateSnapshot {
  cooldownSeconds: number;
  cooldownProgress: number;
  isReady: boolean;
  isActive: boolean;
  shakeStrength: number;
  motionStrength: number;
  phase: number;
  directionX: number;
  directionY: number;
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
  type: HexTypeId;
}

export interface ExpansionEvent {
  stage: number;
  newCells: HexCell[];
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface WorldRenderSnapshot {
  cells: HexCell[];
  bounds: WorldBounds;
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

export interface UiStomachParasiteSnapshot {
  id: string;
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
  dashCooldown: number;
  dashCooldownProgress: number;
  dashReady: boolean;
  activeLimbId: string | null;
  pickupCounts: Record<NutrientPickupTier, number>;
  activeParasiteCount: number;
  parasiteAlertProgress: number;
  stomachParticles: UiStomachParticleSnapshot[];
  stomachParasites: UiStomachParasiteSnapshot[];
  debug: boolean;
}
