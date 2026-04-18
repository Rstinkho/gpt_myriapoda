import * as Phaser from 'phaser';
import {
  sampleBackdropDensity,
  type BackdropReactivitySample,
} from '@/background/backgroundMath';
import {
  buildVeinGraph,
  computeEdgeAlpha,
  computeGlobalBreath,
  veinGraphFingerprint,
  type VeinEdge,
  type VeinGraph,
  type VeinNode,
} from '@/background/veinMesh';
import { tuning } from '@/game/tuning';
import type { WorldRenderSnapshot } from '@/game/types';

/**
 * Renders the background vein network as a space-colonized branching tree with Murray-law
 * radii. Each branch is a curved Bézier polyline; every polyline segment is stroked three
 * times (halo / mid / core) at widths derived from the Murray radius of that segment, so
 * trunks read thick, capillaries read hair-thin, and the transition tapers organically —
 * rather than the previous toddler-straight uniform-width lattice.
 *
 * The mesh geometry lives in `veinMesh.ts` (pure, unit-tested). This class is a thin Phaser
 * adapter: it redraws the polylines each frame with a shared global-breath alpha modulation.
 */
interface CachedDensity {
  bio: number;
  corruption: number;
}

/** Re-sample `sampleBackdropDensity` once every N frames per edge/node. The density
 * field changes on a human scale (hex-cell resolution), so per-frame sampling is
 * waste; 4-frame staleness is invisible at 60fps. */
const DENSITY_REFRESH_INTERVAL = 4;

export class VeinMeshRenderer {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private graph: VeinGraph | null = null;
  /** Pre-computed "has ≥2 children" flag per node, cached when the graph is rebuilt. */
  private bifurcations: boolean[] = [];
  private fingerprint = '';
  private elapsed = 0;
  private frameCount = 0;
  private edgeDensityCache: CachedDensity[] = [];
  private nodeDensityCache: CachedDensity[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const mesh = tuning.background.veinMesh;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(mesh.depth);
    this.graphics.setScrollFactor(mesh.parallax, mesh.parallax);
    this.graphics.setBlendMode(Phaser.BlendModes.ADD);
    this.graphics.setAlpha(mesh.masterAlpha);
  }

  getGraphics(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  update(
    deltaSeconds: number,
    sample: BackdropReactivitySample,
    snapshot: WorldRenderSnapshot,
  ): void {
    this.elapsed += deltaSeconds;
    const mesh = tuning.background.veinMesh;
    const coverageRadius = this.computeCoverageRadius(snapshot);
    const fingerprint = veinGraphFingerprint(snapshot, coverageRadius);
    if (fingerprint !== this.fingerprint || !this.graph) {
      this.graph = buildVeinGraph({
        coverageRadius,
        rootCount: mesh.rootCount,
        attractorCount: mesh.attractorCount,
        growthStep: mesh.growthStep,
        influenceRadius: mesh.influenceRadius,
        killRadius: mesh.killRadius,
        maxIterations: mesh.maxGrowthIterations,
        capillaryDepthThreshold: mesh.capillaryDepthThreshold,
        murrayExponent: mesh.murrayExponent,
        rootRadius: mesh.rootRadius,
        minRadius: mesh.minRadius,
        anastomosisRatio: mesh.anastomosisRatio,
        curveSamples: mesh.curveSamples,
        curveBow: mesh.curveBow,
        seed: mesh.seed ^ snapshot.stage,
      });
      this.bifurcations = this.computeBifurcations(this.graph);
      this.fingerprint = fingerprint;
      this.edgeDensityCache = new Array(this.graph.edges.length);
      this.nodeDensityCache = new Array(this.graph.nodes.length);
    }
    this.frameCount += 1;

    const breath = computeGlobalBreath(this.elapsed, mesh.breathRateHz);
    this.redraw(breath, sample, snapshot);
  }

  private computeCoverageRadius(snapshot: WorldRenderSnapshot): number {
    const halfWidth = snapshot.bounds.width * 0.5;
    const halfHeight = snapshot.bounds.height * 0.5;
    const mul = tuning.background.veinMesh.coverageMultiplier;
    return Math.max(halfWidth, halfHeight) * mul;
  }

  /** Pre-computes a "this node has ≥ 2 children" table so bifurcation dots can be drawn cheaply. */
  private computeBifurcations(graph: VeinGraph): boolean[] {
    const childCount = new Array<number>(graph.nodes.length).fill(0);
    for (const node of graph.nodes) {
      if (node.parent >= 0) childCount[node.parent] = (childCount[node.parent] ?? 0) + 1;
    }
    return childCount.map((c) => c >= 2);
  }

  private redraw(
    breath: number,
    sample: BackdropReactivitySample,
    snapshot: WorldRenderSnapshot,
  ): void {
    const graphics = this.graphics;
    graphics.clear();
    if (!this.graph) return;

    const mesh = tuning.background.veinMesh;
    const bands = mesh.strokeBands;
    const { edges, nodes } = this.graph;
    const center = { x: snapshot.bounds.centerX, y: snapshot.bounds.centerY };

    const refreshDensity = this.frameCount % DENSITY_REFRESH_INTERVAL === 0;

    for (let edgeIdx = 0; edgeIdx < edges.length; edgeIdx += 1) {
      const edge = edges[edgeIdx]!;
      const profile = edge.kind === 'capillary' ? mesh.capillary : mesh.main;
      let density = this.edgeDensityCache[edgeIdx];
      if (!density || refreshDensity) {
        const midPoint = edge.curve.points[Math.floor(edge.curve.points.length / 2)]!;
        density = sampleBackdropDensity(
          { x: center.x + midPoint.x, y: center.y + midPoint.y },
          sample,
          snapshot.hexSize,
        );
        this.edgeDensityCache[edgeIdx] = density;
      }
      let alpha = computeEdgeAlpha(
        edge,
        breath,
        density.bio,
        density.corruption,
        profile.alpha,
      );
      alpha *= this.slowPulseFactor();
      if (alpha <= 0.01) continue;

      this.drawCurve(edge, profile, alpha, center, bands);
    }

    // Draw soft bifurcation dots. These read as nodal swellings where branches fork —
    // a subtle cue that the mesh is a real tree, not just a web of lines.
    for (let idx = 0; idx < nodes.length; idx += 1) {
      if (!this.bifurcations[idx]) continue;
      const node = nodes[idx]!;
      if (node.parent < 0) continue; // Skip roots; they don't need a dot.
      const profile = node.depth >= mesh.capillaryDepthThreshold ? mesh.capillary : mesh.main;
      let density = this.nodeDensityCache[idx];
      if (!density || refreshDensity) {
        density = sampleBackdropDensity(
          { x: center.x + node.x, y: center.y + node.y },
          sample,
          snapshot.hexSize,
        );
        this.nodeDensityCache[idx] = density;
      }
      const pseudoEdge: VeinEdge = {
        a: node.parent,
        b: idx,
        kind: node.depth >= mesh.capillaryDepthThreshold ? 'capillary' : 'main',
        jitter: node.hash,
        curve: { points: [], widths: [] },
      };
      let alpha = computeEdgeAlpha(
        pseudoEdge,
        breath,
        density.bio,
        density.corruption,
        profile.alpha,
      );
      alpha *= this.slowPulseFactor();
      if (alpha <= 0.01) continue;
      const radius = Math.max(
        bands.minStrokePixels,
        node.radius * mesh.bifurcationDotRadiusFactor,
      );
      const swayed = this.swayLocalPoint(node.x, node.y, node.hash, idx);
      graphics.fillStyle(profile.coreColor, alpha * mesh.bifurcationDotAlphaFactor);
      graphics.fillCircle(center.x + swayed.x, center.y + swayed.y, radius);
    }
  }

  /**
   * Strokes one branch as three passes (halo/mid/core), each iterating through consecutive
   * polyline sample pairs so that line widths change along the curve (taper). This is what
   * lifts the look from "uniform line" to "tapering vessel".
   */
  private drawCurve(
    edge: VeinEdge,
    profile: VeinProfile,
    alpha: number,
    center: { x: number; y: number },
    bands: {
      haloRadiusFactor: number;
      midRadiusFactor: number;
      coreRadiusFactor: number;
      haloAlphaFactor: number;
      midAlphaFactor: number;
      minStrokePixels: number;
    },
  ): void {
    const graphics = this.graphics;
    const { points, widths } = edge.curve;
    if (points.length < 2) return;

    // Perf: collapsed from three passes (halo/mid/core) to two (halo/core). Each pass
    // issues `points.length - 1` lineStyle+lineBetween pairs per edge, so dropping the
    // mid pass cuts this renderer's draw-call count by ~33%. The core alpha is bumped
    // slightly and the core width interpolated up toward the old mid-band radius, so
    // the visible silhouette is preserved.
    const edgeSeed = edge.jitter;
    this.strokeBand(
      points,
      widths,
      profile.haloColor,
      alpha * bands.haloAlphaFactor,
      bands.haloRadiusFactor,
      bands.minStrokePixels,
      center,
      edgeSeed,
    );
    const blendedCoreRadius = (bands.coreRadiusFactor + bands.midRadiusFactor * 0.35);
    const blendedCoreAlpha = Math.min(1, alpha * (1 + bands.midAlphaFactor * 0.35));
    this.strokeBand(
      points,
      widths,
      profile.coreColor,
      blendedCoreAlpha,
      blendedCoreRadius,
      bands.minStrokePixels,
      center,
      edgeSeed,
    );
  }

  /** Occasional gentle brightening / dimming on a multi-second cadence (independent of breath). */
  private slowPulseFactor(): number {
    const m = tuning.background.veinMesh;
    const mix = m.slowPulseMix;
    if (mix <= 0) {
      return 1;
    }
    const wave = 0.5 + 0.5 * Math.sin(this.elapsed * Math.PI * 2 * m.slowPulseHz);
    return 1 - mix + mix * wave;
  }

  /**
   * Small world-space offset for a polyline sample so veins drift slowly without rebuilding the mesh.
   */
  private swayLocalPoint(localX: number, localY: number, seed: number, pointIndex: number): {
    x: number;
    y: number;
  } {
    const m = tuning.background.veinMesh;
    const amp = m.swayAmplitude;
    if (amp <= 1e-6) {
      return { x: localX, y: localY };
    }
    const p = seed * 19.231 + pointIndex * 3.127 + localX * 0.0007 + localY * 0.0006;
    const spatial = (localX + localY) * m.swaySpatialFreq;
    const e1 = this.elapsed * Math.PI * 2 * m.swayDriftHz;
    const e2 = this.elapsed * Math.PI * 2 * m.swayWobbleHz;
    const wx =
      Math.sin(e1 + p) * 0.55 +
      Math.sin(e2 + p * 1.7 + spatial) * 0.35 +
      Math.sin(e1 * 0.38 + p * 0.4) * 0.1;
    const wy =
      Math.cos(e1 * 0.92 + p * 1.3) * 0.55 +
      Math.cos(e2 * 1.07 + spatial + p) * 0.35 +
      Math.sin(e2 * 0.41 + p) * 0.1;
    return {
      x: localX + wx * amp,
      y: localY + wy * amp,
    };
  }

  private strokeBand(
    points: Array<{ x: number; y: number }>,
    widths: number[],
    color: number,
    alpha: number,
    radiusFactor: number,
    minPx: number,
    center: { x: number; y: number },
    edgeSeed: number,
  ): void {
    const graphics = this.graphics;
    if (alpha <= 0.01) return;
    for (let i = 1; i < points.length; i += 1) {
      const prev = this.swayLocalPoint(points[i - 1]!.x, points[i - 1]!.y, edgeSeed, i - 1);
      const curr = this.swayLocalPoint(points[i]!.x, points[i]!.y, edgeSeed, i);
      const wPrev = widths[i - 1]!;
      const wCurr = widths[i]!;
      const avgWidth = Math.max(minPx, ((wPrev + wCurr) * 0.5) * radiusFactor);
      graphics.lineStyle(avgWidth, color, alpha);
      graphics.lineBetween(
        center.x + prev.x,
        center.y + prev.y,
        center.x + curr.x,
        center.y + curr.y,
      );
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}

export interface VeinProfile {
  haloColor: number;
  midColor: number;
  coreColor: number;
  alpha: {
    baseAlpha: number;
    breathAmplitude: number;
    bioBoost: number;
    corruptionBoost: number;
    jitterAmplitude: number;
  };
}

// Keep `VeinNode` import tree-shake-friendly and surface it for external adapters if needed.
export type { VeinEdge, VeinNode };
