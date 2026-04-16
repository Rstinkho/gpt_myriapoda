import * as Phaser from 'phaser';
import {
  createBackdropReactivitySample,
  getWeightedAnchorCenter,
  sampleBackdropDensity,
  sampleBioWebHexOcclusionRect,
  type BackdropAnchor,
} from '@/background/backgroundMath';
import { textureKeys } from '@/game/assets';
import { tuning } from '@/game/tuning';
import type { WorldRenderSnapshot } from '@/game/types';

type AnchorKind = 'center' | 'living' | 'corruption';

interface DriftSpriteSlot {
  image: Phaser.GameObjects.Image;
  anchorKind: AnchorKind;
  anchorIndex: number;
  offsetX: number;
  offsetY: number;
  driftX: number;
  driftY: number;
  speed: number;
  phase: number;
  alphaMin: number;
  alphaMax: number;
  widthFactor: number;
  heightFactor: number;
  scalePulse: number;
  rotationBase: number;
  rotationDrift: number;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
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
  private readonly layer1Clouds: DriftSpriteSlot[];
  private readonly farCorruptionClouds: DriftSpriteSlot[];
  private readonly webs: DriftSpriteSlot[];
  private readonly websCapillary: DriftSpriteSlot[];
  private readonly membranes: DriftSpriteSlot[];
  private readonly cracks: DriftSpriteSlot[];
  private readonly farDustZone = new Phaser.Geom.Rectangle();
  private readonly sporeZone = new Phaser.Geom.Rectangle();
  private readonly livingAccentZone = new Phaser.Geom.Rectangle();
  private readonly nearMoteZone = new Phaser.Geom.Rectangle();
  private readonly bioFloatZone = new Phaser.Geom.Rectangle();
  private readonly farDust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly spores: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly bioFloat: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly livingAccent: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly nearMotes: Phaser.GameObjects.Particles.ParticleEmitter;
  private elapsed = 0;
  private corruptionFlickerTimer = 8;
  private corruptionFlickerStrength = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.baseGraphics = scene.add.graphics().setDepth(tuning.background.depths.layer1);
    this.vignetteGraphics = scene.add.graphics().setDepth(tuning.background.depths.layer1 + 0.01);
    this.baseGraphics.setScrollFactor(1, 1);
    this.vignetteGraphics.setScrollFactor(1, 1);

    this.layer1Clouds = [
      this.createImageSlot(textureKeys.background.softCloud, tuning.background.depths.layer1 + 0.02, tuning.background.parallax.layer1, 'center', 0, {
        offsetX: 120,
        offsetY: -24,
        driftX: 18,
        driftY: 10,
        speed: 0.18,
        phase: 0.2,
        alphaMin: tuning.background.alpha.layer1CloudMin,
        alphaMax: tuning.background.alpha.layer1CloudMax,
        widthFactor: 0.98,
        heightFactor: 0.78,
        scalePulse: 0.04,
        rotationBase: 0.14,
        rotationDrift: 0.02,
      }),
      this.createImageSlot(textureKeys.background.softCloud, tuning.background.depths.layer1 + 0.025, tuning.background.parallax.layer1, 'center', 1, {
        offsetX: -160,
        offsetY: 88,
        driftX: 12,
        driftY: 14,
        speed: 0.14,
        phase: 1.1,
        alphaMin: tuning.background.alpha.layer1CloudMin * 0.9,
        alphaMax: tuning.background.alpha.layer1CloudMax * 0.88,
        widthFactor: 0.82,
        heightFactor: 0.68,
        scalePulse: 0.035,
        rotationBase: -0.32,
        rotationDrift: 0.03,
      }),
    ];
    this.layer1Clouds[0].image.setTint(tuning.background.palette.bg.darkPetrol);
    this.layer1Clouds[1].image.setTint(tuning.background.palette.bg.deepTeal);

    this.farCorruptionClouds = [
      this.createImageSlot(textureKeys.background.softCloud, tuning.background.depths.layer4Far, tuning.background.parallax.layer4, 'corruption', 0, {
        offsetX: -100,
        offsetY: 120,
        driftX: 10,
        driftY: 6,
        speed: 0.16,
        phase: 0.7,
        alphaMin: tuning.background.alpha.corruptionMin,
        alphaMax: tuning.background.alpha.corruptionMax,
        widthFactor: 2.6,
        heightFactor: 2.1,
        scalePulse: 0.03,
        rotationBase: 0.2,
        rotationDrift: 0.03,
      }),
      this.createImageSlot(textureKeys.background.softCloud, tuning.background.depths.layer4Far + 0.005, tuning.background.parallax.layer4, 'corruption', 1, {
        offsetX: 96,
        offsetY: -82,
        driftX: 8,
        driftY: 8,
        speed: 0.13,
        phase: 1.8,
        alphaMin: tuning.background.alpha.corruptionMin * 0.9,
        alphaMax: tuning.background.alpha.corruptionMax * 0.92,
        widthFactor: 2.2,
        heightFactor: 1.9,
        scalePulse: 0.025,
        rotationBase: -0.24,
        rotationDrift: 0.025,
      }),
      this.createImageSlot(textureKeys.background.softCloud, tuning.background.depths.layer4Far + 0.01, tuning.background.parallax.layer4, 'corruption', 2, {
        offsetX: 18,
        offsetY: 44,
        driftX: 7,
        driftY: 10,
        speed: 0.15,
        phase: 2.4,
        alphaMin: tuning.background.alpha.corruptionMin * 0.85,
        alphaMax: tuning.background.alpha.corruptionMax * 0.86,
        widthFactor: 1.9,
        heightFactor: 1.6,
        scalePulse: 0.02,
        rotationBase: 0.48,
        rotationDrift: 0.018,
      }),
    ];
    this.farCorruptionClouds[0].image.setTint(tuning.background.palette.dead.ashViolet);
    this.farCorruptionClouds[1].image.setTint(tuning.background.palette.dead.deadGray);
    this.farCorruptionClouds[2].image.setTint(tuning.background.palette.dead.bruisePurple);

    const webTemplates: Omit<DriftSpriteSlot, 'image' | 'anchorKind' | 'anchorIndex'>[] = [
      {
        offsetX: -70,
        offsetY: -18,
        driftX: 10,
        driftY: 8,
        speed: 0.18,
        phase: 0.4,
        alphaMin: tuning.background.alpha.tissueWebMin,
        alphaMax: tuning.background.alpha.tissueWebMax,
        widthFactor: 5.6,
        heightFactor: 5.2,
        scalePulse: 0.04,
        rotationBase: 0.14,
        rotationDrift: 0.035,
      },
      {
        offsetX: 96,
        offsetY: 64,
        driftX: 12,
        driftY: 10,
        speed: 0.16,
        phase: 1.5,
        alphaMin: tuning.background.alpha.tissueWebMin * 0.9,
        alphaMax: tuning.background.alpha.tissueWebMax * 0.92,
        widthFactor: 5.1,
        heightFactor: 4.8,
        scalePulse: 0.03,
        rotationBase: -0.5,
        rotationDrift: 0.03,
      },
      {
        offsetX: 14,
        offsetY: -96,
        driftX: 8,
        driftY: 9,
        speed: 0.14,
        phase: 2.1,
        alphaMin: tuning.background.alpha.tissueWebMin * 0.8,
        alphaMax: tuning.background.alpha.tissueWebMax * 0.82,
        widthFactor: 4.6,
        heightFactor: 4.2,
        scalePulse: 0.028,
        rotationBase: 0.88,
        rotationDrift: 0.022,
      },
    ];
    const webTints = [
      tuning.background.palette.bio.cyanDim,
      tuning.background.palette.bio.toxicGreen,
      tuning.background.palette.bio.cyanSoft,
    ];
    const { cols, rows } = tuning.background.tissueWebGrid;
    const webCount = cols * rows;
    this.webs = [];
    for (let i = 0; i < webCount; i += 1) {
      const template = webTemplates[i % webTemplates.length]!;
      const slot = this.createImageSlot(
        textureKeys.background.bioWeb,
        tuning.background.depths.layer2 + (i % 3) * 0.005,
        1,
        'living',
        i % 3,
        {
          ...template,
          phase: template.phase + i * 0.19,
        },
      );
      slot.image.setTint(webTints[i % webTints.length]!);
      this.webs.push(slot);
    }

    const capillaryTints = [
      tuning.background.palette.bio.capillaryRose,
      tuning.background.palette.bio.capillaryWine,
      tuning.background.palette.bio.capillaryCoral,
    ];
    const { cols: capCols, rows: capRows } = tuning.background.tissueWebCapillaryGrid;
    const capCount = capCols * capRows;
    this.websCapillary = [];
    for (let i = 0; i < capCount; i += 1) {
      const template = webTemplates[i % webTemplates.length]!;
      const slot = this.createImageSlot(
        textureKeys.background.bioWeb,
        tuning.background.depths.layer2Capillary + (i % 3) * 0.004,
        1,
        'living',
        i % 3,
        {
          ...template,
          phase: template.phase + i * 0.27 + 2.1,
          speed: template.speed * 1.45,
          scalePulse: template.scalePulse * 1.35,
        },
      );
      slot.image.setTint(capillaryTints[i % capillaryTints.length]!);
      slot.image.setBlendMode(Phaser.BlendModes.ADD);
      this.websCapillary.push(slot);
    }

    this.membranes = [
      this.createImageSlot(textureKeys.background.membraneStain, tuning.background.depths.layer2 - 0.01, tuning.background.parallax.layer2, 'living', 0, {
        offsetX: -92,
        offsetY: 82,
        driftX: 7,
        driftY: 6,
        speed: 0.13,
        phase: 0.9,
        alphaMin: tuning.background.alpha.membraneMin,
        alphaMax: tuning.background.alpha.membraneMax,
        widthFactor: 4.8,
        heightFactor: 4.4,
        scalePulse: 0.028,
        rotationBase: -0.24,
        rotationDrift: 0.016,
      }),
      this.createImageSlot(textureKeys.background.membraneStain, tuning.background.depths.layer2 - 0.008, tuning.background.parallax.layer2, 'living', 1, {
        offsetX: 110,
        offsetY: -72,
        driftX: 6,
        driftY: 8,
        speed: 0.12,
        phase: 1.6,
        alphaMin: tuning.background.alpha.membraneMin * 0.92,
        alphaMax: tuning.background.alpha.membraneMax * 0.95,
        widthFactor: 4.2,
        heightFactor: 3.9,
        scalePulse: 0.024,
        rotationBase: 0.38,
        rotationDrift: 0.018,
      }),
      this.createImageSlot(textureKeys.background.membraneStain, tuning.background.depths.layer2 - 0.006, tuning.background.parallax.layer2, 'living', 2, {
        offsetX: 28,
        offsetY: 24,
        driftX: 5,
        driftY: 7,
        speed: 0.1,
        phase: 2.6,
        alphaMin: tuning.background.alpha.membraneMin * 0.85,
        alphaMax: tuning.background.alpha.membraneMax * 0.88,
        widthFactor: 3.9,
        heightFactor: 3.4,
        scalePulse: 0.02,
        rotationBase: -0.6,
        rotationDrift: 0.014,
      }),
    ];
    this.membranes[0].image.setTint(tuning.background.palette.bg.darkPetrol);
    this.membranes[1].image.setTint(tuning.background.palette.bg.deepTeal);
    this.membranes[2].image.setTint(0x17352f);

    this.cracks = Array.from({ length: 4 }, (_, index) =>
      this.createImageSlot(textureKeys.background.corruptionCrack, tuning.background.depths.layer4Near, tuning.background.parallax.layer4, 'corruption', index, {
        offsetX: (index % 2 === 0 ? -1 : 1) * (50 + index * 18),
        offsetY: (index < 2 ? -1 : 1) * (32 + index * 14),
        driftX: 4,
        driftY: 5,
        speed: 0.11 + index * 0.01,
        phase: 0.6 + index * 0.7,
        alphaMin: tuning.background.alpha.crackMin,
        alphaMax: tuning.background.alpha.crackMax,
        widthFactor: 2.4,
        heightFactor: 2.4,
        scalePulse: 0.02,
        rotationBase: index * 0.45,
        rotationDrift: 0.016,
      }),
    );
    this.cracks.forEach((slot, index) => {
      slot.image.setTint(
        index % 2 === 0
          ? tuning.background.palette.dead.decayPink
          : tuning.background.palette.dead.ashViolet,
      );
    });

    this.farDust = scene.add.particles(0, 0, textureKeys.background.particleDot, {
      emitZone: { type: 'random' as const, source: createRandomZoneSource(this.farDustZone) },
      lifespan: { min: 12000, max: 22000 },
      speedX: { min: -2, max: 2 },
      speedY: { min: -4, max: -1 },
      scale: { start: 0.08, end: 0.02 },
      alpha: { start: 0.12, end: 0 },
      quantity: 1,
      frequency: tuning.background.particles.farDustFrequencyMs,
      maxAliveParticles: tuning.background.particles.farDustMax,
      tint: [
        tuning.background.palette.particles.dust,
        tuning.background.palette.bio.cyanSoft,
      ],
    });
    this.farDust.setDepth(tuning.background.depths.farDust);
    this.farDust.setScrollFactor(tuning.background.parallax.farDust);

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
    this.spores.setScrollFactor(1, 1);

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
    this.bioFloat.setScrollFactor(1, 1);

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
    this.livingAccent.setDepth(tuning.background.depths.spores + 0.01);
    this.livingAccent.setScrollFactor(tuning.background.parallax.nearMotes);

    this.nearMotes = scene.add.particles(0, 0, textureKeys.background.moteFragment, {
      emitZone: { type: 'random' as const, source: createRandomZoneSource(this.nearMoteZone) },
      lifespan: { min: 9000, max: 14000 },
      speedX: { min: -6, max: 10 },
      speedY: { min: -6, max: 5 },
      rotate: { min: -35, max: 35 },
      scale: { start: 0.26, end: 0.08 },
      alpha: { start: 0.28, end: 0 },
      quantity: 1,
      frequency: tuning.background.particles.nearMotesFrequencyMs,
      maxAliveParticles: tuning.background.particles.nearMotesMax,
      tint: [
        tuning.background.palette.bio.cyanSoft,
        tuning.background.palette.particles.dust,
        tuning.background.palette.bio.paleLime,
      ],
    });
    this.nearMotes.setDepth(tuning.background.depths.nearMotes);
    this.nearMotes.setScrollFactor(tuning.background.parallax.nearMotes);
  }

  update(snapshot: WorldRenderSnapshot, deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.updateCorruptionFlicker(deltaSeconds);

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
    const livingCenter = getWeightedAnchorCenter(sample.livingAnchors);

    this.renderLayer1(layerAnchor, coverageWidth, coverageHeight);
    this.updateSlots(this.farCorruptionClouds, sample.corruptionAnchors, worldCenter, sample, snapshot, coverageWidth * 0.36);
    this.updateSlots(this.membranes, sample.livingAnchors, livingCenter, sample, snapshot, snapshot.hexSize);
    this.updateCapillaryWebWorldFill(layerAnchor, coverageWidth, coverageHeight, sample, snapshot);
    this.updateTissueWebWorldFill(layerAnchor, coverageWidth, coverageHeight, sample, snapshot);
    this.updateSlots(this.cracks, sample.corruptionAnchors, worldCenter, sample, snapshot, snapshot.hexSize);
    this.updateParticles(sample, snapshot, layerAnchor, livingCenter, coverageWidth, coverageHeight);
  }

  destroy(): void {
    this.baseGraphics.destroy();
    this.vignetteGraphics.destroy();
    this.layer1Clouds.forEach((slot) => slot.image.destroy());
    this.farCorruptionClouds.forEach((slot) => slot.image.destroy());
    this.webs.forEach((slot) => slot.image.destroy());
    this.websCapillary.forEach((slot) => slot.image.destroy());
    this.membranes.forEach((slot) => slot.image.destroy());
    this.cracks.forEach((slot) => slot.image.destroy());
    this.farDust.destroy();
    this.spores.destroy();
    this.bioFloat.destroy();
    this.livingAccent.destroy();
    this.nearMotes.destroy();
  }

  private createImageSlot(
    texture: string,
    depth: number,
    scrollFactor: number,
    anchorKind: AnchorKind,
    anchorIndex: number,
    config: Omit<DriftSpriteSlot, 'image' | 'anchorKind' | 'anchorIndex'>,
  ): DriftSpriteSlot {
    const image = this.scene.add.image(0, 0, texture);
    image.setOrigin(0.5);
    image.setDepth(depth);
    image.setScrollFactor(scrollFactor);
    image.setAlpha(0);

    return {
      image,
      anchorKind,
      anchorIndex,
      ...config,
    };
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
    // Single subtle center wash (no stacked corner / offset ovals).
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

    for (const slot of this.layer1Clouds) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * slot.speed + slot.phase);
      slot.image.setPosition(
        worldCenter.x + slot.offsetX + Math.sin(this.elapsed * slot.speed + slot.phase) * slot.driftX,
        worldCenter.y + slot.offsetY + Math.cos(this.elapsed * slot.speed * 0.8 + slot.phase) * slot.driftY,
      );
      slot.image.setDisplaySize(
        coverageWidth * slot.widthFactor * (1 + slot.scalePulse * pulse),
        coverageHeight * slot.heightFactor * (1 + slot.scalePulse * pulse),
      );
      slot.image.setAlpha(lerp(slot.alphaMin, slot.alphaMax, pulse));
      slot.image.setRotation(slot.rotationBase + (pulse - 0.5) * slot.rotationDrift);
    }
  }

  /** Reddish capillary layer: finer grid, staggered vs main webs, drawn underneath. */
  private updateCapillaryWebWorldFill(
    anchor: { x: number; y: number },
    halfCoverW: number,
    halfCoverH: number,
    sample: ReturnType<typeof createBackdropReactivitySample>,
    snapshot: WorldRenderSnapshot,
  ): void {
    const { cols, rows } = tuning.background.tissueWebCapillaryGrid;
    const floor = tuning.background.tissueWebCapillaryAlphaFloor;
    const sizeFactor = tuning.background.tissueWebCapillaryBaseFactor;
    const tileScale = tuning.background.tissueWebCapillaryTileScale;
    const alphaMul = tuning.background.tissueWebCapillaryAlphaMul;
    let idx = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const slot = this.websCapillary[idx];
        if (!slot) {
          break;
        }
        idx += 1;
        const u = cols > 1 ? (col + 0.5) / cols : 0.5;
        const v = rows > 1 ? (row + 0.5) / rows : 0.5;
        const gx = (u - 0.5) * 2 * halfCoverW * 0.96;
        const gy = (v - 0.5) * 2 * halfCoverH * 0.96;
        const wobbleX =
          Math.sin(this.elapsed * 0.22 + idx * 0.41) * halfCoverW * 0.034;
        const wobbleY =
          Math.cos(this.elapsed * 0.19 + idx * 0.33) * halfCoverH * 0.034;
        const basePoint = {
          x: anchor.x + gx + wobbleX + slot.offsetX * 0.2,
          y: anchor.y + gy + wobbleY + slot.offsetY * 0.2,
        };
        const driftWave = Math.sin(this.elapsed * slot.speed + slot.phase);
        const driftWaveY = Math.cos(this.elapsed * slot.speed * 0.84 + slot.phase);
        const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * (0.65 + slot.speed) + slot.phase * 1.4);
        const flowPulse =
          0.72 + 0.28 * Math.sin(this.elapsed * 2.15 + idx * 0.51 + slot.phase);
        const density = sampleBackdropDensity(basePoint, sample, snapshot.hexSize);
        const alphaT = clamp(
          floor +
            (1 - floor) *
              (density.bio * 0.45 + density.localPulse * 0.35 + 0.35),
          0,
          1,
        );
        const baseSize = Math.max(
          snapshot.hexSize * 3.6,
          Math.min(halfCoverW, halfCoverH) * sizeFactor,
        );
        const targetWidth =
          baseSize * slot.widthFactor * tileScale * (1 + slot.scalePulse * pulse);
        const targetHeight =
          baseSize * slot.heightFactor * tileScale * (1 + slot.scalePulse * pulse);
        const drawX = basePoint.x + driftWave * slot.driftX * 0.62;
        const drawY = basePoint.y + driftWaveY * slot.driftY * 0.62;
        const targetAlpha =
          alphaMul *
          flowPulse *
          Math.max(
            tuning.background.alpha.tissueWebMin * 0.95,
            lerp(slot.alphaMin, slot.alphaMax, alphaT),
          ) *
          sampleBioWebHexOcclusionRect(
            { x: drawX, y: drawY },
            targetWidth * 0.5,
            targetHeight * 0.5,
            snapshot,
          );

        slot.image.setPosition(drawX, drawY);
        slot.image.setDisplaySize(targetWidth, targetHeight);
        slot.image.setAlpha(Phaser.Math.Clamp(targetAlpha, 0, 1));
        slot.image.setRotation(
          slot.rotationBase + driftWave * slot.rotationDrift + Math.sin(this.elapsed * 1.8 + idx) * 0.12,
        );
      }
    }
  }

  /** World-locked tiled tissue webs across the full backdrop coverage (no parallax gaps). */
  private updateTissueWebWorldFill(
    anchor: { x: number; y: number },
    halfCoverW: number,
    halfCoverH: number,
    sample: ReturnType<typeof createBackdropReactivitySample>,
    snapshot: WorldRenderSnapshot,
  ): void {
    const { cols, rows } = tuning.background.tissueWebGrid;
    const floor = tuning.background.tissueWebAlphaFloor;
    const sizeFactor = tuning.background.tissueWebBaseSizeFactor;
    const tileScale = tuning.background.tissueWebTileScale;
    let idx = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const slot = this.webs[idx];
        if (!slot) {
          break;
        }
        idx += 1;
        const u = cols > 1 ? col / (cols - 1) : 0.5;
        const v = rows > 1 ? row / (rows - 1) : 0.5;
        const gx = (u - 0.5) * 2 * halfCoverW * 0.96;
        const gy = (v - 0.5) * 2 * halfCoverH * 0.96;
        const wobbleX =
          Math.sin(this.elapsed * 0.12 + idx * 0.37) * halfCoverW * 0.02;
        const wobbleY =
          Math.cos(this.elapsed * 0.1 + idx * 0.29) * halfCoverH * 0.02;
        const basePoint = {
          x: anchor.x + gx + wobbleX + slot.offsetX * 0.22,
          y: anchor.y + gy + wobbleY + slot.offsetY * 0.22,
        };
        const driftWave = Math.sin(this.elapsed * slot.speed + slot.phase);
        const driftWaveY = Math.cos(this.elapsed * slot.speed * 0.84 + slot.phase);
        const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * (0.5 + slot.speed) + slot.phase * 1.4);
        const density = sampleBackdropDensity(basePoint, sample, snapshot.hexSize);
        const alphaT = clamp(
          floor +
            (1 - floor) *
              (density.bio * 0.5 + density.localPulse * 0.35 + 0.28),
          0,
          1,
        );
        const baseSize = Math.max(
          snapshot.hexSize * 4,
          Math.min(halfCoverW, halfCoverH) * sizeFactor,
        );
        const targetWidth =
          baseSize * slot.widthFactor * tileScale * (1 + slot.scalePulse * pulse);
        const targetHeight =
          baseSize * slot.heightFactor * tileScale * (1 + slot.scalePulse * pulse);
        const drawX = basePoint.x + driftWave * slot.driftX * 0.55;
        const drawY = basePoint.y + driftWaveY * slot.driftY * 0.55;
        const targetAlpha =
          Math.max(
            tuning.background.alpha.tissueWebMin * 0.85,
            lerp(slot.alphaMin, slot.alphaMax, alphaT),
          ) *
          sampleBioWebHexOcclusionRect(
            { x: drawX, y: drawY },
            targetWidth * 0.5,
            targetHeight * 0.5,
            snapshot,
          );

        slot.image.setPosition(drawX, drawY);
        slot.image.setDisplaySize(targetWidth, targetHeight);
        slot.image.setAlpha(targetAlpha);
        slot.image.setRotation(slot.rotationBase + driftWave * slot.rotationDrift);
      }
    }
  }

  private updateSlots(
    slots: DriftSpriteSlot[],
    anchors: BackdropAnchor[],
    fallbackAnchor: { x: number; y: number },
    sample: ReturnType<typeof createBackdropReactivitySample>,
    snapshot: WorldRenderSnapshot,
    baseSize: number,
  ): void {
    for (const slot of slots) {
      const anchor =
        slot.anchorKind === 'center'
          ? undefined
          : anchors[slot.anchorIndex % Math.max(1, anchors.length)];
      const anchorPoint = anchor
        ? { x: anchor.x, y: anchor.y }
        : fallbackAnchor;
      const driftWave = Math.sin(this.elapsed * slot.speed + slot.phase);
      const driftWaveY = Math.cos(this.elapsed * slot.speed * 0.84 + slot.phase);
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * (0.5 + slot.speed) + slot.phase * 1.4);
      const basePoint = {
        x: anchorPoint.x + slot.offsetX,
        y: anchorPoint.y + slot.offsetY,
      };
      const density = sampleBackdropDensity(basePoint, sample, snapshot.hexSize);
      const alphaT =
        slot.anchorKind === 'corruption'
          ? clamp(density.corruption + this.corruptionFlickerStrength)
          : slot.anchorKind === 'living'
            ? clamp(density.bio + density.localPulse * 0.8)
            : pulse;
      const targetAlpha = lerp(slot.alphaMin, slot.alphaMax, alphaT);
      const targetWidth = baseSize * slot.widthFactor * (1 + slot.scalePulse * pulse);
      const targetHeight = baseSize * slot.heightFactor * (1 + slot.scalePulse * pulse);

      slot.image.setPosition(
        basePoint.x + driftWave * slot.driftX,
        basePoint.y + driftWaveY * slot.driftY,
      );
      slot.image.setDisplaySize(targetWidth, targetHeight);
      slot.image.setAlpha(targetAlpha);
      slot.image.setRotation(slot.rotationBase + driftWave * slot.rotationDrift);
    }
  }

  private updateParticles(
    sample: ReturnType<typeof createBackdropReactivitySample>,
    snapshot: WorldRenderSnapshot,
    layerAnchor: { x: number; y: number },
    livingCenter: { x: number; y: number },
    coverageWidth: number,
    coverageHeight: number,
  ): void {
    this.farDust.setPosition(layerAnchor.x, layerAnchor.y);
    this.farDustZone.setTo(
      -coverageWidth * 0.58,
      -coverageHeight * 0.58,
      coverageWidth * 1.16,
      coverageHeight * 1.16,
    );

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

    this.nearMotes.setPosition(primaryLiving.x, primaryLiving.y);
    this.nearMoteZone.setTo(
      -snapshot.hexSize * 1.7,
      -snapshot.hexSize * 1.6,
      snapshot.hexSize * 3.4,
      snapshot.hexSize * 3.2,
    );
    this.nearMotes.setAlpha(0.32 + accentPulse * 0.12);
  }

  private updateCorruptionFlicker(deltaSeconds: number): void {
    this.corruptionFlickerTimer -= deltaSeconds;
    if (this.corruptionFlickerTimer <= 0) {
      this.corruptionFlickerTimer = Phaser.Math.FloatBetween(
        tuning.background.motion.rareFlickerMinSeconds,
        tuning.background.motion.rareFlickerMaxSeconds,
      );
      this.corruptionFlickerStrength = 0.12;
    }

    this.corruptionFlickerStrength = Math.max(
      0,
      this.corruptionFlickerStrength - deltaSeconds * 0.42,
    );
  }
}
