/**
 * The "worlds" Leonard can take you riding through — grouped by country, each a
 * shelf of routes he's ridden before. This backs the world selector that opens
 * when you say "yes" to going for a ride (ui/WorldModal.tsx).
 *
 * Placeholder data for now: gradient-swatch thumbnails + a glyph, so the flow
 * (talk → yes → world selector) is wired end-to-end. Real route thumbnails,
 * distances and copy get swapped in later — keep the shape stable, the modal
 * renders straight off these fields. Cards are non-interactive for now (a route
 * doesn't load anything yet), mirroring the café's locked arcade games.
 */
export interface Route {
  id: string
  place: string
  region: string
  distanceKm: number
  elevationM: number
  /** 1–5, rendered as a pip row on the thumbnail. */
  difficulty: number
  /** Placeholder thumbnail: a two-stop gradient + a glyph, until real art lands. */
  thumb: { from: string; to: string; glyph: string }
  /** What Leonard says on the ride, line by line. Optional — when absent, a
      contextual placeholder script is generated from the route's fields (see
      routeScript). Hand-author these as the real ride content lands. */
  script?: string[]
  /** Web path to the ride's blog post — one folder per post under public/blog/,
      each holding an `index.html` + an `images/` folder (see public/blog/README.md),
      e.g. '/blog/shimanami-kaido/index.html'. (Points at index.html explicitly, not
      the bare directory, so it resolves as a static file instead of hitting Vite's
      SPA fallback.) When set, the world-selector card shows a 📖 marker and the ride
      scene shows a button that opens the post in a new tab. The post's
      <meta name="sm:*"> tags are the source I read to author this route; its <body>
      is what I turn into `script`. */
  blogPath?: string
}

export interface Country {
  id: string
  name: string
  /** Flag emoji shown next to the section header. */
  flag: string
  routes: Route[]
}

export const WORLDS: Country[] = [
  {
    id: 'japan',
    name: 'Japan',
    flag: '🇯🇵',
    routes: [
      {
        id: 'shimanami', place: 'Shimanami Kaido', region: 'Seto Inland Sea', distanceKm: 70, elevationM: 640, difficulty: 2, thumb: { from: '#7ec8e3', to: '#2f8f83', glyph: '🌊' },
        blogPath: '/blog/shimanami-kaido/index.html',
        script: [
          'Ahh, the Shimanami Kaido — this one’s special.',
          'Seventy kilometres island-hopping across the Seto Inland Sea.',
          'Six big suspension bridges, one after another, all to ourselves.',
          'Every crossing has a long spiral ramp — no stairs, just a gentle climb up to deck height.',
          'Gentle gradients the whole way, so just spin and soak in that unreal blue.',
          'I wrote the whole day up back home — tap the log if you want the full story.',
        ],
      },
      { id: 'fuji', place: 'Fuji Five Lakes', region: 'Yamanashi', distanceKm: 118, elevationM: 2380, difficulty: 5, thumb: { from: '#cfe3df', to: '#6b7fb0', glyph: '🗻' } },
      { id: 'noto', place: 'Noto Peninsula', region: 'Ishikawa', distanceKm: 96, elevationM: 980, difficulty: 3, thumb: { from: '#a6cfe1', to: '#50708f', glyph: '⛩️' } },
      {
        id: 'biei', place: 'Biei Rolling Hills', region: 'Hokkaido', distanceKm: 62, elevationM: 1180, difficulty: 3, thumb: { from: '#cfe3a6', to: '#7a9a52', glyph: '🌾' },
        blogPath: '/blog/biei-hills/index.html',
        script: [
          'Now this one’s a hidden gem — Biei, up in Hokkaido.',
          'Sixty-odd kilometres of rolling farmland that looks straight out of a painting.',
          'No set loop — you just wander the lanes between the fields and the lone trees.',
          'Constant little ups and downs, and every crest hands you another postcard.',
          'Summer only, mind — but the prettiest sixty kays I’ve ever ridden. Full log’s in the button.',
        ],
      },
    ],
  },
  {
    id: 'korea',
    name: 'Korea',
    flag: '🇰🇷',
    routes: [
      {
        id: 'jeju', place: 'Jeju Coastal Loop', region: 'Jeju-do', distanceKm: 202, elevationM: 1720, difficulty: 4, thumb: { from: '#f4d38a', to: '#d98a5a', glyph: '🌋' },
        blogPath: '/blog/jeju-coastal-loop/index.html',
        script: [
          'Right, Jeju — a full lap of the island on the coast road.',
          'Two hundred kilometres round a volcano, salt spray the whole way.',
          'The climbing’s gentle, but the wind? The wind decides your day out here.',
          'Hallasan sits in the middle the entire ride, ducking in and out of the clouds.',
          'I split it over two days in the end — the write-up’s in the log if you fancy it.',
        ],
      },
      { id: 'hallasan', place: 'Hallasan Climb', region: 'Jeju-do', distanceKm: 44, elevationM: 1580, difficulty: 4, thumb: { from: '#e7d3b0', to: '#b4553f', glyph: '🌲' } },
    ],
  },
  {
    id: 'taiwan',
    name: 'Taiwan',
    flag: '🇹🇼',
    routes: [
      { id: 'taroko', place: 'Taroko Gorge', region: 'Hualien', distanceKm: 86, elevationM: 2260, difficulty: 5, thumb: { from: '#9bae77', to: '#4e6138', glyph: '⛰️' } },
      { id: 'sun-moon', place: 'Sun Moon Lake', region: 'Nantou', distanceKm: 30, elevationM: 520, difficulty: 2, thumb: { from: '#8fd0d6', to: '#3a6f8f', glyph: '🚵' } },
    ],
  },
  {
    id: 'malaysia',
    name: 'Malaysia',
    flag: '🇲🇾',
    routes: [
      { id: 'cameron', place: 'Cameron Highlands', region: 'Pahang', distanceKm: 92, elevationM: 2100, difficulty: 4, thumb: { from: '#a7c98a', to: '#3f6b46', glyph: '🍃' } },
      { id: 'langkawi', place: 'Langkawi Loop', region: 'Kedah', distanceKm: 58, elevationM: 610, difficulty: 2, thumb: { from: '#ffd79a', to: '#c98a4a', glyph: '🏝️' } },
    ],
  },
  {
    id: 'australia',
    name: 'Australia',
    flag: '🇦🇺',
    routes: [
      { id: 'great-ocean', place: 'Great Ocean Road', region: 'Victoria', distanceKm: 243, elevationM: 2900, difficulty: 5, thumb: { from: '#8fc7e8', to: '#356a94', glyph: '🌅' } },
      { id: 'blue-mtns', place: 'Blue Mountains', region: 'New South Wales', distanceKm: 74, elevationM: 1650, difficulty: 4, thumb: { from: '#9aa6d6', to: '#4b4f7a', glyph: '🏔️' } },
    ],
  },
  {
    id: 'singapore',
    name: 'Singapore',
    flag: '🇸🇬',
    routes: [
      { id: 'round-island', place: 'Round Island Route', region: 'Island loop', distanceKm: 150, elevationM: 480, difficulty: 3, thumb: { from: '#ffcf8a', to: '#d9694a', glyph: '🌆' } },
      { id: 'east-coast', place: 'East Coast Park', region: 'Coastal path', distanceKm: 24, elevationM: 40, difficulty: 1, thumb: { from: '#9fe0cf', to: '#3f8f7a', glyph: '🌴' } },
    ],
  },
  {
    id: 'hongkong',
    name: 'Hong Kong',
    flag: '🇭🇰',
    routes: [
      { id: 'tai-mo-shan', place: 'Tai Mo Shan', region: 'New Territories', distanceKm: 40, elevationM: 1300, difficulty: 4, thumb: { from: '#c9d6a7', to: '#5a6b3f', glyph: '🌫️' } },
      { id: 'sai-kung', place: 'Sai Kung Coast', region: 'Sai Kung', distanceKm: 52, elevationM: 900, difficulty: 3, thumb: { from: '#8fd0e8', to: '#356e8f', glyph: '⛵' } },
    ],
  },
]

/** Flat index of every route by id — the ride scene looks routes up by id. */
export const ROUTES: Record<string, Route> = Object.fromEntries(
  WORLDS.flatMap((c) => c.routes.map((r) => [r.id, r])),
)

const DIFFICULTY_NOTE = [
  'Nice and easy — a proper cruise, this one.',
  'Nothing too taxing, just a lovely roll.',
  'A few honest climbs, but well worth it.',
  'It bites in places — pace yourself on the climbs.',
  'This is a big one. Legs and lungs both, all day.',
] as const

/**
 * The lines Leonard says on a ride: the route's hand-authored `script` if it has
 * one, otherwise a contextual placeholder built from its fields — so every route
 * has something to say today. The closing line is appended by the caller.
 */
export function routeScript(route: Route): string[] {
  if (route.script?.length) return route.script
  const note = DIFFICULTY_NOTE[Math.min(route.difficulty, 5) - 1] ?? DIFFICULTY_NOTE[2]
  return [
    `Right then — ${route.place}. You’re gonna love this.`,
    `${route.distanceKm} km through ${route.region}, about ${route.elevationM} m of climbing.`,
    note,
    'Stick with me and just enjoy the ride.',
  ]
}
