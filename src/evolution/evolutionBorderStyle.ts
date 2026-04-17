import type * as Phaser from 'phaser';

/**
 * Hand-drawn jittered rounded-rect border helper for the evolution UI.
 *
 * The outline is sampled at ~48 points around a rounded rectangle. Each sample
 * is displaced perpendicular to its tangent by a small deterministic amount
 * derived from a per-card `seed`, so the jitter is stable across frames and
 * distinct per card. The result reads as a hand-drawn "organic" border that
 * fits the biological theme of the game.
 */

export interface JitteredRectOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly seed: number;
  /** Peak perpendicular jitter in pixels. Defaults to 0.9. */
  readonly jitter?: number;
  /** Sample count around the perimeter. Defaults to 48. */
  readonly samples?: number;
}

const DEFAULT_JITTER = 0.9;
const DEFAULT_SAMPLES = 48;

/**
 * Deterministic pseudo-random in [-1, 1] for the given integer `i` and `seed`.
 * Uses a small hash on top of trig so the sequence reads as organic but is
 * perfectly reproducible.
 */
function jitterNoise(seed: number, i: number): number {
  const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Project a parameter t in [0, 1] (fraction of perimeter) to an (x,y) on a
 * rounded rectangle, along with the outward normal (for jittering perpendicular
 * to the tangent). Uses the analytical decomposition of the perimeter into 4
 * straight sides + 4 corner quarter-arcs.
 */
function rectParamToPoint(
  t: number,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): { px: number; py: number; nx: number; ny: number } {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  const sx = width - 2 * r;
  const sy = height - 2 * r;
  const arc = (Math.PI * r) / 2;
  const perim = 2 * (sx + sy) + 4 * arc;
  const u = ((t % 1) + 1) % 1;
  let d = u * perim;

  // Order around the perimeter starting at the top-left corner end of the top side,
  // going clockwise: top side -> top-right arc -> right side -> bottom-right arc ->
  // bottom side -> bottom-left arc -> left side -> top-left arc.
  if (d < sx) {
    return { px: x + r + d, py: y, nx: 0, ny: -1 };
  }
  d -= sx;
  if (d < arc) {
    const theta = d / r - Math.PI / 2;
    const cx = x + width - r;
    const cy = y + r;
    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;
    return { px, py, nx: Math.cos(theta), ny: Math.sin(theta) };
  }
  d -= arc;
  if (d < sy) {
    return { px: x + width, py: y + r + d, nx: 1, ny: 0 };
  }
  d -= sy;
  if (d < arc) {
    const theta = d / r;
    const cx = x + width - r;
    const cy = y + height - r;
    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;
    return { px, py, nx: Math.cos(theta), ny: Math.sin(theta) };
  }
  d -= arc;
  if (d < sx) {
    return { px: x + width - r - d, py: y + height, nx: 0, ny: 1 };
  }
  d -= sx;
  if (d < arc) {
    const theta = d / r + Math.PI / 2;
    const cx = x + r;
    const cy = y + height - r;
    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;
    return { px, py, nx: Math.cos(theta), ny: Math.sin(theta) };
  }
  d -= arc;
  if (d < sy) {
    return { px: x, py: y + height - r - d, nx: -1, ny: 0 };
  }
  d -= sy;
  const theta = d / r + Math.PI;
  const cx = x + r;
  const cy = y + r;
  const px = cx + Math.cos(theta) * r;
  const py = cy + Math.sin(theta) * r;
  return { px, py, nx: Math.cos(theta), ny: Math.sin(theta) };
}

export interface JitterPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Builds the closed polyline of a jittered rounded rect. Exposed for tests and
 * for callers that want to both fill and stroke the same shape consistently.
 *
 * Returns plain `{x, y}` objects so the function can be unit-tested without a
 * Phaser runtime. `Phaser.GameObjects.Graphics.strokePoints` / `fillPoints`
 * accept any iterable of `{x, y}` objects, so the draw helpers can consume
 * these directly.
 */
export function buildJitteredRoundedRectPolyline(
  options: JitteredRectOptions,
): JitterPoint[] {
  const jitter = options.jitter ?? DEFAULT_JITTER;
  const samples = Math.max(12, options.samples ?? DEFAULT_SAMPLES);
  const pts: JitterPoint[] = new Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = i / samples;
    const { px, py, nx, ny } = rectParamToPoint(
      t,
      options.x,
      options.y,
      options.width,
      options.height,
      options.radius,
    );
    const n = jitterNoise(options.seed, i) * jitter;
    pts[i] = { x: px + nx * n, y: py + ny * n };
  }
  return pts;
}

/**
 * Strokes a deterministic jittered rounded rectangle on the given graphics object.
 */
export function drawJitteredRoundedRect(
  graphics: Phaser.GameObjects.Graphics,
  options: JitteredRectOptions & {
    readonly strokeWidth: number;
    readonly color: number;
    readonly alpha: number;
  },
): void {
  const pts = buildJitteredRoundedRectPolyline(options);
  graphics.lineStyle(options.strokeWidth, options.color, options.alpha);
  // Graphics.strokePoints is typed as Vector2[] but works with any {x,y} array
  // at runtime. We keep the points as plain objects for test-friendliness.
  graphics.strokePoints(pts as unknown as Phaser.Math.Vector2[], true, true);
}

/**
 * Fills a deterministic jittered rounded rectangle on the given graphics object.
 * Useful for giving the fill the same irregular outline as the stroke.
 */
export function drawJitteredRoundedRectFill(
  graphics: Phaser.GameObjects.Graphics,
  options: JitteredRectOptions & {
    readonly color: number;
    readonly alpha: number;
  },
): void {
  const pts = buildJitteredRoundedRectPolyline(options);
  graphics.fillStyle(options.color, options.alpha);
  graphics.fillPoints(pts as unknown as Phaser.Math.Vector2[], true);
}

/**
 * Derives a stable integer seed from an arbitrary string (e.g. a card id) so
 * different cards get different but stable jitter patterns.
 */
export function deriveJitterSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100000;
}
