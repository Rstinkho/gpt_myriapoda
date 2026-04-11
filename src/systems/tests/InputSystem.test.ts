import { beforeEach, describe, expect, it, vi } from 'vitest';

const { justDown } = vi.hoisted(() => ({
  justDown: vi.fn((key: { justDown?: boolean }) => Boolean(key.justDown)),
}));

vi.mock('phaser', () => ({
  Input: {
    Keyboard: {
      KeyCodes: {
        W: 87,
        A: 65,
        S: 83,
        D: 68,
        SPACE: 32,
      },
      JustDown: justDown,
    },
  },
}));

import { InputSystem } from '@/systems/InputSystem';

function createScene() {
  const keys = {
    up: { isDown: false },
    down: { isDown: false },
    left: { isDown: false },
    right: { isDown: false },
    dash: { isDown: false, justDown: false },
  };

  return {
    keys,
    scene: {
      input: {
        keyboard: {
          addKeys: vi.fn(() => keys),
        },
        on: vi.fn(),
        off: vi.fn(),
      },
    },
  };
}

describe('InputSystem', () => {
  beforeEach(() => {
    justDown.mockClear();
  });

  it('queues dash once per rendered update and consumes it only once', () => {
    const { keys, scene } = createScene();
    const inputSystem = new InputSystem(scene as never);

    keys.dash.justDown = true;
    inputSystem.update();
    keys.dash.justDown = false;

    expect(inputSystem.consumeDashRequest()).toBe(true);
    expect(inputSystem.consumeDashRequest()).toBe(false);
  });

  it('does not requeue dash without a new key press', () => {
    const { scene } = createScene();
    const inputSystem = new InputSystem(scene as never);

    inputSystem.update();

    expect(inputSystem.consumeDashRequest()).toBe(false);
    expect(justDown).toHaveBeenCalled();
  });
});
