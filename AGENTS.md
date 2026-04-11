# Project Rules

## 1. Phaser 4 First

- This project targets `phaser@^4.0.0`.
- Before implementing a feature, prefer Phaser 4-native APIs, patterns, and renderer capabilities over older Phaser 3-era approaches.
- Do not reintroduce deprecated or legacy Phaser 3 workflows when a Phaser 4 equivalent exists.
- When unsure, check the official local Phaser sources first:
  - `node_modules/phaser/changelog/v4/4.0/MIGRATION-GUIDE.md`
  - `node_modules/phaser/changelog/v4/4.0/CHANGELOG-v4.0.0.md`
  - `node_modules/phaser/docs/`
- Treat Phaser 4 documentation and shipped source as the primary authority for engine usage.

## 2. Physics: Planck Only

- All gameplay physics in this project uses `Planck.js`.
- Do not add Phaser Arcade Physics, Matter Physics, or any other Phaser physics system.
- Do not enable Arcade or Matter plugins in game config.
- New movement, collision, joints, bodies, sensors, and forces should be implemented with Planck.
- Phaser should only handle rendering, scenes, input, cameras, filters, and presentation concerns.

## 3. Visuals: Use Phaser 4 Capabilities Well

- For new visual work, actively consider Phaser 4 renderer upgrades before building custom workarounds.
- Prefer Phaser 4 features that improve look or performance where they fit:
  - filters
  - render textures / dynamic textures
  - improved masking workflow
  - modern shader paths
  - gradients / noise / newer rendering utilities
  - GPU-oriented layers or batching features when applicable
- Do not force new engine features into places where they add complexity without visual payoff.
- When a visual feature can be done either with an old-style workaround or a cleaner Phaser 4-native path, choose the Phaser 4-native path.
- Visual changes should aim for both better appearance and better runtime behavior, not just novelty.

## 4. Practical Workflow

- Before implementation:
  - confirm the Phaser 4-native approach
  - confirm the feature does not introduce non-Planck physics
  - check whether Phaser 4 offers a better rendering path than the current one
- After implementation:
  - run `npm run build`
  - run `npm test`
  - do a manual smoke check for visual or scene-lifecycle changes when relevant

