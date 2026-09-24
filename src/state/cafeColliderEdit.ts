import { cafeColliders, setCafeColliders } from '../systems/cafeColliders'
import { createInteriorColliderEdit } from './interiorColliderEdit'

/** The café's `?edit` collision-editor store (see interiorColliderEdit). Saved
 *  back into config/cafe.ts via /__save-cafe-colliders. */
export const useCafeColliderEdit = createInteriorColliderEdit(
  cafeColliders,
  setCafeColliders,
  'solomiles.cafeColliderOpen',
)
