import * as Phaser from 'phaser';
import { GameEvents } from '@/game/events';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';

export class DigestSystem {
  constructor(private readonly eventBus: Phaser.Events.EventEmitter) {}

  update(myriapoda: Myriapoda, deltaSeconds: number): void {
    myriapoda.stomach.step(deltaSeconds);
    this.eventBus.emit(GameEvents.matterDigested, {
      stored: myriapoda.stomach.particles.length,
      packets: myriapoda.stomach.particles.length,
    });
  }
}
