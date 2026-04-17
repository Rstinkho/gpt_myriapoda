import type { WorldRenderSnapshot } from '@/game/types';

/**
 * Pure math for the procedural vascular network drawn in the background.
 *
 * Uses a Space Colonization Algorithm (Runions et al., "Modeling Trees with a Space
 * Colonization Algorithm", 2007) to grow a biologically plausible branching tree,
 * then assigns per-branch radii via Murray's law (r_parent^3 ≈ Σ r_child^3), adds a
 * few anastomoses (capillary-to-capillary loops), and pre-samples each branch as a
 * short polyline along a quadratic Bézier so the renderer can draw organic curves
 * with tapering widths instead of toddler-straight line segments.
 *
 * Pure, testable. No Phaser imports.
 */

export type VeinKind = 'main' | 'capillary';

export interface VeinNode {
  x: number;
  y: number;
  /** Index of the parent node inside the graph's `nodes` array (-1 for tree roots). */
  parent: number;
  /** Distance (in edges) from the nearest root. 0 for roots. */
  depth: number;
  /** Murray-law derived radius (world pixels). Tapers toward leaves. */
  radius: number;
  /** Deterministic per-node variance seed in [0,1). Stable across frames. */
  hash: number;
}

export interface VeinPolyline {
  /** Pre-computed polyline samples along the branch (parent → child). World-relative coords. */
  points: Array<{ x: number; y: number }>;
  /** Matching widths per sample: widths[i] corresponds to points[i]. */
  widths: number[];
}

export interface VeinEdge {
  /** Index into `nodes` — the branch's parent endpoint (thick end). */
  a: number;
  /** Index into `nodes` — the branch's child endpoint (thin end). */
  b: number;
  kind: VeinKind;
  /** Deterministic per-edge variance in [0,1). Used for alpha jitter so the mesh isn't uniform. */
  jitter: number;
  /** Pre-sampled curved geometry of the branch, so the renderer just iterates. */
  curve: VeinPolyline;
  /**
   * Only set for anastomosis loops: a closing chord between two capillary tips.
   * Loops don't have a parent-child relationship in the tree; they're rendered as
   * capillaries and skip hierarchy logic.
   */
  loop?: true;
}

export interface VeinGraph {
  nodes: VeinNode[];
  edges: VeinEdge[];
  /** Bounding radius used at generation time (handy for re-gen decisions). */
  coverageRadius: number;
}

export interface VeinGraphOptions {
  /** Half the world-space span to scatter growth across (centered on 0,0). */
  coverageRadius: number;
  /** Number of trunk origins (source hearts) from which trees grow. 2-4 reads as "one organism". */
  rootCount: number;
  /** Initial attractor target count before growth begins. Controls overall vein density. */
  attractorCount: number;
  /** Growth segment length in world pixels. Smaller = more detail, slower generation. */
  growthStep: number;
  /** Attractors within this radius of a tip influence its growth direction. */
  influenceRadius: number;
  /** Attractors within this radius of a tip are consumed (removed). */
  killRadius: number;
  /** Max SCA iterations (safety bound). Real growth usually terminates much earlier. */
  maxIterations: number;
  /** Depth at which branches transition from "main" (cyan trunk) to "capillary" (red leaves). */
  capillaryDepthThreshold: number;
  /** Murray's law exponent. Classic biology value is 3; some tissues observe 2.5-2.7. */
  murrayExponent: number;
  /** Radius assigned to root nodes (world pixels). Everything tapers from this. */
  rootRadius: number;
  /** Minimum radius any leaf can have. Prevents zero-width strokes. */
  minRadius: number;
  /** Fraction of capillary leaves that get an anastomosis loop to a nearby tip [0..1]. */
  anastomosisRatio: number;
  /** Number of polyline samples per branch Bézier curve. 6-10 reads as smooth. */
  curveSamples: number;
  /** Max perpendicular bow of a branch Bézier as a fraction of segment length. */
  curveBow: number;
  /** Seed for deterministic growth. */
  seed: number;
}

/** Mulberry32 — small, fast, deterministic. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface Vec2 {
  x: number;
  y: number;
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normalizeOr(v: Vec2, fallback: Vec2): Vec2 {
  const len = length(v);
  if (len < 1e-6) return fallback;
  return { x: v.x / len, y: v.y / len };
}

function rotate(v: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * Samples attractor points across the coverage area with a mild radial bias so the mesh
 * thins at the edges (real tissue doesn't have a hard rectangular border).
 */
function scatterAttractors(
  random: () => number,
  coverageRadius: number,
  count: number,
): Vec2[] {
  const attractors: Vec2[] = [];
  for (let i = 0; i < count; i += 1) {
    // Reject-sample a point inside a disc, then scale so inner cells are denser than edge cells.
    let x = 0;
    let y = 0;
    while (true) {
      x = (random() - 0.5) * 2;
      y = (random() - 0.5) * 2;
      const r2 = x * x + y * y;
      if (r2 <= 1) {
        const bias = Math.pow(r2, 0.22);
        x *= bias;
        y *= bias;
        break;
      }
    }
    attractors.push({ x: x * coverageRadius, y: y * coverageRadius });
  }
  return attractors;
}

/**
 * Positions root "hearts" symmetrically so trees grow from distinct centers.
 * Deterministic given the seed so re-runs are identical.
 */
function placeRoots(random: () => number, coverageRadius: number, count: number): Vec2[] {
  const roots: Vec2[] = [];
  const baseAngle = random() * Math.PI * 2;
  const orbit = coverageRadius * 0.22;
  for (let i = 0; i < count; i += 1) {
    const angle = baseAngle + (i / count) * Math.PI * 2;
    roots.push({ x: Math.cos(angle) * orbit, y: Math.sin(angle) * orbit });
  }
  return roots;
}

interface GrowthNode {
  x: number;
  y: number;
  parent: number;
  depth: number;
  /** Set true once the node is no longer a tip (its children have been spawned). */
  settled: boolean;
  /** Deterministic hash seed (pulled from the shared RNG at creation). */
  hash: number;
}

/**
 * Grows a branching tree using the space-colonization algorithm. Returns the raw
 * parent-child forest; radii, curves, and capillary classification happen later.
 */
function growTrees(
  random: () => number,
  roots: Vec2[],
  attractors: Vec2[],
  options: VeinGraphOptions,
): GrowthNode[] {
  const nodes: GrowthNode[] = roots.map((root) => ({
    x: root.x,
    y: root.y,
    parent: -1,
    depth: 0,
    settled: false,
    hash: random(),
  }));

  const tips: number[] = nodes.map((_, idx) => idx);
  const activeAttractors = attractors.slice();
  const influenceR2 = options.influenceRadius * options.influenceRadius;
  const killR2 = options.killRadius * options.killRadius;

  for (let iter = 0; iter < options.maxIterations; iter += 1) {
    if (activeAttractors.length === 0 || tips.length === 0) break;

    // For each live attractor, find the closest tip. Only that tip is pulled toward it.
    const tipInfluence = new Map<number, Vec2>();
    const tipCount = new Map<number, number>();
    for (const attractor of activeAttractors) {
      let bestTip = -1;
      let bestD2 = influenceR2;
      for (const tipIdx of tips) {
        const tip = nodes[tipIdx]!;
        const dx = attractor.x - tip.x;
        const dy = attractor.y - tip.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestTip = tipIdx;
        }
      }
      if (bestTip === -1) continue;
      const tip = nodes[bestTip]!;
      const dir = normalizeOr(sub(attractor, tip), { x: 0, y: 0 });
      const accumulated = tipInfluence.get(bestTip);
      if (accumulated) {
        accumulated.x += dir.x;
        accumulated.y += dir.y;
      } else {
        tipInfluence.set(bestTip, { x: dir.x, y: dir.y });
      }
      tipCount.set(bestTip, (tipCount.get(bestTip) ?? 0) + 1);
    }

    if (tipInfluence.size === 0) break;

    // Each pulled tip spawns a single child node a `growthStep` along its mean influence direction.
    // Persistence: blend with the previous segment direction so branches don't zig-zag on every step.
    const newTips: number[] = [];
    for (const tipIdx of tips) {
      const influence = tipInfluence.get(tipIdx);
      if (!influence) continue;
      const tip = nodes[tipIdx]!;
      const meanDir = normalizeOr(influence, { x: 1, y: 0 });
      const parentDir =
        tip.parent >= 0
          ? normalizeOr(sub(tip, nodes[tip.parent]!), meanDir)
          : meanDir;
      const persistence = 0.45;
      const blended = normalizeOr(
        {
          x: meanDir.x * (1 - persistence) + parentDir.x * persistence,
          y: meanDir.y * (1 - persistence) + parentDir.y * persistence,
        },
        meanDir,
      );

      const wiggle = (random() - 0.5) * 0.35;
      const stepDir = rotate(blended, wiggle);
      const child: GrowthNode = {
        x: tip.x + stepDir.x * options.growthStep,
        y: tip.y + stepDir.y * options.growthStep,
        parent: tipIdx,
        depth: tip.depth + 1,
        settled: false,
        hash: random(),
      };
      nodes.push(child);
      newTips.push(nodes.length - 1);

      // Detect a fork: if two or more attractors pulled this tip strongly in *different* directions,
      // spawn a second child offset by the other dominant direction. Biologically: bifurcation.
      const pullCount = tipCount.get(tipIdx) ?? 0;
      if (pullCount >= 3 && random() < 0.25) {
        const forkAngle = (random() < 0.5 ? 1 : -1) * (0.55 + random() * 0.35);
        const forkDir = rotate(blended, forkAngle);
        const sibling: GrowthNode = {
          x: tip.x + forkDir.x * options.growthStep * 0.9,
          y: tip.y + forkDir.y * options.growthStep * 0.9,
          parent: tipIdx,
          depth: tip.depth + 1,
          settled: false,
          hash: random(),
        };
        nodes.push(sibling);
        newTips.push(nodes.length - 1);
      }
    }

    // Settle consumed tips (they are no longer active).
    for (const tipIdx of tipInfluence.keys()) {
      nodes[tipIdx]!.settled = true;
    }

    // Preserve tips that didn't get influence this frame (they may pull later from other attractors)
    // and append the freshly spawned children as new tips.
    tips.length = 0;
    for (const [idx, node] of nodes.entries()) {
      if (!node.settled) tips.push(idx);
    }
    for (const idx of newTips) tips.push(idx);

    // Kill attractors near any node (not just tips). This is the classic SCA termination:
    // a region is "fed" once any branch reaches it.
    for (let ai = activeAttractors.length - 1; ai >= 0; ai -= 1) {
      const attractor = activeAttractors[ai]!;
      for (const node of nodes) {
        const dx = attractor.x - node.x;
        const dy = attractor.y - node.y;
        if (dx * dx + dy * dy <= killR2) {
          activeAttractors.splice(ai, 1);
          break;
        }
      }
    }
  }

  return nodes;
}

/**
 * Assigns each node a Murray-law radius: sum of child radii cubed equals parent radius cubed.
 * Walks the forest bottom-up (leaves first) so parents can aggregate children.
 */
function assignRadii(
  nodes: GrowthNode[],
  options: VeinGraphOptions,
): number[] {
  const childrenOf: number[][] = nodes.map(() => []);
  for (const [idx, node] of nodes.entries()) {
    if (node.parent >= 0) childrenOf[node.parent]!.push(idx);
  }
  const radii = new Array<number>(nodes.length).fill(options.minRadius);

  // Depth-first traversal from each root, collecting radii bottom-up.
  const stack: Array<{ idx: number; phase: 'enter' | 'exit' }> = [];
  for (const [idx, node] of nodes.entries()) {
    if (node.parent === -1) stack.push({ idx, phase: 'enter' });
  }

  while (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    if (top.phase === 'enter') {
      top.phase = 'exit';
      for (const child of childrenOf[top.idx]!) {
        stack.push({ idx: child, phase: 'enter' });
      }
    } else {
      stack.pop();
      const children = childrenOf[top.idx]!;
      if (children.length === 0) {
        radii[top.idx] = options.minRadius;
      } else {
        let sumCubes = 0;
        for (const childIdx of children) {
          const r = radii[childIdx]!;
          sumCubes += Math.pow(r, options.murrayExponent);
        }
        // Parent carries all children's flow: r_parent = (Σ r_child^n)^(1/n).
        const r = Math.pow(sumCubes, 1 / options.murrayExponent);
        radii[top.idx] = r;
      }
    }
  }

  // Normalize so root radii match `rootRadius`, then clamp everything else.
  let maxRoot = 0;
  for (const [idx, node] of nodes.entries()) {
    if (node.parent === -1) maxRoot = Math.max(maxRoot, radii[idx]!);
  }
  if (maxRoot > 0) {
    const scale = options.rootRadius / maxRoot;
    for (let i = 0; i < radii.length; i += 1) {
      radii[i] = Math.max(options.minRadius, radii[i]! * scale);
    }
  }
  return radii;
}

/**
 * Builds a quadratic-Bézier polyline along a parent→child segment. The control point is
 * offset perpendicular to the segment by a deterministic bow amount, so the branch curves
 * organically instead of being a straight line.
 */
function buildBezierPolyline(
  parent: { x: number; y: number; radius: number },
  child: { x: number; y: number; radius: number; hash: number },
  samples: number,
  bowFactor: number,
): VeinPolyline {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const segLen = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy;
  const perpY = dx;
  const signedBow = ((child.hash - 0.5) * 2) * bowFactor * segLen;
  const normLen = segLen > 1e-6 ? 1 / segLen : 0;
  const controlX = (parent.x + child.x) * 0.5 + perpX * normLen * signedBow;
  const controlY = (parent.y + child.y) * 0.5 + perpY * normLen * signedBow;

  const points: Array<{ x: number; y: number }> = [];
  const widths: number[] = [];
  const steps = Math.max(2, samples);
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const one = 1 - t;
    const x = one * one * parent.x + 2 * one * t * controlX + t * t * child.x;
    const y = one * one * parent.y + 2 * one * t * controlY + t * t * child.y;
    const width = parent.radius * one + child.radius * t;
    points.push({ x, y });
    widths.push(width);
  }
  return { points, widths };
}

/** Classifies each edge based on depth: deep (leaf-side) branches become capillaries. */
function classifyEdge(depth: number, threshold: number): VeinKind {
  return depth >= threshold ? 'capillary' : 'main';
}

/** Finds capillary tips (leaves) to pair into anastomosis loops with nearby other tips. */
function buildAnastomoses(
  random: () => number,
  nodes: VeinNode[],
  childrenOf: number[][],
  radii: number[],
  options: VeinGraphOptions,
): VeinEdge[] {
  const loops: VeinEdge[] = [];
  const capillaryTips: number[] = [];
  for (const [idx, node] of nodes.entries()) {
    if (childrenOf[idx]!.length === 0 && node.depth >= options.capillaryDepthThreshold) {
      capillaryTips.push(idx);
    }
  }
  if (capillaryTips.length < 4) return loops;

  const paired = new Set<number>();
  const maxLoopDistance = options.growthStep * 2.2;
  const maxLoopDistanceSq = maxLoopDistance * maxLoopDistance;

  for (const tip of capillaryTips) {
    if (paired.has(tip)) continue;
    if (random() >= options.anastomosisRatio) continue;
    const a = nodes[tip]!;
    let bestOther = -1;
    let bestD2 = maxLoopDistanceSq;
    for (const other of capillaryTips) {
      if (other === tip) continue;
      if (paired.has(other)) continue;
      // Skip siblings (same parent). Real anastomoses connect unrelated capillary fields.
      if (nodes[other]!.parent === a.parent) continue;
      const dx = nodes[other]!.x - a.x;
      const dy = nodes[other]!.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestOther = other;
      }
    }
    if (bestOther === -1) continue;
    paired.add(tip);
    paired.add(bestOther);

    const parent = { x: a.x, y: a.y, radius: radii[tip]! };
    const child = {
      x: nodes[bestOther]!.x,
      y: nodes[bestOther]!.y,
      radius: radii[bestOther]!,
      hash: nodes[bestOther]!.hash,
    };
    const curve = buildBezierPolyline(parent, child, options.curveSamples, options.curveBow * 1.4);
    loops.push({
      a: tip,
      b: bestOther,
      kind: 'capillary',
      jitter: random(),
      curve,
      loop: true,
    });
  }
  return loops;
}

export function buildVeinGraph(options: VeinGraphOptions): VeinGraph {
  const random = createSeededRandom(options.seed);
  const roots = placeRoots(random, options.coverageRadius, Math.max(1, options.rootCount));
  const attractors = scatterAttractors(
    random,
    options.coverageRadius,
    Math.max(0, options.attractorCount),
  );
  const growthNodes = growTrees(random, roots, attractors, options);
  const radii = assignRadii(growthNodes, options);

  const nodes: VeinNode[] = growthNodes.map((node, idx) => ({
    x: node.x,
    y: node.y,
    parent: node.parent,
    depth: node.depth,
    radius: radii[idx]!,
    hash: node.hash,
  }));

  const childrenOf: number[][] = nodes.map(() => []);
  for (const [idx, node] of nodes.entries()) {
    if (node.parent >= 0) childrenOf[node.parent]!.push(idx);
  }

  const edges: VeinEdge[] = [];
  for (const [idx, node] of nodes.entries()) {
    if (node.parent < 0) continue;
    const parent = nodes[node.parent]!;
    const curve = buildBezierPolyline(
      { x: parent.x, y: parent.y, radius: parent.radius },
      { x: node.x, y: node.y, radius: node.radius, hash: node.hash },
      options.curveSamples,
      options.curveBow,
    );
    edges.push({
      a: node.parent,
      b: idx,
      kind: classifyEdge(node.depth, options.capillaryDepthThreshold),
      jitter: node.hash,
      curve,
    });
  }

  const loops = buildAnastomoses(random, nodes, childrenOf, radii, options);
  for (const loop of loops) edges.push(loop);

  return { nodes, edges, coverageRadius: options.coverageRadius };
}

/**
 * A single global "breath" value in [0,1] shared by every vein, so the whole mesh feels like
 * one organism inhaling/exhaling rather than a crowd of independent tiles.
 *
 * `breathRateHz` is cycles per second. ~0.2 Hz ≈ 5 s per breath.
 */
export function computeGlobalBreath(elapsedSeconds: number, breathRateHz: number): number {
  return 0.5 + 0.5 * Math.sin(elapsedSeconds * Math.PI * 2 * breathRateHz);
}

/**
 * Returns an alpha multiplier for a given vein in [0,1] based on:
 * - the shared global breath (primary motion)
 * - a small deterministic per-edge offset so the mesh has texture without breaking unity
 * - the live bio/corruption density sampled at the edge midpoint.
 *
 * Keeps motion explicitly calm: breath amplitude is bounded and dominated by the base alpha.
 */
export function computeEdgeAlpha(
  edge: VeinEdge,
  globalBreath: number,
  densityBio: number,
  densityCorruption: number,
  config: {
    baseAlpha: number;
    breathAmplitude: number;
    bioBoost: number;
    corruptionBoost: number;
    jitterAmplitude: number;
  },
): number {
  const perEdgeOffset = (edge.jitter - 0.5) * 2 * config.jitterAmplitude;
  const breathTerm = (globalBreath - 0.5) * 2 * config.breathAmplitude;
  const reactivity = densityBio * config.bioBoost + densityCorruption * config.corruptionBoost;
  const alpha = config.baseAlpha + breathTerm + perEdgeOffset + reactivity;
  return alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
}

/**
 * Decides if a regenerate of the mesh is required, comparing against a fingerprint of the
 * snapshot state that affects coverage. Keeps mesh geometry stable across normal frames.
 */
export function veinGraphFingerprint(
  snapshot: Pick<WorldRenderSnapshot, 'hexSize' | 'stage'>,
  coverageRadius: number,
): string {
  return `${snapshot.stage}:${snapshot.hexSize.toFixed(2)}:${Math.round(coverageRadius)}`;
}
