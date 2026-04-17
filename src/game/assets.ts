export const textureKeys = {
  head: 'head',
  background: {
    softCloud: 'background-soft-cloud',
    bioWeb: 'background-bio-web',
    neuralVein: 'background-neural-vein',
    capillaryVein: 'background-capillary-vein',
    pulseHead: 'background-pulse-head',
    membraneStain: 'background-membrane-stain',
    softGlowDot: 'background-soft-glow-dot',
    particleDot: 'background-particle-dot',
    softParticle: 'background-soft-particle',
    moteFragment: 'background-mote-fragment',
    corruptionCrack: 'background-corruption-crack',
  },
  pickups: {
    biomass: 'pickup-basic-biomass',
    tissue: 'pickup-advanced-tissue',
    structuralCell: 'pickup-rare-structural-cell',
    parasite: 'pickup-harmful-parasite',
  },
  /** Procedural evolution UI building icons (PreloadScene). */
  evolutionBuildings: [
    'evo-building-0',
    'evo-building-1',
    'evo-building-2',
    'evo-building-3',
    'evo-building-4',
    'evo-building-5',
    'evo-building-6',
    'evo-building-7',
  ] as const,
  /** Procedural resource cost icons (PreloadScene), keyed by PickupResourceId. */
  resourceIcons: {
    biomass: 'resource-icon-biomass',
    tissue: 'resource-icon-tissue',
    structuralCell: 'resource-icon-structuralCell',
    parasite: 'resource-icon-parasite',
  },
} as const;
