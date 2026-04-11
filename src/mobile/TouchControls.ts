import type { InputSnapshot } from '@/game/types';

export interface TouchControls {
  isEnabled(): boolean;
  sample(): Partial<InputSnapshot>;
}

export class DisabledTouchControls implements TouchControls {
  isEnabled(): boolean {
    return false;
  }

  sample(): Partial<InputSnapshot> {
    return {};
  }
}
