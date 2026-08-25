import type { InteractZone } from './town'

/**
 * Hand-authored interaction zones ("doors") — the single source of truth for the
 * boxes the player can stand in and press E on. Each is just a named box; the
 * press does NOTHING until that box is wired to real behaviour by name (enter a
 * map, open a modal, start a dialogue). See the InteractZone doc in town.ts.
 *
 * Edit these live in the browser: open the app with `?zones`, add/drag/delete
 * boxes on the ground, name the selected one, then hit "Save" — it rewrites this
 * array (via the dev-server endpoint in vite.config.ts) and git-commits. While
 * editing, a localStorage draft overrides this list so changes survive reloads
 * until you save them here.
 */
export const INTERACT_ZONES: InteractZone[] = [
  // Hand-drawn in ?zones (Leonard), saved straight from the browser editor.
  { id: "ze6h68k", name: "Cafe", verb: "Enter cafe", minX: 11.6, maxX: 12.8, minZ: -0.7, maxZ: 0.5 },
]
