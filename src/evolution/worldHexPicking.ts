import type { HexCell, HexCoord } from '@/game/types';

export interface EvolutionWorldViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvolutionWorldCamera {
  centerX: number;
  centerY: number;
  zoom: number;
}

function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function axialRound(q: number, r: number): HexCoord {
  let cubeX = q;
  let cubeZ = r;
  let cubeY = -cubeX - cubeZ;

  let roundedX = Math.round(cubeX);
  let roundedY = Math.round(cubeY);
  let roundedZ = Math.round(cubeZ);

  const diffX = Math.abs(roundedX - cubeX);
  const diffY = Math.abs(roundedY - cubeY);
  const diffZ = Math.abs(roundedZ - cubeZ);

  if (diffX > diffY && diffX > diffZ) {
    roundedX = -roundedY - roundedZ;
  } else if (diffY > diffZ) {
    roundedY = -roundedX - roundedZ;
  } else {
    roundedZ = -roundedX - roundedY;
  }

  return {
    q: roundedX,
    r: roundedZ,
  };
}

export function pointToHexCoord(
  worldX: number,
  worldY: number,
  hexSize: number,
): HexCoord {
  const q = ((Math.sqrt(3) / 3) * worldX - (1 / 3) * worldY) / hexSize;
  const r = ((2 / 3) * worldY) / hexSize;
  return axialRound(q, r);
}

export function findHexCellAtWorldPoint(
  cells: HexCell[],
  hexSize: number,
  worldX: number,
  worldY: number,
): HexCell | null {
  const picked = pointToHexCoord(worldX, worldY, hexSize);
  const byCoord = new Map(cells.map((cell) => [coordKey(cell.coord), cell] as const));
  return byCoord.get(coordKey(picked)) ?? null;
}

export function worldToViewportPoint(
  worldX: number,
  worldY: number,
  viewport: EvolutionWorldViewport,
  camera: EvolutionWorldCamera,
): { x: number; y: number } {
  return {
    x: viewport.x + viewport.width * 0.5 + (worldX - camera.centerX) * camera.zoom,
    y: viewport.y + viewport.height * 0.5 + (worldY - camera.centerY) * camera.zoom,
  };
}

export function viewportToWorldPoint(
  x: number,
  y: number,
  viewport: EvolutionWorldViewport,
  camera: EvolutionWorldCamera,
): { x: number; y: number } {
  return {
    x: camera.centerX + (x - (viewport.x + viewport.width * 0.5)) / camera.zoom,
    y: camera.centerY + (y - (viewport.y + viewport.height * 0.5)) / camera.zoom,
  };
}
