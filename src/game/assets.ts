export const textureKeys = {
  head: 'head',
  background: {
    softCloud: 'background-soft-cloud',
    bioWeb: 'background-bio-web',
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
} as const;
