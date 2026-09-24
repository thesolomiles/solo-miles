import { HOME } from '../config/home'
import { createColliderRegistry } from './interiorColliders'

/**
 * The home interior's live collider registry (see interiorColliders). A `?edit`
 * draft overrides the committed HOME.colliders until it's saved back into
 * config/home.ts (the dev-server /__save-home-colliders endpoint).
 */
const registry = createColliderRegistry('solomiles.homeColliders', HOME.colliders)

export const homeColliders = registry.boxes
export const setHomeColliders = registry.setBoxes
