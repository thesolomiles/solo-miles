import { CAFE } from '../config/cafe'
import { createColliderRegistry } from './interiorColliders'

/**
 * The café interior's live collider registry (see interiorColliders). A `?edit`
 * draft overrides the committed CAFE.colliders until it's saved back into
 * config/cafe.ts (the dev-server /__save-cafe-colliders endpoint).
 */
const registry = createColliderRegistry('solomiles.cafeColliders', CAFE.colliders)

export const cafeColliders = registry.boxes
export const setCafeColliders = registry.setBoxes
