import type * as Phaser from 'phaser';
import { textureKeys } from '@/game/assets';
import type { PickupPalette } from '@/game/types';
import type { PickupDefinition } from '@/entities/pickups/PickupRegistry';
import {
  drawPickupLine,
  drawPickupPolygon,
  type PickupParticleRenderOptions,
} from '@/entities/pickups/PickupVisuals';

const tissuePalette: PickupPalette = {
  base: 0xe1c873,
  shadow: 0x7b6327,
  highlight: 0xfff3bf,
  detail: 0xc9974d,
  glow: 0xf6d985,
};

const tissueRibbon = [
  { x: -1.02, y: -0.16 },
  { x: -0.7, y: -0.56 },
  { x: -0.24, y: -0.18 },
  { x: 0.12, y: -0.52 },
  { x: 0.66, y: -0.14 },
  { x: 1.02, y: -0.28 },
  { x: 0.98, y: 0.28 },
  { x: 0.58, y: 0.56 },
  { x: 0.14, y: 0.14 },
  { x: -0.1, y: 0.48 },
  { x: -0.68, y: 0.2 },
  { x: -1.02, y: 0.36 },
];

const tissueHighlight = [
  { x: -0.92, y: -0.04 },
  { x: -0.64, y: -0.32 },
  { x: -0.18, y: -0.02 },
  { x: 0.1, y: -0.34 },
  { x: 0.54, y: -0.02 },
  { x: 0.9, y: -0.12 },
  { x: 0.78, y: 0.06 },
  { x: 0.4, y: 0.24 },
  { x: 0.14, y: -0.02 },
  { x: -0.08, y: 0.24 },
  { x: -0.56, y: 0.06 },
  { x: -0.9, y: 0.16 },
];

function drawTissue(
  graphics: Phaser.GameObjects.Graphics,
  options: PickupParticleRenderOptions,
): void {
  const alpha = options.alpha ?? 1;

  drawPickupPolygon(graphics, tissueRibbon, {
    x: options.x,
    y: options.y + options.radius * 0.1,
    radius: options.radius * 1.02,
    angle: options.angle,
    fill: tissuePalette.shadow,
    fillAlpha: 0.22 * alpha,
  });

  drawPickupPolygon(graphics, tissueRibbon, {
    x: options.x,
    y: options.y,
    radius: options.radius,
    angle: options.angle,
    fill: tissuePalette.base,
    fillAlpha: 0.95 * alpha,
    stroke: tissuePalette.shadow,
    strokeAlpha: 0.78 * alpha,
    lineWidth: Math.max(0.9, options.radius * 0.12),
  });

  drawPickupPolygon(graphics, tissueHighlight, {
    x: options.x,
    y: options.y - options.radius * 0.02,
    radius: options.radius * 0.92,
    angle: options.angle,
    fill: tissuePalette.highlight,
    fillAlpha: 0.18 * alpha,
  });

  drawPickupLine(
    graphics,
    options.x,
    options.y,
    options.radius,
    options.angle,
    { x: -0.56, y: -0.26 },
    { x: -0.28, y: 0.3 },
    tissuePalette.detail,
    0.54 * alpha,
    Math.max(0.5, options.radius * 0.08),
  );
  drawPickupLine(
    graphics,
    options.x,
    options.y,
    options.radius,
    options.angle,
    { x: -0.02, y: -0.36 },
    { x: 0.18, y: 0.24 },
    tissuePalette.detail,
    0.46 * alpha,
    Math.max(0.5, options.radius * 0.08),
  );
  drawPickupLine(
    graphics,
    options.x,
    options.y,
    options.radius,
    options.angle,
    { x: 0.42, y: -0.18 },
    { x: 0.58, y: 0.3 },
    tissuePalette.highlight,
    0.3 * alpha,
    Math.max(0.4, options.radius * 0.06),
  );
}

function buildTissueTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
): void {
  drawTissue(graphics, {
    x: size * 0.5,
    y: size * 0.5,
    radius: size * 0.3,
    angle: -0.22,
    elapsedSeconds: 0,
    animationPhase: 0,
  });
}

export const tissuePickupDefinition: PickupDefinition = {
  tier: 'advanced',
  resourceId: 'tissue',
  textureKey: textureKeys.pickups.tissue,
  digestValue: 3,
  radius: 12,
  palette: tissuePalette,
  isHarmful: false,
  buildTexture: buildTissueTexture,
  drawParticle: drawTissue,
};
