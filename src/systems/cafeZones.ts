import { CAFE } from '../config/cafe'
import { createZoneRegistry } from './interiorZones'

/**
 * The café interior's live interaction-zone registry (see interiorZones). A
 * `?zones` draft overrides the committed CAFE.zones until it's saved back into
 * config/cafe.ts (the dev-server /__save-cafe-zones endpoint).
 */
const registry = createZoneRegistry('solomiles.cafeInteractZones', CAFE.zones)

export const cafeZones = registry.zones
export const setCafeZones = registry.setZones
