import * as Phaser from 'phaser';
import {
  createBackdropReactivitySample,
  getBackdropHexFillRadius,
  pickPulseEndpoints,
  samplePulsePosition,
  type PulseEndpoints,
} from '@/background/backgroundMath';
import { VeinMeshRenderer } from '@/background/VeinMeshRenderer';
import { textureKeys } from '@/game/assets';
import { tuning } from '@/game/tuning';
import type { WorldRenderSnapshot } from '@/game/types';
import { GraphicsMaskController } from '@/phaser/GraphicsMaskController';
import { createRegularHexPoints, type BorderPoint } from '@/rendering/worldBorderMath';

interface VeinPulse {
  image: Phaser.GameObjects.Image;
  endpoints: PulseEndpoints;
  elapsed: number;
  duration: number;
  bow: number;
  active: boolean;
  trailTint: number;
}

function blendTowardFocus(
  base: { x: number; y: number },
  focus: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return {
    x: base.x + (focus.x - base.x) * t,
    y: base.y + (focus.y - base.y) * t,
  };
}

function createRandomZoneSource(
  rect: Phaser.Geom.Rectangle,
): Phaser.Types.GameObjects.Particles.RandomZoneSource {
  return {
    getRandomPoint: (point) => {
      point.x = rect.x + Math.random() * rect.width;
      point.y = rect.y + Math.random() * rect.height;
    },
  };
}

export class AbyssBackgroundRenderer {
  private readonly baseGraphics: Phaser.GameObjects.Graphics;
  private readonly vignetteGraphics: Phaser.GameObjects.Graphics;
  private readonly veinMesh: VeinMeshRenderer;
  private readonly pulseGraphics: Phaser.GameObjects.Graphics;
  private readonly pulses: VeinPulse[] = [];
  private readonly pulseTints: readonly number[];
  private readonly hexMask: GraphicsMaskController;
  private readonly sporeZone = new Phaser.Geom.Rectangle();
  private readonly livingAccentZone = new Phaser.Geom.Rectangle();
  private readonly bioFloatZone = new Phaser.Geom.Rectangle();
  private readonly spores: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly bioFloat: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly livingAccent: Phaser.GameObjects.Particles.ParticleEmitter;
  private elapsed = 0;
  private pulseSpawnTimer = 0;
  private hexMaskFingerprint = '';
  private readonly hexPointsScratch: BorderPoint[] = createRegularHexPoints(0, 0, 1);

  constructor(private readonly scene: Phaser.Scene) {
    this.baseGraphics = scene.add.graphics().setDepth(tuning.background.depths.layer1);
    this.vignetteGraphics = scene.add.graphics().setDepth(tuning.background.depths.layer1 + 0.01);
    this.baseGraphics.setScrollFactor(1, 1);
    this.vignetteGraphics.setScrollFactor(1, 1);

    this.veinMesh = new VeinMeshRenderer(scene);

    this.spores = scene.add.particles(0, 0, textureKeys.background.softParticle, {
      emitZone: { type: 'random' as const, source: createRandomZoneSource(this.sporeZone) },
      lifespan: { min: 7000, max: 14000 },
      speedX: { min: -6, max: 6 },
      speedY: { min: -5, max: 3 },
      scale: { start: 0.18, end: 0.04 },
      alpha: { start: 0.35, end: 0 },
      quantity: 1,
      frequency: tuning.background.particles.sporesFrequencyMs,
      maxAliveParticles: tuning.background.particles.sporesMax,
      tint: [
        tuning.background.palette.particles.spore,
        tuning.background.palette.bio.mintSoft,
        tuning.background.palette.particles.warmRare,
      ],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.spores.setDepth(tuning.background.depths.spores);
    this.spores.setScrollFactor(tuning.background.parallax.spores, tuning.background.parallax.spores);

    this.bioFloat = scene.add.particles(0, 0, textureKeys.background.softParticle, {
      emitZone: { type: 'random' as const, source: createRandomZoneSource(this.bioFloatZone) },
      lifespan: { min: 9000, max: 18000 },
      speedX: { min: -5, max: 5 },
      speedY: { min: -4, max: 4 },
      angle: { min: 0, max: 360 },
      rotate: { min: -12, max: 12 },
      scale: { start: 0.22, end: 0.06 },
      alpha: { start: 0.38, end: 0 },
      quantity: 1,
      frequency: tuning.background.particles.bioFloatFrequencyMs,
      maxAliveParticles: tuning.background.particles.bioFloatMax,
      tint: [
        tuning.background.palette.bio.mintSoft,
        tuning.background.palette.particles.spore,
        tuning.background.palette.bio.cyanSoft,
      ],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.bioFloat.setDepth(tuning.background.depths.bioFloat);
    this.bioFloat.setScrollFactor(tuning.background.parallax.bioFloat, tuning.background.parallax.bioFloat);

    this.livingAccent = scene.add.particles(0, 0, textureKeys.background.softGlowDot, {
      emitZone: { type: 'random' as const, source: createRandomZoneSource(this.livingAccentZone) },
      lifespan: { min: 6400, max: 10800 },
      speedX: { min: -4, max: 4 },
      speedY: { min: -4, max: 1.5 },
      scale: { start: 0.12, end: 0.02 },
      alpha: { start: 0.22, end: 0 },
      quantity: 1,
      frequency: tuning.background.particles.livingAccentFrequencyMs,
      maxAliveParticles: tuning.background.particles.livingAccentMax,
      tint: [
        tuning.background.palette.bio.cyanSoft,
        tuning.background.palette.bio.mintSoft,
      ],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.livingAccent.setDepth(tuning.background.depths.livingAccent);
    this.livingAccent.setScrollFactor(
      tuning.background.parallax.livingAccent,
      tuning.background.parallax.livingAccent,
    );

    this.pulseGraphics = scene.add.graphics();
    this.pulseGraphics.setDepth(tuning.background.depths.layer2 + 0.006);
    this.pulseGraphics.setScrollFactor(1, 1);
    this.pulseGraphics.enableFilters();
    Phaser.Actions.AddEffectBloom(this.pulseGraphics, {
      threshold: 0.2,
      blurRadius: 12,
      blurSteps: 2,
      blendAmount: 0.7,
      useInternal: true,
    });

    this.pulseTints = [
      tuning.background.palette.bio.cyanSoft,
      tuning.background.palette.bio.mintSoft,
      tuning.background.palette.bio.cyanDim,
    ];
    for (let i = 0; i < tuning.background.pulse.max; i += 1) {
      const image = scene.add.image(0, 0, textureKeys.background.pulseHead);
      image.setOrigin(0.5);
      image.setDepth(tuning.background.depths.layer2 + 0.007);
      image.setScrollFactor(1, 1);
      image.setBlendMode(Phaser.BlendModes.ADD);
      image.setAlpha(0);
      image.setVisible(false);
      this.pulses.push({
        image,
        endpoints: { fromX: 0, fromY: 0, toX: 0, toY: 0, sourceWeight: 0 },
        elapsed: 0,
        duration: 1,
        bow: 0,
        active: false,
        trailTint: this.pulseTints[i % this.pulseTints.length]!,
      });
    }
    this.pulseSpawnTimer = Phaser.Math.FloatBetween(
      tuning.background.pulse.idleIntervalMinSeconds,
      tuning.background.pulse.idleIntervalMaxSeconds,
    );

    this.hexMask = new GraphicsMaskController(scene, {
      viewCamera: scene.cameras.main,
      viewTransform: 'world',
      invert: true,
      useInternal: false,
      scrollFactor: 1,
    });
    this.attachHexMaskTargets();
  }

  /** Attaches the (inverted) hex-shape mask to every backdrop layer that must hide behind hex cells. */
  private attachHexMaskTargets(): void {
    const attach = (go: Phaser.GameObjects.GameObject) => this.hexMask.attach(
      go as Phaser.GameObjects.GameObject & {
        enableFilters(): Phaser.GameObjects.GameObject;
        readonly filters: Phaser.Types.GameObjects.FiltersInternalExternal | null;
      },
    );

    attach(this.veinMesh.getGraphics());
    for (const pulse of this.pulses) attach(pulse.image);
    attach(this.pulseGraphics);
    attach(this.spores);
    attach(this.bioFloat);
    attach(this.livingAccent);
  }

  update(snapshot: WorldRenderSnapshot, deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

    const camera = this.scene.cameras.main;
    const viewWidth = this.scene.scale.width / Math.max(0.0001, camera.zoom);
    const viewHeight = this.scene.scale.height / Math.max(0.0001, camera.zoom);
    const halfViewW = viewWidth * 0.5;
    const halfViewH = viewHeight * 0.5;
    const halfDiagonal = Math.hypot(halfViewW, halfViewH);
    const edgeMul = tuning.background.coverage.viewportHalfCoverMultiplier;
    const radialMul = tuning.background.coverage.viewportRadialCoverMultiplier;
    const coverageWidth = Math.max(
      tuning.background.coverage.minimumWorldSizePx,
      viewWidth * tuning.background.coverage.gameplayWidthMultiplier,
      snapshot.bounds.width + viewWidth * 0.8,
      halfViewW * edgeMul,
      halfDiagonal * radialMul,
    );
    const coverageHeight = Math.max(
      tuning.background.coverage.minimumWorldSizePx,
      viewHeight * tuning.background.coverage.gameplayHeightMultiplier,
      snapshot.bounds.height + viewHeight * 0.8,
      halfViewH * edgeMul,
      halfDiagonal * radialMul,
    );
    const sample = createBackdropReactivitySample(snapshot);
    const worldCenter = {
      x: snapshot.bounds.centerX,
      y: snapshot.bounds.centerY,
    };
    const focus = { x: snapshot.focusX, y: snapshot.focusY };
    const layerAnchor = blendTowardFocus(worldCenter, focus, tuning.background.layer1FocusBias);
    this.renderLayer1(layerAnchor, coverageWidth, coverageHeight);
    this.veinMesh.update(deltaSeconds, sample, snapshot);
    this.updatePulses(deltaSeconds, sample, snapshot);
    this.updateParticles(sample, snapshot, layerAnchor, coverageWidth, coverageHeight);
    this.updateHexMask(snapshot);
  }

  /**
   * Rebuilds the hex occlusion mask only when the cell set or hex size actually changes.
   * The mask lives in world space (scroll factor 1), so camera pan/zoom never requires a rebuild;
   * this amortizes a per-frame cost down to ~once per world expansion.
   */
  private updateHexMask(snapshot: WorldRenderSnapshot): void {
    const fingerprint = `${snapshot.cells.length}:${snapshot.hexSize.toFixed(2)}:${snapshot.stage}`;
    if (fingerprint === this.hexMaskFingerprint) {
      return;
    }
    this.hexMaskFingerprint = fingerprint;

    const radius = getBackdropHexFillRadius(snapshot.hexSize);
    this.hexMask.clear();
    this.hexMask.drawMask((graphics) => {
      for (const cell of snapshot.cells) {
        const points = createRegularHexPoints(
          cell.centerX,
          cell.centerY,
          radius,
          this.hexPointsScratch,
        );
        graphics.fillPoints(points as Phaser.Math.Vector2[], true);
      }
    });
  }

  destroy(): void {
    this.baseGraphics.destroy();
    this.vignetteGraphics.destroy();
    this.veinMesh.destroy();
    this.pulses.forEach((pulse) => pulse.image.destroy());
    this.pulseGraphics.destroy();
    this.spores.destroy();
    this.bioFloat.destroy();
    this.livingAccent.destroy();
    this.hexMask.destroy();
  }

  private renderLayer1(
    worldCenter: { x: number; y: number },
    coverageWidth: number,
    coverageHeight: number,
  ): void {
    const bg = tuning.background.palette.bg;
    this.baseGraphics.clear();
    this.baseGraphics.fillStyle(bg.blackBlue, 1);
    this.baseGraphics.fillRect(
      worldCenter.x - coverageWidth,
      worldCenter.y - coverageHeight,
      coverageWidth * 2,
      coverageHeight * 2,
    );
    this.baseGraphics.fillStyle(bg.abyssBlue, 0.045);
    this.baseGraphics.fillEllipse(
      worldCenter.x,
      worldCenter.y,
      coverageWidth * 0.75,
      coverageHeight * 0.68,
    );

    this.vignetteGraphics.clear();
    const v = tuning.background.alpha.layer1Vignette;
    this.vignetteGraphics.fillStyle(bg.blackBlue, v);
    this.vignetteGraphics.fillEllipse(
      worldCenter.x,
      worldCenter.y,
      coverageWidth * 1.55,
      coverageHeight * 1.48,
    );
  }

  private updateParticles(
    sample: ReturnType<typeof createBackdropReactivitySample>,
    snapshot: WorldRenderSnapshot,
    layerAnchor: { x: number; y: number },
    coverageWidth: number,
    coverageHeight: number,
  ): void {
    const spanW = coverageWidth * 2 * 1.04;
    const spanH = coverageHeight * 2 * 1.04;
    this.spores.setPosition(layerAnchor.x, layerAnchor.y);
    this.sporeZone.setTo(-spanW * 0.5, -spanH * 0.5, spanW, spanH);

    this.bioFloat.setPosition(layerAnchor.x, layerAnchor.y);
    this.bioFloatZone.setTo(-spanW * 0.5, -spanH * 0.5, spanW, spanH);

    const primaryLiving = sample.primaryLivingAnchor;
    const accentPulse = primaryLiving.source === 'conquest' ? 1 : 0.62;
    this.livingAccent.setPosition(primaryLiving.x, primaryLiving.y);
    this.livingAccentZone.setTo(
      -snapshot.hexSize * 1.2,
      -snapshot.hexSize * 1.2,
      snapshot.hexSize * 2.4,
      snapshot.hexSize * 2.4,
    );
    this.livingAccent.setAlpha(0.45 + accentPulse * 0.22);
  }

  private updatePulses(
    deltaSeconds: number,
    sample: ReturnType<typeof createBackdropReactivitySample>,
    snapshot: WorldRenderSnapshot,
  ): void {
    this.pulseGraphics.clear();

    const hasConquest = sample.livingAnchors.some((anchor) => anchor.source === 'conquest');
    this.pulseSpawnTimer -= deltaSeconds;
    if (this.pulseSpawnTimer <= 0) {
      this.spawnPulse(sample, snapshot);
      this.pulseSpawnTimer = hasConquest
        ? Phaser.Math.FloatBetween(
            tuning.background.pulse.activeIntervalMinSeconds,
            tuning.background.pulse.activeIntervalMaxSeconds,
          )
        : Phaser.Math.FloatBetween(
            tuning.background.pulse.idleIntervalMinSeconds,
            tuning.background.pulse.idleIntervalMaxSeconds,
          );
    }

    for (const pulse of this.pulses) {
      if (!pulse.active) {
        pulse.image.setVisible(false);
        continue;
      }

      pulse.elapsed += deltaSeconds;
      const t = Math.min(1, pulse.elapsed / Math.max(0.0001, pulse.duration));
      if (t >= 1) {
        pulse.active = false;
        pulse.image.setVisible(false);
        pulse.image.setAlpha(0);
        continue;
      }

      this.renderPulse(pulse, t, snapshot);
    }
  }

  private spawnPulse(
    sample: ReturnType<typeof createBackdropReactivitySample>,
    snapshot: WorldRenderSnapshot,
  ): void {
    const slot = this.pulses.find((pulse) => !pulse.active);
    if (!slot) {
      return;
    }

    const endpoints = pickPulseEndpoints(sample, {
      fallbackSpan: snapshot.hexSize * tuning.background.pulse.spanFallbackFactor,
    });
    if (!endpoints) {
      return;
    }

    slot.endpoints = endpoints;
    slot.elapsed = 0;
    slot.duration = Phaser.Math.FloatBetween(
      tuning.background.pulse.durationMinSeconds,
      tuning.background.pulse.durationMaxSeconds,
    );
    const span = Math.hypot(
      endpoints.toX - endpoints.fromX,
      endpoints.toY - endpoints.fromY,
    );
    slot.bow = (Math.random() - 0.5) * 2 * Math.min(snapshot.hexSize * 0.9, span * 0.18);
    slot.trailTint = this.pulseTints[
      Math.floor(Math.random() * this.pulseTints.length)
    ]!;
    slot.active = true;
    slot.image.setTint(slot.trailTint);
    slot.image.setVisible(true);
  }

  private renderPulse(pulse: VeinPulse, t: number, snapshot: WorldRenderSnapshot): void {
    const envelope = Math.sin(t * Math.PI);
    const position = samplePulsePosition(pulse.endpoints, t, pulse.bow);
    const headAlpha = tuning.background.pulse.headAlpha * envelope;

    pulse.image.setPosition(position.x, position.y);
    const headSize = snapshot.hexSize * tuning.background.pulse.headScale * (0.72 + 0.28 * envelope);
    pulse.image.setDisplaySize(headSize, headSize);
    pulse.image.setAlpha(Phaser.Math.Clamp(headAlpha, 0, 1));

    const trailSegments = 6;
    const trailMaxOffset = Math.min(0.32, t);
    for (let i = 1; i <= trailSegments; i += 1) {
      const tailT = Math.max(0, t - (trailMaxOffset * i) / trailSegments);
      const tailPoint = samplePulsePosition(pulse.endpoints, tailT, pulse.bow);
      const fade = (1 - i / trailSegments) * envelope;
      const width = tuning.background.pulse.width * (0.45 + 0.55 * fade);
      this.pulseGraphics.lineStyle(
        width,
        pulse.trailTint,
        Phaser.Math.Clamp(tuning.background.pulse.trailAlpha * fade, 0, 1),
      );
      this.pulseGraphics.lineBetween(
        tailPoint.x,
        tailPoint.y,
        position.x,
        position.y,
      );
    }
  }
}
