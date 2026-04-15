import type { Enemy } from '@/entities/enemies/Enemy';
import type { EnemyFactory } from '@/entities/enemies/EnemyFactory';
import type { HexWorld } from '@/entities/world/HexWorld';
import { enforceEnemyCap } from '@/entities/world/SpawnSystem';
import { tuning } from '@/game/tuning';
import type { ConquestProgressSnapshot, HexCoord } from '@/game/types';
import { createWorldAttackWave } from '@/systems/worldAttacks';

interface ActiveConquestState {
  targetCoord: HexCoord;
  occupiedSeconds: number;
  killCount: number;
  playerInside: boolean;
  activeEnemyIds: Set<string>;
}

function coordsMatch(left: HexCoord, right: HexCoord): boolean {
  return left.q === right.q && left.r === right.r;
}

function axialRound(q: number, r: number): HexCoord {
  let cubeX = q;
  let cubeZ = r;
  let cubeY = -cubeX - cubeZ;

  let roundedX = Math.round(cubeX);
  let roundedY = Math.round(cubeY);
  let roundedZ = Math.round(cubeZ);

  const diffX = Math.abs(roundedX - cubeX);
  const diffY = Math.abs(roundedY - cubeY);
  const diffZ = Math.abs(roundedZ - cubeZ);

  if (diffX > diffY && diffX > diffZ) {
    roundedX = -roundedY - roundedZ;
  } else if (diffY > diffZ) {
    roundedY = -roundedX - roundedZ;
  } else {
    roundedZ = -roundedX - roundedY;
  }

  return {
    q: roundedX,
    r: roundedZ,
  };
}

function pointToHexCoord(worldX: number, worldY: number, hexSize: number): HexCoord {
  const q = ((Math.sqrt(3) / 3) * worldX - (1 / 3) * worldY) / hexSize;
  const r = ((2 / 3) * worldY) / hexSize;
  return axialRound(q, r);
}

export class ConquestSystem {
  private state: ActiveConquestState | null = null;

  constructor(
    private readonly enemyFactory: EnemyFactory,
    private readonly enemies: Map<string, Enemy>,
    private readonly randomFloat: () => number = Math.random,
  ) {}

  isActive(): boolean {
    return this.state !== null;
  }

  start(world: HexWorld, coord: HexCoord): boolean {
    const target = world.beginConquest(coord);
    if (!target) {
      return false;
    }

    this.state = {
      targetCoord: { ...target.coord },
      occupiedSeconds: 0,
      killCount: 0,
      playerInside: false,
      activeEnemyIds: new Set<string>(),
    };
    return true;
  }

  update(world: HexWorld, headPosition: { x: number; y: number }): boolean {
    if (!this.state) {
      return false;
    }

    this.state.playerInside = coordsMatch(
      pointToHexCoord(headPosition.x, headPosition.y, tuning.worldHexSize),
      this.state.targetCoord,
    );
    if (this.state.playerInside) {
      this.state.occupiedSeconds = Math.min(
        tuning.conquerOccupancySeconds,
        this.state.occupiedSeconds + tuning.fixedStepSeconds,
      );
    }

    for (const enemyId of [...this.state.activeEnemyIds]) {
      if (!this.enemies.has(enemyId)) {
        this.state.activeEnemyIds.delete(enemyId);
      }
    }

    this.spawnAttackWave(world);

    if (
      this.state.occupiedSeconds >= tuning.conquerOccupancySeconds &&
      this.state.killCount >= tuning.conquerKillGoal
    ) {
      world.completeConquest(this.state.targetCoord);
      this.state = null;
      return true;
    }

    return false;
  }

  handleEnemyKilled(payload: { enemyId?: string }): void {
    if (!this.state || !payload.enemyId) {
      return;
    }

    if (this.state.activeEnemyIds.delete(payload.enemyId)) {
      this.state.killCount = Math.min(
        tuning.conquerKillGoal,
        this.state.killCount + 1,
      );
    }
  }

  getSnapshot(): ConquestProgressSnapshot | null {
    if (!this.state) {
      return null;
    }

    return {
      coord: { ...this.state.targetCoord },
      occupiedSeconds: this.state.occupiedSeconds,
      occupiedGoalSeconds: tuning.conquerOccupancySeconds,
      killCount: this.state.killCount,
      killGoal: tuning.conquerKillGoal,
      playerInside: this.state.playerInside,
    };
  }

  private spawnAttackWave(world: HexWorld): void {
    if (!this.state) {
      return;
    }

    if (this.state.activeEnemyIds.size > 0) {
      return;
    }

    const remainingKills = tuning.conquerKillGoal - this.state.killCount;
    const remainingEnemyCapacity = enforceEnemyCap(this.enemies.size, tuning.enemyCap);
    const maxWaveBudget = Math.min(
      remainingKills,
      remainingEnemyCapacity,
      tuning.conquerMaxActiveLeeches,
    );
    if (maxWaveBudget <= 0) {
      return;
    }

    const targetCell = world.findCell(this.state.targetCoord);
    if (!targetCell) {
      return;
    }

    const wave = createWorldAttackWave('conquestLeechPack', {
      targetCell,
      remainingKills: maxWaveBudget,
      randomFloat: this.randomFloat,
    });

    for (const spawn of wave) {
      const enemy = this.enemyFactory.create(spawn, spawn.enemyType);
      this.enemies.set(enemy.id, enemy);
      this.state.activeEnemyIds.add(enemy.id);
    }
  }
}
