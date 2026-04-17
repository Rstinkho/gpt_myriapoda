import type { EvolutionSection, PickupResourceId, ResourceCost } from '@/game/types';
import {
  evolutionWorldActionDefs,
  evolutionWorldBuildingDefs,
  formatResourceCost,
  getEvolutionUpgradeNodes,
  type EvolutionUpgradeFamily,
  type EvolutionUpgradeNodeDefinition,
  type EvolutionWorldActionId,
  type EvolutionWorldActionIcon,
} from '@/evolution/evolutionData';

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvolutionRectGroup {
  summaryRow: RectLike;
  detailCard: RectLike;
  statsCard: RectLike;
  lowerPanel: RectLike;
}

export interface EvolutionBuildingSlotLayout {
  id: string;
  name: string;
  description: string;
  cost: ResourceCost;
  costLabel: string;
  requirement: string;
  rect: RectLike;
}

export interface EvolutionEnhancementNodeLayout {
  id: string;
  label: string;
  /** Legacy plain-text cost label ("8 BIOMASS"); kept for tests/back-compat. */
  sublabel: string;
  /** Structured cost so renderers can draw icon + amount widgets. */
  cost: ResourceCost;
  description: string;
  column: number;
  row: number;
  locked: boolean;
  rect: RectLike;
}

export interface EvolutionEnhancementLinkLayout {
  fromId: string;
  toId: string;
}

export interface EvolutionActionCardLayout {
  id: EvolutionWorldActionId;
  title: string;
  description: string;
  icon: EvolutionWorldActionIcon;
  cost?: ResourceCost;
  costLabel?: string;
  locked: boolean;
  rect: RectLike;
}

export const evolutionToolbarResourceIds = [
  'biomass',
  'tissue',
  'structuralCell',
] as const satisfies readonly PickupResourceId[];

const branchLinks: EvolutionEnhancementLinkLayout[] = [
  { fromId: 'core', toId: 'tier-1a' },
  { fromId: 'core', toId: 'tier-1b' },
  { fromId: 'tier-1a', toId: 'tier-2a' },
  { fromId: 'tier-1a', toId: 'tier-2b' },
  { fromId: 'tier-1b', toId: 'tier-2b' },
  { fromId: 'tier-1b', toId: 'tier-2c' },
  { fromId: 'tier-2a', toId: 'tier-3a' },
  { fromId: 'tier-2b', toId: 'tier-3b' },
  { fromId: 'tier-2c', toId: 'tier-3c' },
] as const;

function insetRect(bounds: RectLike, inset: number): RectLike {
  return {
    x: bounds.x + inset,
    y: bounds.y + inset,
    width: Math.max(0, bounds.width - inset * 2),
    height: Math.max(0, bounds.height - inset * 2),
  };
}

export function computeEvolutionContentSplit(
  outerWidth: number,
  section: EvolutionSection,
  gutter: number,
): { leftWidth: number; rightWidth: number; leftRatio: number } {
  const leftRatio = section === 'world' ? 0.7 : 0.5;
  const leftWidth = (outerWidth - gutter) * leftRatio;
  return {
    leftWidth,
    rightWidth: outerWidth - gutter - leftWidth,
    leftRatio,
  };
}

export function getEvolutionMyriapodaPanelLayout(
  bounds: RectLike,
  gap = 14,
): EvolutionRectGroup {
  const summaryHeight = bounds.height * 0.35;
  const lowerY = bounds.y + summaryHeight + gap;
  const lowerHeight = Math.max(80, bounds.height - summaryHeight - gap);
  const summaryRow = { x: bounds.x, y: bounds.y, width: bounds.width, height: summaryHeight };
  const detailWidth = (bounds.width - gap) * 0.5;

  return {
    summaryRow,
    detailCard: {
      x: summaryRow.x,
      y: summaryRow.y,
      width: detailWidth,
      height: summaryRow.height,
    },
    statsCard: {
      x: summaryRow.x + detailWidth + gap,
      y: summaryRow.y,
      width: bounds.width - detailWidth - gap,
      height: summaryRow.height,
    },
    lowerPanel: {
      x: bounds.x,
      y: lowerY,
      width: bounds.width,
      height: lowerHeight,
    },
  };
}

const WORLD_STATS_CARDS_GAP = 10;
const WORLD_MIN_ACTION_CARDS_H = 72;

/**
 * Content area below the world right-column sub-tab bar (Actions | Buildings).
 * `tabBarHeight` should match the scene: top padding + tab row height + gap before content.
 */
export function getEvolutionWorldSideContentRect(
  sideBounds: RectLike,
  tabBarHeight: number,
  gapAfterTabs = 8,
): RectLike {
  const top = sideBounds.y + tabBarHeight + gapAfterTabs;
  const bottom = sideBounds.y + sideBounds.height;
  return {
    x: sideBounds.x,
    y: top,
    width: sideBounds.width,
    height: Math.max(0, bottom - top),
  };
}

export function getEvolutionWorldActionsViewLayout(content: RectLike): {
  statsCard: RectLike;
  actionList: RectLike;
} {
  const innerH = content.height;
  let statsHeight = Math.max(96, Math.min(200, Math.floor(innerH * 0.42)));
  let actionCardsHeight = innerH - statsHeight - WORLD_STATS_CARDS_GAP;
  if (actionCardsHeight < WORLD_MIN_ACTION_CARDS_H && innerH > WORLD_MIN_ACTION_CARDS_H + 96) {
    statsHeight = Math.max(
      80,
      innerH - WORLD_STATS_CARDS_GAP - WORLD_MIN_ACTION_CARDS_H,
    );
    actionCardsHeight = innerH - statsHeight - WORLD_STATS_CARDS_GAP;
  }
  actionCardsHeight = Math.max(64, actionCardsHeight);

  let y = content.y;
  const statsCard: RectLike = {
    x: content.x,
    y,
    width: content.width,
    height: statsHeight,
  };
  y += statsHeight + WORLD_STATS_CARDS_GAP;
  const actionList: RectLike = {
    x: content.x,
    y,
    width: content.width,
    height: actionCardsHeight,
  };
  return { statsCard, actionList };
}

export function getEvolutionWorldBuildingsViewLayout(content: RectLike): { buildingsSection: RectLike } {
  return { buildingsSection: { ...content } };
}

/** Insets the buildings view area for the 4×2 grid (sub-tabs replace section titles). */
export function getEvolutionWorldBuildingsGridBounds(section: RectLike): RectLike {
  return insetRect(section, 6);
}

export function getEvolutionWorldBuildingSlotLayout(
  bounds: RectLike,
  gap = 8,
): EvolutionBuildingSlotLayout[] {
  const inner = insetRect(bounds, 4);
  const cols = 4;
  const rows = 2;
  const maxTileW = (inner.width - gap * (cols - 1)) / cols;
  const maxTileH = (inner.height - gap * (rows - 1)) / rows;
  const tile = Math.min(maxTileW, maxTileH);
  const gridW = cols * tile + gap * (cols - 1);
  const gridH = rows * tile + gap * (rows - 1);
  const startX = inner.x + (inner.width - gridW) * 0.5;
  const startY = inner.y;
  const defs = evolutionWorldBuildingDefs;

  return defs.map((def, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      cost: def.cost,
      costLabel: formatResourceCost(def.cost),
      requirement: def.requirement,
      rect: {
        x: startX + col * (tile + gap),
        y: startY + row * (tile + gap),
        width: tile,
        height: tile,
      },
    };
  });
}

export function getEvolutionEnhancementTreeLayout(
  bounds: RectLike,
  family: EvolutionUpgradeFamily = 'head',
): {
  nodes: EvolutionEnhancementNodeLayout[];
  links: readonly EvolutionEnhancementLinkLayout[];
} {
  const cardInset = Math.max(8, Math.min(16, bounds.width * 0.03));
  const inner = insetRect(bounds, cardInset);
  const columnCount = 4;
  const maxRows = 3;
  const columnWidth = inner.width / columnCount;
  const nodeWidth = Math.min(162, columnWidth * 0.78);
  const nodeHeight = Math.max(42, Math.min(64, inner.height * 0.16));
  const rowHeights = [0.22, 0.5, 0.78];

  const nodeDefs: EvolutionUpgradeNodeDefinition[] = getEvolutionUpgradeNodes(family);
  const nodes: EvolutionEnhancementNodeLayout[] = nodeDefs.map((node) => {
    const columnCenterX = inner.x + columnWidth * (node.column + 0.5);
    const yFactor =
      node.column === 0 ? 0.5 : rowHeights[Math.min(maxRows - 1, Math.max(0, node.row))];
    const centerY = inner.y + inner.height * yFactor;
    return {
      id: node.id,
      label: node.label,
      description: node.description,
      cost: node.cost,
      sublabel: formatResourceCost(node.cost),
      column: node.column,
      row: node.row,
      locked: node.locked,
      rect: {
        x: columnCenterX - nodeWidth * 0.5,
        y: centerY - nodeHeight * 0.5,
        width: nodeWidth,
        height: nodeHeight,
      },
    };
  });

  return { nodes, links: branchLinks };
}

export function getEvolutionWorldActionCardLayout(
  bounds: RectLike,
  gap = 8,
): EvolutionActionCardLayout[] {
  const inner = insetRect(bounds, Math.max(4, Math.min(12, bounds.width * 0.03)));
  const n = evolutionWorldActionDefs.length;
  const totalGap = gap * Math.max(0, n - 1);
  const slotW = (inner.width - totalGap) / n;
  /** Square tiles: fit row width, but do not stretch to full action-list height. */
  const quad = Math.min(slotW, inner.height);
  const rowW = n * quad + totalGap;
  const startX = inner.x + (inner.width - rowW) * 0.5;
  /** Bottom-aligned in the action section so buttons sit along the lower edge. */
  const startY = inner.y + Math.max(0, inner.height - quad);

  return evolutionWorldActionDefs.map((card, index) => ({
    id: card.id,
    title: card.title,
    description: card.description,
    icon: card.icon,
    cost: card.cost,
    costLabel: card.cost ? formatResourceCost(card.cost) : undefined,
    locked: card.locked,
    rect: {
      x: startX + index * (quad + gap),
      y: startY,
      width: quad,
      height: quad,
    },
  }));
}
