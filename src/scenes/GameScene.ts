import Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import type { CameraImpulsePayload, ExpansionEvent, HudSnapshot, UiMode } from '@/game/types';
import { Enemy } from '@/entities/enemies/Enemy';
import { EnemyFactory } from '@/entities/enemies/EnemyFactory';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { Pickup } from '@/entities/pickups/Pickup';
import { PickupFactory } from '@/entities/pickups/PickupFactory';
import { CollisionRegistry } from '@/physics/CollisionRegistry';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { MyriapodaRenderer } from '@/rendering/MyriapodaRenderer';
import { AISystem } from '@/systems/AISystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { DigestSystem } from '@/systems/DigestSystem';
import { FollowChainSystem } from '@/systems/FollowChainSystem';
import { GrowthSystem } from '@/systems/GrowthSystem';
import { InputSystem } from '@/systems/InputSystem';
import { MovementSystem } from '@/systems/MovementSystem';
import { VacuumSystem } from '@/systems/VacuumSystem';
import { WorldSystem } from '@/systems/WorldSystem';
import {
  createUiStomachParticleSnapshots,
  cycleUiMode,
  getLimbCooldownProgress,
  getPickupCountsByType,
  showsWorldDebug,
} from '@/ui/uiState';

export class GameScene extends Phaser.Scene {
  private readonly eventBus = new Phaser.Events.EventEmitter();
  private accumulator = 0;
  private uiMode: UiMode = 'inspect';
  private renderDeltaSeconds = tuning.fixedStepSeconds;

  private collisions!: CollisionRegistry;
  private physicsWorld!: PhysicsWorld;
  private myriapoda!: Myriapoda;
  private myriapodaRenderer!: MyriapodaRenderer;
  private pickups = new Map<string, Pickup>();
  private enemies = new Map<string, Enemy>();
  private pickupFactory!: PickupFactory;
  private enemyFactory!: EnemyFactory;

  private inputSystem!: InputSystem;
  private movementSystem!: MovementSystem;
  private followChainSystem!: FollowChainSystem;
  private vacuumSystem!: VacuumSystem;
  private digestSystem!: DigestSystem;
  private combatSystem!: CombatSystem;
  private aiSystem!: AISystem;
  private growthSystem!: GrowthSystem;
  private worldSystem!: WorldSystem;
  private cameraSystem!: CameraSystem;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugToggleKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.collisions = new CollisionRegistry();
    this.physicsWorld = new PhysicsWorld(this.collisions);
    this.myriapoda = new Myriapoda(this, this.physicsWorld.world, 0, 0);
    this.myriapodaRenderer = new MyriapodaRenderer(this);
    this.pickupFactory = new PickupFactory(this, this.physicsWorld.world);
    this.enemyFactory = new EnemyFactory(this, this.physicsWorld.world);

    this.inputSystem = new InputSystem(this);
    this.movementSystem = new MovementSystem();
    this.followChainSystem = new FollowChainSystem();
    this.vacuumSystem = new VacuumSystem(this.eventBus);
    this.digestSystem = new DigestSystem(this.eventBus);
    this.combatSystem = new CombatSystem(this.eventBus);
    this.aiSystem = new AISystem();
    this.growthSystem = new GrowthSystem();
    this.worldSystem = new WorldSystem(
      this,
      this.eventBus,
      this.pickupFactory,
      this.enemyFactory,
      this.pickups,
      this.enemies,
    );
    this.cameraSystem = new CameraSystem(this);

    this.debugGraphics = this.add.graphics().setDepth(100);
    this.debugToggleKey = this.input.keyboard!.addKey(tuning.debugToggleKey);
    this.debugToggleKey.on('down', this.cycleUiMode, this);
    this.eventBus.on(GameEvents.cameraImpulse, this.handleCameraImpulse, this);
    this.eventBus.on(GameEvents.worldExpanded, this.handleWorldExpanded, this);

    this.cameras.main.setZoom(1);
    this.scene.launch('UIScene', {
      eventBus: this.eventBus,
      getSnapshot: () => this.getHudSnapshot(),
    });
    this.eventBus.emit(GameEvents.hudChanged);
  }

  update(_time: number, deltaMs: number): void {
    this.inputSystem.update();
    this.renderDeltaSeconds = Math.min(0.05, deltaMs / 1000);
    this.accumulator += deltaMs / 1000;

    while (this.accumulator >= tuning.fixedStepSeconds) {
      this.fixedUpdate();
      this.accumulator -= tuning.fixedStepSeconds;
    }

    this.render();
  }

  shutdown(): void {
    this.eventBus.off(GameEvents.cameraImpulse, this.handleCameraImpulse, this);
    this.eventBus.off(GameEvents.worldExpanded, this.handleWorldExpanded, this);
    this.debugToggleKey.off('down', this.cycleUiMode, this);
    this.worldSystem.destroy();
  }

  private fixedUpdate(): void {
    const input = this.inputSystem.getSnapshot();
    const moveIntent = this.movementSystem.update(this.myriapoda.head.body, input);
    const headPlanckPosition = this.myriapoda.head.body.getPosition();
    this.aiSystem.update(this.enemies, {
      x: headPlanckPosition.x,
      y: headPlanckPosition.y,
    });
    this.physicsWorld.step();
    this.collisions.update();

    this.followChainSystem.update(this.myriapoda);
    this.myriapoda.syncBodyAttachments(tuning.fixedStepSeconds);
    this.vacuumSystem.update(
      this.myriapoda,
      this.pickups,
      this.collisions.pickupsInVacuum,
      this.physicsWorld.world,
      this.collisions,
    );
    this.digestSystem.update(this.myriapoda, tuning.fixedStepSeconds);
    this.combatSystem.update(this.myriapoda, this.enemies, this.collisions, this.physicsWorld.world);

    this.growthSystem.update(this.myriapoda);
    this.myriapoda.syncBodyAttachments(0);
    const headPixelPosition = vec2ToPixels(this.myriapoda.head.body.getPosition());
    this.worldSystem.update(headPixelPosition);

    this.cameraSystem.update(this.myriapoda.head.body, moveIntent);
    this.eventBus.emit(GameEvents.hudChanged);
  }

  private render(): void {
    this.syncActorsToPhysics();
    this.myriapodaRenderer.update(this.myriapoda);
    this.renderDebug();
  }

  private syncActorsToPhysics(): void {
    for (const pickup of this.pickups.values()) {
      const position = vec2ToPixels(pickup.body.getPosition());
      pickup.sprite.setPosition(position.x, position.y);
      pickup.sprite.setRotation(pickup.body.getAngle());
    }

    for (const enemy of this.enemies.values()) {
      enemy.updateVisual(this.renderDeltaSeconds);
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

  private getHudSnapshot(): HudSnapshot {
    const stomachParticles = createUiStomachParticleSnapshots(
      this.myriapoda.stomach.particles.map((particle) => ({
        id: particle.id,
        shape: particle.shape,
        color: particle.color,
        radiusMeters: particle.radiusMeters,
        position: particle.body.getPosition(),
        angle: particle.body.getAngle(),
      })),
      tuning.stomachRadiusMeters,
      tuning.stomachContainmentMarginMeters,
    );
    const attackCooldown = this.combatSystem.getAttackCooldown();

    return {
      uiMode: this.uiMode,
      storedPickups: this.myriapoda.stomach.particles.length,
      spentPickups: this.myriapoda.stomach.consumedPickupTotal,
      growthPickupGoal: tuning.growthPickupsPerSegment,
      fillLevel: this.worldSystem.world.fillLevel,
      fillThreshold: this.worldSystem.world.fillThreshold,
      stage: this.worldSystem.world.stage,
      segments: this.myriapoda.body.segments.length,
      enemies: this.enemies.size,
      pickups: this.pickups.size,
      attackCooldown,
      limbCooldownProgress: getLimbCooldownProgress(
        attackCooldown,
        tuning.limbAttackIntervalSeconds,
      ),
      limbReady: attackCooldown === 0,
      activeLimbId: this.combatSystem.getActiveLimbId(),
      pickupCounts: getPickupCountsByType(stomachParticles),
      stomachParticles,
      debug: showsWorldDebug(this.uiMode),
    };
  }

  private handleCameraImpulse(payload: CameraImpulsePayload): void {
    this.cameraSystem.addImpulse(payload);
  }

  private handleWorldExpanded(_payload: ExpansionEvent): void {
    this.cameraSystem.triggerExpansion();
  }

  private cycleUiMode(): void {
    this.uiMode = cycleUiMode(this.uiMode);
    this.eventBus.emit(GameEvents.hudChanged);
  }
}
