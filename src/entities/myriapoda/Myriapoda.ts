import * as Phaser from 'phaser';
import * as planck from 'planck';
import { BodyChain } from '@/entities/myriapoda/BodyChain';
import { Head } from '@/entities/myriapoda/Head';
import { LimbController } from '@/entities/myriapoda/LimbController';
import { StomachSystem } from '@/entities/myriapoda/StomachSystem';
import { TailController } from '@/entities/myriapoda/TailController';
import { VacuumSystem } from '@/entities/myriapoda/VacuumSystem';
import type { DashStateSnapshot } from '@/game/types';

export class Myriapoda {
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
}
