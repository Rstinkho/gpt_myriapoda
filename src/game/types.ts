import type * as Phaser from 'phaser';
import type * as planck from 'planck';

export type PickupTier = 'basic' | 'advanced' | 'rare' | 'harmful';
export type NutrientPickupTier = Exclude<PickupTier, 'harmful'>;
export type PickupResourceId =
  | 'biomass'
  | 'tissue'
  | 'structuralCell'
  | 'parasite';
export type ResourceCost = Partial<Record<PickupResourceId, number>>;
export type EnemyType = 'jellyfish' | 'leech' | 'shellback';
export type ShellbackClawSide = 'left' | 'right';
export type ShellbackShellState = 'exposed' | 'shelled';
export type ShellbackAttackState = 'idle' | 'windup' | 'strike' | 'recover';
export type HexConquestState = 'active' | 'owned';
export type HexTypeId =
  | 'dead'
  | 'restoring'
  | 'purified'
  | 'enriched'
  | 'corrupted'
  | 'corridor';
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
  ownerId?: string;
  buildable?: boolean;
  conquestState?: HexConquestState;
}

export interface EnemySpawnContext {
  x: number;
  y: number;
  cell: HexCell;
  guardCell?: HexCell;
  enemySpeedMultiplier?: number;
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
  conquest: ConquestProgressSnapshot | null;
  /**
   * Monotonic counter that changes whenever the world cell set or cell-state (conquest,
   * ownership, etc.) mutates. Used by the renderer to fingerprint geometry-dependent
   * caches (silhouette mask, ordered border edges) without hashing cells every frame.
   */
  generation: number;
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

export interface ConquestProgressSnapshot {
  coord: HexCoord;
  occupiedSeconds: number;
  occupiedGoalSeconds: number;
  killCount: number;
  killGoal: number;
  playerInside: boolean;
}

export interface HudSnapshot {
  uiMode: UiMode;
  storedPickups: number;
  stomachCapacity: number;
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
  conquest: ConquestProgressSnapshot | null;
  stomachParticles: UiStomachParticleSnapshot[];
  stomachParasites: UiStomachParasiteSnapshot[];
  debug: boolean;
}

export type EvolutionSection = 'myriapoda' | 'world';

/** Right-hand column (30%) when `EvolutionSection` is `world`: Actions vs Buildings. */
export type WorldRightPanelView = 'actions' | 'buildings';

export type EvolutionPartId =
  | 'head'
  | 'stomach'
  | 'tail'
  | { type: 'limb'; index: number }
  | { type: 'segment'; index: number };

export interface EvolutionMyriapodaSnapshot {
  segmentCount: number;
  disabledLimbIndices: number[];
  stomachResources: PickupResourceId[];
  parasiteCount: number;
  stomachCapacity: number;
}

export type EvolutionResourceCounts = Record<PickupResourceId, number>;

export interface EvolutionWorldActionAvailability {
  allowed: boolean;
  reason?: string;
}

export interface EvolutionWorldActionResult {
  success: boolean;
  reason?: string;
}

export interface EvolutionWorldActionCallbacks {
  canStartConquest: (coord: HexCoord | null) => EvolutionWorldActionAvailability;
  startConquest: (coord: HexCoord) => EvolutionWorldActionResult;
}

/** Wired from GameScene so the evolution overlay can refresh state and buy segments with biomass. */
export interface EvolutionMyriapodaCallbacks {
  getSnapshot: () => EvolutionSnapshot;
  purchaseSegment: () => EvolutionWorldActionResult;
}

export interface EvolutionSnapshot {
  myriapoda: EvolutionMyriapodaSnapshot;
  world: WorldRenderSnapshot;
  resourceCounts: EvolutionResourceCounts;
}
