import * as Phaser from 'phaser';
import { textureKeys } from '@/game/assets';
import { tuning } from '@/game/tuning';

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
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

export class EvolutionBackdropRenderer {
  private readonly baseGraphics: Phaser.GameObjects.Graphics;
  private readonly cloudA: Phaser.GameObjects.Image;
  private readonly cloudB: Phaser.GameObjects.Image;
  private readonly tissueA: Phaser.GameObjects.Image;
  private readonly tissueB: Phaser.GameObjects.Image;
  private readonly dustZone = new Phaser.Geom.Rectangle();
  private readonly glowZone = new Phaser.Geom.Rectangle();
  private readonly farDust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly softGlow: Phaser.GameObjects.Particles.ParticleEmitter;
  private elapsed = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.baseGraphics = scene.add.graphics().setDepth(tuning.background.depths.overlayBase);

    this.cloudA = this.createImage(
      textureKeys.background.softCloud,
      tuning.background.depths.overlayBase + 0.01,
      tuning.background.palette.bg.darkPetrol,
    );
    this.cloudB = this.createImage(
      textureKeys.background.softCloud,
      tuning.background.depths.overlayBase + 0.015,
      tuning.background.palette.bg.deepTeal,
    );
    this.tissueA = this.createImage(
      textureKeys.background.bioWeb,
      tuning.background.depths.overlayTissue,
      tuning.background.palette.bio.cyanDim,
    );
    this.tissueB = this.createImage(
      textureKeys.background.membraneStain,
      tuning.background.depths.overlayTissue - 0.005,
      tuning.background.palette.bg.darkPetrol,
    );

    this.farDust = scene.add.particles(0, 0, textureKeys.background.particleDot, {
      emitZone: { type: 'random' as const, source: createRandomZoneSource(this.dustZone) },
      lifespan: { min: 12000, max: 22000 },
      speedX: { min: -2, max: 2 },
      speedY: { min: -3, max: -0.5 },
      scale: { start: 0.08, end: 0.02 },
      alpha: { start: 0.11, end: 0 },
      quantity: 1,
      frequency: tuning.background.particles.overlayDustFrequencyMs,
      maxAliveParticles: tuning.background.particles.overlayDustMax,
      tint: [
        tuning.background.palette.particles.dust,
        tuning.background.palette.bio.cyanSoft,
      ],
    });
    this.farDust.setDepth(tuning.background.depths.overlayDust);
    this.farDust.setScrollFactor(0);

    this.softGlow = scene.add.particles(0, 0, textureKeys.background.softGlowDot, {
      emitZone: { type: 'random' as const, source: createRandomZoneSource(this.glowZone) },
      lifespan: { min: 5200, max: 9800 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -18, max: 8 },
      scale: { start: 0.14, end: 0.03 },
      alpha: { start: 0.2, end: 0 },
      quantity: 1,
      frequency: tuning.background.particles.overlayGlowFrequencyMs,
      maxAliveParticles: tuning.background.particles.overlayGlowMax,
      tint: [
        tuning.background.palette.bio.cyanSoft,
        tuning.background.palette.bio.mintSoft,
        tuning.background.palette.particles.warmRare,
      ],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.softGlow.setDepth(tuning.background.depths.overlayDust + 0.01);
    this.softGlow.setScrollFactor(0);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    this.baseGraphics.clear();
    this.baseGraphics.fillStyle(tuning.background.palette.bg.blackBlue, 1);
    this.baseGraphics.fillRect(0, 0, width, height);
    this.baseGraphics.fillStyle(tuning.background.palette.bg.abyssBlue, 0.16);
    this.baseGraphics.fillEllipse(centerX + width * 0.06, centerY, width * 1.12, height * 0.96);
    this.baseGraphics.fillStyle(tuning.background.palette.bg.deepTeal, 0.06);
    this.baseGraphics.fillEllipse(centerX - width * 0.18, centerY - height * 0.1, width * 0.42, height * 0.32);
    this.baseGraphics.fillStyle(
      tuning.background.palette.bg.blackBlue,
      tuning.background.alpha.layer1Vignette * 0.82,
    );
    this.baseGraphics.fillEllipse(width * 0.1, height * 0.12, width * 0.6, height * 0.6);
    this.baseGraphics.fillEllipse(width * 0.9, height * 0.14, width * 0.62, height * 0.62);
    this.baseGraphics.fillEllipse(width * 0.14, height * 0.9, width * 0.66, height * 0.66);
    this.baseGraphics.fillEllipse(width * 0.88, height * 0.88, width * 0.64, height * 0.64);

    const cloudPulseA = 0.5 + 0.5 * Math.sin(this.elapsed * 0.16 + 0.4);
    const cloudPulseB = 0.5 + 0.5 * Math.sin(this.elapsed * 0.12 + 1.2);
    const tissuePulse = 0.5 + 0.5 * Math.sin(this.elapsed * 0.22 + 0.7);

    this.cloudA.setPosition(
      centerX + width * 0.08 + Math.sin(this.elapsed * 0.08) * 12,
      centerY - height * 0.02 + Math.cos(this.elapsed * 0.06) * 8,
    );
    this.cloudA.setDisplaySize(width * 1.08, height * 0.88);
    this.cloudA.setAlpha(
      lerp(
        tuning.background.alpha.overlayCloudMin,
        tuning.background.alpha.overlayCloudMax,
        cloudPulseA,
      ),
    );
    this.cloudA.setRotation(0.18 + (cloudPulseA - 0.5) * 0.04);

    this.cloudB.setPosition(
      centerX - width * 0.12 + Math.sin(this.elapsed * 0.06 + 1) * 10,
      centerY + height * 0.08 + Math.cos(this.elapsed * 0.05 + 0.6) * 10,
    );
    this.cloudB.setDisplaySize(width * 0.94, height * 0.82);
    this.cloudB.setAlpha(
      lerp(
        tuning.background.alpha.overlayCloudMin * 0.9,
        tuning.background.alpha.overlayCloudMax * 0.92,
        cloudPulseB,
      ),
    );
    this.cloudB.setRotation(-0.28 + (cloudPulseB - 0.5) * 0.03);

    this.tissueA.setPosition(
      centerX - width * 0.04 + Math.sin(this.elapsed * 0.09 + 0.5) * 10,
      centerY + Math.cos(this.elapsed * 0.08 + 0.9) * 8,
    );
    this.tissueA.setDisplaySize(width * 0.58, height * 0.58);
    this.tissueA.setAlpha(
      lerp(
        tuning.background.alpha.overlayTissueMin,
        tuning.background.alpha.overlayTissueMax,
        tissuePulse,
      ),
    );
    this.tissueA.setRotation(0.34 + (tissuePulse - 0.5) * 0.04);

    this.tissueB.setPosition(
      centerX + width * 0.14 + Math.sin(this.elapsed * 0.07 + 1.4) * 8,
      centerY - height * 0.07 + Math.cos(this.elapsed * 0.06 + 1.1) * 6,
    );
    this.tissueB.setDisplaySize(width * 0.44, height * 0.4);
    this.tissueB.setAlpha(
      lerp(
        tuning.background.alpha.overlayTissueMin * 0.85,
        tuning.background.alpha.overlayTissueMax * 0.88,
        1 - tissuePulse * 0.4,
      ),
    );
    this.tissueB.setRotation(-0.42 + (tissuePulse - 0.5) * 0.03);

    this.farDust.setPosition(centerX, centerY);
    this.softGlow.setPosition(centerX, centerY);
    const ow = width * tuning.background.coverage.overlayWidthMultiplier;
    const oh = height * tuning.background.coverage.overlayHeightMultiplier;
    this.dustZone.setTo(-ow * 0.5, -oh * 0.5, ow, oh);
    this.glowZone.setTo(-ow * 0.5, -oh * 0.5, ow, oh);
  }

  destroy(): void {
    this.baseGraphics.destroy();
    this.cloudA.destroy();
    this.cloudB.destroy();
    this.tissueA.destroy();
    this.tissueB.destroy();
    this.farDust.destroy();
    this.softGlow.destroy();
  }

  private createImage(
    texture: string,
    depth: number,
    tint: number,
  ): Phaser.GameObjects.Image {
    return this.scene.add
      .image(0, 0, texture)
      .setOrigin(0.5)
      .setDepth(depth)
      .setScrollFactor(0)
      .setTint(tint);
  }
}
