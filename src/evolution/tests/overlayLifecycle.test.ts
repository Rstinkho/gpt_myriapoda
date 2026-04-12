import { describe, expect, it, vi } from 'vitest';
import {
  closeEvolutionOverlay,
  evolutionSceneKey,
  gameSceneKey,
  isEvolutionOverlayOpen,
  openEvolutionOverlay,
  uiSceneKey,
} from '@/evolution/overlayLifecycle';

function createSceneController() {
  const active = new Set<string>([gameSceneKey, uiSceneKey]);
  const paused = new Set<string>();
  const sleeping = new Set<string>();

  return {
    controller: {
      isActive: vi.fn((key: string) => active.has(key)),
      isPaused: vi.fn((key: string) => paused.has(key)),
      isSleeping: vi.fn((key: string) => sleeping.has(key)),
      launch: vi.fn((key: string) => {
        active.add(key);
      }),
      sleep: vi.fn((key: string) => {
        active.delete(key);
        sleeping.add(key);
      }),
      pause: vi.fn((key: string) => {
        active.delete(key);
        paused.add(key);
      }),
      resume: vi.fn((key: string) => {
        paused.delete(key);
        active.add(key);
      }),
      wake: vi.fn((key: string) => {
        sleeping.delete(key);
        active.add(key);
      }),
      stop: vi.fn((key?: string) => {
        if (!key) {
          return;
        }
        active.delete(key);
        paused.delete(key);
        sleeping.delete(key);
      }),
    },
    active,
    paused,
    sleeping,
  };
}

describe('overlayLifecycle', () => {
  it('launches evolution once and pauses the game / sleeps the HUD', () => {
    const { controller, paused, sleeping } = createSceneController();

    expect(openEvolutionOverlay(controller, { snapshot: true })).toBe(true);
    expect(controller.launch).toHaveBeenCalledWith(evolutionSceneKey, { snapshot: true });
    expect(controller.pause).toHaveBeenCalledWith(gameSceneKey);
    expect(controller.sleep).toHaveBeenCalledWith(uiSceneKey);
    expect(paused.has(gameSceneKey)).toBe(true);
    expect(sleeping.has(uiSceneKey)).toBe(true);
  });

  it('prevents duplicate overlay launches while evolution is already open', () => {
    const { controller, active } = createSceneController();
    active.add(evolutionSceneKey);

    expect(isEvolutionOverlayOpen(controller)).toBe(true);
    expect(openEvolutionOverlay(controller, { snapshot: true })).toBe(false);
    expect(controller.launch).not.toHaveBeenCalled();
  });

  it('resumes the game and wakes the HUD when evolution closes', () => {
    const { controller, paused, sleeping, active } = createSceneController();
    active.delete(gameSceneKey);
    paused.add(gameSceneKey);
    sleeping.add(uiSceneKey);
    active.add(evolutionSceneKey);

    closeEvolutionOverlay(controller);

    expect(controller.resume).toHaveBeenCalledWith(gameSceneKey);
    expect(controller.wake).toHaveBeenCalledWith(uiSceneKey);
    expect(controller.stop).toHaveBeenCalledWith(evolutionSceneKey);
  });
});
