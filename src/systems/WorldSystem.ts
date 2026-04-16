import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import type { WorldRenderSnapshot } from '@/game/types';
import { isShellbackEnemy, type Enemy } from '@/entities/enemies/Enemy';
import type { EnemyFactory } from '@/entities/enemies/EnemyFactory';
import { resolveEnemyDrops } from '@/entities/enemies/EnemyDropRegistry';
import { resolveEnemyType } from '@/entities/enemies/EnemyRegistry';
import { pickShellbackGuardCell } from '@/entities/enemies/shellback/ShellbackAI';
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
import { ConquestSystem } from '@/systems/conquest/ConquestSystem';
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
  private bufferedFillGain = 0;
  private shellbackRespawnTimer = 0;
  private readonly plantSlots = new Map<string, PlantSlot>();
  private readonly randomFloat: () => number;
  private spawningSuppressed = false;
  private readonly conquestSystem: ConquestSystem;
  private lastFocus = { x: 0, y: 0 };
  private lastSnapshot: WorldRenderSnapshot;

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
    this.conquestSystem = new ConquestSystem(
      this.enemyFactory,
      this.enemies,
      this.randomFloat,
    );
    this.lastSnapshot = this.createSnapshot();
    this.eventBus.on(GameEvents.enemyKilled, this.handleEnemyKilled, this);
    this.eventBus.on(GameEvents.pickupAbsorbed, this.handlePickupAbsorbed, this);
  }

  update(headPosition: { x: number; y: number }): void {
    this.lastFocus = { ...headPosition };
    if (this.shellbackRespawnTimer > 0) {
      this.shellbackRespawnTimer = Math.max(
        0,
        this.shellbackRespawnTimer - tuning.fixedStepSeconds,
      );
      if (this.shellbackRespawnTimer < 0.000001) {
        this.shellbackRespawnTimer = 0;
      }
    }
    const fillGain = this.pendingFillGain;
    this.pendingFillGain = 0;

    if (this.conquestSystem.isActive()) {
      this.bufferedFillGain += fillGain;
    } else {
      const totalFillGain = this.bufferedFillGain + fillGain;
      this.bufferedFillGain = 0;
      if (totalFillGain > 0) {
        this.renderer.addFillPulse(Math.min(0.36, totalFillGain * 0.05));
        const expansion = this.world.addFill(totalFillGain);
        if (expansion) {
          const overflowProgress = this.world.fillLevel / Math.max(1, this.world.fillThreshold);
          this.renderer.startExpansion(expansion, overflowProgress);
          this.eventBus.emit(GameEvents.worldExpanded, expansion);
        }
      }
    }

    this.conquestSystem.update(this.world, headPosition);

    const visibleCells = this.renderer.getSpawnableCells(this.world.cells);
    if (!this.spawningSuppressed) {
      this.ensurePlants(visibleCells);
      this.ensureShellback(headPosition, visibleCells);
      this.ensureEnemies(headPosition, visibleCells);
    }
    this.lastSnapshot = this.createSnapshot();
    this.renderer.update(this.lastSnapshot);
  }

  canStartConquest(coord: { q: number; r: number } | null): { allowed: boolean; reason?: string } {
    if (this.conquestSystem.isActive()) {
      return {
        allowed: false,
        reason: 'Conquest already in progress.',
      };
    }

    if (this.world.hasOwnedCell()) {
      return {
        allowed: false,
        reason: 'This world already has a conquered hex.',
      };
    }

    if (!coord) {
      return {
        allowed: true,
      };
    }

    if (!this.world.canConquerCell(coord)) {
      return {
        allowed: false,
        reason: 'Choose an unowned dead hex.',
      };
    }

    return {
      allowed: true,
    };
  }

  startConquest(coord: { q: number; r: number }): boolean {
    return this.conquestSystem.start(this.world, coord);
  }

  getConquestProgress() {
    return this.conquestSystem.getSnapshot();
  }

  getRenderSnapshot(): WorldRenderSnapshot {
    return this.lastSnapshot;
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
    const activeShellbackCount = [...this.enemies.values()].filter(isShellbackEnemy).length;
    const activeAmbientEnemyCount = this.enemies.size - activeShellbackCount;
    const desired = Math.min(
      tuning.targetEnemyCount + Math.max(0, this.world.stage - 1),
      tuning.enemyCap - activeShellbackCount,
    );

    let remaining = Math.min(
      desired - activeAmbientEnemyCount,
      enforceEnemyCap(this.enemies.size, tuning.enemyCap),
    );

    while (remaining > 0) {
      const enemyType = resolveEnemyType(this.world.stage, this.randomFloat());
      const spawn = this.spawner.pickSpawn(cells, headPosition);
      const enemy = this.enemyFactory.create(
        spawn,
        enemyType,
      );
      this.enemies.set(enemy.id, enemy);
      remaining -= 1;
    }
  }

  private ensureShellback(
    headPosition: { x: number; y: number },
    cells: typeof this.world.cells,
  ): void {
    if (this.world.stage < 3) {
      return;
    }

    const activeShellbackCount = [...this.enemies.values()].filter(isShellbackEnemy).length;
    if (
      activeShellbackCount >= tuning.shellbackMaxActiveCount ||
      this.shellbackRespawnTimer > 0 ||
      enforceEnemyCap(this.enemies.size, tuning.enemyCap) <= 0
    ) {
      return;
    }

    const claimedGuardCellKeys = new Set(
      [...this.enemies.values()]
        .filter(isShellbackEnemy)
        .map((enemy) => enemy.guardCellKey),
    );
    const guardCell = pickShellbackGuardCell(cells, claimedGuardCellKeys, this.randomFloat);
    if (!guardCell) {
      return;
    }

    const spawn = this.spawner.pickSpawnInCell(guardCell, headPosition);
    const enemy = this.enemyFactory.create(
      {
        ...spawn,
        guardCell,
      },
      'shellback',
    );
    this.enemies.set(enemy.id, enemy);
  }

  private handleEnemyKilled(payload: { enemyId?: string; enemyType: Enemy['type']; x: number; y: number }): void {
    this.conquestSystem.handleEnemyKilled(payload);
    if (payload.enemyType === 'shellback') {
      this.shellbackRespawnTimer = tuning.shellbackRespawnDelaySeconds;
    }
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

  private createSnapshot(): WorldRenderSnapshot {
    return {
      cells: this.world.cells,
      bounds: this.world.bounds,
      stage: this.world.stage,
      fillLevel: this.world.fillLevel,
      fillThreshold: this.world.fillThreshold,
      hexSize: tuning.worldHexSize,
      focusX: this.lastFocus.x,
      focusY: this.lastFocus.y,
      conquest: this.conquestSystem.getSnapshot(),
    };
  }
}
