import * as Phaser from 'phaser';
import * as planck from 'planck';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { evolutionPreviewStyle } from '@/evolution/evolutionVisuals';
import {
  type EvolutionSelectablePartRegion,
  findTopEvolutionPartAtPoint,
  getEvolutionPartLabel,
  isSameEvolutionPartId,
} from '@/evolution/myriapodaSelection';
import type { EvolutionPartId, EvolutionSnapshot } from '@/game/types';
import { tuning } from '@/game/tuning';
import { vec2FromPixels, vec2ToPixels } from '@/physics/PhysicsUtils';
import { MyriapodaRenderer } from '@/rendering/MyriapodaRenderer';
import { FollowChainSystem } from '@/systems/FollowChainSystem';

const idleDashState = {
  cooldownSeconds: 0,
  cooldownProgress: 1,
  isReady: true,
  isActive: false,
  shakeStrength: 0,
  motionStrength: 0,
  phase: 0,
  directionX: 1,
  directionY: 0,
} as const;

export class EvolutionMyriapodaPreview {
  private readonly scene: Phaser.Scene;
  private readonly physicsWorld: planck.World;
  private readonly myriapoda: Myriapoda;
  private readonly renderer: MyriapodaRenderer;
  private readonly followChainSystem: FollowChainSystem;
  private readonly backdropGraphics: Phaser.GameObjects.Graphics;
  private readonly selectionGraphics: Phaser.GameObjects.Graphics;
  private readonly selectionGlowGraphics: Phaser.GameObjects.Graphics;
  private segmentCount: number;
  private visible = true;
  private elapsed = 0;
  private centerX = 0;
  private centerY = 0;
  private orbitRadiusX = 120;
  private orbitRadiusY = 68;
  private bounds = new Phaser.Geom.Rectangle();
  private hoveredPartId: EvolutionPartId | null = null;
  private selectedPartId: EvolutionPartId | null = null;
  private partRegions: EvolutionSelectablePartRegion[] = [];
  private needsWarmup = true;

  constructor(scene: Phaser.Scene, snapshot: EvolutionSnapshot['myriapoda']) {
    this.scene = scene;
    this.segmentCount = snapshot.segmentCount;
    this.physicsWorld = new planck.World({
      gravity: planck.Vec2(0, 0),
    });
    this.myriapoda = new Myriapoda(scene, this.physicsWorld, 0, 0);
    while (this.myriapoda.body.segments.length < snapshot.segmentCount) {
      this.myriapoda.body.addSegment();
    }
    for (const disabledLimbIndex of snapshot.disabledLimbIndices) {
      this.myriapoda.limbs.destroyLimb(`limb-${disabledLimbIndex + 1}`);
    }
    for (const resourceId of snapshot.stomachResources) {
      this.myriapoda.stomach.add(resourceId);
    }
    for (let index = 0; index < snapshot.parasiteCount; index += 1) {
      this.myriapoda.stomach.add('parasite');
    }

    this.renderer = new MyriapodaRenderer(scene, {
      bodyAlphaMultiplier: evolutionPreviewStyle.alphaBoost,
      outlineAlphaMultiplier: evolutionPreviewStyle.outlineBoost,
      outlineWidthMultiplier: 1.22,
      highlightAlphaMultiplier: 1.45,
      shadowAlphaMultiplier: 1.2,
    });
    this.followChainSystem = new FollowChainSystem();
    this.backdropGraphics = scene.add.graphics().setDepth(1.5);
    this.selectionGlowGraphics = scene.add.graphics().setDepth(5.28);
    this.selectionGraphics = scene.add.graphics().setDepth(5.32);
  }

  layout(bounds: Phaser.Geom.Rectangle): void {
    this.bounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height);
    this.centerX = bounds.centerX;
    this.centerY = bounds.centerY + Math.min(28, bounds.height * 0.025);
    this.orbitRadiusX = Math.min(bounds.width * 0.14, 64 + this.segmentCount * 2.1);
    this.orbitRadiusY = Math.min(bounds.height * 0.1, 32 + this.segmentCount * 1.2);
    this.renderer.setRenderTransform(
      this.centerX,
      this.centerY,
      evolutionPreviewStyle.visualScale,
    );

    if (this.needsWarmup) {
      this.warmUpPose();
      this.needsWarmup = false;
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.clear();
    }
  }

  /**
   * After GameScene adds a segment via evolution purchase, grow the preview body to match.
   */
  syncSegmentCountFromGame(targetCount: number): void {
    while (this.myriapoda.body.segments.length < targetCount) {
      this.myriapoda.body.addSegment();
    }
    this.segmentCount = this.myriapoda.body.segments.length;
  }

  update(deltaSeconds: number): void {
    if (!this.visible) {
      return;
    }

    const step = Math.min(0.033, Math.max(0.001, deltaSeconds));
    this.stepSimulation(step);
    this.renderBackdrop();
    this.renderer.update(this.myriapoda, idleDashState);
    this.partRegions = this.collectPartRegions();
    this.drawSelectionState();
  }

  destroy(): void {
    this.clear();
    this.renderer.destroy();
    this.selectionGraphics.destroy();
    this.selectionGlowGraphics.destroy();
    this.backdropGraphics.destroy();
    this.myriapoda.head.sprite.destroy();
  }

  containsPoint(x: number, y: number): boolean {
    return this.bounds.contains(x, y);
  }

  handlePointerMove(x: number, y: number): void {
    if (!this.visible || !this.containsPoint(x, y)) {
      this.hoveredPartId = null;
      return;
    }

    const previewPoint = this.toPreviewPoint(x, y);
    const hovered = findTopEvolutionPartAtPoint(this.partRegions, previewPoint.x, previewPoint.y);
    this.hoveredPartId = hovered?.id ?? null;
  }

  handlePointerDown(x: number, y: number): boolean {
    if (!this.visible || !this.containsPoint(x, y)) {
      return false;
    }

    const previewPoint = this.toPreviewPoint(x, y);
    const picked = findTopEvolutionPartAtPoint(
      this.partRegions,
      previewPoint.x,
      previewPoint.y,
    );
    if (!picked) {
      this.selectedPartId = null;
      return true;
    }

    this.selectedPartId = isSameEvolutionPartId(this.selectedPartId, picked.id)
      ? null
      : picked.id;
    this.hoveredPartId = picked.id;
    return true;
  }

  getFocusedPart(): EvolutionSelectablePartRegion | null {
    const preferredId = this.selectedPartId ?? this.hoveredPartId;
    if (!preferredId) {
      return null;
    }

    return (
      this.partRegions.find((region) => isSameEvolutionPartId(region.id, preferredId)) ?? null
    );
  }

  getFocusedPartName(): string {
    const focused = this.getFocusedPart();
    return focused ? focused.label : 'Select a body part';
  }

  private warmUpPose(): void {
    for (let index = 0; index < 220; index += 1) {
      this.stepSimulation(1 / 60);
    }
  }

  private stepSimulation(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    const pose = this.sampleGuidePose();

    this.myriapoda.head.body.setTransform(vec2FromPixels(pose.x, pose.y), pose.angle);
    this.myriapoda.head.body.setLinearVelocity(planck.Vec2(0, 0));
    this.myriapoda.head.body.setAngularVelocity(0);

    this.followChainSystem.update(this.myriapoda, idleDashState);
    this.myriapoda.syncBodyAttachments(deltaSeconds, idleDashState);
    this.myriapoda.limbs.update(deltaSeconds, new Set<string>(), this.myriapoda.body);
    this.physicsWorld.step(deltaSeconds);
    this.myriapoda.syncBodyAttachments(0, idleDashState);
    this.myriapoda.stomach.step(deltaSeconds);
  }

  private sampleGuidePose(): { x: number; y: number; angle: number } {
    const phase = this.elapsed * 0.46;
    const x = this.centerX + Math.cos(phase) * this.orbitRadiusX;
    const y = this.centerY + Math.sin(phase) * this.orbitRadiusY;
    const tangentX = -Math.sin(phase) * this.orbitRadiusX;
    const tangentY = Math.cos(phase) * this.orbitRadiusY;

    return {
      x,
      y,
      angle: Math.atan2(tangentY, tangentX),
    };
  }

  private collectPartRegions(): EvolutionSelectablePartRegion[] {
    const head = vec2ToPixels(this.myriapoda.head.body.getPosition());
    const stomachAnchor = this.myriapoda.body.getStomachAnchor();
    const stomachRadius = tuning.stomachRadiusMeters * tuning.pixelsPerMeter * 1.05;
    const regions: EvolutionSelectablePartRegion[] = [
      {
        id: 'head',
        label: getEvolutionPartLabel('head'),
        shape: {
          kind: 'ellipse',
          x: head.x,
          y: head.y,
          radiusX: tuning.headRadius * tuning.myriapodaHeadVisualScale * 2.1,
          radiusY: tuning.headRadius * tuning.myriapodaHeadVisualScale * 1.8,
          rotation: this.myriapoda.head.body.getAngle(),
        },
      },
      {
        id: 'stomach',
        label: getEvolutionPartLabel('stomach'),
        shape: {
          kind: 'circle',
          x: stomachAnchor.x,
          y: stomachAnchor.y,
          radius: stomachRadius,
        },
      },
      {
        id: 'tail',
        label: getEvolutionPartLabel('tail'),
        shape: {
          kind: 'capsule',
          ax: this.myriapoda.body.getTailAnchor().x,
          ay: this.myriapoda.body.getTailAnchor().y,
          bx: this.myriapoda.tail.getTipPixels().x,
          by: this.myriapoda.tail.getTipPixels().y,
          radius: Math.max(10, tuning.tailRadiusPx * 1.9),
        },
      },
    ];

    for (const limb of this.myriapoda.limbs.limbs) {
      if (!limb.body) {
        continue;
      }
      const root = vec2ToPixels(limb.body.root.getPosition());
      const tip = vec2ToPixels(limb.body.tip.getPosition());
      regions.push({
        id: { type: 'limb', index: Number(limb.id.replace('limb-', '')) - 1 },
        label: getEvolutionPartLabel({
          type: 'limb',
          index: Number(limb.id.replace('limb-', '')) - 1,
        }),
        shape: {
          kind: 'capsule',
          ax: root.x,
          ay: root.y,
          bx: tip.x,
          by: tip.y,
          radius: Math.max(10, tuning.limbThicknessPx * 2.2),
        },
      });
    }

    this.myriapoda.body.segments.forEach((segment, index) => {
      if (Phaser.Math.Distance.Between(segment.x, segment.y, stomachAnchor.x, stomachAnchor.y) <= stomachRadius) {
        return;
      }
      regions.push({
        id: { type: 'segment', index },
        label: getEvolutionPartLabel({ type: 'segment', index }),
        shape: {
          kind: 'circle',
          x: segment.x,
          y: segment.y,
          radius: segment.radius * tuning.myriapodaBodyCircleScale * 1.12,
        },
      });
    });

    return regions;
  }

  private renderBackdrop(): void {
    this.backdropGraphics.clear();
  }

  private drawSelectionState(): void {
    this.selectionGraphics.clear();
    this.selectionGlowGraphics.clear();

    const hovered = this.findRegionById(this.hoveredPartId);
    const selected = this.findRegionById(this.selectedPartId);

    if (hovered && !selected) {
      this.drawRegion(
        hovered,
        1.05,
        evolutionPreviewStyle.hoverGlowColor,
        0.32,
        0xd9ffff,
        0.86,
      );
    }

    if (selected) {
      this.drawRegion(
        selected,
        1.12,
        evolutionPreviewStyle.hoverGlowColor,
        0.42,
        evolutionPreviewStyle.selectionGlowColor,
        1,
      );
    }
  }

  private drawRegion(
    region: EvolutionSelectablePartRegion,
    scale: number,
    glowColor: number,
    glowAlpha: number,
    strokeColor: number,
    strokeAlpha: number,
  ): void {
    this.selectionGlowGraphics.fillStyle(glowColor, glowAlpha);

    if (region.shape.kind === 'circle') {
      const center = this.toDisplayPoint(region.shape.x, region.shape.y);
      this.selectionGraphics.lineStyle(
        this.toDisplayDistance(1.2),
        strokeColor,
        strokeAlpha,
      );
      this.selectionGlowGraphics.fillCircle(
        center.x,
        center.y,
        this.toDisplayDistance(region.shape.radius * scale * 1.35),
      );
      this.selectionGraphics.strokeCircle(
        center.x,
        center.y,
        this.toDisplayDistance(region.shape.radius * scale),
      );
      return;
    }

    if (region.shape.kind === 'ellipse') {
      const center = this.toDisplayPoint(region.shape.x, region.shape.y);
      this.selectionGraphics.lineStyle(
        this.toDisplayDistance(1.1),
        strokeColor,
        strokeAlpha,
      );
      const glowPoints = this.sampleEllipsePoints(
        center.x,
        center.y,
        this.toDisplayDistance(region.shape.radiusX * scale * 1.18),
        this.toDisplayDistance(region.shape.radiusY * scale * 1.18),
        region.shape.rotation,
      );
      const strokePoints = this.sampleEllipsePoints(
        center.x,
        center.y,
        this.toDisplayDistance(region.shape.radiusX * scale),
        this.toDisplayDistance(region.shape.radiusY * scale),
        region.shape.rotation,
      );
      this.selectionGlowGraphics.fillPoints(glowPoints as Phaser.Math.Vector2[], true);
      this.selectionGraphics.strokePoints(strokePoints as Phaser.Math.Vector2[], true, true);
      return;
    }

    const glowCapsule = this.sampleCapsulePoints(
      this.toDisplayPoint(region.shape.ax, region.shape.ay),
      this.toDisplayPoint(region.shape.bx, region.shape.by),
      this.toDisplayDistance(region.shape.radius * scale * 1.55),
      10,
    );
    const strokeCapsule = this.sampleCapsulePoints(
      this.toDisplayPoint(region.shape.ax, region.shape.ay),
      this.toDisplayPoint(region.shape.bx, region.shape.by),
      this.toDisplayDistance(region.shape.radius * scale * 1.04),
      10,
    );
    this.selectionGlowGraphics.fillPoints(glowCapsule as Phaser.Math.Vector2[], true);
    this.selectionGlowGraphics.lineStyle(
      this.toDisplayDistance(Math.max(1.4, region.shape.radius * 0.26)),
      glowColor,
      glowAlpha * 0.82,
    );
    this.selectionGlowGraphics.strokePoints(strokeCapsule as Phaser.Math.Vector2[], true, true);
    this.selectionGraphics.lineStyle(
      this.toDisplayDistance(Math.max(1.1, region.shape.radius * 0.18)),
      strokeColor,
      strokeAlpha,
    );
    this.selectionGraphics.strokePoints(strokeCapsule as Phaser.Math.Vector2[], true, true);
  }

  private sampleEllipsePoints(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
  ): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const localX = Math.cos(angle) * radiusX;
      const localY = Math.sin(angle) * radiusY;
      const rotatedX = localX * Math.cos(rotation) - localY * Math.sin(rotation);
      const rotatedY = localX * Math.sin(rotation) + localY * Math.cos(rotation);
      points.push(new Phaser.Math.Vector2(x + rotatedX, y + rotatedY));
    }
    return points;
  }

  private sampleCapsulePoints(
    start: { x: number; y: number },
    end: { x: number; y: number },
    radius: number,
    steps: number,
  ): Phaser.Math.Vector2[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const points: Phaser.Math.Vector2[] = [];

    for (let index = 0; index <= steps; index += 1) {
      const theta = angle - Math.PI * 0.5 + (index / steps) * Math.PI;
      points.push(
        new Phaser.Math.Vector2(
          end.x + Math.cos(theta) * radius,
          end.y + Math.sin(theta) * radius,
        ),
      );
    }

    for (let index = 0; index <= steps; index += 1) {
      const theta = angle + Math.PI * 0.5 + (index / steps) * Math.PI;
      points.push(
        new Phaser.Math.Vector2(
          start.x + Math.cos(theta) * radius,
          start.y + Math.sin(theta) * radius,
        ),
      );
    }

    return points;
  }

  private findRegionById(partId: EvolutionPartId | null): EvolutionSelectablePartRegion | null {
    if (!partId) {
      return null;
    }

    return this.partRegions.find((region) => isSameEvolutionPartId(region.id, partId)) ?? null;
  }

  private clear(): void {
    this.renderer.clear();
    this.backdropGraphics.clear();
    this.selectionGraphics.clear();
    this.selectionGlowGraphics.clear();
  }

  private toPreviewPoint(x: number, y: number): { x: number; y: number } {
    const scale = evolutionPreviewStyle.visualScale;
    return {
      x: this.centerX + (x - this.centerX) / scale,
      y: this.centerY + (y - this.centerY) / scale,
    };
  }

  private toDisplayPoint(x: number, y: number): { x: number; y: number } {
    const scale = evolutionPreviewStyle.visualScale;
    return {
      x: this.centerX + (x - this.centerX) * scale,
      y: this.centerY + (y - this.centerY) * scale,
    };
  }

  private toDisplayDistance(distance: number): number {
    return distance * evolutionPreviewStyle.visualScale;
  }
}
