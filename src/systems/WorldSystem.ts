import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import type { Enemy } from '@/entities/enemies/Enemy';
import type { EnemyFactory } from '@/entities/enemies/EnemyFactory';
import { resolveEnemyDrops } from '@/entities/enemies/EnemyDropRegistry';
import type { Plant } from '@/entities/plants/Plant';
import type { PlantFactory } from '@/entities/plants/PlantFactory';
import { shouldOccupyPurifiedHex } from '@/entities/plants/plantLifecycle';
import type { Pickup } from '@/entities/pickups/Pickup';
import type { PickupFactory } from '@/entities/pickups/PickupFactory';
import { getPickupTierFromResource } from '@/entities/pickups/PickupRegistry';
import { appendParasiteBonusDrop } from '@/entities/pickups/harmful';
import { HexWorld } from '@/entities/world/HexWorld';
import { SpawnSystem, enforceEnemyCap } from '@/entities/world/SpawnSystem';
import { createCoordKey, type ChooseIndex } from '@/entities/world/WorldExpansion';
import { WorldRenderer } from '@/rendering/WorldRenderer';
import { randomBetween } from '@/utils/random';

interface PlantSlot {
  occupied: boolean;
  plantId: string | null;
}

interface WorldSystemOptions {
  randomFloat?: () => number;
  chooseIndex?: ChooseIndex;
}

export class WorldSystem {
  readonly world: HexWorld;
  readonly spawner = new SpawnSystem(tuning.enemySpawnRadiusPadding);
  readonly renderer: WorldRenderer;
  private pendingFillGain = 0;
  private readonly plantSlots = new Map<string, PlantSlot>();
  private readonly randomFloat: () => number;
  private spawningSuppressed = false;

  constructor(
    scene: Phaser.Scene,
    private readonly eventBus: Phaser.Events.EventEmitter,
    private readonly pickupFactory: PickupFactory,
    private readonly plantFactory: PlantFactory,
    private readonly enemyFactory: EnemyFactory,
    private readonly pickups: Map<string, Pickup>,
    private readonly plants: Map<string, Plant>,
    private readonly enemies: Map<string, Enemy>,
    options: WorldSystemOptions = {},
  ) {
    this.randomFloat = options.randomFloat ?? Math.random;
    this.world = new HexWorld(options.chooseIndex);
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

    const visibleCells = this.renderer.getSpawnableCells(this.world.cells);
    if (!this.spawningSuppressed) {
      this.ensurePlants(visibleCells);
      this.ensureEnemies(headPosition, visibleCells);
    }
    this.renderer.update({
      cells: this.world.cells,
      bounds: this.world.bounds,
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
    this.renderer.destroy();
  }

  setSpawningSuppressed(suppressed: boolean): void {
    this.spawningSuppressed = suppressed;
  }

  isExpansionActive(): boolean {
    return this.renderer.isExpansionActive();
  }

  releasePlantOccupants(): void {
    for (const slot of this.plantSlots.values()) {
      slot.plantId = null;
    }
  }

  private ensurePlants(visibleCells: typeof this.world.cells): void {
    const visibleCellKeys = new Set(
      visibleCells.map((cell) => createCoordKey(cell.coord)),
    );

    for (const cell of this.world.cells) {
      if (cell.type !== 'purified') {
        continue;
      }

      const cellKey = createCoordKey(cell.coord);
      let slot = this.plantSlots.get(cellKey);
      if (!slot) {
        slot = {
          occupied: shouldOccupyPurifiedHex(
            this.randomFloat(),
            tuning.purifiedPlantOccupancyChance,
          ),
          plantId: null,
        };
        this.plantSlots.set(cellKey, slot);
      }

      if (!slot.occupied || slot.plantId || !visibleCellKeys.has(cellKey)) {
        continue;
      }

      const plant = this.plantFactory.create(cell, 'fiberPlant');
      this.plants.set(plant.id, plant);
      slot.plantId = plant.id;
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

  private handleEnemyKilled(payload: { enemyType: Enemy['type']; x: number; y: number }): void {
    const drops = appendParasiteBonusDrop(
      resolveEnemyDrops(payload.enemyType, this.randomFloat()),
      this.randomFloat(),
      tuning.parasiteDropChance,
    );
    for (const resourceId of drops) {
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(4, 10);
      const pickup = this.pickupFactory.create(
        payload.x + Math.cos(angle) * distance,
        payload.y + Math.sin(angle) * distance,
        getPickupTierFromResource(resourceId),
        {
          resourceId,
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
