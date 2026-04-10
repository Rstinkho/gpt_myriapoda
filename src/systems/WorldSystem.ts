import Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import { Enemy } from '@/entities/enemies/Enemy';
import { EnemyFactory } from '@/entities/enemies/EnemyFactory';
import { Pickup } from '@/entities/pickups/Pickup';
import { PickupFactory } from '@/entities/pickups/PickupFactory';
import { HexWorld } from '@/entities/world/HexWorld';
import { SpawnSystem, enforceEnemyCap } from '@/entities/world/SpawnSystem';
import { WorldRenderer } from '@/rendering/WorldRenderer';
import { randomBetween, randomItem } from '@/utils/random';

export class WorldSystem {
  readonly world = new HexWorld();
  readonly spawner = new SpawnSystem(tuning.enemySpawnRadiusPadding);
  readonly renderer: WorldRenderer;
  private pendingFillGain = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly eventBus: Phaser.Events.EventEmitter,
    private readonly pickupFactory: PickupFactory,
    private readonly enemyFactory: EnemyFactory,
    private readonly pickups: Map<string, Pickup>,
    private readonly enemies: Map<string, Enemy>,
  ) {
    this.renderer = new WorldRenderer(scene);
    this.eventBus.on(GameEvents.enemyKilled, this.handleEnemyKilled, this);
    this.eventBus.on(GameEvents.pickupAbsorbed, this.handlePickupAbsorbed, this);
  }

  update(headPosition: { x: number; y: number }): void {
    const fillGain = this.pendingFillGain;
    this.pendingFillGain = 0;

    if (fillGain > 0) {
      this.renderer.addFillPulse(Math.min(0.36, fillGain * 0.05));
      const expansion = this.world.addFill(fillGain);
      if (expansion) {
        const overflowProgress = this.world.fillLevel / Math.max(1, this.world.fillThreshold);
        this.renderer.startExpansion(expansion, overflowProgress);
        this.eventBus.emit(GameEvents.worldExpanded, expansion);
      }
    }

    const spawnableCells = this.renderer.getSpawnableCells(this.world.cells);
    this.ensurePickups(headPosition, spawnableCells);
    this.ensureEnemies(headPosition, spawnableCells);
    this.renderer.update({
      cells: this.world.cells,
      stage: this.world.stage,
      fillLevel: this.world.fillLevel,
      fillThreshold: this.world.fillThreshold,
      hexSize: tuning.worldHexSize,
      focusX: headPosition.x,
      focusY: headPosition.y,
    });
  }

  destroy(): void {
    this.eventBus.off(GameEvents.enemyKilled, this.handleEnemyKilled, this);
    this.eventBus.off(GameEvents.pickupAbsorbed, this.handlePickupAbsorbed, this);
  }

  private ensurePickups(headPosition: { x: number; y: number }, cells: typeof this.world.cells): void {
    while (this.pickups.size < tuning.targetPickupCount) {
      const spawn = this.spawner.pickSpawn(cells, headPosition);
      const pickup = this.pickupFactory.create(spawn.x, spawn.y);
      this.pickups.set(pickup.id, pickup);
    }
  }

  private ensureEnemies(headPosition: { x: number; y: number }, cells: typeof this.world.cells): void {
    const desired = Math.min(
      tuning.targetEnemyCount + Math.max(0, this.world.stage - 1),
      tuning.enemyCap,
    );

    let remaining = Math.min(
      desired - this.enemies.size,
      enforceEnemyCap(this.enemies.size, tuning.enemyCap),
    );

    while (remaining > 0) {
      const spawn = this.spawner.pickSpawn(cells, headPosition);
      const enemy = this.enemyFactory.create(spawn.x, spawn.y);
      this.enemies.set(enemy.id, enemy);
      remaining -= 1;
    }
  }

  private handleEnemyKilled(payload: { x: number; y: number }): void {
    for (let index = 0; index < tuning.enemyShardCount; index += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(4, 10);
      const type = randomItem(['triangle', 'crystal', 'bone'] as const);
      const pickup = this.pickupFactory.create(
        payload.x + Math.cos(angle) * distance,
        payload.y + Math.sin(angle) * distance,
        type,
        {
          scale: tuning.enemyShardScale,
          alpha: 0.85,
          impulse: {
            x: Math.cos(angle) * randomBetween(0.12, 0.3),
            y: Math.sin(angle) * randomBetween(0.12, 0.3),
          },
        },
      );
      this.pickups.set(pickup.id, pickup);
    }
  }

  private handlePickupAbsorbed(payload: { digestValue: number }): void {
    this.pendingFillGain += payload.digestValue;
  }
}
