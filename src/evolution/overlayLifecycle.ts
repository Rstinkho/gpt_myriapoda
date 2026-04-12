export const gameSceneKey = 'GameScene';
export const uiSceneKey = 'UIScene';
export const evolutionSceneKey = 'EvolutionScene';

export interface EvolutionSceneController {
  isActive(key: string): boolean;
  isPaused(key: string): boolean;
  isSleeping(key: string): boolean;
  launch(key: string, data?: unknown): void;
  sleep(key: string): void;
  pause(key: string): void;
  resume(key: string): void;
  wake(key: string): void;
  stop(key?: string): void;
}

export function isEvolutionOverlayOpen(scene: EvolutionSceneController): boolean {
  return (
    scene.isActive(evolutionSceneKey) ||
    scene.isPaused(evolutionSceneKey) ||
    scene.isSleeping(evolutionSceneKey)
  );
}

export function openEvolutionOverlay(
  scene: EvolutionSceneController,
  data: unknown,
): boolean {
  if (isEvolutionOverlayOpen(scene)) {
    return false;
  }

  scene.launch(evolutionSceneKey, data);
  if (scene.isActive(uiSceneKey)) {
    scene.sleep(uiSceneKey);
  }
  scene.pause(gameSceneKey);
  return true;
}

export function closeEvolutionOverlay(scene: EvolutionSceneController): void {
  if (scene.isPaused(gameSceneKey)) {
    scene.resume(gameSceneKey);
  }
  if (scene.isSleeping(uiSceneKey)) {
    scene.wake(uiSceneKey);
  }
  scene.stop(evolutionSceneKey);
}
