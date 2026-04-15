import * as Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import type {
  CameraImpulsePayload,
  DashStateSnapshot,
  EvolutionResourceCounts,
  EvolutionSnapshot,
  EvolutionWorldActionAvailability,
  EvolutionWorldActionResult,
  ExpansionEvent,
  HudSnapshot,
  MoveIntent,
  UiMode,
} from '@/game/types';
import { Enemy } from '@/entities/enemies/Enemy';
import { EnemyFactory } from '@/entities/enemies/EnemyFactory';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import type { Plant } from '@/entities/plants/Plant';
import { PlantFactory } from '@/entities/plants/PlantFactory';
import { Pickup } from '@/entities/pickups/Pickup';
import { PickupFactory } from '@/entities/pickups/PickupFactory';
import { CollisionRegistry } from '@/physics/CollisionRegistry';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { EnemyBurstFxRenderer } from '@/rendering/EnemyBurstFxRenderer';
import { EnemyBurstFxController } from '@/rendering/enemyBurstFx';
import { MyriapodaRenderer } from '@/rendering/MyriapodaRenderer';
import {
  evolutionSceneKey,
  isEvolutionOverlayOpen,
  openEvolutionOverlay,
} from '@/evolution/overlayLifecycle';
import { AISystem } from '@/systems/AISystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { DigestSystem } from '@/systems/DigestSystem';
import { DashSystem } from '@/systems/DashSystem';
import { FollowChainSystem } from '@/systems/FollowChainSystem';
import { InputSystem } from '@/systems/InputSystem';
import { MovementSystem } from '@/systems/MovementSystem';
import { PlantSystem } from '@/systems/PlantSystem';
import { PlayerDamageSystem } from '@/systems/PlayerDamageSystem';
import { VacuumSystem } from '@/systems/VacuumSystem';
import { WorldSystem } from '@/systems/WorldSystem';
import {
  createUiStomachParticleSnapshots,
  cycleUiMode,
  getLimbCooldownProgress,
  getPickupCountsByTier,
  showsWorldDebug,
} from '@/ui/uiState';

const stationaryMoveIntent: MoveIntent = {
  aimAngle: 0,
  thrust: 0,
  strafeX: 0,
  strafeY: 0,
};

const idleDashState: DashStateSnapshot = {
  cooldownSeconds: 0,
  cooldownProgress: 1,
  isReady: true,
  isActive: false,
  shakeStrength: 0,
  motionStrength: 0,
  phase: 0,
  directionX: 1,
  directionY: 0,
};

interface TransitionPickupSnapshot {
  x: number;
  y: number;
  resourceId: Pickup['resourceId'];
  tier: Pickup['tier'];
  scale: Pickup['scale'];
}

export class GameScene extends Phaser.Scene {
  private eventBus!: Phaser.Events.EventEmitter;
  private accumulator = 0;
  private uiMode: UiMode = 'minimal';
  private renderDeltaSeconds = tuning.fixedStepSeconds;
  private lastMoveIntent: MoveIntent = { ...stationaryMoveIntent };
  private lastDashState: DashStateSnapshot = { ...idleDashState };
  private stageTransitionActive = false;
  private stageTransitionPickups: TransitionPickupSnapshot[] = [];

  private collisions!: CollisionRegistry;
  private physicsWorld!: PhysicsWorld;
  private myriapoda!: Myriapoda;
  private myriapodaRenderer!: MyriapodaRenderer;
  private enemyBurstFxController!: EnemyBurstFxController;
  private enemyBurstFxRenderer!: EnemyBurstFxRenderer;
  private pickups = new Map<string, Pickup>();
  private plants = new Map<string, Plant>();
  private enemies = new Map<string, Enemy>();
  private pickupFactory!: PickupFactory;
  private plantFactory!: PlantFactory;
  private enemyFactory!: EnemyFactory;

  private inputSystem!: InputSystem;
  private movementSystem!: MovementSystem;
  private dashSystem!: DashSystem;
  private followChainSystem!: FollowChainSystem;
  private vacuumSystem!: VacuumSystem;
  private plantSystem!: PlantSystem;
  private digestSystem!: DigestSystem;
  private combatSystem!: CombatSystem;
  private aiSystem!: AISystem;
  private worldSystem!: WorldSystem;
  private cameraSystem!: CameraSystem;
  private plantGatherGraphics!: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugToggleKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.eventBus = new Phaser.Events.EventEmitter();
    this.accumulator = 0;
    this.uiMode = 'minimal';
    this.renderDeltaSeconds = tuning.fixedStepSeconds;
    this.lastMoveIntent = { ...stationaryMoveIntent };
    this.lastDashState = { ...idleDashState };
    this.stageTransitionActive = false;
    this.stageTransitionPickups = [];
    this.pickups = new Map<string, Pickup>();
    this.plants = new Map<string, Plant>();
    this.enemies = new Map<string, Enemy>();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);

    this.collisions = new CollisionRegistry();
    this.physicsWorld = new PhysicsWorld(this.collisions);
    this.myriapoda = new Myriapoda(this, this.physicsWorld.world, 0, 0);
    this.myriapodaRenderer = new MyriapodaRenderer(this);
    this.enemyBurstFxController = new EnemyBurstFxController(this.eventBus);
    this.enemyBurstFxRenderer = new EnemyBurstFxRenderer(this);
    this.pickupFactory = new PickupFactory(this, this.physicsWorld.world);
    this.plantFactory = new PlantFactory(this, this.physicsWorld.world);
    this.enemyFactory = new EnemyFactory(this, this.physicsWorld.world);

    this.inputSystem = new InputSystem(this);
    this.movementSystem = new MovementSystem();
    this.dashSystem = new DashSystem();
    this.followChainSystem = new FollowChainSystem();
    this.vacuumSystem = new VacuumSystem(this.eventBus);
    this.plantSystem = new PlantSystem(this.eventBus);
    this.digestSystem = new DigestSystem(this.eventBus);
    this.combatSystem = new CombatSystem(this.eventBus);
    this.aiSystem = new AISystem(new PlayerDamageSystem(this.eventBus));
    this.worldSystem = new WorldSystem(
      this,
      this.eventBus,
      this.pickupFactory,
      this.plantFactory,
      this.enemyFactory,
      this.pickups,
      this.plants,
      this.enemies,
    );
    this.cameraSystem = new CameraSystem(this);

    this.plantGatherGraphics = this.add.graphics().setDepth(4.8);
    this.debugGraphics = this.add.graphics().setDepth(100);
    this.debugToggleKey = this.input.keyboard!.addKey(tuning.debugToggleKey);
    this.debugToggleKey.on('down', this.cycleUiMode, this);
    this.eventBus.on(GameEvents.cameraImpulse, this.handleCameraImpulse, this);
    this.eventBus.on(GameEvents.worldExpanded, this.handleWorldExpanded, this);

    this.cameras.main.setZoom(1);
    this.scene.launch('UIScene', {
      eventBus: this.eventBus,
      getSnapshot: () => this.getHudSnapshot(),
      requestEvolutionOpen: () => this.openEvolutionScene(),
      requestUiModeCycle: () => this.cycleUiMode(),
    });
    this.eventBus.emit(GameEvents.hudChanged);
  }

  update(_time: number, deltaMs: number): void {
    this.inputSystem.update();
    if (this.inputSystem.consumeEvolutionToggleRequest()) {
      this.toggleEvolutionScene();
      return;
    }
    this.renderDeltaSeconds = Math.min(0.05, deltaMs / 1000);
    this.accumulator += deltaMs / 1000;

    while (this.accumulator >= tuning.fixedStepSeconds) {
      this.fixedUpdate();
      this.accumulator -= tuning.fixedStepSeconds;
    }

    const cameraInput = this.inputSystem.getSnapshot();
    this.cameraSystem.update(
      this.myriapoda.head.body,
      this.lastMoveIntent,
      this.worldSystem.world.bounds,
      cameraInput.wheelDeltaY,
      this.renderDeltaSeconds,
    );
    this.render();
  }

  private fixedUpdate(): void {
    if (this.stageTransitionActive) {
      this.fixedUpdateStageTransition();
      return;
    }

    const input = this.inputSystem.getSnapshot();
    const moveIntent = this.movementSystem.update(this.myriapoda.head.body, input);
    const didDash = this.dashSystem.step(
      this.myriapoda.head.body,
      moveIntent,
      this.inputSystem.consumeDashRequest(),
    );
    const dashState = this.dashSystem.getStateSnapshot();
    this.lastDashState = dashState;
    if (didDash) {
      this.eventBus.emit(GameEvents.cameraImpulse, {
        duration: tuning.dashMotionSeconds * 0.6,
        zoom: tuning.dashCameraZoom,
        shake: tuning.dashCameraShake,
      });
    }
    this.lastMoveIntent = dashState.isActive
      ? {
          aimAngle: Math.atan2(dashState.directionY, dashState.directionX),
          thrust: 1,
          strafeX: dashState.directionX,
          strafeY: dashState.directionY,
        }
      : moveIntent;
    this.aiSystem.update(
      this.enemies,
      this.myriapoda,
      dashState,
    );
    this.physicsWorld.step();
    this.collisions.update();

    this.followChainSystem.update(this.myriapoda, dashState);
    this.myriapoda.syncBodyAttachments(tuning.fixedStepSeconds, dashState);
    this.vacuumSystem.update(
      this.myriapoda,
      this.pickups,
      this.collisions.pickupsInVacuum,
      this.physicsWorld.world,
      this.collisions,
    );
    this.plantSystem.update(
      this.myriapoda,
      this.plants,
      this.collisions.plantsInVacuum,
      this.pickups,
      this.pickupFactory,
    );
    this.digestSystem.update(this.myriapoda, tuning.fixedStepSeconds);
    this.combatSystem.update(this.myriapoda, this.enemies, this.collisions, this.physicsWorld.world);

    this.myriapoda.syncBodyAttachments(0, dashState);
    const headPixelPosition = vec2ToPixels(this.myriapoda.head.body.getPosition());
    this.worldSystem.update(headPixelPosition);
    this.eventBus.emit(GameEvents.hudChanged);
  }

  private fixedUpdateStageTransition(): void {
    this.lastMoveIntent = stationaryMoveIntent;
    this.lastDashState = this.dashSystem.getStateSnapshot();
    this.freezePlayerBodies();
    this.myriapoda.syncBodyAttachments(0, this.lastDashState);

    const headPixelPosition = vec2ToPixels(this.myriapoda.head.body.getPosition());
    this.worldSystem.update(headPixelPosition);
    if (!this.worldSystem.isExpansionActive()) {
      this.stageTransitionActive = false;
      this.worldSystem.releasePlantOccupants();
      this.worldSystem.setSpawningSuppressed(false);
      this.respawnTransitionPickups();
    }

    this.eventBus.emit(GameEvents.hudChanged);
  }

  private render(): void {
    this.syncActorsToPhysics();
    if (this.stageTransitionActive) {
      this.enemyBurstFxController.clear();
      this.enemyBurstFxRenderer.clear();
      this.myriapodaRenderer.clear();
      this.plantGatherGraphics.clear();
      this.debugGraphics.clear();
      return;
    }

    this.myriapoda.stepDamageFeedback(this.renderDeltaSeconds);
    this.enemyBurstFxController.update(this.renderDeltaSeconds);
    this.myriapodaRenderer.update(this.myriapoda, this.lastDashState);
    this.enemyBurstFxRenderer.render(this.enemyBurstFxController.getBursts());
    this.renderPlantGatherCue();
    this.renderDebug();
  }

  private syncActorsToPhysics(): void {
    const elapsedSeconds = this.time.now / 1000;
    for (const pickup of this.pickups.values()) {
      if (pickup.stepWorldLifecycle(this.renderDeltaSeconds)) {
        this.collisions.forgetPickup(pickup.id);
        pickup.destroy(this.physicsWorld.world);
        this.pickups.delete(pickup.id);
        continue;
      }

      const position = vec2ToPixels(pickup.body.getPosition());
      pickup.sprite.setPosition(position.x, position.y);
      pickup.updateVisual(elapsedSeconds);
    }

    for (const enemy of this.enemies.values()) {
      enemy.updateVisual(this.renderDeltaSeconds);
    }

    for (const plant of this.plants.values()) {
      plant.updateVisual(this.renderDeltaSeconds);
    }
  }

  private renderDebug(): void {
    this.debugGraphics.clear();
    if (!showsWorldDebug(this.uiMode)) {
      return;
    }

    const headPosition = vec2ToPixels(this.myriapoda.head.body.getPosition());
    const headAngle = this.myriapoda.head.body.getAngle();
    this.debugGraphics.lineStyle(2, 0xffd2a8, 0.65);
    this.debugGraphics.beginPath();
    this.debugGraphics.moveTo(headPosition.x, headPosition.y);
    const leftAngle = headAngle - tuning.headEatConeHalfAngle;
    const rightAngle = headAngle + tuning.headEatConeHalfAngle;
      this.debugGraphics.lineTo(
        headPosition.x + Math.cos(leftAngle) * tuning.vacuumConeLength,
        headPosition.y + Math.sin(leftAngle) * tuning.vacuumConeLength,
      );
      this.debugGraphics.arc(
        headPosition.x,
        headPosition.y,
        tuning.vacuumConeLength,
        leftAngle,
        rightAngle,
        false,
      );
    this.debugGraphics.closePath();
    this.debugGraphics.strokePath();

    this.debugGraphics.lineStyle(2, 0x8df5ca, 0.4);
    for (const pickupId of this.myriapoda.vacuum.nearbyPickupIds) {
      const pickup = this.pickups.get(pickupId);
      if (!pickup) {
        continue;
      }
      const position = vec2ToPixels(pickup.body.getPosition());
      this.debugGraphics.strokeCircle(position.x, position.y, 20);
    }

    this.debugGraphics.lineStyle(2, 0xff9b87, 0.7);
    for (const enemyId of this.collisions.enemiesThreateningHead) {
      const enemy = this.enemies.get(enemyId);
      if (!enemy) {
        continue;
      }
      const position = vec2ToPixels(enemy.body.getPosition());
      this.debugGraphics.strokeCircle(position.x, position.y, 24);
    }

    for (const limb of this.myriapoda.limbs.limbs) {
      if (!limb.body) {
        continue;
      }
      const strikePose = this.myriapoda.limbs.getStrikePose(limb, this.myriapoda.body);
      const tip = strikePose.tipPixels;
      const direction = strikePose.direction;
      const isActive = limb.id === this.combatSystem.getActiveLimbId();
      this.debugGraphics.lineStyle(1.5, isActive ? 0xff8eb1 : 0x9bdff4, isActive ? 0.9 : 0.5);
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(tip.x, tip.y);
      const leftAngle =
        Math.atan2(direction.y, direction.x) - tuning.limbAttackConeHalfAngle;
      const rightAngle =
        Math.atan2(direction.y, direction.x) + tuning.limbAttackConeHalfAngle;
      this.debugGraphics.lineTo(
        tip.x + Math.cos(leftAngle) * tuning.limbAttackConeRangePx,
        tip.y + Math.sin(leftAngle) * tuning.limbAttackConeRangePx,
      );
      this.debugGraphics.arc(
        tip.x,
        tip.y,
        tuning.limbAttackConeRangePx,
        leftAngle,
        rightAngle,
        false,
      );
      this.debugGraphics.closePath();
      this.debugGraphics.strokePath();
    }
  }

  private renderPlantGatherCue(): void {
    this.plantGatherGraphics.clear();

    const cue = this.plantSystem.getGatherCue();
    if (!cue) {
      return;
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 140);
    const outerRadius = cue.radius + 2 + pulse * 4;
    const innerRadius = Math.max(tuning.headRadius * 1.5, cue.radius * 0.5);

    this.plantGatherGraphics.fillStyle(0x330106, 0.06 + cue.intensity * 0.06);
    this.plantGatherGraphics.fillCircle(cue.x, cue.y, outerRadius);
    this.plantGatherGraphics.fillStyle(0x78131c, 0.12 + cue.intensity * 0.1);
    this.plantGatherGraphics.fillCircle(cue.x, cue.y, cue.radius);
    this.plantGatherGraphics.fillStyle(0x1f0507, 0.16);
    this.plantGatherGraphics.fillCircle(cue.x, cue.y, innerRadius);
    this.plantGatherGraphics.lineStyle(2, 0xff6e7a, 0.26 + cue.intensity * 0.22);
    this.plantGatherGraphics.strokeCircle(cue.x, cue.y, cue.radius);
    this.plantGatherGraphics.lineStyle(1.1, 0xffb2b7, 0.38 + cue.intensity * 0.24);
    this.plantGatherGraphics.strokeCircle(cue.x, cue.y, outerRadius);
  }

  private getHudSnapshot(): HudSnapshot {
    const stomachParticles = createUiStomachParticleSnapshots(
      this.myriapoda.stomach.particles.map((particle) => ({
        id: particle.id,
        resourceId: particle.resourceId,
        radiusMeters: particle.radiusMeters,
        position: particle.body.getPosition(),
        angle: particle.body.getAngle(),
      })),
      tuning.stomachRadiusMeters,
      tuning.stomachContainmentMarginMeters,
    );
    const attackCooldown = this.combatSystem.getAttackCooldown();
    const dashState = this.dashSystem.getStateSnapshot();
    const hasAttackCapableLimb = this.myriapoda.limbs.hasAttackCapableLimb();

    return {
      uiMode: this.uiMode,
      storedPickups: this.myriapoda.stomach.particles.length,
      stomachCapacity: this.myriapoda.stomach.capacity,
      fillLevel: this.worldSystem.world.fillLevel,
      fillThreshold: this.worldSystem.world.fillThreshold,
      stage: this.worldSystem.world.stage,
      segments: this.myriapoda.body.segments.length,
      enemies: this.enemies.size,
      pickups: this.pickups.size,
      attackCooldown,
      limbCooldownProgress: hasAttackCapableLimb
        ? getLimbCooldownProgress(
            attackCooldown,
            tuning.limbAttackIntervalSeconds,
          )
        : 0,
      limbReady: attackCooldown === 0 && hasAttackCapableLimb,
      dashCooldown: dashState.cooldownSeconds,
      dashCooldownProgress: dashState.cooldownProgress,
      dashReady: dashState.isReady,
      activeLimbId: this.combatSystem.getActiveLimbId(),
      activeParasiteCount: this.myriapoda.stomach.getActiveParasiteCount(),
      parasiteAlertProgress: this.myriapoda.stomach.getParasiteAlertProgress(),
      conquest: this.worldSystem.getConquestProgress(),
      pickupCounts: getPickupCountsByTier(stomachParticles),
      stomachParticles,
      stomachParasites: this.myriapoda.stomach.getUiParasiteSnapshots(),
      debug: showsWorldDebug(this.uiMode),
    };
  }

  private buildEvolutionSnapshot(): EvolutionSnapshot {
    const resourceCounts = this.myriapoda.stomach.getResourceCounts() as EvolutionResourceCounts;
    return {
      myriapoda: {
        segmentCount: this.myriapoda.body.segments.length,
        disabledLimbIndices: this.myriapoda.limbs.getDestroyedLimbIndices(),
        stomachResources: this.myriapoda.stomach.particles.map((particle) => particle.resourceId),
        parasiteCount: this.myriapoda.stomach.getActiveParasiteCount(),
        stomachCapacity: this.myriapoda.stomach.capacity,
      },
      resourceCounts,
      world: {
        cells: this.worldSystem.world.cells.map((cell) => ({
          coord: { ...cell.coord },
          centerX: cell.centerX,
          centerY: cell.centerY,
          unlocked: cell.unlocked,
          type: cell.type,
          ownerId: cell.ownerId,
          buildable: cell.buildable,
          conquestState: cell.conquestState,
        })),
        bounds: { ...this.worldSystem.world.bounds },
        stage: this.worldSystem.world.stage,
        fillLevel: this.worldSystem.world.fillLevel,
        fillThreshold: this.worldSystem.world.fillThreshold,
        hexSize: tuning.worldHexSize,
        focusX: 0,
        focusY: 0,
        conquest: this.worldSystem.getConquestProgress(),
      },
    };
  }

  private toggleEvolutionScene(): void {
    if (isEvolutionOverlayOpen(this.scene as never)) {
      return;
    }

    this.openEvolutionScene();
  }

  private openEvolutionScene(): void {
    if (
      this.stageTransitionActive ||
      isEvolutionOverlayOpen(this.scene as never)
    ) {
      return;
    }

    openEvolutionOverlay(this.scene as never, {
      snapshot: this.buildEvolutionSnapshot(),
      worldActions: {
        canStartConquest: (coord: { q: number; r: number } | null) => this.canStartConquest(coord),
        startConquest: (coord: { q: number; r: number }) => this.startConquest(coord),
      },
    });
  }

  private canStartConquest(coord: { q: number; r: number } | null): EvolutionWorldActionAvailability {
    const worldAvailability = this.worldSystem.canStartConquest(coord);
    if (!worldAvailability.allowed) {
      return worldAvailability;
    }

    if (!this.myriapoda.stomach.canAfford({ biomass: tuning.conquerBiomassCost })) {
      return {
        allowed: false,
        reason: `Need ${tuning.conquerBiomassCost} biomass.`,
      };
    }

    return {
      allowed: true,
    };
  }

  private startConquest(coord: { q: number; r: number }): EvolutionWorldActionResult {
    const availability = this.canStartConquest(coord);
    if (!availability.allowed) {
      return {
        success: false,
        reason: availability.reason,
      };
    }

    const spent = this.myriapoda.stomach.spend({
      biomass: tuning.conquerBiomassCost,
    });
    if (!spent) {
      return {
        success: false,
        reason: `Need ${tuning.conquerBiomassCost} biomass.`,
      };
    }

    if (!this.worldSystem.startConquest(coord)) {
      return {
        success: false,
        reason: 'Unable to start conquest here.',
      };
    }

    this.eventBus.emit(GameEvents.hudChanged);
    return {
      success: true,
    };
  }

  private handleCameraImpulse(payload: CameraImpulsePayload): void {
    this.cameraSystem.addImpulse(payload);
  }

  private handleWorldExpanded(_payload: ExpansionEvent): void {
    this.cameraSystem.triggerExpansion();
    this.stageTransitionActive = true;
    this.lastMoveIntent = stationaryMoveIntent;
    this.lastDashState = { ...idleDashState };
    this.worldSystem.setSpawningSuppressed(true);
    this.clearTransientWorldEntities();
    this.plantSystem.clearGatherCue();
    this.enemyBurstFxController.clear();
    this.enemyBurstFxRenderer.clear();
    this.resetVacuumState();
    this.freezePlayerBodies();
  }

  private cycleUiMode(): void {
    this.uiMode = cycleUiMode(this.uiMode);
    this.eventBus.emit(GameEvents.hudChanged);
  }

  private clearTransientWorldEntities(): void {
    this.stageTransitionPickups = [];
    for (const enemy of this.enemies.values()) {
      enemy.destroy(this.physicsWorld.world);
    }
    this.enemies.clear();

    for (const pickup of this.pickups.values()) {
      const position = vec2ToPixels(pickup.body.getPosition());
      this.stageTransitionPickups.push({
        x: position.x,
        y: position.y,
        resourceId: pickup.resourceId,
        tier: pickup.tier,
        scale: pickup.scale,
      });
      pickup.destroy(this.physicsWorld.world);
    }
    this.pickups.clear();

    for (const plant of this.plants.values()) {
      plant.destroy(this.physicsWorld.world);
    }
    this.plants.clear();

    this.worldSystem.releasePlantOccupants();
    this.collisions.resetTransientState();
  }

  private respawnTransitionPickups(): void {
    for (const pickup of this.stageTransitionPickups) {
      const restoredPickup = this.pickupFactory.create(
        pickup.x,
        pickup.y,
        pickup.tier,
        {
          resourceId: pickup.resourceId,
          scale: pickup.scale,
          alpha: 0.9,
        },
      );
      this.pickups.set(restoredPickup.id, restoredPickup);
    }
    this.stageTransitionPickups = [];
  }

  private resetVacuumState(): void {
    this.myriapoda.vacuum.nearbyPickupIds.clear();
    this.myriapoda.vacuum.activePickupCount = 0;
    this.myriapoda.vacuum.suctionAmount = 0;
    this.myriapoda.vacuum.consumePulseTimer = 0;
  }

  private freezePlayerBodies(): void {
    this.stopBodyMotion(this.myriapoda.head.body);

    for (const limb of this.myriapoda.limbs.limbs) {
      if (!limb.body) {
        continue;
      }
      this.stopBodyMotion(limb.body.root);
      for (const body of limb.body.bodies) {
        this.stopBodyMotion(body);
      }
    }

    this.stopBodyMotion(this.myriapoda.tail.tipBody);

    for (const particle of this.myriapoda.stomach.particles) {
      this.stopBodyMotion(particle.body);
    }
  }

  private stopBodyMotion(body: planck.Body): void {
    body.setLinearVelocity(planck.Vec2(0, 0));
    body.setAngularVelocity(0);
  }

  private handleSceneShutdown(): void {
    if (
      this.scene.isActive('UIScene') ||
      this.scene.isPaused('UIScene') ||
      this.scene.isSleeping('UIScene')
    ) {
      this.scene.stop('UIScene');
    }
    if (
      this.scene.isActive(evolutionSceneKey) ||
      this.scene.isPaused(evolutionSceneKey) ||
      this.scene.isSleeping(evolutionSceneKey)
    ) {
      this.scene.stop(evolutionSceneKey);
    }

    this.eventBus.off(GameEvents.cameraImpulse, this.handleCameraImpulse, this);
    this.eventBus.off(GameEvents.worldExpanded, this.handleWorldExpanded, this);
    this.enemyBurstFxController.destroy();
    this.debugToggleKey.off('down', this.cycleUiMode, this);
    this.inputSystem.destroy();
    this.enemyBurstFxRenderer.destroy();
    this.myriapodaRenderer.destroy();
    this.worldSystem.destroy();
    this.eventBus.removeAllListeners();

    this.pickups.clear();
    this.plants.clear();
    this.enemies.clear();
    this.stageTransitionPickups = [];
    this.accumulator = 0;
    this.uiMode = 'minimal';
    this.renderDeltaSeconds = tuning.fixedStepSeconds;
    this.lastMoveIntent = { ...stationaryMoveIntent };
    this.lastDashState = { ...idleDashState };
    this.stageTransitionActive = false;
  }
}
