import { describe, expect, it } from 'vitest';
import { tuning } from '@/game/tuning';
import {
  clampPointToRadius,
  pickShellbackGuardCell,
  stepShellbackState,
} from '@/entities/enemies/shellback/ShellbackAI';
import type { HexCell } from '@/game/types';

describe('ShellbackAI', () => {
  it('prefers unclaimed enriched guard hexes when selecting territory', () => {
    const cells: HexCell[] = [
      {
        coord: { q: 0, r: 0 },
        centerX: 0,
        centerY: 0,
        unlocked: true,
        type: 'enriched',
      },
      {
        coord: { q: 1, r: 0 },
        centerX: 10,
        centerY: 0,
        unlocked: true,
        type: 'enriched',
      },
      {
        coord: { q: 0, r: 1 },
        centerX: 0,
        centerY: 10,
        unlocked: true,
        type: 'corrupted',
      },
    ];

    const chosen = pickShellbackGuardCell(cells, new Set(['0,0']), () => 0);

    expect(chosen).not.toBeNull();
    expect(chosen!.coord).toEqual({ q: 1, r: 0 });
  });

  it('returns no guard territory when no enriched hex is visible', () => {
    const cells: HexCell[] = [
      {
        coord: { q: 0, r: 0 },
        centerX: 0,
        centerY: 0,
        unlocked: true,
        type: 'purified',
      },
      {
        coord: { q: 1, r: 0 },
        centerX: 10,
        centerY: 0,
        unlocked: true,
        type: 'dead',
      },
    ];

    expect(pickShellbackGuardCell(cells, new Set(), () => 0.5)).toBeNull();
  });

  it('clamps patrol and chase targets to the configured guard radius', () => {
    const clamped = clampPointToRadius(
      { x: 96, y: -42 },
      { x: 0, y: 0 },
      tuning.shellbackGuardOrbitRadiusPx,
    );

    expect(Math.hypot(clamped.x, clamped.y)).toBeCloseTo(
      tuning.shellbackGuardOrbitRadiusPx,
      5,
    );
  });

  it('cycles between exposed and shelled states and only remains vulnerable while exposed', () => {
    const shelled = stepShellbackState(
      {
        shellState: 'exposed',
        shellTimer: 0.01,
        attackState: 'idle',
        attackTimer: 0,
        attackTarget: null,
        activeClaw: 'left',
      },
      {
        deltaSeconds: 0.02,
        hasAggro: false,
        strikeTarget: null,
      },
    );

    expect(shelled.shellState).toBe('shelled');
    expect(shelled.isVulnerable).toBe(false);
    expect(shelled.didStrike).toBe(false);

    const exposed = stepShellbackState(
      {
        ...shelled,
        shellTimer: 0.01,
      },
      {
        deltaSeconds: 0.02,
        hasAggro: true,
        strikeTarget: { x: 10, y: 0 },
      },
    );

    expect(exposed.shellState).toBe('exposed');
    expect(exposed.isVulnerable).toBe(true);
  });

  it('winds up and strikes only while exposed', () => {
    const windingUp = stepShellbackState(
      {
        shellState: 'exposed',
        shellTimer: tuning.shellbackExposedSeconds,
        attackState: 'idle',
        attackTimer: 0,
        attackTarget: null,
        activeClaw: 'left',
      },
      {
        deltaSeconds: tuning.fixedStepSeconds,
        hasAggro: true,
        strikeTarget: { x: 18, y: 4 },
      },
    );

    expect(windingUp.attackState).toBe('windup');
    expect(windingUp.attackTarget).toEqual({ x: 18, y: 4 });

    const striking = stepShellbackState(
      {
        ...windingUp,
        attackTimer: 0.01,
      },
      {
        deltaSeconds: 0.02,
        hasAggro: true,
        strikeTarget: { x: 20, y: 5 },
      },
    );

    expect(striking.attackState).toBe('strike');
    expect(striking.didStrike).toBe(true);

    const shelled = stepShellbackState(
      {
        shellState: 'shelled',
        shellTimer: tuning.shellbackShelledSeconds,
        attackState: 'idle',
        attackTimer: 0,
        attackTarget: null,
        activeClaw: 'left',
      },
      {
        deltaSeconds: tuning.fixedStepSeconds,
        hasAggro: true,
        strikeTarget: { x: 20, y: 5 },
      },
    );

    expect(shelled.attackState).toBe('idle');
    expect(shelled.didStrike).toBe(false);
  });

  it('alternates claws after each completed recovery cycle', () => {
    const recovered = stepShellbackState(
      {
        shellState: 'exposed',
        shellTimer: tuning.shellbackExposedSeconds,
        attackState: 'recover',
        attackTimer: 0.01,
        attackTarget: { x: 22, y: -3 },
        activeClaw: 'left',
      },
      {
        deltaSeconds: 0.02,
        hasAggro: true,
        strikeTarget: { x: 22, y: -3 },
      },
    );

    expect(recovered.attackState).toBe('idle');
    expect(recovered.attackTimer).toBeCloseTo(tuning.shellbackAttackCooldownSeconds, 5);
    expect(recovered.activeClaw).toBe('right');
  });
});
