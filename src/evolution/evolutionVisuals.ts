import type { HexTypeId } from '@/game/types';

export interface EvolutionPreviewStyle {
  visualScale: number;
  alphaBoost: number;
  outlineBoost: number;
  hoverGlowColor: number;
  selectionGlowColor: number;
}

export interface EvolutionStrategicHexStyle {
  fillColor: number;
  fillAlpha: number;
  reactiveColor: number;
  reactiveAlpha: number;
  strokeColor: number;
  strokeAlpha: number;
  contourColor: number;
  contourAlpha: number;
  glowColor: number;
  glowAlpha: number;
}

export const evolutionPreviewStyle: EvolutionPreviewStyle = {
  visualScale: 1.85,
  alphaBoost: 1.55,
  outlineBoost: 1.8,
  hoverGlowColor: 0x6ef8ff,
  selectionGlowColor: 0xe8ffff,
};

const strategicHexStyles: Record<HexTypeId, EvolutionStrategicHexStyle> = {
  dead: {
    fillColor: 0x203541,
    fillAlpha: 0.54,
    reactiveColor: 0x4c7f98,
    reactiveAlpha: 0.2,
    strokeColor: 0x8fd8ee,
    strokeAlpha: 0.82,
    contourColor: 0xf0feff,
    contourAlpha: 0.48,
    glowColor: 0x78dfff,
    glowAlpha: 0.2,
  },
  corridor: {
    fillColor: 0x234867,
    fillAlpha: 0.56,
    reactiveColor: 0x5197c6,
    reactiveAlpha: 0.22,
    strokeColor: 0xb8ebff,
    strokeAlpha: 0.88,
    contourColor: 0xfbfeff,
    contourAlpha: 0.52,
    glowColor: 0x8be6ff,
    glowAlpha: 0.22,
  },
  restoring: {
    fillColor: 0x5b5920,
    fillAlpha: 0.58,
    reactiveColor: 0xb0be4d,
    reactiveAlpha: 0.24,
    strokeColor: 0xf7efad,
    strokeAlpha: 0.9,
    contourColor: 0xfffee9,
    contourAlpha: 0.58,
    glowColor: 0xf6f1a3,
    glowAlpha: 0.2,
  },
  purified: {
    fillColor: 0x1a4f30,
    fillAlpha: 0.6,
    reactiveColor: 0x35d778,
    reactiveAlpha: 0.26,
    strokeColor: 0x9ff6bd,
    strokeAlpha: 0.92,
    contourColor: 0xfbfff8,
    contourAlpha: 0.6,
    glowColor: 0x90ffd3,
    glowAlpha: 0.22,
  },
  corrupted: {
    fillColor: 0x5d2145,
    fillAlpha: 0.6,
    reactiveColor: 0xd15da5,
    reactiveAlpha: 0.24,
    strokeColor: 0xffc2ea,
    strokeAlpha: 0.9,
    contourColor: 0xfff1fb,
    contourAlpha: 0.58,
    glowColor: 0xff9bdd,
    glowAlpha: 0.22,
  },
};

export function getEvolutionStrategicHexStyle(type: HexTypeId): EvolutionStrategicHexStyle {
  return strategicHexStyles[type];
}
