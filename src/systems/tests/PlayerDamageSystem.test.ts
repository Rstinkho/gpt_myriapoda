import { describe, expect, it, vi } from 'vitest';
import * as planck from 'planck';
import { createIdleLimbState } from '@/entities/myriapoda/limbState';
import { tuning } from '@/game/tuning';
import type { LimbRuntime } from '@/entities/myriapoda/LimbController';
import { PlayerDamageSystem } from '@/systems/PlayerDamageSystem';

function createLimb(id: string, x: number, y: number): LimbRuntime {
  const world = new planck.World({ gravity: planck.Vec2(0, 0) });
  const root = world.createBody({
    position: planck.Vec2(x / tuning.pixelsPerMeter, y / tuning.pixelsPerMeter),
  });

  return {
    id,
    slotIndex: Number(id.replace('limb-', '')) - 1,
    body: {
      root,
      tip: root,
      bodies: [root],
      joints: [],
      destroy() {},
    } as never,
    anchorRatio: 0,
    mountOffsetPx: 0,
    side: -1,
    phase: 0,
    state: createIdleLimbState(),
    desiredTarget: null,
  };
}

function createMyriapodaStub(options: {
  segmentXs: number[];
  attachedLimbsBySegment?: Record<number, LimbRuntime[]>;
  drainedAmount?: number;
}) {
  const segments = options.segmentXs.map((x) => ({
    x,
    y: 0,
    angle: 0,
    radius: 10,
  }));
  const body = {
    segments,
    getStomachSegmentIndex() {
      return Math.max(0, segments.length - 2);
    },
    getStomachAnchor() {
      return segments[this.getStomachSegmentIndex()];
    },
    removeSegmentAt: vi.fn((index: number) => {
      segments.splice(index, 1);
      return true;
    }),
  };
  const attachedLimbsBySegment = options.attachedLimbsBySegment ?? {};
  const limbs = {
    getActiveLimbsAttachedToSegment: vi.fn((index: number) => attachedLimbsBySegment[index] ?? []),
    destroyLimb: vi.fn(() => true),
  };
  const stomach = {
    drainStoredParticles: vi.fn(() => options.drainedAmount ?? tuning.shellbackStomachMaterialLoss),
  };

  return {
    body,
    limbs,
    stomach,
    flashSegmentDamage: vi.fn(),
    flashStomachDamage: vi.fn(),
    spawnLimbLossEffect: vi.fn(),
    spawnStomachHitEffect: vi.fn(),
  };
}

describe('PlayerDamageSystem', () => {
  it('targets the nearest attached limb root so the shellback claw closes over the limb', () => {
    const eventBus = { emit: vi.fn() };
    const system = new PlayerDamageSystem(eventBus as never);
    const upperLimb = createLimb('limb-1', 14, -6);
    const lowerLimb = createLimb('limb-2', 20, 7);
    const myriapoda = createMyriapodaStub({
      segmentXs: [12, 40, 68, 96],
      attachedLimbsBySegment: {
        0: [upperLimb, lowerLimb],
      },
    });

    const result = system.findShellbackStrikeTarget(
      myriapoda as never,
      { x: 0, y: -8 },
    );

    expect(result).toMatchObject({
      type: 'segment',
      index: 0,
      x: 14,
      y: -6,
    });
  });

  it('destroys the nearest attached limb before removing a body circle', () => {
    const eventBus = { emit: vi.fn() };
    const system = new PlayerDamageSystem(eventBus as never);
    const upperLimb = createLimb('limb-1', 8, -6);
    const lowerLimb = createLimb('limb-2', 8, 6);
    const myriapoda = createMyriapodaStub({
      segmentXs: [12, 40, 68, 96],
      attachedLimbsBySegment: {
        0: [upperLimb, lowerLimb],
      },
    });

    const result = system.applyShellbackStrike(myriapoda as never, { x: 0, y: -10 });

    expect(result.kind).toBe('limb');
    expect(myriapoda.limbs.destroyLimb).toHaveBeenCalledWith('limb-1');
    expect(myriapoda.flashSegmentDamage).toHaveBeenCalledWith(0);
    expect(myriapoda.spawnLimbLossEffect).toHaveBeenCalledWith(8, -6);
    expect(myriapoda.body.removeSegmentAt).not.toHaveBeenCalled();
  });

  it('removes a body circle when no active limb is attached to the chosen segment', () => {
    const eventBus = { emit: vi.fn() };
    const system = new PlayerDamageSystem(eventBus as never);
    const myriapoda = createMyriapodaStub({
      segmentXs: [12, 40, 68, 96],
    });

    const result = system.applyShellbackStrike(myriapoda as never, { x: 0, y: 0 });

    expect(result.kind).toBe('segment');
    expect(myriapoda.body.removeSegmentAt).toHaveBeenCalledWith(0);
    expect(myriapoda.stomach.drainStoredParticles).not.toHaveBeenCalled();
  });

  it('drains stomach matter with a cap of fifteen stored particles', () => {
    const eventBus = { emit: vi.fn() };
    const system = new PlayerDamageSystem(eventBus as never);
    const myriapoda = createMyriapodaStub({
      segmentXs: [12, 40, 68, 96],
      drainedAmount: 12,
    });

    const result = system.applyShellbackStrike(myriapoda as never, { x: 68, y: 0 });

    expect(result).toMatchObject({
      kind: 'stomach',
      removedMaterials: 12,
    });
    expect(myriapoda.stomach.drainStoredParticles).toHaveBeenCalledWith(15);
    expect(myriapoda.flashStomachDamage).toHaveBeenCalled();
    expect(myriapoda.spawnStomachHitEffect).toHaveBeenCalledWith(68, 0);
    expect(myriapoda.body.removeSegmentAt).not.toHaveBeenCalled();
  });

  it('falls back to stomach-only damage when only the core body circle remains', () => {
    const eventBus = { emit: vi.fn() };
    const system = new PlayerDamageSystem(eventBus as never);
    const myriapoda = createMyriapodaStub({
      segmentXs: [24],
      drainedAmount: 0,
    });

    const result = system.applyShellbackStrike(myriapoda as never, { x: 24, y: 0 });

    expect(result).toMatchObject({
      kind: 'stomach',
      removedMaterials: 0,
    });
    expect(myriapoda.body.removeSegmentAt).not.toHaveBeenCalled();
  });
});
