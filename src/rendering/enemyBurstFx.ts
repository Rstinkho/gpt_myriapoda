import type * as Phaser from 'phaser';
import { jellyfishDefinition } from '@/entities/enemies/jellyfish/definition';
import { GameEvents } from '@/game/events';
import { tuning } from '@/game/tuning';
import type { EnemyType } from '@/game/types';

export interface EnemyFxPalette {
  shardColors: number[];
  bubbleFill: number;
  bubbleOutline: number;
  glowColor: number;
}

export type EnemyBurstShardShape = 'diamond' | 'sliver' | 'droplet';

export interface EnemyBurstShard {
  shape: EnemyBurstShardShape;
  color: number;
  velocityX: number;
  velocityY: number;
  sizePx: number;
  stretch: number;
  rotation: number;
  angularVelocity: number;
  lifetimeSeconds: number;
}

export interface EnemyBurstBubble {
  fillColor: number;
  outlineColor: number;
  velocityX: number;
  velocityY: number;
  sizePx: number;
  growthPx: number;
  wobbleAmplitudePx: number;
  wobbleSpeed: number;
  lifetimeSeconds: number;
}

export interface EnemyBurst {
  enemyType: EnemyType;
  x: number;
  y: number;
  ageSeconds: number;
  lifetimeSeconds: number;
  palette: EnemyFxPalette;
  shards: EnemyBurstShard[];
  bubbles: EnemyBurstBubble[];
}

export interface EnemyKilledFxPayload {
  enemyType: EnemyType;
  x: number;
  y: number;
}

type EventBusLike = Pick<Phaser.Events.EventEmitter, 'on' | 'off'>;
type RandomSource = () => number;

const burstShapes: EnemyBurstShardShape[] = ['diamond', 'sliver', 'droplet'];

export function resolveEnemyFxPalette(enemyType: EnemyType): EnemyFxPalette {
  switch (enemyType) {
    case 'jellyfish':
      return {
        shardColors: [
          jellyfishDefinition.bellColor,
          jellyfishDefinition.tentacleColor,
          jellyfishDefinition.skirtColor,
          jellyfishDefinition.bellHighlightColor,
        ],
        bubbleFill: jellyfishDefinition.bellHighlightColor,
        bubbleOutline: jellyfishDefinition.bellOutlineColor,
        glowColor: jellyfishDefinition.bloomColor,
      };
    case 'leech':
      return {
        shardColors: [0xf6d9cf, 0xe8b8b0, 0x9b5f67, 0x5d2430],
        bubbleFill: 0xf6d9cf,
        bubbleOutline: 0xf9e5d9,
        glowColor: 0xe8b8b0,
      };
  }
}

export function createEnemyBurst(
  enemyType: EnemyType,
  x: number,
  y: number,
  random: RandomSource = Math.random,
): EnemyBurst {
  const palette = resolveEnemyFxPalette(enemyType);
  const shardCount = randomInt(
    random,
    tuning.enemyBurstShardMinCount,
    tuning.enemyBurstShardMaxCount,
  );
  const bubbleCount = randomInt(
    random,
    tuning.enemyBurstBubbleMinCount,
    tuning.enemyBurstBubbleMaxCount,
  );

  const shards = Array.from({ length: shardCount }, () => createShard(palette, random));
  const bubbles = Array.from({ length: bubbleCount }, () => createBubble(palette, random));
  const lifetimeSeconds = Math.max(
    0,
    ...shards.map((shard) => shard.lifetimeSeconds),
    ...bubbles.map((bubble) => bubble.lifetimeSeconds),
  );

  return {
    enemyType,
    x,
    y,
    ageSeconds: 0,
    lifetimeSeconds,
    palette,
    shards,
    bubbles,
  };
}

export function advanceEnemyBurst(
  burst: EnemyBurst,
  deltaSeconds: number,
): EnemyBurst | null {
  const ageSeconds = burst.ageSeconds + Math.max(0, deltaSeconds);
  if (ageSeconds >= burst.lifetimeSeconds) {
    return null;
  }

  return {
    ...burst,
    ageSeconds,
  };
}

export class EnemyBurstFxController {
  private bursts: EnemyBurst[] = [];
  private destroyed = false;

  constructor(
    private readonly eventBus: EventBusLike,
    private readonly random: RandomSource = Math.random,
  ) {
    this.eventBus.on(GameEvents.enemyKilled, this.handleEnemyKilled);
  }

  update(deltaSeconds: number): void {
    if (this.bursts.length === 0) {
      return;
    }

    const nextBursts: EnemyBurst[] = [];
    for (const burst of this.bursts) {
      const next = advanceEnemyBurst(burst, deltaSeconds);
      if (next) {
        nextBursts.push(next);
      }
    }
    this.bursts = nextBursts;
  }

  clear(): void {
    this.bursts = [];
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.eventBus.off(GameEvents.enemyKilled, this.handleEnemyKilled);
    this.clear();
    this.destroyed = true;
  }

  getBursts(): readonly EnemyBurst[] {
    return this.bursts;
  }

  getActiveBurstCount(): number {
    return this.bursts.length;
  }

  private readonly handleEnemyKilled = (payload: EnemyKilledFxPayload): void => {
    this.bursts = [
      ...this.bursts,
      createEnemyBurst(payload.enemyType, payload.x, payload.y, this.random),
    ];
  };
}

function createShard(
  palette: EnemyFxPalette,
  random: RandomSource,
): EnemyBurstShard {
  const angle = randomBetween(random, 0, Math.PI * 2);
  const speed = randomBetween(
    random,
    tuning.enemyBurstShardMinSpeedPx,
    tuning.enemyBurstShardMaxSpeedPx,
  );
  const sizePx =
    randomBetween(
      random,
      tuning.enemyBurstShardMinSizePx,
      tuning.enemyBurstShardMaxSizePx,
    ) * tuning.enemyShardScale;

  return {
    shape: burstShapes[randomInt(random, 0, burstShapes.length - 1)],
    color: palette.shardColors[randomInt(random, 0, palette.shardColors.length - 1)],
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    sizePx,
    stretch: randomBetween(random, 0.9, 1.8),
    rotation: randomBetween(random, 0, Math.PI * 2),
    angularVelocity: randomBetween(
      random,
      -tuning.enemyBurstShardAngularVelocity,
      tuning.enemyBurstShardAngularVelocity,
    ),
    lifetimeSeconds: randomBetween(
      random,
      tuning.enemyBurstShardMinLifetimeSeconds,
      tuning.enemyBurstShardMaxLifetimeSeconds,
    ),
  };
}

function createBubble(
  palette: EnemyFxPalette,
  random: RandomSource,
): EnemyBurstBubble {
  const angle = randomBetween(random, -Math.PI * 0.9, -Math.PI * 0.1);
  const speed = randomBetween(
    random,
    tuning.enemyBurstBubbleMinSpeedPx,
    tuning.enemyBurstBubbleMaxSpeedPx,
  );

  return {
    fillColor: palette.bubbleFill,
    outlineColor: palette.bubbleOutline,
    velocityX: Math.cos(angle) * speed * 0.35,
    velocityY: Math.sin(angle) * speed,
    sizePx: randomBetween(
      random,
      tuning.enemyBurstBubbleMinSizePx,
      tuning.enemyBurstBubbleMaxSizePx,
    ),
    growthPx: randomBetween(
      random,
      tuning.enemyBurstBubbleGrowthMinPx,
      tuning.enemyBurstBubbleGrowthMaxPx,
    ),
    wobbleAmplitudePx: randomBetween(random, 0.4, 1.8),
    wobbleSpeed: randomBetween(random, 3.2, 6.4),
    lifetimeSeconds: randomBetween(
      random,
      tuning.enemyBurstBubbleMinLifetimeSeconds,
      tuning.enemyBurstBubbleMaxLifetimeSeconds,
    ),
  };
}

function randomBetween(random: RandomSource, min: number, max: number): number {
  return min + (max - min) * random();
}

function randomInt(random: RandomSource, min: number, max: number): number {
  return Math.floor(randomBetween(random, min, max + 1));
}
