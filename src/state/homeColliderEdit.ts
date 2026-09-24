import { homeColliders, setHomeColliders } from '../systems/homeColliders'
import { createInteriorColliderEdit } from './interiorColliderEdit'

/** The home's `?edit` collision-editor store (see interiorColliderEdit). Saved
 *  back into config/home.ts via /__save-home-colliders. */
export const useHomeColliderEdit = createInteriorColliderEdit(
  homeColliders,
  setHomeColliders,
  'solomiles.homeColliderOpen',
)
