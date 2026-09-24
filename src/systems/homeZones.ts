import { HOME } from '../config/home'
import { createZoneRegistry } from './interiorZones'

/**
 * The home interior's live interaction-zone registry (see interiorZones). A
 * `?zones` draft overrides the committed HOME.zones until it's saved back into
 * config/home.ts (the dev-server /__save-home-zones endpoint).
 */
const registry = createZoneRegistry('solomiles.homeInteractZones', HOME.zones)

export const homeZones = registry.zones
export const setHomeZones = registry.setZones
