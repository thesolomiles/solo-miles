import { cafeZones, setCafeZones } from '../systems/cafeZones'
import { createInteriorZoneEdit } from './interiorZoneEdit'

/** The café's `?zones` editor store (see interiorZoneEdit). Saved back into
 *  config/cafe.ts via /__save-cafe-zones. */
export const useCafeZoneEdit = createInteriorZoneEdit(cafeZones, setCafeZones, 'solomiles.cafeZoneOpen')
