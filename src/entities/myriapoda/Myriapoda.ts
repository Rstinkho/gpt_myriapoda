import * as Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { BodyChain } from '@/entities/myriapoda/BodyChain';
import { Head } from '@/entities/myriapoda/Head';
import { LimbController } from '@/entities/myriapoda/LimbController';
import { StomachSystem } from '@/entities/myriapoda/StomachSystem';
import { TailController } from '@/entities/myriapoda/TailController';
import { VacuumSystem } from '@/entities/myriapoda/VacuumSystem';
import type { DashStateSnapshot } from '@/game/types';

export interface MyriapodaDamageEffect {
  kind: 'limb-loss' | 'stomach-hit';
  x: number;
  y: number;
  timer: number;
  duration: number;
  seed: number;
}

export class Myriapoda {
  private damagedSegmentIndex: number | null = null;
  private damagedSegmentTimer = 0;
  private stomachDamageTimer = 0;
  private readonly damageEffects: MyriapodaDamageEffect[] = [];
  readonly head: Head;
  readonly body: BodyChain;
  readonly limbs: LimbController;
  readonly tail: TailController;
  readonly stomach: StomachSystem;
  readonly vacuum: VacuumSystem;

  constructor(scene: Phaser.Scene, world: planck.World, x: number, y: number) {
    this.head = new Head(scene, world, x, y);
    this.body = new BodyChain(x, y);
    this.limbs = new LimbController(world, this.body);
    this.tail = new TailController(world, this.body);
    this.stomach = new StomachSystem();
    this.vacuum = new VacuumSystem();
    this.syncBodyAttachments(0);
  }

  syncBodyAttachments(deltaSeconds: number, dashState?: DashStateSnapshot): void {
    const stomachAnchor = this.body.getStomachAnchor();
    this.stomach.setAnchor(stomachAnchor.x, stomachAnchor.y);
    this.tail.update(deltaSeconds, this.body, dashState);
  }

  stepDamageFeedback(deltaSeconds: number): void {
    this.damagedSegmentTimer = Math.max(0, this.damagedSegmentTimer - deltaSeconds);
    if (this.damagedSegmentTimer === 0) {
      this.damagedSegmentIndex = null;
    }

    this.stomachDamageTimer = Math.max(0, this.stomachDamageTimer - deltaSeconds);

    for (let index = this.damageEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.damageEffects[index];
      effect.timer = Math.max(0, effect.timer - deltaSeconds);
      if (effect.timer === 0) {
        this.damageEffects.splice(index, 1);
      }
    }
  }

  flashSegmentDamage(segmentIndex: number): void {
    this.damagedSegmentIndex = segmentIndex;
    this.damagedSegmentTimer = tuning.myriapodaDamageFlashSeconds;
  }

  flashStomachDamage(): void {
    this.stomachDamageTimer = tuning.myriapodaDamageFlashSeconds;
  }

  spawnLimbLossEffect(x: number, y: number): void {
    this.damageEffects.push({
      kind: 'limb-loss',
      x,
      y,
      timer: tuning.myriapodaDamageBurstSeconds,
      duration: tuning.myriapodaDamageBurstSeconds,
      seed: this.damageEffects.length * 0.9 + x * 0.013 + y * 0.007,
    });
  }

  spawnStomachHitEffect(x: number, y: number): void {
    this.damageEffects.push({
      kind: 'stomach-hit',
      x,
      y,
      timer: tuning.myriapodaDamageBurstSeconds,
      duration: tuning.myriapodaDamageBurstSeconds,
      seed: this.damageEffects.length * 0.7 + x * 0.009 - y * 0.011,
    });
  }

  getSegmentDamageFlash(segmentIndex: number): number {
    if (this.damagedSegmentIndex !== segmentIndex) {
      return 0;
    }

    return this.damagedSegmentTimer / tuning.myriapodaDamageFlashSeconds;
  }

  getStomachDamageFlash(): number {
    return this.stomachDamageTimer / tuning.myriapodaDamageFlashSeconds;
  }

  getDamageEffects(): ReadonlyArray<MyriapodaDamageEffect> {
    return this.damageEffects;
  }
}
