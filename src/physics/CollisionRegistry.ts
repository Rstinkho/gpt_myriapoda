import type * as planck from 'planck';
import type { FixtureMeta } from '@/game/types';

interface LimbHit {
  limbId: string;
  enemyId: string;
}

function getMeta(fixture: planck.Fixture | null): FixtureMeta | null {
  if (!fixture) {
    return null;
  }
  return (fixture.getUserData() as FixtureMeta | undefined) ?? null;
}

export class CollisionRegistry {
  readonly pickupsInVacuum = new Set<string>();
  readonly plantsInVacuum = new Set<string>();
  readonly enemiesThreateningHead = new Set<string>();
  private readonly limbHits: LimbHit[] = [];

  bind(world: planck.World): void {
    world.on('begin-contact', (contact) => this.handleBeginContact(contact));
    world.on('end-contact', (contact) => this.handleEndContact(contact));
  }

  update(): void {
    if (this.limbHits.length > 64) {
      this.limbHits.splice(0, this.limbHits.length - 64);
    }
  }

  drainLimbHits(): LimbHit[] {
    return this.limbHits.splice(0, this.limbHits.length);
  }

  forgetPickup(pickupId: string): void {
    this.pickupsInVacuum.delete(pickupId);
  }

  forgetEnemy(enemyId: string): void {
    this.enemiesThreateningHead.delete(enemyId);
  }

  resetTransientState(): void {
    this.pickupsInVacuum.clear();
    this.plantsInVacuum.clear();
    this.enemiesThreateningHead.clear();
    this.limbHits.length = 0;
  }

  private handleBeginContact(contact: planck.Contact): void {
    const metaA = getMeta(contact.getFixtureA());
    const metaB = getMeta(contact.getFixtureB());
    if (!metaA || !metaB) {
      return;
    }

    this.handlePair(metaA, metaB, true);
    this.handlePair(metaB, metaA, true);
  }

  private handleEndContact(contact: planck.Contact): void {
    const metaA = getMeta(contact.getFixtureA());
    const metaB = getMeta(contact.getFixtureB());
    if (!metaA || !metaB) {
      return;
    }

    this.handlePair(metaA, metaB, false);
    this.handlePair(metaB, metaA, false);
  }

  private handlePair(left: FixtureMeta, right: FixtureMeta, isBegin: boolean): void {
    if (left.tag === 'head-vacuum' && right.tag === 'pickup-body') {
      if (isBegin) {
        this.pickupsInVacuum.add(right.entityId);
      } else {
        this.pickupsInVacuum.delete(right.entityId);
      }
    }

    if (left.tag === 'head-vacuum' && right.tag === 'plant-body') {
      if (isBegin) {
        this.plantsInVacuum.add(right.entityId);
      } else {
        this.plantsInVacuum.delete(right.entityId);
      }
    }

    if (left.tag === 'head-threat' && right.tag === 'enemy-body') {
      if (isBegin) {
        this.enemiesThreateningHead.add(right.entityId);
      } else {
        this.enemiesThreateningHead.delete(right.entityId);
      }
    }

    if (isBegin && left.tag === 'limb-tip' && right.tag === 'enemy-body' && left.ownerId) {
      this.limbHits.push({
        limbId: left.ownerId,
        enemyId: right.entityId,
      });
    }
  }
}
