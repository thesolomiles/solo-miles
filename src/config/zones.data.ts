import type { InteractZone } from './town'

/**
 * Hand-authored interaction zones ("doors") — the single source of truth for the
 * boxes the player can stand in and press E on. Each is just a box with an id;
 * the press does NOTHING until that box is wired to real behaviour by id (enter a
 * map, open a modal, start a dialogue). See the InteractZone doc in town.ts.
 *
 * Edit these live in the browser: open the app with `?zones`, add/drag/delete
 * boxes on the ground, then hit "Save" — it rewrites this array (via the
 * dev-server endpoint in vite.config.ts) and git-commits. While editing, a
 * localStorage draft overrides this list so changes survive reloads until you
 * save them here.
 */
export const INTERACT_ZONES: InteractZone[] = [
  // Hand-drawn in ?zones (Leonard), saved straight from the browser editor.
  { id: "ze6h68k", verb: "Enter cafe", minX: 11.6, maxX: 12.8, minZ: -0.7, maxZ: 1.4 },
  { id: "zkjs0ff", verb: "Use vending machine", minX: 5.8, maxX: 6.7, minZ: -2.1, maxZ: 0.5 },
  { id: "z9mqziw", minX: -9.7, maxX: -7, minZ: -1.4, maxZ: 2.8 },
]
