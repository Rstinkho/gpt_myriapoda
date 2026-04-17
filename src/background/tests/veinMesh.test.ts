import { describe, expect, it } from 'vitest';
import {
  buildVeinGraph,
  computeEdgeAlpha,
  computeGlobalBreath,
  veinGraphFingerprint,
  type VeinEdge,
  type VeinGraphOptions,
} from '@/background/veinMesh';

const defaults: VeinGraphOptions = {
  coverageRadius: 1200,
  rootCount: 2,
  attractorCount: 220,
  growthStep: 42,
  influenceRadius: 220,
  killRadius: 58,
  maxIterations: 80,
  capillaryDepthThreshold: 4,
  murrayExponent: 3,
  rootRadius: 3.2,
  minRadius: 0.5,
  anastomosisRatio: 0.15,
  curveSamples: 8,
  curveBow: 0.18,
  seed: 0xa5a5,
};

describe('buildVeinGraph', () => {
  it('is deterministic for the same seed', () => {
    const a = buildVeinGraph({ ...defaults });
    const b = buildVeinGraph({ ...defaults });
    expect(a.nodes.length).toBe(b.nodes.length);
    expect(a.edges.length).toBe(b.edges.length);
    for (const [idx, node] of a.nodes.entries()) {
      expect(node.x).toBe(b.nodes[idx]!.x);
      expect(node.y).toBe(b.nodes[idx]!.y);
      expect(node.depth).toBe(b.nodes[idx]!.depth);
      expect(node.parent).toBe(b.nodes[idx]!.parent);
    }
  });

  it('produces a forest rooted at parent=-1 nodes and every other node links to a valid parent', () => {
    const graph = buildVeinGraph({ ...defaults });
    const roots = graph.nodes.filter((n) => n.parent === -1);
    expect(roots.length).toBe(defaults.rootCount);
    expect(roots.every((r) => r.depth === 0)).toBe(true);
    for (const node of graph.nodes) {
      if (node.parent >= 0) {
        expect(node.parent).toBeLessThan(graph.nodes.length);
        expect(graph.nodes[node.parent]!.depth).toBe(node.depth - 1);
      }
    }
  });

  it('tapers radii from trunk to leaves (Murray-law monotonic along any path)', () => {
    const graph = buildVeinGraph({ ...defaults });
    // Every non-root node should have radius ≤ its parent's radius (allowing ~1% tolerance).
    let violations = 0;
    for (const node of graph.nodes) {
      if (node.parent < 0) continue;
      const parentRadius = graph.nodes[node.parent]!.radius;
      if (node.radius > parentRadius * 1.01) violations += 1;
    }
    expect(violations).toBe(0);
    // The dominant root matches `rootRadius` exactly; other roots (smaller territories,
    // fewer descendants) are capped at or below it — biologically expected because a trunk's
    // radius scales with the downstream flow it supports.
    const rootRadii = graph.nodes.filter((n) => n.parent === -1).map((n) => n.radius);
    const maxRoot = Math.max(...rootRadii);
    expect(maxRoot).toBeCloseTo(defaults.rootRadius, 5);
    for (const r of rootRadii) {
      expect(r).toBeGreaterThan(defaults.minRadius);
      expect(r).toBeLessThanOrEqual(defaults.rootRadius + 1e-6);
    }
  });

  it('classifies deep branches as capillary and shallow branches as main', () => {
    const graph = buildVeinGraph({ ...defaults });
    const shallowMain = graph.edges.filter(
      (e) => !e.loop && graph.nodes[e.b]!.depth < defaults.capillaryDepthThreshold,
    );
    const deepCapillary = graph.edges.filter(
      (e) => !e.loop && graph.nodes[e.b]!.depth >= defaults.capillaryDepthThreshold,
    );
    expect(shallowMain.every((e) => e.kind === 'main')).toBe(true);
    expect(deepCapillary.every((e) => e.kind === 'capillary')).toBe(true);
  });

  it('pre-samples each branch as a polyline with matching point/width counts', () => {
    const graph = buildVeinGraph({ ...defaults });
    for (const edge of graph.edges) {
      expect(edge.curve.points.length).toBeGreaterThanOrEqual(2);
      expect(edge.curve.points.length).toBe(edge.curve.widths.length);
      for (const width of edge.curve.widths) {
        expect(width).toBeGreaterThan(0);
      }
    }
  });

  it('produces anastomosis loops marked with loop=true (or none when ratio=0)', () => {
    const loopy = buildVeinGraph({ ...defaults, anastomosisRatio: 0.5 });
    const dry = buildVeinGraph({ ...defaults, anastomosisRatio: 0 });
    const loops = loopy.edges.filter((e) => e.loop);
    expect(loops.every((e) => e.kind === 'capillary')).toBe(true);
    expect(dry.edges.some((e) => e.loop)).toBe(false);
  });

  it('curve control points actually bow off the straight line (organic curvature)', () => {
    const graph = buildVeinGraph({ ...defaults });
    // For each edge find the max deviation from the straight chord;
    // across the whole mesh we expect non-trivial curvature on average.
    let totalDev = 0;
    let longEdges = 0;
    for (const edge of graph.edges) {
      const first = edge.curve.points[0]!;
      const last = edge.curve.points[edge.curve.points.length - 1]!;
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const chordLen = Math.sqrt(dx * dx + dy * dy);
      if (chordLen < 5) continue;
      longEdges += 1;
      let maxDev = 0;
      for (const p of edge.curve.points) {
        // Perpendicular distance from point to chord.
        const cross = Math.abs((p.x - first.x) * dy - (p.y - first.y) * dx);
        const dev = cross / chordLen;
        if (dev > maxDev) maxDev = dev;
      }
      totalDev += maxDev / chordLen;
    }
    const avgBow = totalDev / Math.max(1, longEdges);
    expect(avgBow).toBeGreaterThan(0.01);
  });
});

describe('computeGlobalBreath', () => {
  it('stays within [0,1]', () => {
    for (const t of [0, 0.5, 1, 2.345, 7.8, 100]) {
      const v = computeGlobalBreath(t, 0.2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('completes one cycle per 1/rate seconds', () => {
    const rateHz = 0.25;
    const a = computeGlobalBreath(0, rateHz);
    const b = computeGlobalBreath(1 / rateHz, rateHz);
    expect(b).toBeCloseTo(a, 5);
  });
});

describe('computeEdgeAlpha', () => {
  const baseEdge: VeinEdge = {
    a: 0,
    b: 1,
    kind: 'main',
    jitter: 0.5,
    curve: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], widths: [2, 1] },
  };
  const baseConfig = {
    baseAlpha: 0.35,
    breathAmplitude: 0.06,
    bioBoost: 0.2,
    corruptionBoost: 0.15,
    jitterAmplitude: 0.03,
  };

  it('returns base alpha at neutral breath and zero density for median-jitter edge', () => {
    const alpha = computeEdgeAlpha(baseEdge, 0.5, 0, 0, baseConfig);
    expect(alpha).toBeCloseTo(baseConfig.baseAlpha, 5);
  });

  it('lifts alpha where bio density is high', () => {
    const quiet = computeEdgeAlpha(baseEdge, 0.5, 0, 0, baseConfig);
    const loud = computeEdgeAlpha(baseEdge, 0.5, 1, 0, baseConfig);
    expect(loud).toBeGreaterThan(quiet);
    expect(loud - quiet).toBeCloseTo(baseConfig.bioBoost, 5);
  });

  it('clamps output within [0,1]', () => {
    const hot = computeEdgeAlpha(baseEdge, 1, 5, 5, baseConfig);
    const cold = computeEdgeAlpha(
      baseEdge,
      0,
      0,
      0,
      { ...baseConfig, baseAlpha: -10 },
    );
    expect(hot).toBeLessThanOrEqual(1);
    expect(cold).toBeGreaterThanOrEqual(0);
  });

  it('breath amplitude is bounded — calm motion, not flashing', () => {
    const low = computeEdgeAlpha(baseEdge, 0, 0, 0, baseConfig);
    const high = computeEdgeAlpha(baseEdge, 1, 0, 0, baseConfig);
    expect(high - low).toBeCloseTo(2 * baseConfig.breathAmplitude, 5);
  });
});

describe('veinGraphFingerprint', () => {
  it('changes when stage changes', () => {
    const a = veinGraphFingerprint({ hexSize: 60, stage: 1 }, 2000);
    const b = veinGraphFingerprint({ hexSize: 60, stage: 2 }, 2000);
    expect(a).not.toBe(b);
  });

  it('changes when coverage radius changes meaningfully', () => {
    const a = veinGraphFingerprint({ hexSize: 60, stage: 1 }, 2000);
    const b = veinGraphFingerprint({ hexSize: 60, stage: 1 }, 3000);
    expect(a).not.toBe(b);
  });

  it('is stable between equal snapshots', () => {
    const a = veinGraphFingerprint({ hexSize: 60, stage: 2 }, 1500);
    const b = veinGraphFingerprint({ hexSize: 60, stage: 2 }, 1500);
    expect(a).toBe(b);
  });
});
