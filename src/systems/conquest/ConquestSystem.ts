import type { Enemy } from '@/entities/enemies/Enemy';
import type { EnemyFactory } from '@/entities/enemies/EnemyFactory';
import type { HexWorld } from '@/entities/world/HexWorld';
import { enforceEnemyCap } from '@/entities/world/SpawnSystem';
import { tuning } from '@/game/tuning';
import type { ConquestProgressSnapshot, HexCoord } from '@/game/types';
import { createWorldAttackWave } from '@/systems/worldAttacks';

export interface ConquestRules {
  occupiedSeconds: number;
  killGoal: number;
  maxActiveLeeches: number;
}

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
  private rules: ConquestRules = {
    occupiedSeconds: tuning.conquerOccupancySeconds,
    killGoal: tuning.conquerKillGoal,
    maxActiveLeeches: tuning.conquerMaxActiveLeeches,
  };

  constructor(
    private readonly enemyFactory: EnemyFactory,
    private readonly enemies: Map<string, Enemy>,
    private readonly randomFloat: () => number = Math.random,
  ) {}

  setRules(rules: ConquestRules): void {
    this.rules = { ...rules };
  }

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

  update(world: HexWorld, headPosition: { x: number; y: number }): HexCoord | null {
    if (!this.state) {
      return null;
    }

    this.state.playerInside = coordsMatch(
      pointToHexCoord(headPosition.x, headPosition.y, tuning.worldHexSize),
      this.state.targetCoord,
    );
    if (this.state.playerInside) {
      this.state.occupiedSeconds = Math.min(
        this.rules.occupiedSeconds,
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
      this.state.occupiedSeconds >= this.rules.occupiedSeconds &&
      this.state.killCount >= this.rules.killGoal
    ) {
      const completedCoord = { ...this.state.targetCoord };
      world.completeConquest(this.state.targetCoord);
      this.state = null;
      return completedCoord;
    }

    return null;
  }

  handleEnemyKilled(payload: { enemyId?: string }): void {
    if (!this.state || !payload.enemyId) {
      return;
    }

    if (this.state.activeEnemyIds.delete(payload.enemyId)) {
      this.state.killCount = Math.min(
        this.rules.killGoal,
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
      occupiedGoalSeconds: this.rules.occupiedSeconds,
      killCount: this.state.killCount,
      killGoal: this.rules.killGoal,
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

    const remainingKills = this.rules.killGoal - this.state.killCount;
    const remainingEnemyCapacity = enforceEnemyCap(this.enemies.size, tuning.enemyCap);
    const maxWaveBudget = Math.min(
      remainingKills,
      remainingEnemyCapacity,
      this.rules.maxActiveLeeches,
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
