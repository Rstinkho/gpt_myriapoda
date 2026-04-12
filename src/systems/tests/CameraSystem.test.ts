import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  Math: {
    Linear: (start: number, end: number, t: number) => start + (end - start) * t,
    Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
  },
}));

import { tuning } from '@/game/tuning';
import { CameraSystem } from '@/systems/CameraSystem';

function createCamera() {
  return {
    width: 1280,
    height: 720,
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    setZoom(zoom: number) {
      this.zoom = zoom;
    },
  };
}

function createScene(camera: ReturnType<typeof createCamera>) {
  return {
    cameras: {
      main: camera,
    },
  };
}

function createHeadBody(xPixels: number, yPixels: number) {
  return {
    getPosition: () => ({
      x: xPixels / tuning.pixelsPerMeter,
      y: yPixels / tuning.pixelsPerMeter,
    }),
  };
}

const zeroIntent = {
  aimAngle: 0,
  thrust: 0,
  strafeX: 0,
  strafeY: 0,
};

describe('CameraSystem', () => {
  it('keeps stage-one zoom near the preferred gameplay feel', () => {
    const camera = createCamera();
    const system = new CameraSystem(createScene(camera) as never);

    system.update(
      createHeadBody(0, 0) as never,
      zeroIntent,
      {
        minX: -200,
        maxX: 200,
        minY: -150,
        maxY: 150,
        centerX: 0,
        centerY: 0,
        width: 400,
        height: 300,
      },
      0,
      tuning.fixedStepSeconds,
    );

    expect(camera.zoom).toBeGreaterThan(0.98);
    expect(camera.zoom).toBeLessThanOrEqual(tuning.cameraAbsoluteMaxZoom);
  });

  it('auto-zooms out as the world bounds grow', () => {
    const camera = createCamera();
    const system = new CameraSystem(createScene(camera) as never);
    const headBody = createHeadBody(0, 0);

    system.update(
      headBody as never,
      zeroIntent,
      {
        minX: -220,
        maxX: 220,
        minY: -180,
        maxY: 180,
        centerX: 0,
        centerY: 0,
        width: 440,
        height: 360,
      },
      0,
      tuning.fixedStepSeconds,
    );
    const stageOneZoom = camera.zoom;

    for (let index = 0; index < 24; index += 1) {
      system.update(
        headBody as never,
        zeroIntent,
        {
          minX: -2200,
          maxX: 2200,
          minY: -1600,
          maxY: 1600,
          centerX: 0,
          centerY: 0,
          width: 4400,
          height: 3200,
        },
        0,
        tuning.fixedStepSeconds,
      );
    }

    expect(camera.zoom).toBeLessThan(stageOneZoom);
    expect(camera.zoom).toBeGreaterThanOrEqual(tuning.cameraAbsoluteMinZoom);
  });

  it('applies mouse-wheel zoom as a persistent bias around the auto-fit baseline', () => {
    const camera = createCamera();
    const system = new CameraSystem(createScene(camera) as never);
    const headBody = createHeadBody(0, 0);
    const bounds = {
      minX: -1200,
      maxX: 1200,
      minY: -900,
      maxY: 900,
      centerX: 0,
      centerY: 0,
      width: 2400,
      height: 1800,
    };

    for (let index = 0; index < 40; index += 1) {
      system.update(headBody as never, zeroIntent, bounds, 0, tuning.fixedStepSeconds);
    }
    const settledBaseZoom = camera.zoom;

    system.update(headBody as never, zeroIntent, bounds, -120, tuning.fixedStepSeconds);
    expect(camera.zoom).toBeGreaterThan(settledBaseZoom);

    const zoomedIn = camera.zoom;
    system.update(headBody as never, zeroIntent, bounds, 120, tuning.fixedStepSeconds);
    expect(camera.zoom).toBeLessThan(zoomedIn);
  });

  it('eases expansion zoom instead of snapping wildly across frames', () => {
    const camera = createCamera();
    const system = new CameraSystem(createScene(camera) as never);
    const controlCamera = createCamera();
    const controlSystem = new CameraSystem(createScene(controlCamera) as never);
    const headBody = createHeadBody(0, 0);
    const bounds = {
      minX: -1000,
      maxX: 1000,
      minY: -800,
      maxY: 800,
      centerX: 0,
      centerY: 0,
      width: 2000,
      height: 1600,
    };

    for (let index = 0; index < 12; index += 1) {
      system.update(headBody as never, zeroIntent, bounds, 0, tuning.fixedStepSeconds);
      controlSystem.update(headBody as never, zeroIntent, bounds, 0, tuning.fixedStepSeconds);
    }

    system.triggerExpansion();
    system.update(headBody as never, zeroIntent, bounds, 0, tuning.fixedStepSeconds);
    controlSystem.update(headBody as never, zeroIntent, bounds, 0, tuning.fixedStepSeconds);
    const firstExpandedFrame = camera.zoom;
    const firstControlFrame = controlCamera.zoom;
    system.update(headBody as never, zeroIntent, bounds, 0, tuning.fixedStepSeconds);
    controlSystem.update(headBody as never, zeroIntent, bounds, 0, tuning.fixedStepSeconds);
    const secondExpandedFrame = camera.zoom;
    const secondControlFrame = controlCamera.zoom;

    // During stage expansion the camera zooms out to the minimum and follows world center,
    // so it diverges from the normal follow-zoom path; still step smoothly frame-to-frame.
    expect(Math.abs(secondExpandedFrame - firstExpandedFrame)).toBeLessThan(0.12);
    expect(firstExpandedFrame).toBeLessThan(firstControlFrame);
  });
});
