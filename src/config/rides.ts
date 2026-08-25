/**
 * Leonard's ride log — the places he's cycled, shown as game-style cards when
 * you say "yes" to going for a ride.
 *
 * This is placeholder data with gradient-swatch thumbnails so the flow (talk →
 * yes → card modal) is wired up end-to-end; the real thumbnails, routes and copy
 * get swapped in later (the UI art is being prepped elsewhere). Keep the shape
 * stable — the modal (ui/RidesModal.tsx) renders straight off these fields.
 */
export interface Ride {
  id: string
  place: string
  region: string
  distanceKm: number
  elevationM: number
  /** 1–5, rendered as stars. */
  difficulty: number
  /** Placeholder thumbnail: a two-stop gradient + a glyph, until real art lands. */
  thumb: { from: string; to: string; glyph: string }
}

export const RIDES: Ride[] = [
  {
    id: 'shimanami',
    place: 'Shimanami Kaido',
    region: 'Japan · Seto Inland Sea',
    distanceKm: 70,
    elevationM: 640,
    difficulty: 2,
    thumb: { from: '#7ec8e3', to: '#2f8f83', glyph: '🌊' },
  },
  {
    id: 'fuji',
    place: 'Fuji Five Lakes',
    region: 'Japan · Yamanashi',
    distanceKm: 118,
    elevationM: 2380,
    difficulty: 5,
    thumb: { from: '#cfe3df', to: '#6b7fb0', glyph: '🗻' },
  },
  {
    id: 'jeju',
    place: 'Jeju Coastal Loop',
    region: 'Korea · Jeju-do',
    distanceKm: 202,
    elevationM: 1720,
    difficulty: 4,
    thumb: { from: '#f4d38a', to: '#d98a5a', glyph: '🌋' },
  },
  {
    id: 'taroko',
    place: 'Taroko Gorge',
    region: 'Taiwan · Hualien',
    distanceKm: 86,
    elevationM: 2260,
    difficulty: 5,
    thumb: { from: '#9bae77', to: '#4e6138', glyph: '⛰️' },
  },
  {
    id: 'hallasan',
    place: 'Hallasan Climb',
    region: 'Korea · Jeju-do',
    distanceKm: 44,
    elevationM: 1580,
    difficulty: 4,
    thumb: { from: '#e7d3b0', to: '#b4553f', glyph: '🌲' },
  },
  {
    id: 'noto',
    place: 'Noto Peninsula',
    region: 'Japan · Ishikawa',
    distanceKm: 96,
    elevationM: 980,
    difficulty: 3,
    thumb: { from: '#a6cfe1', to: '#50708f', glyph: '⛩️' },
  },
]
