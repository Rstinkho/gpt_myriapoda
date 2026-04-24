import { describe, expect, it } from 'vitest';
import { HexGrid } from '@/entities/world/HexGrid';
import { tuning } from '@/game/tuning';
import { tutorialStageScripts } from '@/tutorial/tutorialData';
import {
  createPostTutorialWorldPreset,
  createTutorialWorldPreset,
  tutorialConquestCoord,
  tutorialPlantCoord,
} from '@/tutorial/tutorialWorldPresets';

function key(q: number, r: number): string {
  return `${q},${r}`;
}

describe('tutorialWorldPresets', () => {
  it('creates the authored seven-hex tutorial cluster with a purified plant hex', () => {
    const preset = createTutorialWorldPreset(new HexGrid(tuning.worldHexSize));
    const plantCell = preset.cells.find(
      (cell) => cell.coord.q === tutorialPlantCoord.q && cell.coord.r === tutorialPlantCoord.r,
    );

    expect(preset.cells).toHaveLength(7);
    expect(preset.fillThreshold).toBe(1_000_000);
    expect(plantCell?.type).toBe('purified');
    expect(preset.progressRegionCoords).toHaveLength(7);
  });

  it('preserves existing cells and appends corridor and main-region geometry after the tutorial', () => {
    const grid = new HexGrid(tuning.worldHexSize);
    const tutorial = createTutorialWorldPreset(grid);
    const home = tutorial.cells.find((cell) => cell.coord.q === 0 && cell.coord.r === 0)!;
    home.ownerId = 'player';
    home.buildable = false;
    home.buildingId = 'spire';
    home.conquestState = 'owned';

    const postTutorial = createPostTutorialWorldPreset(grid, tutorial.cells);
    const cellsByKey = new Map(
      postTutorial.cells.map((cell) => [key(cell.coord.q, cell.coord.r), cell]),
    );

    expect(cellsByKey.get(key(0, 0))?.buildingId).toBe('spire');
    expect(cellsByKey.get(key(2, 0))?.type).toBe('corridor');
    expect(cellsByKey.get(key(3, 0))?.type).toBe('corridor');
    expect(cellsByKey.get(key(4, 1))?.type).toBe('purified');
    expect(cellsByKey.get(key(6, -1))?.type).toBe('purified');
    expect(postTutorial.progressRegionCoords).toHaveLength(7);
    expect(postTutorial.progressRegionCoords).not.toContainEqual({ q: 2, r: 0 });
    expect(postTutorial.progressRegionCoords).not.toContainEqual({ q: 3, r: 0 });
    expect(postTutorial.cells.length).toBeGreaterThan(tutorial.cells.length);
  });

  it('anchors the scripted conquest and stage-specific tutorial content', () => {
    expect(tutorialStageScripts['tutorial-stage-2']?.plants).toHaveLength(1);
    expect(tutorialStageScripts['tutorial-stage-2']?.enemies?.[0]?.type).toBe('leech');
    expect(tutorialStageScripts['tutorial-stage-3']?.conquestTargetCoord).toEqual(
      tutorialConquestCoord,
    );
    expect(tutorialStageScripts['tutorial-stage-5']?.enemies?.[0]?.type).toBe('shellback');
  });
});
