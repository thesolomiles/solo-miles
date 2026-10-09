/** Moss-covered wayside stones: one shared palette GLB, five silhouettes. */
export const FOREST_STONES = {
  variants: ['LowCairn', 'SquatLantern', 'LayeredPagoda', 'TallStack', 'BrokenLantern'],
  every: 12,
  fill: 0.78,
  depth: [-3.4, -6.5],
  scale: [0.65, 1.25],
  /** Includes the widest walking frame and the prepared discovery shots. */
  maxHalf: 42,
  margin: 7,
} as const
