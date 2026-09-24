import { homeZones, setHomeZones } from '../systems/homeZones'
import { createInteriorZoneEdit } from './interiorZoneEdit'

/** The home's `?zones` editor store (see interiorZoneEdit). Saved back into
 *  config/home.ts via /__save-home-zones. */
export const useHomeZoneEdit = createInteriorZoneEdit(homeZones, setHomeZones, 'solomiles.homeZoneOpen')
