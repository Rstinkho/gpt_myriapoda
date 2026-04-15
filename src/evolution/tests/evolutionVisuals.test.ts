import { describe, expect, it } from 'vitest';
import {
  evolutionPreviewStyle,
  getEvolutionStrategicHexStyle,
} from '@/evolution/evolutionVisuals';

describe('evolutionVisuals', () => {
  it('uses a larger and brighter preview presentation than gameplay defaults', () => {
    expect(evolutionPreviewStyle.visualScale).toBeGreaterThan(1.5);
    expect(evolutionPreviewStyle.alphaBoost).toBeGreaterThan(1);
    expect(evolutionPreviewStyle.outlineBoost).toBeGreaterThan(1);
  });

  it('provides brighter strategic hex styles while preserving type distinction', () => {
    const purified = getEvolutionStrategicHexStyle('purified');
    const enriched = getEvolutionStrategicHexStyle('enriched');
    const corrupted = getEvolutionStrategicHexStyle('corrupted');
    const dead = getEvolutionStrategicHexStyle('dead');

    expect(purified.fillAlpha).toBeGreaterThan(0.5);
    expect(enriched.glowAlpha).toBeGreaterThan(0.2);
    expect(corrupted.strokeAlpha).toBeGreaterThan(0.8);
    expect(dead.contourAlpha).toBeGreaterThan(0.4);
    expect(purified.fillColor).not.toBe(corrupted.fillColor);
    expect(enriched.fillColor).not.toBe(purified.fillColor);
  });
});
