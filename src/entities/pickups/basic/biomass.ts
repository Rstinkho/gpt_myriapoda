import type Phaser from 'phaser';
import { textureKeys } from '@/game/assets';
import type { PickupPalette } from '@/game/types';
import type { PickupDefinition } from '@/entities/pickups/PickupRegistry';
import {
  drawPickupPolygon,
  projectPickupPoints,
  type PickupParticleRenderOptions,
} from '@/entities/pickups/PickupVisuals';
import { rotateVector } from '@/utils/math';

const biomassPalette: PickupPalette = {
  base: 0x6f8477,
  shadow: 0x314239,
  highlight: 0xcbd6cc,
  detail: 0x91a697,
  glow: 0xa6c1af,
};

const membraneOutline = [
  { x: -1.02, y: -0.16 },
  { x: -0.82, y: -0.74 },
  { x: -0.24, y: -0.96 },
  { x: 0.34, y: -0.84 },
  { x: 0.88, y: -0.4 },
  { x: 0.96, y: 0.18 },
  { x: 0.58, y: 0.82 },
  { x: -0.04, y: 1.02 },
  { x: -0.72, y: 0.7 },
  { x: -1.02, y: 0.16 },
];

const lobes = [
  { x: -0.46, y: -0.18, radius: 0.62 },
  { x: 0.2, y: -0.34, radius: 0.54 },
  { x: 0.42, y: 0.28, radius: 0.58 },
  { x: -0.2, y: 0.34, radius: 0.66 },
];

function drawBiomass(
  graphics: Phaser.GameObjects.Graphics,
  options: PickupParticleRenderOptions,
): void {
  const alpha = options.alpha ?? 1;
  const shadowRadius = options.radius * 1.08;

  drawPickupPolygon(graphics, membraneOutline, {
    x: options.x,
    y: options.y,
    radius: shadowRadius,
    angle: options.angle,
    fill: biomassPalette.shadow,
    fillAlpha: 0.18 * alpha,
  });

  for (const lobe of lobes) {
    const offset = rotateVector(
      lobe.x * options.radius,
      lobe.y * options.radius,
      options.angle,
    );
    graphics.fillStyle(biomassPalette.base, 0.94 * alpha);
    graphics.fillCircle(
      options.x + offset.x,
      options.y + offset.y,
      options.radius * lobe.radius,
    );
  }

  drawPickupPolygon(graphics, membraneOutline, {
    x: options.x,
    y: options.y,
    radius: options.radius,
    angle: options.angle,
    fill: biomassPalette.base,
    fillAlpha: 0.24 * alpha,
    stroke: biomassPalette.shadow,
    strokeAlpha: 0.8 * alpha,
    lineWidth: Math.max(0.8, options.radius * 0.14),
  });

  const highlightPoints = projectPickupPoints(
    [
      { x: -0.26, y: -0.22 },
      { x: 0.26, y: -0.46 },
      { x: 0.34, y: 0.18 },
    ],
    options.x,
    options.y,
    options.radius,
    options.angle,
  );
  graphics.fillStyle(biomassPalette.highlight, 0.22 * alpha);
  graphics.fillCircle(highlightPoints[0].x, highlightPoints[0].y, options.radius * 0.18);
  graphics.fillCircle(highlightPoints[1].x, highlightPoints[1].y, options.radius * 0.14);
  graphics.fillCircle(highlightPoints[2].x, highlightPoints[2].y, options.radius * 0.12);

  const nucleus = rotateVector(options.radius * 0.12, options.radius * 0.16, options.angle);
  graphics.fillStyle(biomassPalette.detail, 0.42 * alpha);
  graphics.fillCircle(
    options.x + nucleus.x,
    options.y + nucleus.y,
    options.radius * 0.18,
  );
}

function buildBiomassTexture(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
): void {
  drawBiomass(graphics, {
    x: size * 0.5,
    y: size * 0.5,
    radius: size * 0.28,
    angle: -0.18,
    elapsedSeconds: 0,
    animationPhase: 0,
  });
}

export const biomassPickupDefinition: PickupDefinition = {
  tier: 'basic',
  resourceId: 'biomass',
  textureKey: textureKeys.pickups.biomass,
  digestValue: 2,
  radius: 12,
  palette: biomassPalette,
  isHarmful: false,
  buildTexture: buildBiomassTexture,
  drawParticle: drawBiomass,
};
