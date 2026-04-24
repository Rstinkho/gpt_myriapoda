import { describe, expect, it } from 'vitest';
import {
  computeEvolutionContentSplit,
  evolutionToolbarResourceIds,
  getEvolutionEnhancementTreeLayout,
  getEvolutionMyriapodaPanelLayout,
  getEvolutionWorldActionCardLayout,
  getEvolutionWorldActionsViewLayout,
  getEvolutionWorldBuildingSlotLayout,
  getEvolutionWorldBuildingsGridBounds,
  getEvolutionWorldBuildingsViewLayout,
  getEvolutionWorldProgressPanelBounds,
  getEvolutionWorldSideContentRect,
} from '@/evolution/evolutionLayout';

describe('evolutionLayout', () => {
  it('keeps only nutrient resources in the evolution toolbar', () => {
    expect([...evolutionToolbarResourceIds]).toEqual(['biomass', 'tissue', 'structuralCell']);
    expect(evolutionToolbarResourceIds).not.toContain('parasite');
  });

  it('uses a 70/30 split for the world strategic section', () => {
    const split = computeEvolutionContentSplit(1000, 'world', 14);

    expect(split.leftRatio).toBeCloseTo(0.7, 5);
    expect(split.leftWidth).toBeCloseTo((1000 - 14) * 0.7, 5);
    expect(split.rightWidth).toBeCloseTo((1000 - 14) * 0.3, 5);
  });

  it('uses a 35/65 side-panel split with three summary columns for myriapoda', () => {
    const w = 420;
    const gap = 14;
    const layout = getEvolutionMyriapodaPanelLayout({ x: 0, y: 0, width: w, height: 600 });
    const colW = (w - gap * 2) / 3;

    expect(layout.summaryRow.height).toBeCloseTo(210, 5);
    expect(layout.detailCard.width).toBeCloseTo(colW, 5);
    expect(layout.statsCard.width).toBeCloseTo(colW, 5);
    expect(layout.segmentColumn.width).toBeCloseTo(colW, 5);
    expect(layout.lowerPanel.height).toBeCloseTo(600 - 210 - 14, 5);
  });

  it('lays out world Actions vs Buildings as separate full content regions below a tab bar', () => {
    const side = { x: 0, y: 0, width: 300, height: 620 };
    const tabBarH = 50;
    const gapAfterTabs = 8;
    const content = getEvolutionWorldSideContentRect(side, tabBarH, gapAfterTabs);
    expect(content.y).toBe(tabBarH + gapAfterTabs);
    const actions = getEvolutionWorldActionsViewLayout(content);
    const buildings = getEvolutionWorldBuildingsViewLayout(content);
    const cards = getEvolutionWorldActionCardLayout(actions.actionList);
    const slots = getEvolutionWorldBuildingSlotLayout(getEvolutionWorldBuildingsGridBounds(buildings.buildingsSection));

    expect(content.height).toBeGreaterThan(100);
    expect(actions.statsCard.height).toBeGreaterThanOrEqual(96);
    expect(cards).toHaveLength(4);
    expect(cards[0].rect.width).toBe(cards[0].rect.height);
    expect(slots).toHaveLength(8);
    expect(slots[4].rect.y).toBeGreaterThan(slots[0].rect.y);
  });

  it('keeps the world progress panel tucked inside the map viewport', () => {
    const mapBounds = { x: 40, y: 80, width: 720, height: 520 };
    const panel = getEvolutionWorldProgressPanelBounds(mapBounds);

    expect(panel.width).toBeGreaterThanOrEqual(244);
    expect(panel.height).toBeGreaterThanOrEqual(156);
    expect(panel.x).toBeGreaterThan(mapBounds.x);
    expect(panel.y).toBeGreaterThan(mapBounds.y);
    expect(panel.x + panel.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width);
    expect(panel.y + panel.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height);
  });

  it('builds a 9-node left-to-right branched enhancement tree', () => {
    const tree = getEvolutionEnhancementTreeLayout({ x: 0, y: 0, width: 520, height: 340 });
    const columns = new Set(tree.nodes.map((node) => node.column));
    const root = tree.nodes.find((node) => node.id === 'core');

    expect(tree.nodes).toHaveLength(9);
    expect(columns.size).toBe(4);
    expect(root?.column).toBe(0);
    expect(tree.links.length).toBeGreaterThan(8);
    expect(
      tree.links.every((link) => {
        const from = tree.nodes.find((node) => node.id === link.fromId);
        const to = tree.nodes.find((node) => node.id === link.toId);
        return !!from && !!to && from.column < to.column;
      }),
    ).toBe(true);
  });
});
