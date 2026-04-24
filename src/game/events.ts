export const GameEvents = {
  pickupAbsorbed: 'pickupAbsorbed',
  matterDigested: 'matterDigested',
  enemyKilled: 'enemyKilled',
  worldExpanded: 'worldExpanded',
  dashUsed: 'dashUsed',
  plantHarvestStarted: 'plantHarvestStarted',
  conquestCompleted: 'conquestCompleted',
  segmentPurchased: 'segmentPurchased',
  buildingPlaced: 'buildingPlaced',
  cameraImpulse: 'cameraImpulse',
  hudChanged: 'hudChanged',
  debugToggled: 'debugToggled',
} as const;

export type GameEventKey = (typeof GameEvents)[keyof typeof GameEvents];
