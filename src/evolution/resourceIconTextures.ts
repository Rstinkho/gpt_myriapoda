import * as Phaser from 'phaser';
import type { PickupResourceId } from '@/game/types';

/**
 * Procedural 32x32 resource cost icons for the evolution UI.
 *
 * Intentionally simpler than the gameplay pickup textures: the cost icons live at
 * ~12-16px display size next to numbers, so we prioritise a strong silhouette and
 * a palette derived from each resource's pickup visuals so the two feel related.
 */

const ICON_SIZE = 32;

interface ResourceIconPalette {
  readonly base: number;
  readonly shadow: number;
  readonly highlight: number;
  readonly glow: number;
}

const resourcePalettes: Record<PickupResourceId, ResourceIconPalette> = {
  biomass: {
    base: 0x6f8477,
    shadow: 0x2a3b32,
    highlight: 0xcbd6cc,
    glow: 0xa6c1af,
  },
  tissue: {
    base: 0xe1c873,
    shadow: 0x6b531c,
    highlight: 0xfff3bf,
    glow: 0xf6d985,
  },
  structuralCell: {
    base: 0x8e66d4,
    shadow: 0x3a1f58,
    highlight: 0xf0d9ff,
    glow: 0xe88dff,
  },
  parasite: {
    base: 0x8d8e62,
    shadow: 0x2e2f1a,
    highlight: 0xd8ddb5,
    glow: 0xb79a63,
  },
};

function drawBiomassIcon(g: Phaser.GameObjects.Graphics, size: number, p: ResourceIconPalette): void {
  const cx = size * 0.5;
  const cy = size * 0.5;
  g.fillStyle(p.glow, 0.22);
  g.fillCircle(cx, cy, size * 0.46);
  g.fillStyle(p.shadow, 0.9);
  g.fillCircle(cx + 1, cy + 1.5, size * 0.34);
  const lobes = [
    { dx: -0.22, dy: -0.08, r: 0.22 },
    { dx: 0.1, dy: -0.18, r: 0.2 },
    { dx: 0.2, dy: 0.12, r: 0.22 },
    { dx: -0.1, dy: 0.16, r: 0.24 },
  ];
  for (const lobe of lobes) {
    g.fillStyle(p.base, 0.96);
    g.fillCircle(cx + lobe.dx * size, cy + lobe.dy * size, size * lobe.r);
  }
  g.fillStyle(p.highlight, 0.4);
  g.fillCircle(cx - size * 0.1, cy - size * 0.14, size * 0.09);
  g.fillCircle(cx + size * 0.12, cy - size * 0.2, size * 0.06);
}

function drawTissueIcon(g: Phaser.GameObjects.Graphics, size: number, p: ResourceIconPalette): void {
  const cx = size * 0.5;
  const cy = size * 0.5;
  g.fillStyle(p.glow, 0.2);
  g.fillCircle(cx, cy, size * 0.46);
  // Teardrop-like droplet: ellipse with a tapered top
  g.fillStyle(p.shadow, 0.9);
  g.fillEllipse(cx + 0.6, cy + 1.6, size * 0.56, size * 0.7);
  g.fillStyle(p.base, 0.97);
  g.fillEllipse(cx, cy + 1, size * 0.52, size * 0.66);
  // Tapered highlight along top-left
  g.fillStyle(p.highlight, 0.55);
  g.fillEllipse(cx - size * 0.11, cy - size * 0.1, size * 0.14, size * 0.26);
  g.fillStyle(p.highlight, 0.32);
  g.fillCircle(cx + size * 0.1, cy + size * 0.14, size * 0.06);
}

function drawStructuralCellIcon(
  g: Phaser.GameObjects.Graphics,
  size: number,
  p: ResourceIconPalette,
): void {
  const cx = size * 0.5;
  const cy = size * 0.5;
  g.fillStyle(p.glow, 0.24);
  g.fillCircle(cx, cy, size * 0.46);
  // Hexagonal crystal: 6 points rotated 30deg for pointy top
  const r = size * 0.34;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  // Drop shadow
  g.fillStyle(p.shadow, 0.85);
  g.fillPoints(
    pts.map((pt) => new Phaser.Math.Vector2(pt.x + 1.2, pt.y + 1.6)),
    true,
  );
  g.fillStyle(p.base, 0.96);
  g.fillPoints(
    pts.map((pt) => new Phaser.Math.Vector2(pt.x, pt.y)),
    true,
  );
  // Inner facet highlight (triangle from top vertex)
  g.fillStyle(p.highlight, 0.45);
  g.fillTriangle(
    pts[0].x,
    pts[0].y,
    cx - r * 0.12,
    cy - r * 0.18,
    cx + r * 0.18,
    cy - r * 0.1,
  );
  g.lineStyle(1.1, p.highlight, 0.55);
  g.strokePoints(
    pts.map((pt) => new Phaser.Math.Vector2(pt.x, pt.y)),
    true,
    true,
  );
}

function drawParasiteIcon(g: Phaser.GameObjects.Graphics, size: number, p: ResourceIconPalette): void {
  const cx = size * 0.5;
  const cy = size * 0.5;
  g.fillStyle(p.glow, 0.18);
  g.fillCircle(cx, cy, size * 0.46);
  // Oblong body with two tendrils
  g.fillStyle(p.shadow, 0.9);
  g.fillEllipse(cx + 0.8, cy + 1.4, size * 0.5, size * 0.32);
  g.fillStyle(p.base, 0.96);
  g.fillEllipse(cx, cy, size * 0.46, size * 0.3);
  g.lineStyle(1.4, p.shadow, 0.7);
  g.beginPath();
  g.moveTo(cx - size * 0.2, cy + size * 0.04);
  g.lineTo(cx - size * 0.36, cy + size * 0.2);
  g.moveTo(cx + size * 0.2, cy + size * 0.04);
  g.lineTo(cx + size * 0.36, cy + size * 0.2);
  g.strokePath();
  g.fillStyle(p.highlight, 0.4);
  g.fillCircle(cx - size * 0.08, cy - size * 0.06, size * 0.05);
}

const iconDrawers: Record<
  PickupResourceId,
  (g: Phaser.GameObjects.Graphics, size: number, p: ResourceIconPalette) => void
> = {
  biomass: drawBiomassIcon,
  tissue: drawTissueIcon,
  structuralCell: drawStructuralCellIcon,
  parasite: drawParasiteIcon,
};

export function registerResourceIconTextures(scene: Phaser.Scene): void {
  for (const resourceId of Object.keys(iconDrawers) as PickupResourceId[]) {
    const key = `resource-icon-${resourceId}`;
    if (scene.textures.exists(key)) {
      continue;
    }
    const g = scene.add.graphics();
    iconDrawers[resourceId](g, ICON_SIZE, resourcePalettes[resourceId]);
    g.generateTexture(key, ICON_SIZE, ICON_SIZE);
    g.destroy();
  }
}

export function getResourceIconTextureKey(resourceId: PickupResourceId): string {
  return `resource-icon-${resourceId}`;
}
