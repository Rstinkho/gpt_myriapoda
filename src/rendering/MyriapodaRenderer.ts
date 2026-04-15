import * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import type { DashStateSnapshot, PickupPalette } from '@/game/types';
import { getPickupDefinition } from '@/entities/pickups/PickupRegistry';
import {
  getPickupAnimationPhase,
  samplePickupAnimation,
} from '@/entities/pickups/PickupVisuals';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { GraphicsMaskController } from '@/phaser/GraphicsMaskController';
import { MaskedGraphicsLayer } from '@/phaser/MaskedGraphicsLayer';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { sampleDashRearAnchor } from '@/rendering/dashFxMath';
import { LimbRenderer } from '@/rendering/LimbRenderer';
import { normalize, rotateVector } from '@/utils/math';
import type { MyriapodaDamageEffect } from '@/entities/myriapoda/Myriapoda';

const bodyShadowDepth = 4.9;
const stomachGradientDepth = 5.02;
const dashSpiralDepth = 5.03;
const stomachNoiseDepth = 5.04;
const bodyDepth = 5.08;
const limbDepth = 5.1;
const limbStrikeDepth = 5.12;
const stomachGlowDepth = 5.14;
const stomachParticleDepth = 5.16;
const stomachMembraneDepth = 5.18;
const shellHighlightDepth = 5.2;
const damageFxDepth = 5.22;
const dashWaveDepth = 5.24;
const vacuumDepth = 5.26;
const stomachNoiseTextureSize = 256;

interface SegmentVisual {
  radius: number;
  alpha: number;
  fillColor: number;
}

interface ConnectorRenderStyle {
  fillColor: number;
  fillAlpha: number;
  lineColor?: number;
  lineAlpha?: number;
  lineWidth?: number;
  offsetX?: number;
  offsetY?: number;
}

interface MyriapodaRendererConfig {
  renderScale?: number;
  renderAnchorX?: number;
  renderAnchorY?: number;
  bodyAlphaMultiplier?: number;
  outlineAlphaMultiplier?: number;
  outlineWidthMultiplier?: number;
  highlightAlphaMultiplier?: number;
  shadowAlphaMultiplier?: number;
}

type TransformableDisplayObject =
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Gradient
  | Phaser.GameObjects.Image;

export class MyriapodaRenderer {
  private readonly scene: Phaser.Scene;
  private readonly config: Required<MyriapodaRendererConfig>;
  private readonly bodyShadowGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachGradient: Phaser.GameObjects.Gradient;
  private readonly stomachNoiseQuad: Phaser.GameObjects.NoiseSimplex2D;
  private readonly stomachNoiseLayer: Phaser.GameObjects.Image;
  private readonly dashRearWhirlGraphics: Phaser.GameObjects.Graphics;
  private readonly shellGraphics: Phaser.GameObjects.Graphics;
  private readonly limbGraphics: Phaser.GameObjects.Graphics;
  private readonly limbStrikeGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachGlowGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachMembraneGraphics: Phaser.GameObjects.Graphics;
  private readonly shellHighlightGraphics: Phaser.GameObjects.Graphics;
  private readonly damageFxGraphics: Phaser.GameObjects.Graphics;
  private readonly dashSideWaveGraphics: Phaser.GameObjects.Graphics;
  private readonly vacuumGraphics: Phaser.GameObjects.Graphics;
  private readonly stomachFxMask: GraphicsMaskController;
  private readonly stomachParticles: MaskedGraphicsLayer;
  private readonly limbRenderer: LimbRenderer;
  private readonly stomachNoiseTextureKey: string;
  private readonly transformables: TransformableDisplayObject[] = [];
  private elapsed = 0;

  constructor(scene: Phaser.Scene, config: MyriapodaRendererConfig = {}) {
    this.scene = scene;
    this.config = {
      renderScale: config.renderScale ?? 1,
      renderAnchorX: config.renderAnchorX ?? 0,
      renderAnchorY: config.renderAnchorY ?? 0,
      bodyAlphaMultiplier: config.bodyAlphaMultiplier ?? 1,
      outlineAlphaMultiplier: config.outlineAlphaMultiplier ?? 1,
      outlineWidthMultiplier: config.outlineWidthMultiplier ?? 1,
      highlightAlphaMultiplier: config.highlightAlphaMultiplier ?? 1,
      shadowAlphaMultiplier: config.shadowAlphaMultiplier ?? 1,
    };
    this.bodyShadowGraphics = scene.add.graphics().setDepth(bodyShadowDepth);

    this.stomachGradient = scene.add.gradient(
      this.createStomachGradientConfig(),
      0,
      0,
      128,
      128,
    );
    this.stomachGradient.setDepth(stomachGradientDepth);
    this.stomachGradient.setOrigin(0.5);

    this.stomachNoiseTextureKey = `myriapoda-stomach-noise-${Math.floor(Math.random() * 1_000_000)}`;
    this.stomachNoiseQuad = scene.add.noisesimplex2d(
      this.createStomachNoiseConfig(),
      stomachNoiseTextureSize * 0.5,
      stomachNoiseTextureSize * 0.5,
      stomachNoiseTextureSize,
      stomachNoiseTextureSize,
    );
    this.stomachNoiseQuad.setRenderToTexture(this.stomachNoiseTextureKey);
    this.stomachNoiseQuad.setVisible(false);

    this.stomachNoiseLayer = scene.add.image(0, 0, this.stomachNoiseTextureKey);
    this.stomachNoiseLayer.setDepth(stomachNoiseDepth);
    this.stomachNoiseLayer.setAlpha(tuning.myriapodaFxStomachNoiseAlpha);

    this.dashRearWhirlGraphics = scene.add.graphics().setDepth(dashSpiralDepth);
    this.shellGraphics = scene.add.graphics().setDepth(bodyDepth);
    this.limbGraphics = scene.add.graphics().setDepth(limbDepth);
    this.limbStrikeGraphics = scene.add.graphics().setDepth(limbStrikeDepth);
    this.stomachGlowGraphics = scene.add.graphics().setDepth(stomachGlowDepth);
    this.stomachMembraneGraphics = scene.add.graphics().setDepth(stomachMembraneDepth);
    this.shellHighlightGraphics = scene.add.graphics().setDepth(shellHighlightDepth);
    this.damageFxGraphics = scene.add.graphics().setDepth(damageFxDepth);
    this.dashSideWaveGraphics = scene.add.graphics().setDepth(dashWaveDepth);
    this.vacuumGraphics = scene.add.graphics().setDepth(vacuumDepth);

    this.stomachFxMask = new GraphicsMaskController(scene, {
      viewCamera: scene.cameras.main,
      viewTransform: 'world',
    });
    this.stomachFxMask.attach(this.stomachGradient);
    this.stomachFxMask.attach(this.stomachNoiseLayer);
    this.stomachFxMask.attach(this.stomachGlowGraphics);

    this.stomachParticles = new MaskedGraphicsLayer(scene, {
      contentDepth: stomachParticleDepth,
      blurRadius: tuning.myriapodaFxStomachMaskBlurRadius,
    });
    this.limbRenderer = new LimbRenderer(this.limbGraphics, this.limbStrikeGraphics);

    Phaser.Actions.AddEffectBloom(this.vacuumGraphics, {
      threshold: tuning.myriapodaFxVacuumBloomThreshold,
      blurRadius: tuning.myriapodaFxVacuumBloomRadius,
      blurSteps: tuning.myriapodaFxVacuumBloomSteps,
      blendAmount: tuning.myriapodaFxVacuumBloomAmount,
      useInternal: true,
    });
    Phaser.Actions.AddEffectBloom(this.dashRearWhirlGraphics, {
      threshold: tuning.dashFxBloomThreshold,
      blurRadius: tuning.dashFxBloomRadius,
      blurSteps: tuning.dashFxBloomSteps,
      blendAmount: tuning.dashFxBloomAmount,
      useInternal: true,
    });
    Phaser.Actions.AddEffectBloom(this.dashSideWaveGraphics, {
      threshold: tuning.dashFxBloomThreshold,
      blurRadius: tuning.dashFxBloomRadius,
      blurSteps: tuning.dashFxBloomSteps,
      blendAmount: tuning.dashFxBloomAmount,
      useInternal: true,
    });
    Phaser.Actions.AddEffectBloom(this.limbStrikeGraphics, {
      threshold: tuning.limbStrikeBloomThreshold,
      blurRadius: tuning.limbStrikeBloomRadius,
      blurSteps: tuning.limbStrikeBloomSteps,
      blendAmount: tuning.limbStrikeBloomAmount,
      useInternal: true,
    });
    Phaser.Actions.AddEffectBloom(this.damageFxGraphics, {
      threshold: tuning.limbStrikeBloomThreshold,
      blurRadius: tuning.limbStrikeBloomRadius,
      blurSteps: tuning.limbStrikeBloomSteps,
      blendAmount: tuning.limbStrikeBloomAmount * 0.76,
      useInternal: true,
    });

    this.transformables.push(
      this.bodyShadowGraphics,
      this.stomachGradient,
      this.stomachNoiseLayer,
      this.dashRearWhirlGraphics,
      this.shellGraphics,
      this.limbGraphics,
      this.limbStrikeGraphics,
      this.stomachGlowGraphics,
      this.stomachMembraneGraphics,
      this.shellHighlightGraphics,
      this.damageFxGraphics,
      this.dashSideWaveGraphics,
      this.vacuumGraphics,
    );
    this.applyRenderTransform();
  }

  update(myriapoda: Myriapoda, dashState: DashStateSnapshot): void {
    const headPosition = vec2ToPixels(myriapoda.head.body.getPosition());
    this.elapsed += Math.min(0.05, this.scene.game.loop.delta / 1000);
    myriapoda.head.sprite.setVisible(false);

    this.clear();
    this.renderBody(myriapoda, headPosition);
    this.renderTail(myriapoda);
    this.renderDashFx(myriapoda, dashState);
    this.renderStomach(myriapoda);
    this.limbRenderer.render(myriapoda);
    this.renderDamageEffects(myriapoda);
    this.renderHead(
      myriapoda,
      headPosition.x,
      headPosition.y,
      myriapoda.head.body.getAngle(),
    );
  }

  clear(): void {
    this.bodyShadowGraphics.clear();
    this.dashRearWhirlGraphics.clear();
    this.shellGraphics.clear();
    this.limbGraphics.clear();
    this.limbStrikeGraphics.clear();
    this.stomachGlowGraphics.clear();
    this.stomachMembraneGraphics.clear();
    this.shellHighlightGraphics.clear();
    this.damageFxGraphics.clear();
    this.dashSideWaveGraphics.clear();
    this.vacuumGraphics.clear();
    this.stomachFxMask.clear();
    this.stomachParticles.clear();
  }

  setRenderTransform(anchorX: number, anchorY: number, scale: number): void {
    this.config.renderAnchorX = anchorX;
    this.config.renderAnchorY = anchorY;
    this.config.renderScale = scale;
    this.applyRenderTransform();
  }

  destroy(): void {
    this.stomachFxMask.destroy();
    this.stomachParticles.destroy();
    this.bodyShadowGraphics.destroy();
    this.stomachGradient.destroy();
    this.stomachNoiseLayer.destroy();
    this.stomachNoiseQuad.destroy();
    this.dashRearWhirlGraphics.destroy();
    this.shellGraphics.destroy();
    this.limbGraphics.destroy();
    this.limbStrikeGraphics.destroy();
    this.stomachGlowGraphics.destroy();
    this.stomachMembraneGraphics.destroy();
    this.shellHighlightGraphics.destroy();
    this.damageFxGraphics.destroy();
    this.dashSideWaveGraphics.destroy();
    this.vacuumGraphics.destroy();

    if (this.scene.textures.exists(this.stomachNoiseTextureKey)) {
      this.scene.textures.remove(this.stomachNoiseTextureKey);
    }
  }

  private renderBody(
    myriapoda: Myriapoda,
    headPosition: { x: number; y: number },
  ): void {
    const stomachIndex = myriapoda.body.getStomachSegmentIndex();
    const stomachDamageFlash = myriapoda.getStomachDamageFlash();
    const scale = tuning.headRadius / 11;
    const shadowOffset = { x: -0.6 * scale, y: 1.8 * scale };
    const highlightOffset = { x: -1.05 * scale, y: -1.1 * scale };
    const firstSegment = myriapoda.body.segments[0];
    const firstVisual = this.getSegmentVisual(
      firstSegment.radius,
      stomachIndex === 0,
      0,
    );

    this.renderHeadConnector(
      this.bodyShadowGraphics,
      headPosition,
      firstSegment,
      firstVisual,
      {
        fillColor: tuning.myriapodaFxShellShadowColor,
        fillAlpha: this.shadowAlpha(tuning.myriapodaFxShellShadowAlpha * 0.88),
        offsetX: shadowOffset.x,
        offsetY: shadowOffset.y,
      },
    );
    this.renderHeadConnector(
      this.shellGraphics,
      headPosition,
      firstSegment,
      firstVisual,
      {
        fillColor: firstVisual.fillColor,
        fillAlpha: this.bodyAlpha(firstVisual.alpha + 0.06),
        lineColor: tuning.myriapodaHeadOutlineColor,
        lineAlpha: this.outlineAlpha(0.18),
        lineWidth: this.outlineWidth(Math.max(0.5, tuning.headRadius / 11)),
      },
    );
    this.renderHeadConnector(
      this.shellHighlightGraphics,
      headPosition,
      firstSegment,
      firstVisual,
      {
        fillColor: tuning.myriapodaFxShellHighlightColor,
        fillAlpha: this.highlightAlpha(tuning.myriapodaFxShellHighlightAlpha * 0.35),
        lineColor: tuning.myriapodaFxShellSpecColor,
        lineAlpha: this.highlightAlpha(tuning.myriapodaFxShellSpecAlpha * 0.5),
        lineWidth: this.outlineWidth(Math.max(0.35, tuning.headRadius / 18)),
        offsetX: highlightOffset.x,
        offsetY: highlightOffset.y,
      },
    );

    for (let index = myriapoda.body.segments.length - 1; index > 0; index -= 1) {
      const segment = myriapoda.body.segments[index];
      const previous = myriapoda.body.segments[index - 1];
      const segmentStyle = this.getSegmentVisual(
        segment.radius,
        index === stomachIndex,
        index,
      );
      const previousStyle = this.getSegmentVisual(
        previous.radius,
        index - 1 === stomachIndex,
        index - 1,
      );
      this.renderConnector(
        this.bodyShadowGraphics,
        { x: segment.x, y: segment.y },
        { x: previous.x, y: previous.y },
        segmentStyle,
        previousStyle,
        {
          fillColor: tuning.myriapodaFxShellShadowColor,
          fillAlpha: this.shadowAlpha(tuning.myriapodaFxShellShadowAlpha),
          offsetX: shadowOffset.x,
          offsetY: shadowOffset.y,
        },
      );
      this.renderConnector(
        this.shellGraphics,
        { x: segment.x, y: segment.y },
        { x: previous.x, y: previous.y },
        segmentStyle,
        previousStyle,
        {
          fillColor: segmentStyle.fillColor,
          fillAlpha: this.bodyAlpha(Math.min(segmentStyle.alpha, previousStyle.alpha) + 0.04),
          lineColor: tuning.myriapodaHeadOutlineColor,
          lineAlpha: this.outlineAlpha(0.18),
          lineWidth: this.outlineWidth(Math.max(0.5, tuning.headRadius / 11)),
        },
      );
      this.renderConnector(
        this.shellHighlightGraphics,
        { x: segment.x, y: segment.y },
        { x: previous.x, y: previous.y },
        segmentStyle,
        previousStyle,
        {
          fillColor: tuning.myriapodaFxShellHighlightColor,
          fillAlpha: this.highlightAlpha(tuning.myriapodaFxShellHighlightAlpha * 0.28),
          lineColor: tuning.myriapodaFxShellSpecColor,
          lineAlpha: this.highlightAlpha(tuning.myriapodaFxShellSpecAlpha * 0.4),
          lineWidth: this.outlineWidth(Math.max(0.3, tuning.headRadius / 18)),
          offsetX: highlightOffset.x,
          offsetY: highlightOffset.y,
        },
      );
    }

    for (let index = myriapoda.body.segments.length - 1; index >= 0; index -= 1) {
      const segment = myriapoda.body.segments[index];
      const isStomach = index === stomachIndex;
      const visual = this.getSegmentVisual(segment.radius, isStomach, index);
      const damageFlash = isStomach
        ? stomachDamageFlash
        : myriapoda.getSegmentDamageFlash(index);
      const blinkFlash = this.getDamageBlinkFactor(damageFlash);
      const fillColor =
        blinkFlash > 0
          ? this.blendColor(visual.fillColor, tuning.myriapodaDamageFlashColor, blinkFlash * 0.82)
          : visual.fillColor;
      const outlineColor = blinkFlash > 0
        ? tuning.myriapodaDamageFlashColor
        : isStomach
          ? tuning.myriapodaStomachColor
          : tuning.myriapodaHeadOutlineColor;

      this.bodyShadowGraphics.fillStyle(
        tuning.myriapodaFxShellShadowColor,
        this.shadowAlpha(tuning.myriapodaFxShellShadowAlpha * (isStomach ? 0.72 : 1)),
      );
      this.bodyShadowGraphics.fillCircle(
        segment.x + shadowOffset.x,
        segment.y + shadowOffset.y,
        visual.radius * (isStomach ? 0.98 : 1.02),
      );

      this.shellGraphics.fillStyle(fillColor, this.bodyAlpha(visual.alpha + blinkFlash * 0.08));
      this.shellGraphics.fillCircle(segment.x, segment.y, visual.radius);
      this.shellGraphics.lineStyle(
        this.outlineWidth(Math.max(0.7, 1.35 * scale)),
        outlineColor,
        this.outlineAlpha((isStomach ? 0.28 : 0.42) + blinkFlash * 0.34),
      );
      this.shellGraphics.strokeCircle(segment.x, segment.y, visual.radius);

      if (isStomach) {
        this.shellHighlightGraphics.lineStyle(
          this.outlineWidth(Math.max(0.45, 0.8 * scale)),
          blinkFlash > 0 ? tuning.myriapodaDamageFlashColor : 0xffffff,
          this.highlightAlpha(0.08 + blinkFlash * 0.28),
        );
        this.shellHighlightGraphics.strokeCircle(
          segment.x,
          segment.y,
          visual.radius * 0.84,
        );
        if (blinkFlash > 0) {
          this.shellHighlightGraphics.fillStyle(
            tuning.myriapodaDamageFlashColor,
            this.highlightAlpha(blinkFlash * 0.18),
          );
          this.shellHighlightGraphics.fillCircle(segment.x, segment.y, visual.radius * 1.08);
        }
        continue;
      }

      if (blinkFlash > 0) {
        this.shellHighlightGraphics.fillStyle(
          tuning.myriapodaDamageFlashColor,
          this.highlightAlpha(blinkFlash * 0.22),
        );
        this.shellHighlightGraphics.fillCircle(segment.x, segment.y, visual.radius * 1.06);
      }
      this.shellHighlightGraphics.fillStyle(
        blinkFlash > 0 ? tuning.myriapodaDamageFlashColor : tuning.myriapodaFxShellSpecColor,
        this.highlightAlpha(tuning.myriapodaFxShellSpecAlpha + blinkFlash * 0.12),
      );
      this.shellHighlightGraphics.fillCircle(
        segment.x - visual.radius * 0.16,
        segment.y - visual.radius * 0.24,
        Math.max(0.8, visual.radius * 0.12),
      );
    }
  }

  private getSegmentVisual(
    radius: number,
    isStomach: boolean,
    index = 0,
  ): SegmentVisual {
    if (isStomach) {
      const stomachRadius = tuning.stomachRadiusMeters * tuning.pixelsPerMeter;
      return {
        radius: stomachRadius,
        alpha: 0.18,
        fillColor: tuning.myriapodaStomachColor,
      };
    }

    return {
      radius: radius * tuning.myriapodaBodyCircleScale,
      alpha: tuning.bodyAlpha,
      fillColor: Phaser.Display.Color.GetColor(
        92 + Math.min(90, index * 3),
        156 + Math.min(70, index * 2),
        132 + Math.min(45, index * 2),
      ),
    };
  }

  private renderHeadConnector(
    graphics: Phaser.GameObjects.Graphics,
    headPosition: { x: number; y: number },
    segment: { x: number; y: number; radius: number },
    segmentVisual: SegmentVisual,
    style: ConnectorRenderStyle,
  ): void {
    const dx = segment.x - headPosition.x;
    const dy = segment.y - headPosition.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const direction = { x: dx / distance, y: dy / distance };
    const normal = { x: -direction.y, y: direction.x };
    const headConnectorRadius = tuning.headRadius * tuning.myriapodaHeadVisualScale * 0.72;
    const headBoundary = {
      x: headPosition.x + direction.x * headConnectorRadius,
      y: headPosition.y + direction.y * headConnectorRadius,
    };
    const bodyBoundary = this.getCircleBoundaryPoint(segment, segmentVisual.radius, {
      x: -direction.x,
      y: -direction.y,
    });
    const halfWidth = Math.min(segmentVisual.radius, headConnectorRadius) * 0.28;
    const polygon = this.offsetPolygon(
      [
        new Phaser.Math.Vector2(
          headBoundary.x + normal.x * halfWidth,
          headBoundary.y + normal.y * halfWidth,
        ),
        new Phaser.Math.Vector2(
          headBoundary.x - normal.x * halfWidth,
          headBoundary.y - normal.y * halfWidth,
        ),
        new Phaser.Math.Vector2(
          bodyBoundary.x - normal.x * halfWidth,
          bodyBoundary.y - normal.y * halfWidth,
        ),
        new Phaser.Math.Vector2(
          bodyBoundary.x + normal.x * halfWidth,
          bodyBoundary.y + normal.y * halfWidth,
        ),
      ],
      style.offsetX ?? 0,
      style.offsetY ?? 0,
    );

    this.fillAndStrokePolygon(graphics, polygon, style);
  }

  private renderConnector(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    fromVisual: SegmentVisual,
    toVisual: SegmentVisual,
    style: ConnectorRenderStyle,
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const dir = { x: dx / length, y: dy / length };
    const normal = { x: -dir.y, y: dir.x };
    const fromBoundary = this.getCircleBoundaryPoint(from, fromVisual.radius, dir);
    const toBoundary = this.getCircleBoundaryPoint(to, toVisual.radius, {
      x: -dir.x,
      y: -dir.y,
    });
    const bridgeHalfWidth = Math.min(fromVisual.radius, toVisual.radius) * 0.24;
    const polygon = this.offsetPolygon(
      [
        new Phaser.Math.Vector2(
          fromBoundary.x + normal.x * bridgeHalfWidth,
          fromBoundary.y + normal.y * bridgeHalfWidth,
        ),
        new Phaser.Math.Vector2(
          fromBoundary.x - normal.x * bridgeHalfWidth,
          fromBoundary.y - normal.y * bridgeHalfWidth,
        ),
        new Phaser.Math.Vector2(
          toBoundary.x - normal.x * bridgeHalfWidth,
          toBoundary.y - normal.y * bridgeHalfWidth,
        ),
        new Phaser.Math.Vector2(
          toBoundary.x + normal.x * bridgeHalfWidth,
          toBoundary.y + normal.y * bridgeHalfWidth,
        ),
      ],
      style.offsetX ?? 0,
      style.offsetY ?? 0,
    );

    this.fillAndStrokePolygon(graphics, polygon, style);
  }

  private fillAndStrokePolygon(
    graphics: Phaser.GameObjects.Graphics,
    polygon: Phaser.Math.Vector2[],
    style: ConnectorRenderStyle,
  ): void {
    graphics.fillStyle(style.fillColor, style.fillAlpha);
    graphics.fillPoints(polygon, true);

    if (
      style.lineColor !== undefined &&
      style.lineAlpha !== undefined &&
      style.lineWidth !== undefined
    ) {
      graphics.lineStyle(style.lineWidth, style.lineColor, style.lineAlpha);
      graphics.strokePoints(polygon, true, true);
    }
  }

  private offsetPolygon(
    polygon: Phaser.Math.Vector2[],
    offsetX: number,
    offsetY: number,
  ): Phaser.Math.Vector2[] {
    if (offsetX === 0 && offsetY === 0) {
      return polygon;
    }

    return polygon.map(
      (point) => new Phaser.Math.Vector2(point.x + offsetX, point.y + offsetY),
    );
  }

  private getCircleBoundaryPoint(
    center: { x: number; y: number },
    radius: number,
    direction: { x: number; y: number },
  ): { x: number; y: number } {
    return {
      x: center.x + direction.x * radius,
      y: center.y + direction.y * radius,
    };
  }

  private renderStomach(myriapoda: Myriapoda): void {
    const stomachAnchor = myriapoda.stomach.getAnchor();
    const stomachSegment = myriapoda.body.getStomachAnchor();
    const stomachDamageFlash = this.getDamageBlinkFactor(myriapoda.getStomachDamageFlash());
    const chamberRadius = tuning.stomachRadiusMeters * tuning.pixelsPerMeter;
    const scale = tuning.headRadius / 11;
    const containmentRadius =
      chamberRadius - tuning.stomachContainmentMarginMeters * tuning.pixelsPerMeter;
    const parasites = myriapoda.stomach.getUiParasiteSnapshots();
    const parasiteWeight = Math.min(1, parasites.length / 4);
    const stomachNormal = {
      x: -Math.sin(stomachSegment.angle),
      y: Math.cos(stomachSegment.angle),
    };
    const slosh =
      Math.sin(this.elapsed * 4.6 + stomachSegment.angle * 1.35) *
      Math.min(0.68, chamberRadius * 0.016);
    const fxAnchor = {
      x: stomachAnchor.x + stomachNormal.x * slosh,
      y: stomachAnchor.y + stomachNormal.y * slosh,
    };

    this.layoutStomachFxLayers(fxAnchor, chamberRadius);
    this.animateStomachFxLayers();

    this.stomachFxMask.drawMask((maskGraphics) => {
      maskGraphics.fillCircle(fxAnchor.x, fxAnchor.y, chamberRadius * 0.98);
    });
    this.stomachParticles.drawMask((maskGraphics) => {
      maskGraphics.fillCircle(stomachAnchor.x, stomachAnchor.y, containmentRadius);
    });

    this.stomachGlowGraphics.fillStyle(
      tuning.myriapodaFxStomachGradientOuterColor,
      this.highlightAlpha(0.08 + parasiteWeight * 0.04),
    );
    this.stomachGlowGraphics.fillCircle(
      fxAnchor.x,
      fxAnchor.y,
      chamberRadius * 0.98,
    );
    this.stomachGlowGraphics.fillStyle(
      tuning.myriapodaFxStomachGradientInnerColor,
      this.highlightAlpha(0.06),
    );
    this.stomachGlowGraphics.fillCircle(
      fxAnchor.x,
      fxAnchor.y,
      chamberRadius * 0.72,
    );

    if (parasiteWeight > 0) {
      this.stomachGlowGraphics.fillStyle(0xff8088, this.highlightAlpha(parasiteWeight * 0.08));
      this.stomachGlowGraphics.fillCircle(
        fxAnchor.x,
        fxAnchor.y,
        chamberRadius * 0.88,
      );
    }

    for (const particle of myriapoda.stomach.particles) {
      const local = vec2ToPixels(particle.body.getPosition());
      const definition = getPickupDefinition(particle.resourceId);
      const phase = getPickupAnimationPhase(particle.id);
      const animation = samplePickupAnimation(
        definition.animationProfile,
        this.elapsed,
        phase,
      );
      const x = stomachAnchor.x + local.x;
      const y = stomachAnchor.y + local.y;
      const radius = particle.radiusMeters * tuning.pixelsPerMeter * 1.28;

      this.drawStomachPickupGlow(
        x,
        y,
        radius,
        definition.palette,
        animation.glowAlpha,
      );
      definition.drawParticle(this.stomachParticles.graphics, {
        x,
        y,
        radius,
        angle: particle.body.getAngle(),
        elapsedSeconds: this.elapsed,
        animationPhase: phase,
        alpha: 0.94,
      });
    }

    const parasiteDefinition = getPickupDefinition('parasite');
    for (const parasite of parasites) {
      const phase = getPickupAnimationPhase(parasite.id);
      const animation = samplePickupAnimation(
        parasiteDefinition.animationProfile,
        this.elapsed,
        phase,
      );
      const x = stomachAnchor.x + parasite.localX * chamberRadius;
      const y = stomachAnchor.y + parasite.localY * chamberRadius;
      const radius = chamberRadius * parasite.radius;

      this.drawStomachPickupGlow(
        x,
        y,
        radius,
        parasiteDefinition.palette,
        animation.glowAlpha,
        1.2,
      );
      parasiteDefinition.drawParticle(this.stomachParticles.graphics, {
        x,
        y,
        radius,
        angle: parasite.angle,
        elapsedSeconds: this.elapsed,
        animationPhase: phase,
        alpha: 0.96,
      });
    }

    const membranePulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3.2);
    this.stomachMembraneGraphics.fillStyle(
      tuning.myriapodaFxStomachMembraneGlowColor,
      this.highlightAlpha(0.04 + membranePulse * 0.02),
    );
    this.stomachMembraneGraphics.fillCircle(
      fxAnchor.x,
      fxAnchor.y,
      chamberRadius * 1.02,
    );
    this.stomachMembraneGraphics.lineStyle(
      this.outlineWidth(Math.max(1.1, 2.6 * scale)),
      0xffebf3,
      this.outlineAlpha(tuning.myriapodaFxStomachMembraneInnerAlpha + membranePulse * 0.08),
    );
    this.stomachMembraneGraphics.strokeCircle(
      fxAnchor.x,
      fxAnchor.y,
      chamberRadius,
    );
    this.stomachMembraneGraphics.lineStyle(
      this.outlineWidth(Math.max(0.55, 1.1 * scale)),
      tuning.myriapodaFxStomachMembraneGlowColor,
      this.highlightAlpha(tuning.myriapodaFxStomachMembraneGlowAlpha + membranePulse * 0.08),
    );
    this.stomachMembraneGraphics.strokeCircle(
      fxAnchor.x,
      fxAnchor.y,
      chamberRadius * 0.88,
    );

    if (stomachDamageFlash > 0) {
      this.stomachGlowGraphics.fillStyle(
        tuning.myriapodaDamageFlashColor,
        this.highlightAlpha(stomachDamageFlash * 0.2),
      );
      this.stomachGlowGraphics.fillCircle(
        fxAnchor.x,
        fxAnchor.y,
        chamberRadius * 1.02,
      );
      this.stomachMembraneGraphics.lineStyle(
        this.outlineWidth(Math.max(1.1, 2.8 * scale)),
        tuning.myriapodaDamageFlashColor,
        this.outlineAlpha(0.36 + stomachDamageFlash * 0.44),
      );
      this.stomachMembraneGraphics.strokeCircle(
        fxAnchor.x,
        fxAnchor.y,
        chamberRadius * 1.01,
      );
      this.stomachMembraneGraphics.lineStyle(
        this.outlineWidth(Math.max(0.7, 1.4 * scale)),
        0xffffff,
        this.outlineAlpha(stomachDamageFlash * 0.18),
      );
      this.stomachMembraneGraphics.strokeCircle(
        fxAnchor.x,
        fxAnchor.y,
        chamberRadius * 0.82,
      );
    }
  }

  private drawStomachPickupGlow(
    x: number,
    y: number,
    radius: number,
    palette: PickupPalette,
    glowAlpha: number,
    intensity = 1,
  ): void {
    const outerColor = palette.glow ?? palette.highlight;
    const outerAlpha =
      tuning.myriapodaFxStomachParticleGlowAlpha *
      intensity *
      (0.45 + glowAlpha * 0.9);

    this.stomachGlowGraphics.fillStyle(outerColor, outerAlpha);
    this.stomachGlowGraphics.fillCircle(x, y, radius * 1.95);
    this.stomachGlowGraphics.fillStyle(palette.highlight, outerAlpha * 0.58);
    this.stomachGlowGraphics.fillCircle(x, y, radius * 1.15);
  }

  private renderDamageEffects(myriapoda: Myriapoda): void {
    for (const effect of myriapoda.getDamageEffects()) {
      const progress = Phaser.Math.Clamp(effect.timer / effect.duration, 0, 1);
      if (progress <= 0) {
        continue;
      }

      if (effect.kind === 'limb-loss') {
        this.renderLimbLossEffect(effect, progress);
      } else {
        this.renderStomachHitEffect(effect, progress);
      }
    }
  }

  private renderLimbLossEffect(effect: MyriapodaDamageEffect, progress: number): void {
    const burst = 1 - progress;
    const fade = progress;
    const rayLength = Phaser.Math.Linear(7, 22, burst);
    const ringRadius = Phaser.Math.Linear(4, 16, burst);

    this.damageFxGraphics.fillStyle(
      tuning.myriapodaDamageFlashColor,
      this.highlightAlpha(0.14 * fade),
    );
    this.damageFxGraphics.fillCircle(effect.x, effect.y, ringRadius * 0.82);
    this.damageFxGraphics.lineStyle(
      this.outlineWidth(2.2),
      tuning.myriapodaDamageFlashColor,
      this.outlineAlpha(0.54 * fade),
    );
    this.damageFxGraphics.strokeCircle(effect.x, effect.y, ringRadius);

    for (let index = 0; index < 6; index += 1) {
      const angle = effect.seed + index * ((Math.PI * 2) / 6) + burst * 0.5;
      const innerRadius = 3 + index * 0.3;
      const outerRadius = rayLength + Math.sin(effect.seed + index) * 2.2;
      const inner = {
        x: effect.x + Math.cos(angle) * innerRadius,
        y: effect.y + Math.sin(angle) * innerRadius,
      };
      const outer = {
        x: effect.x + Math.cos(angle) * outerRadius,
        y: effect.y + Math.sin(angle) * outerRadius,
      };
      this.damageFxGraphics.lineStyle(
        this.outlineWidth(2.4 - burst * 0.8),
        index % 2 === 0 ? tuning.myriapodaDamageFlashColor : 0xffffff,
        this.highlightAlpha((0.76 - index * 0.08) * fade),
      );
      this.damageFxGraphics.strokeLineShape(
        new Phaser.Geom.Line(inner.x, inner.y, outer.x, outer.y),
      );
      this.damageFxGraphics.fillStyle(
        0xffffff,
        this.highlightAlpha((0.34 - index * 0.03) * fade),
      );
      this.damageFxGraphics.fillCircle(outer.x, outer.y, Math.max(0.8, 2 - burst * 0.9));
    }
  }

  private renderStomachHitEffect(effect: MyriapodaDamageEffect, progress: number): void {
    const burst = 1 - progress;
    const radius = Phaser.Math.Linear(10, 28, burst);
    const innerRadius = radius * 0.62;
    const fade = progress;

    this.damageFxGraphics.fillStyle(
      tuning.myriapodaDamageFlashColor,
      this.highlightAlpha(0.12 * fade),
    );
    this.damageFxGraphics.fillCircle(effect.x, effect.y, innerRadius);
    this.damageFxGraphics.lineStyle(
      this.outlineWidth(2.6),
      tuning.myriapodaDamageFlashColor,
      this.outlineAlpha(0.48 * fade),
    );
    this.damageFxGraphics.strokeCircle(effect.x, effect.y, radius);
    this.damageFxGraphics.lineStyle(
      this.outlineWidth(1.2),
      0xffffff,
      this.outlineAlpha(0.22 * fade),
    );
    this.damageFxGraphics.strokeCircle(effect.x, effect.y, innerRadius);
  }

  private renderTail(myriapoda: Myriapoda): void {
    const tailAnchor = myriapoda.body.getTailAnchor();
    const tailTip = myriapoda.tail.getTipPixels();
    const tailDirection = {
      x: -Math.cos(tailAnchor.angle),
      y: -Math.sin(tailAnchor.angle),
    };
    const sway = Math.sin(this.elapsed * 3.6) * tuning.tailSwayPx * 0.35;
    const control = {
      x:
        tailAnchor.x +
        tailDirection.x * tuning.tailLengthPx * 0.45 -
        tailDirection.y * sway,
      y:
        tailAnchor.y +
        tailDirection.y * tuning.tailLengthPx * 0.45 +
        tailDirection.x * sway,
    };
    const tailPoints = [
      new Phaser.Math.Vector2(tailAnchor.x, tailAnchor.y),
      new Phaser.Math.Vector2(control.x, control.y),
      new Phaser.Math.Vector2(tailTip.x, tailTip.y),
    ];
    const shadowPoints = this.offsetPolygon(tailPoints, -0.8, 1.6);

    this.bodyShadowGraphics.lineStyle(
      this.outlineWidth(4.2),
      tuning.myriapodaFxShellShadowColor,
      this.shadowAlpha(tuning.myriapodaFxShellShadowAlpha),
    );
    this.bodyShadowGraphics.strokePoints(shadowPoints, false, true);
    this.shellGraphics.lineStyle(this.outlineWidth(3.4), 0x0a1717, this.outlineAlpha(0.64));
    this.shellGraphics.strokePoints(tailPoints, false, true);
    this.shellGraphics.lineStyle(this.outlineWidth(1.8), 0x9eddb5, this.outlineAlpha(0.74));
    this.shellGraphics.strokePoints(tailPoints, false, true);
    this.shellHighlightGraphics.lineStyle(
      this.outlineWidth(1.1),
      tuning.myriapodaFxShellHighlightColor,
      this.highlightAlpha(0.24),
    );
    this.shellHighlightGraphics.strokePoints(tailPoints, false, true);
    this.shellGraphics.fillStyle(tuning.myriapodaHeadColor, this.bodyAlpha(0.55));
    this.shellGraphics.fillCircle(tailTip.x, tailTip.y, tuning.tailRadiusPx);
    this.shellHighlightGraphics.fillStyle(
      tuning.myriapodaFxShellSpecColor,
      this.highlightAlpha(0.12),
    );
    this.shellHighlightGraphics.fillCircle(
      tailTip.x - 0.6,
      tailTip.y - 0.8,
      Math.max(1, tuning.tailRadiusPx * 0.45),
    );
  }

  private renderDashFx(myriapoda: Myriapoda, dashState: DashStateSnapshot): void {
    if (dashState.motionStrength <= 0.01) {
      return;
    }

    const dashDirection = normalize(dashState.directionX, dashState.directionY);
    const forward =
      dashDirection.x === 0 && dashDirection.y === 0 ? { x: 1, y: 0 } : dashDirection;
    const tailTip = myriapoda.tail.getTipPixels();
    const rearAnchor = sampleDashRearAnchor(
      tailTip,
      forward,
      {
        baseOffsetPx: tuning.dashFxWhirlTailOffsetPx,
        extraOffsetPx: tuning.dashFxWhirlMotionOffsetPx,
        motionStrength: dashState.motionStrength,
      },
    );
    this.renderDashBackLines(rearAnchor, forward, dashState.motionStrength);
    this.renderDashSideLines(myriapoda, forward, dashState.motionStrength);
  }

  private renderDashBackLines(
    anchor: { x: number; y: number },
    forward: { x: number; y: number },
    strength: number,
  ): void {
    const normal = {
      x: -forward.y,
      y: forward.x,
    };
    for (let lane = -2; lane <= 2; lane += 1) {
      const laneWeight = 1 - Math.abs(lane) * 0.12;
      const travel =
        (this.elapsed * tuning.dashFxLineTravelSpeed + lane * 0.17 + 0.2) % 1;
      const lateralOffset = lane * tuning.dashFxBackLineSpacingPx;
      const startDistance = 4 + travel * tuning.dashFxBackLineLeadPx;
      const lineLength =
        tuning.dashFxBackLineLengthPx *
        (0.74 + laneWeight * 0.26) *
        (0.5 + strength * 0.5);
      const start = {
        x: anchor.x - forward.x * startDistance + normal.x * lateralOffset,
        y: anchor.y - forward.y * startDistance + normal.y * lateralOffset,
      };
      const end = {
        x: anchor.x - forward.x * (startDistance + lineLength) + normal.x * lateralOffset,
        y: anchor.y - forward.y * (startDistance + lineLength) + normal.y * lateralOffset,
      };

      this.drawSpeedLine(
        this.dashRearWhirlGraphics,
        start,
        end,
        3.8 * laneWeight,
        1.65 * laneWeight,
        (0.06 + strength * 0.12) * laneWeight,
        lane * 0.35 + 0.4,
      );
    }
  }

  private renderDashSideLines(
    myriapoda: Myriapoda,
    forward: { x: number; y: number },
    strength: number,
  ): void {
    const normal = {
      x: -forward.y,
      y: forward.x,
    };
    const count = Math.max(1, tuning.dashFxSideLineCount);

    for (const side of [-1, 1] as const) {
      for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 1 : index / (count - 1);
        const bodyRatio = Phaser.Math.Linear(0.56, 0.88, t);
        const segment = myriapoda.body.sampleAlongBody(bodyRatio);
        const offset =
          segment.radius * 1.55 +
          Phaser.Math.Linear(
            tuning.dashFxSideLineBaseOffsetPx,
            tuning.dashFxSideLineTailOffsetPx,
            t,
          );
        const anchor = {
          x: segment.x + normal.x * offset * side,
          y: segment.y + normal.y * offset * side,
        };
        const travel =
          (this.elapsed * tuning.dashFxLineTravelSpeed + t * 0.42 + (side > 0 ? 0.18 : 0.56)) %
          1;
        const startDistance = 2 + travel * tuning.dashFxSideLineLeadPx;
        const lineLength =
          tuning.dashFxSideLineLengthPx *
          (0.78 + t * 0.26) *
          (0.48 + strength * 0.52);
        const start = {
          x: anchor.x - forward.x * startDistance,
          y: anchor.y - forward.y * startDistance,
        };
        const end = {
          x: anchor.x - forward.x * (startDistance + lineLength),
          y: anchor.y - forward.y * (startDistance + lineLength),
        };
        const alpha = 0.05 + strength * (0.08 + t * 0.04);

        this.drawSpeedLine(
          this.dashSideWaveGraphics,
          start,
          end,
          3.2 - t * 0.4,
          1.35 - t * 0.15,
          alpha,
          t * 0.8 + (side > 0 ? 0.2 : 0.56),
        );
      }
    }
  }

  private drawSpeedLine(
    graphics: Phaser.GameObjects.Graphics,
    start: { x: number; y: number },
    end: { x: number; y: number },
    shadowWidth: number,
    coreWidth: number,
    alpha: number,
    phaseOffset: number,
  ): void {
    const direction = normalize(start.x - end.x, start.y - end.y);
    const forward =
      direction.x === 0 && direction.y === 0 ? { x: 1, y: 0 } : direction;
    const normal = {
      x: -forward.y,
      y: forward.x,
    };
    const pulse =
      1 +
      Math.sin(this.elapsed * tuning.dashFxLinePulseSpeed + phaseOffset) *
        tuning.dashFxLinePulseAmount;
    const glowWidth = shadowWidth * tuning.dashFxLineGlowWidthBoost * pulse;
    const brightWidth = coreWidth * 0.58 * pulse;
    const highlightEnd = {
      x: start.x + (end.x - start.x) * tuning.dashFxLineHighlightLength,
      y: start.y + (end.y - start.y) * tuning.dashFxLineHighlightLength,
    };

    graphics.lineStyle(glowWidth, tuning.dashFxLineShadowColor, alpha * 0.65);
    graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));
    graphics.lineStyle(shadowWidth * pulse, tuning.dashFxLineCoreColor, alpha * 0.72);
    graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));
    graphics.lineStyle(coreWidth * pulse, tuning.dashFxLineCoreColor, alpha * 1.35);
    graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));
    graphics.lineStyle(brightWidth, tuning.dashFxLineHighlightColor, alpha * 1.18);
    graphics.strokeLineShape(
      new Phaser.Geom.Line(start.x, start.y, highlightEnd.x, highlightEnd.y),
    );

    const frontGlowX = start.x + forward.x * 1.2;
    const frontGlowY = start.y + forward.y * 1.2;
    graphics.fillStyle(tuning.dashFxLineCoreColor, alpha * 0.42);
    graphics.fillCircle(frontGlowX, frontGlowY, Math.max(0.8, coreWidth * 0.9 * pulse));
    graphics.fillStyle(tuning.dashFxLineHighlightColor, alpha * 0.78);
    graphics.fillCircle(frontGlowX, frontGlowY, Math.max(0.45, coreWidth * 0.36 * pulse));

    const chevronTip = {
      x: start.x + forward.x * tuning.dashFxChevronLengthPx,
      y: start.y + forward.y * tuning.dashFxChevronLengthPx,
    };
    const chevronBase = {
      x: start.x - forward.x * tuning.dashFxChevronLengthPx * 0.28,
      y: start.y - forward.y * tuning.dashFxChevronLengthPx * 0.28,
    };
    const chevronPoints = [
      new Phaser.Math.Vector2(chevronTip.x, chevronTip.y),
      new Phaser.Math.Vector2(
        chevronBase.x + normal.x * tuning.dashFxChevronWidthPx,
        chevronBase.y + normal.y * tuning.dashFxChevronWidthPx,
      ),
      new Phaser.Math.Vector2(
        chevronBase.x - normal.x * tuning.dashFxChevronWidthPx,
        chevronBase.y - normal.y * tuning.dashFxChevronWidthPx,
      ),
    ];
    graphics.fillStyle(tuning.dashFxLineCoreColor, alpha * 0.18);
    graphics.fillPoints(chevronPoints, true);
    graphics.lineStyle(Math.max(0.6, brightWidth * 0.7), tuning.dashFxLineHighlightColor, alpha * 0.88);
    graphics.strokePoints(chevronPoints, true, true);
  }

  private renderHead(
    myriapoda: Myriapoda,
    x: number,
    y: number,
    angle: number,
  ): void {
    const blinkPhase = (this.elapsed + 0.2) % 4.2;
    const blink =
      blinkPhase > 3.85 ? Math.max(0.12, 1 - (blinkPhase - 3.85) * 10) : 1;
    const scale = (tuning.headRadius / 11) * tuning.myriapodaHeadVisualScale;
    const headWidth = tuning.headRadius * 2.05 * tuning.myriapodaHeadVisualScale;
    const headHeight = tuning.headRadius * 1.8 * tuning.myriapodaHeadVisualScale;
    const vacuum = myriapoda.vacuum;
    const consumePulse =
      tuning.vacuumConsumePulseSeconds > 0
        ? Math.min(1, vacuum.consumePulseTimer / tuning.vacuumConsumePulseSeconds)
        : 0;
    const mouthOpen = Math.min(
      1,
      vacuum.suctionAmount + consumePulse * tuning.mouthConsumeBoost,
    );
    const glossOffset = rotateVector(-1.8 * scale, -2.4 * scale, angle);
    const specOffset = rotateVector(-2.8 * scale, -3.3 * scale, angle);

    this.shellGraphics.fillStyle(tuning.myriapodaHeadColor, this.bodyAlpha(0.92));
    this.shellGraphics.lineStyle(
      this.outlineWidth(Math.max(0.7, 1.4 * scale)),
      tuning.myriapodaHeadOutlineColor,
      this.outlineAlpha(0.5),
    );
    this.shellGraphics.fillEllipse(x, y, headWidth, headHeight);
    this.shellGraphics.strokeEllipse(x, y, headWidth, headHeight);

    this.shellHighlightGraphics.fillStyle(
      tuning.myriapodaFxShellHighlightColor,
      this.highlightAlpha(tuning.myriapodaFxShellHighlightAlpha + 0.04),
    );
    this.shellHighlightGraphics.fillCircle(
      x + glossOffset.x,
      y + glossOffset.y,
      Math.max(1.2, 2.1 * scale),
    );
    this.shellHighlightGraphics.fillStyle(
      tuning.myriapodaFxShellSpecColor,
      this.highlightAlpha(tuning.myriapodaFxShellSpecAlpha + consumePulse * 0.03),
    );
    this.shellHighlightGraphics.fillCircle(
      x + specOffset.x,
      y + specOffset.y,
      Math.max(0.6, 0.95 * scale),
    );

    this.renderVacuumMouth(x, y, angle, scale, mouthOpen, consumePulse);
    this.renderVacuumVortex(vacuum, scale);

    const leftEye = rotateVector(2.4 * scale, -4.6 * scale, angle);
    const rightEye = rotateVector(2.4 * scale, 4.6 * scale, angle);
    const pupilOffset = rotateVector(0.95 * scale, 0, angle);
    this.drawEye(
      this.shellHighlightGraphics,
      x + leftEye.x,
      y + leftEye.y,
      blink,
      pupilOffset,
      scale,
    );
    this.drawEye(
      this.shellHighlightGraphics,
      x + rightEye.x,
      y + rightEye.y,
      blink,
      pupilOffset,
      scale,
    );

    this.drawMustache(this.shellHighlightGraphics, x, y, angle, -1, scale);
    this.drawMustache(this.shellHighlightGraphics, x, y, angle, 1, scale);
  }

  private renderVacuumMouth(
    x: number,
    y: number,
    angle: number,
    scale: number,
    mouthOpen: number,
    consumePulse: number,
  ): void {
    const mouthCenter = rotateVector(7.1 * scale, 0, angle);
    const centerX = x + mouthCenter.x;
    const centerY = y + mouthCenter.y;

    if (mouthOpen < 0.08) {
      const mouthMid = rotateVector(7.5 * scale, 0, angle);
      const mouthLeft = rotateVector(6.2 * scale, -2.2 * scale, angle);
      const mouthRight = rotateVector(6.2 * scale, 2.2 * scale, angle);
      this.vacuumGraphics.lineStyle(
        Math.max(0.8, 1.5 * scale),
        0x183127,
        0.75,
      );
      this.vacuumGraphics.strokePoints(
        [
          new Phaser.Math.Vector2(x + mouthLeft.x, y + mouthLeft.y),
          new Phaser.Math.Vector2(x + mouthMid.x, y + mouthMid.y),
          new Phaser.Math.Vector2(x + mouthRight.x, y + mouthRight.y),
        ],
        false,
        true,
      );
      return;
    }

    const mouthWidth = (4.2 + mouthOpen * 7.8 + consumePulse * 1.5) * scale;
    const mouthHeight = (0.9 + mouthOpen * 5.4 + consumePulse * 1.1) * scale;
    this.vacuumGraphics.fillStyle(
      tuning.myriapodaFxVacuumGlowColor,
      tuning.myriapodaFxVacuumGlowAlpha * (0.28 + mouthOpen * 0.52),
    );
    this.vacuumGraphics.fillEllipse(
      centerX,
      centerY,
      mouthWidth * 1.18,
      mouthHeight * 1.36,
    );
    this.vacuumGraphics.fillStyle(0x102118, 0.82 + mouthOpen * 0.08);
    this.vacuumGraphics.fillEllipse(centerX, centerY, mouthWidth, mouthHeight);
    this.vacuumGraphics.lineStyle(
      Math.max(0.9, 1.4 * scale),
      tuning.myriapodaFxVacuumGlowColor,
      0.16 + mouthOpen * tuning.myriapodaFxVacuumGlowAlpha,
    );
    this.vacuumGraphics.strokeEllipse(
      centerX,
      centerY,
      mouthWidth * 1.04,
      mouthHeight * 1.08,
    );
    this.vacuumGraphics.lineStyle(
      Math.max(0.55, 0.95 * scale),
      0x06100a,
      0.45 + mouthOpen * 0.25,
    );
    this.vacuumGraphics.strokeEllipse(centerX, centerY, mouthWidth, mouthHeight);
    this.vacuumGraphics.fillStyle(
      0xeafee8,
      0.08 + mouthOpen * 0.14 + consumePulse * 0.08,
    );
    this.vacuumGraphics.fillEllipse(
      centerX + 0.55 * scale,
      centerY - 0.2 * scale,
      mouthWidth * 0.42,
      Math.max(0.35 * scale, mouthHeight * 0.2),
    );
    this.vacuumGraphics.fillStyle(
      0xffffff,
      tuning.myriapodaFxVacuumCoreAlpha * (0.16 + mouthOpen * 0.28),
    );
    this.vacuumGraphics.fillEllipse(
      centerX + 0.4 * scale,
      centerY - 0.12 * scale,
      mouthWidth * 0.18,
      Math.max(0.2 * scale, mouthHeight * 0.18),
    );
  }

  private renderVacuumVortex(vacuum: Myriapoda['vacuum'], scale: number): void {
    if (vacuum.activePickupCount <= 0) {
      return;
    }

    const forward = {
      x: Math.cos(vacuum.coneAngle),
      y: Math.sin(vacuum.coneAngle),
    };
    const sideways = {
      x: -forward.y,
      y: forward.x,
    };
    const strength = Math.max(0.22, vacuum.suctionAmount);
    const spinSpeed = 4.8 + strength * 6.4;
    const phase = this.elapsed * spinSpeed;
    const ribbonCount = 2;
    const ringCount = 3;
    const tunnelLength = tuning.vacuumConeLength * (0.86 + strength * 0.12);
    const outerAlpha =
      (tuning.vacuumWispAlpha + tuning.myriapodaFxVacuumGlowAlpha * 0.25) *
      (0.8 + strength * 0.62);
    const outerWidth = tuning.vacuumWispWidth * (1.55 + strength * 0.52) * scale;

    for (let ribbon = 0; ribbon < ribbonCount; ribbon += 1) {
      const ribbonPhase = phase * 0.9 + ribbon * Math.PI;
      const points: Phaser.Math.Vector2[] = [];
      for (let step = 0; step <= 8; step += 1) {
        const t = step / 8;
        const distance = Phaser.Math.Linear(
          tunnelLength * 0.98,
          tuning.headRadius * 1.42,
          t,
        );
        const width = Phaser.Math.Linear(
          18 + strength * 10,
          2.6 + strength * 1.1,
          t,
        ) * scale;
        const orbit = ribbonPhase + t * Math.PI * (1.45 + strength * 0.42);
        const offset = Math.sin(orbit) * width;
        const drift = Math.cos(orbit * 0.7 + t * 3.4) * width * 0.16;
        points.push(
          new Phaser.Math.Vector2(
            vacuum.mouthPosition.x +
              forward.x * distance +
              sideways.x * offset +
              forward.x * drift,
            vacuum.mouthPosition.y +
              forward.y * distance +
              sideways.y * offset +
              forward.y * drift,
          ),
        );
      }

      this.strokeTaperedPath(
        this.vacuumGraphics,
        points,
        outerWidth * 1.08,
        outerWidth * 0.22,
        tuning.myriapodaFxVacuumGlowColor,
        outerAlpha * 0.24,
      );
      this.strokeTaperedPath(
        this.vacuumGraphics,
        points,
        outerWidth,
        outerWidth * 0.18,
        0xddfffb,
        outerAlpha * 0.28,
      );
      this.strokeTaperedPath(
        this.vacuumGraphics,
        points,
        outerWidth * 0.38,
        outerWidth * 0.08,
        0xffffff,
        outerAlpha * tuning.myriapodaFxVacuumCoreAlpha * 0.62,
      );
    }

    for (let ring = 0; ring < ringCount; ring += 1) {
      const travel = (phase * 0.12 + ring / ringCount) % 1;
      const distance = Phaser.Math.Linear(
        tunnelLength * 0.84,
        tuning.headRadius * 1.9,
        travel,
      );
      const center = {
        x: vacuum.mouthPosition.x + forward.x * distance,
        y: vacuum.mouthPosition.y + forward.y * distance,
      };
      const radiusX = Phaser.Math.Linear(
        22 + strength * 10,
        7 + strength * 2,
        travel,
      ) * scale;
      const radiusY = radiusX * (0.28 + strength * 0.05);
      const startAngle = phase * 0.72 + ring * 1.18;
      const points = this.sampleRotatedEllipseArcPoints(
        center,
        radiusX,
        radiusY,
        vacuum.coneAngle,
        startAngle,
        startAngle + Math.PI * 1.08,
        8,
      );
      const alpha = outerAlpha * Phaser.Math.Linear(0.44, 0.92, 1 - travel);
      this.strokeTaperedPath(
        this.vacuumGraphics,
        points,
        outerWidth * Phaser.Math.Linear(0.62, 0.28, travel),
        outerWidth * 0.1,
        0xd7fff8,
        alpha * 0.36,
      );
      this.strokeTaperedPath(
        this.vacuumGraphics,
        points,
        outerWidth * Phaser.Math.Linear(0.2, 0.08, travel),
        outerWidth * 0.05,
        0xffffff,
        alpha * tuning.myriapodaFxVacuumCoreAlpha * 0.42,
      );
    }
  }

  private createStomachGradientConfig(): Phaser.Types.GameObjects.Gradient.GradientQuadConfig {
    return {
      bands: [
        {
          colorStart: this.toRgbaColor(
            tuning.myriapodaFxStomachGradientInnerColor,
            tuning.myriapodaFxStomachGradientAlpha,
          ),
          colorEnd: this.toRgbaColor(
            tuning.myriapodaFxStomachGradientOuterColor,
            tuning.myriapodaFxStomachGradientAlpha,
          ),
          start: 0,
          end: 1,
          interpolation: 2,
        },
      ],
      start: { x: 0.5, y: 0 },
      shape: { x: 0, y: 1 },
      shapeMode: 0,
      repeatMode: 0,
      dither: true,
    };
  }

  private createStomachNoiseConfig(): Phaser.Types.GameObjects.NoiseSimplex2D.NoiseSimplex2DQuadConfig {
    return {
      noiseCells: [
        tuning.myriapodaFxStomachNoiseCellsX,
        tuning.myriapodaFxStomachNoiseCellsY,
      ],
      noiseIterations: tuning.myriapodaFxStomachNoiseIterations,
      noiseWarpAmount: tuning.myriapodaFxStomachNoiseWarpAmount,
      noiseColorStart: this.toRgbaColor(
        tuning.myriapodaFxStomachGradientInnerColor,
        tuning.myriapodaFxStomachNoiseAlpha,
      ),
      noiseColorEnd: this.toRgbaColor(
        tuning.myriapodaFxStomachGradientOuterColor,
        tuning.myriapodaFxStomachNoiseAlpha,
      ),
    };
  }

  private layoutStomachFxLayers(
    stomachAnchor: { x: number; y: number },
    chamberRadius: number,
  ): void {
    const padding = Math.max(24, tuning.myriapodaFxStomachMaskBlurRadius * 3);
    const size = Math.max(64, chamberRadius * 2 + padding);
    const transformed = this.transformPoint(stomachAnchor.x, stomachAnchor.y);
    this.stomachGradient.setPosition(transformed.x, transformed.y);
    this.stomachGradient.setSize(size, size);
    this.stomachGradient.setDisplaySize(size, size);
    this.stomachNoiseLayer.setPosition(transformed.x, transformed.y);
    this.stomachNoiseLayer.setDisplaySize(size, size);
  }

  private animateStomachFxLayers(): void {
    this.stomachGradient.offset =
      Math.sin(this.elapsed * tuning.myriapodaFxStomachNoiseFlowSpeed * 0.6) * 0.06;
    this.stomachNoiseQuad.noiseFlow =
      this.elapsed * tuning.myriapodaFxStomachNoiseFlowSpeed;
    this.stomachNoiseQuad.noiseOffset = [
      this.elapsed * tuning.myriapodaFxStomachNoiseOffsetSpeedX,
      this.elapsed * tuning.myriapodaFxStomachNoiseOffsetSpeedY,
    ];
    this.stomachNoiseQuad.renderImmediate();
  }

  private sampleRotatedEllipseArcPoints(
    center: { x: number; y: number },
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    steps: number,
  ): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index <= steps; index += 1) {
      const t = index / Math.max(1, steps);
      const theta = Phaser.Math.Linear(startAngle, endAngle, t);
      const localX = Math.cos(theta) * radiusX;
      const localY = Math.sin(theta) * radiusY;
      const rotated = rotateVector(localX, localY, rotation);
      points.push(
        new Phaser.Math.Vector2(center.x + rotated.x, center.y + rotated.y),
      );
    }

    return points;
  }

  private strokeTaperedPath(
    graphics: Phaser.GameObjects.Graphics,
    points: Phaser.Math.Vector2[],
    startWidth: number,
    endWidth: number,
    color: number,
    alpha: number,
  ): void {
    for (let index = 1; index < points.length; index += 1) {
      const segmentT = (index - 1) / Math.max(1, points.length - 2);
      const width = Phaser.Math.Linear(startWidth, endWidth, segmentT);
      const segmentAlpha = alpha * Phaser.Math.Linear(0.38, 1, segmentT);
      graphics.lineStyle(width, color, segmentAlpha);
      graphics.strokeLineShape(
        new Phaser.Geom.Line(
          points[index - 1].x,
          points[index - 1].y,
          points[index].x,
          points[index].y,
        ),
      );
    }
  }

  private drawEye(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    blink: number,
    pupilOffset: { x: number; y: number },
    scale: number,
  ): void {
    graphics.fillStyle(0xfafefc, 0.96);
    graphics.fillEllipse(x, y, 6.4 * scale, 5.2 * scale * blink);
    graphics.fillStyle(0x17251f, 0.95);
    graphics.fillCircle(
      x + pupilOffset.x,
      y + pupilOffset.y * blink,
      Math.max(0.7, 1.35 * scale),
    );
  }

  private drawMustache(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    angle: number,
    side: -1 | 1,
    scale: number,
  ): void {
    const reach = tuning.myriapodaMustacheLengthScale;
    const base = rotateVector(5.1 * scale, 2.4 * side * scale, angle);
    const mid = rotateVector(10.6 * scale * reach, 5.6 * side * scale, angle);
    const tip = rotateVector(13.7 * scale * reach, 7.1 * side * scale, angle);
    const lowerMid = rotateVector(
      10.2 * scale * reach,
      4.1 * side * scale,
      angle,
    );
    const lowerTip = rotateVector(
      13.2 * scale * reach,
      5.2 * side * scale,
      angle,
    );

    graphics.lineStyle(Math.max(0.75, 1.25 * scale), 0x284438, 0.74);
    graphics.strokePoints(
      [
        new Phaser.Math.Vector2(x + base.x, y + base.y),
        new Phaser.Math.Vector2(x + mid.x, y + mid.y),
        new Phaser.Math.Vector2(x + tip.x, y + tip.y),
      ],
      false,
      true,
    );
    graphics.strokePoints(
      [
        new Phaser.Math.Vector2(x + base.x, y + base.y + 1.2 * scale),
        new Phaser.Math.Vector2(x + lowerMid.x, y + lowerMid.y),
        new Phaser.Math.Vector2(x + lowerTip.x, y + lowerTip.y),
      ],
      false,
      true,
    );
  }

  private applyRenderTransform(): void {
    const scale = this.config.renderScale;
    const offsetX = this.config.renderAnchorX * (1 - scale);
    const offsetY = this.config.renderAnchorY * (1 - scale);

    for (const displayObject of this.transformables) {
      displayObject.setScale(scale);
      displayObject.setPosition(offsetX, offsetY);
    }

    this.stomachFxMask.setRenderTransform(this.config.renderAnchorX, this.config.renderAnchorY, scale);
    this.stomachParticles.setRenderTransform(
      this.config.renderAnchorX,
      this.config.renderAnchorY,
      scale,
    );
  }

  private getDamageBlinkFactor(progress: number): number {
    if (progress <= 0) {
      return 0;
    }

    const blink =
      0.42 +
      0.58 *
        (0.5 + 0.5 * Math.sin(this.elapsed * tuning.myriapodaDamageBlinkSpeed));
    return Phaser.Math.Clamp(progress * blink, 0, 1);
  }

  private blendColor(from: number, to: number, amount: number): number {
    const clamped = Phaser.Math.Clamp(amount, 0, 1);
    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;
    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;

    return Phaser.Display.Color.GetColor(
      Phaser.Math.Linear(fromR, toR, clamped),
      Phaser.Math.Linear(fromG, toG, clamped),
      Phaser.Math.Linear(fromB, toB, clamped),
    );
  }

  private bodyAlpha(value: number): number {
    return Phaser.Math.Clamp(value * this.config.bodyAlphaMultiplier, 0, 1);
  }

  private shadowAlpha(value: number): number {
    return Phaser.Math.Clamp(value * this.config.shadowAlphaMultiplier, 0, 1);
  }

  private outlineAlpha(value: number): number {
    return Phaser.Math.Clamp(value * this.config.outlineAlphaMultiplier, 0, 1);
  }

  private highlightAlpha(value: number): number {
    return Phaser.Math.Clamp(value * this.config.highlightAlphaMultiplier, 0, 1);
  }

  private outlineWidth(value: number): number {
    return value * this.config.outlineWidthMultiplier;
  }

  private transformPoint(x: number, y: number): { x: number; y: number } {
    return {
      x:
        this.config.renderAnchorX +
        (x - this.config.renderAnchorX) * this.config.renderScale,
      y:
        this.config.renderAnchorY +
        (y - this.config.renderAnchorY) * this.config.renderScale,
    };
  }

  private toRgbaColor(color: number, alpha: number): [number, number, number, number] {
    return [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
      Phaser.Math.Clamp(alpha, 0, 1),
    ];
  }
}
