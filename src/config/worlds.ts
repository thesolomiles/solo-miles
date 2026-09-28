/**
 * The "worlds" Leonard can take you riding through — grouped by country, each a
 * shelf of real climbs he's actually ridden. This backs the world selector that
 * opens when you say "yes" to going for a ride (ui/WorldModal.tsx).
 *
 * The data is drawn from Leonard's Notion "List of climbs": one entry per climb
 * with its real distance and elevation gain, and a route-map trace (the actual
 * GPS shape, exported from Strava) that renders as the card thumbnail from
 * public/routes/<id>.svg. Difficulty is derived from the numbers (see below).
 * Countries Leonard hasn't ridden yet (Singapore, Malaysia, Indonesia) are kept
 * as empty shelves so the map of where he's been reads honestly.
 */
import { script as namsanBugaksan } from './rideScripts/namsan-bugaksan'
import { script as namhansanseong } from './rideScripts/namhansanseong'
import { script as taiMoShan } from './rideScripts/tai-mo-shan'

/** The ride logs (/blog/) are a WIP Leonard is still thinking through, so the
 *  game doesn't link to them: no "L Ride logs" in the world selector, no 📖 on
 *  its cards, no "Read the log" on a ride. The page itself is dev-only too (see
 *  vite.config.ts). Flip to true to bring all of it back. */
export const SHOW_BLOG = false

export interface Route {
  id: string
  place: string
  region: string
  distanceKm: number
  elevationM: number
  /** 1–5, rendered as a pip row on the thumbnail. Derived from distance + climb. */
  difficulty: number
  /** Card background: a two-stop gradient (per country) + a glyph fallback shown
      when there's no route map. */
  thumb: { from: string; to: string; glyph: string }
  /** The real route-map trace, a web path under public/routes/. Rendered as the
      card thumbnail — the actual shape of the ride. */
  map?: string
  /** A scenic photo/illustration for the card (web path under public/thumbs/).
      When set it becomes the card's hero image instead of the gradient + trace. */
  photo?: string
  /** Strava activity for the ride (source of the distance/elevation/map). */
  strava?: string
  /** When it was ridden, YYYY-MM-DD (local), from the Strava activity. Shown
      on the ride log. */
  date?: string
  /** What Leonard says on the ride, line by line. Optional — when absent, a
      contextual placeholder script is generated from the route's fields (see
      routeScript). Hand-author these as the real ride content lands. A line can
      carry a photo, shown as a hologram beside the speech box while he says it. */
  script?: (string | ScriptLine)[]
  /** Web path to the ride's blog post — one folder per post under public/blog/,
      each holding an `index.html` + an `images/` folder (see public/blog/README.md),
      e.g. '/blog/shimanami-kaido/index.html'. When set, the world-selector card
      shows a 📖 marker and the ride scene shows a button that opens the post. */
  blogPath?: string
  /** The ride's GPX file for download (web path, public/gpx/<id>.gpx — exported
      from the Strava activity). Shown on the ride-log page; "GPX soon" until set. */
  gpx?: string
  /** A two-or-three-sentence pitch for the ride, shown under the title in the
      world selector's hero and the /blog/ page's. BLURB_PLACEHOLDER until set. */
  blurb?: string
}

/** Stand-in hero copy for a route with no `blurb` yet (shown greyed out). */
export const BLURB_PLACEHOLDER =
  'Placeholder — a short pitch for this ride goes here: what the climb is like, what you see on the way up, and why it is worth the legs.'

/** One line of a ride script, optionally bringing up the photo(s) he's talking
    about. Photos stay up through the following lines until the next ones. */
export interface ScriptLine {
  say: string
  /** Web paths of photos to bring up together, side by side (usually from the
      route's blog images/ folder); null takes the current ones down. */
  photos?: string[] | null
  /** Short label under the photos. */
  caption?: string
}

export interface Country {
  id: string
  name: string
  /** Flag emoji shown next to the section header. */
  flag: string
  routes: Route[]
}

// Per-country card gradients — the route trace is the hero, so each country gets
// one cohesive palette behind it (its shelf colour).
const G = {
  korea: { from: '#e7b26a', to: '#b1543c' },
  japan: { from: '#86a9db', to: '#3d4f7c' },
  taiwan: { from: '#9cbf79', to: '#3f6b46' },
  australia: { from: '#f0c169', to: '#c6854a' },
  hongkong: { from: '#8fc3c9', to: '#3d6b76' },
} as const

export const WORLDS: Country[] = [
  {
    id: 'korea',
    name: 'Korea',
    flag: '🇰🇷',
    routes: [
      {
        id: 'namsan-bugaksan', place: 'Namsan × Bugaksan', region: 'Seoul', distanceKm: 30.6, elevationM: 611, difficulty: 1, map: '/routes/namsan-bugaksan.svg', strava: 'https://www.strava.com/activities/6967634149', date: '2022-04-12', photo: '/thumbs/namsan-bugaksan.jpg', thumb: { ...G.korea, glyph: '🏙️' },
        blogPath: '/blog/namsan-bugaksan/index.html',
        // Generated from his Notion page (content/rides → tools/sync-ride.py): the
        // page's order of text and photos is the ride's sequence.
        script: namsanBugaksan,
      },
      { id: 'namhansanseong', place: 'Namhansanseong', region: 'Gyeonggi', distanceKm: 96, elevationM: 952, difficulty: 2, map: '/routes/namhansanseong.svg', strava: 'https://www.strava.com/activities/6983386124', date: '2022-04-15', photo: '/thumbs/namhansanseong.jpg', thumb: { ...G.korea, glyph: '🏯' }, blogPath: '/blog/namhansanseong/index.html', script: namhansanseong },
      { id: 'jirisan', place: 'Jirisan', region: 'Jirisan National Park', distanceKm: 82.5, elevationM: 2133, difficulty: 4, map: '/routes/jirisan.svg', strava: 'https://www.strava.com/activities/10065502447', date: '2023-10-19', photo: '/thumbs/jirisan.jpg', thumb: { ...G.korea, glyph: '🏔️' } },
      { id: 'suncheon-bay', place: 'Suncheon Bay Loop', region: 'Suncheon', distanceKm: 153.4, elevationM: 1420, difficulty: 3, map: '/routes/suncheon-bay.svg', strava: 'https://www.strava.com/activities/10071353489', date: '2023-10-20', photo: '/thumbs/suncheon-bay.jpg', thumb: { ...G.korea, glyph: '🌾' } },
      { id: 'jeju-round', place: 'Jeju Round Island', region: 'Jeju-do', distanceKm: 225.7, elevationM: 1406, difficulty: 3, map: '/routes/jeju-round.svg', strava: 'https://www.strava.com/activities/10082940987', date: '2023-10-22', photo: '/thumbs/jeju-round.jpg', thumb: { ...G.korea, glyph: '🌊' } },
      { id: 'jeju-volcano', place: 'Jeju Volcano Loop', region: 'Jeju-do', distanceKm: 103.2, elevationM: 2027, difficulty: 4, map: '/routes/jeju-volcano.svg', strava: 'https://www.strava.com/activities/10076606492', date: '2023-10-21', photo: '/thumbs/jeju-volcano.jpg', thumb: { ...G.korea, glyph: '🌋' } },
      { id: 'jeju-western', place: 'Jeju Western Loop', region: 'Jeju-do', distanceKm: 113.6, elevationM: 1626, difficulty: 3, map: '/routes/jeju-western.svg', strava: 'https://www.strava.com/activities/14452327361', date: '2025-05-12', photo: '/thumbs/jeju-western.jpg', thumb: { ...G.korea, glyph: '🌅' } },
      { id: 'hwaaksan', place: 'Hwaaksan', region: 'Gangwon', distanceKm: 148, elevationM: 1391, difficulty: 3, map: '/routes/hwaaksan.svg', strava: 'https://www.strava.com/activities/10105679554', date: '2023-10-26', photo: '/thumbs/hwaaksan.jpg', thumb: { ...G.korea, glyph: '🌲' } },
      { id: 'that-busan-route', place: 'That Busan Route', region: 'Busan', distanceKm: 104, elevationM: 2546, difficulty: 5, map: '/routes/busan.svg', strava: 'https://www.strava.com/activities/14371983582', date: '2025-05-04', photo: '/thumbs/that-busan-route.jpg', thumb: { ...G.korea, glyph: '🌉' } },
      { id: 'dolsan', place: 'Dolsan Loop', region: 'Yeosu', distanceKm: 65.9, elevationM: 993, difficulty: 2, map: '/routes/dolsan.svg', strava: 'https://www.strava.com/activities/14411204307', date: '2025-05-08', photo: '/thumbs/dolsan.jpg', thumb: { ...G.korea, glyph: '⛵' } },
      { id: 'taebaeksan', place: 'Taebaeksan Route', region: 'Gangwon', distanceKm: 127.3, elevationM: 2508, difficulty: 5, map: '/routes/taebaeksan.svg', strava: 'https://www.strava.com/activities/14587561512', date: '2025-05-25', photo: '/thumbs/taebaeksan.jpg', thumb: { ...G.korea, glyph: '⛰️' } },
      { id: 'daegwallyeong', place: 'Daegwallyeong', region: 'Gangwon', distanceKm: 93.9, elevationM: 1528, difficulty: 3, map: '/routes/daegwallyeong.svg', strava: 'https://www.strava.com/activities/14606144690', date: '2025-05-27', photo: '/thumbs/daegwallyeong.jpg', thumb: { ...G.korea, glyph: '🌿' } },
    ],
  },
  {
    id: 'japan',
    name: 'Japan',
    flag: '🇯🇵',
    routes: [
      { id: 'shibu-touge', place: 'Shibu Tōge', region: 'Nagano', distanceKm: 87.2, elevationM: 2182, difficulty: 4, map: '/routes/shibu-touge.svg', strava: 'https://www.strava.com/activities/11435756906', date: '2024-05-18', photo: '/thumbs/shibu-touge.jpg', thumb: { ...G.japan, glyph: '⛰️' } },
      { id: 'haruna-akagi', place: 'Mt Haruna × Mt Akagi', region: 'Gunma', distanceKm: 128.4, elevationM: 2874, difficulty: 5, map: '/routes/haruna-akagi.svg', strava: 'https://www.strava.com/activities/11444592626', date: '2024-05-19', photo: '/thumbs/haruna-akagi.jpg', thumb: { ...G.japan, glyph: '🌋' } },
      { id: 'nikko-highland', place: 'Nikkō Highland', region: 'Tochigi', distanceKm: 77.1, elevationM: 2008, difficulty: 4, map: '/routes/nikko-highland.svg', strava: 'https://www.strava.com/activities/11460298411', date: '2024-05-21', photo: '/thumbs/nikko-highland.jpg', thumb: { ...G.japan, glyph: '⛩️' } },
      { id: 'utsukushigahara', place: 'Utsukushigahara × Kirigamine', region: 'Nagano', distanceKm: 96.2, elevationM: 2263, difficulty: 4, map: '/routes/utsukushigahara.svg', strava: 'https://www.strava.com/activities/11468885140', date: '2024-05-22', photo: '/thumbs/utsukushigahara.jpg', thumb: { ...G.japan, glyph: '🌾' } },
      { id: 'tsumago-juku', place: 'Tsumago-juku', region: 'Kiso Valley, Nagano', distanceKm: 22.7, elevationM: 606, difficulty: 1, map: '/routes/tsumago-juku.svg', strava: 'https://www.strava.com/activities/11476516041', date: '2024-05-23', photo: '/thumbs/tsumago-juku.jpg', thumb: { ...G.japan, glyph: '🏘️' } },
      { id: 'shirabiso-pass', place: 'Shirabiso Pass', region: 'Nagano', distanceKm: 87.4, elevationM: 1895, difficulty: 4, map: '/routes/shirabiso-pass.svg', strava: 'https://www.strava.com/activities/11483891629', date: '2024-05-24', photo: '/thumbs/shirabiso-pass.jpg', thumb: { ...G.japan, glyph: '🏔️' } },
      { id: 'yanagisawa-pass', place: 'Yanagisawa Pass', region: 'Yamanashi', distanceKm: 82.1, elevationM: 1568, difficulty: 3, map: '/routes/yanagisawa-pass.svg', strava: 'https://www.strava.com/activities/11490356261', date: '2024-05-25', photo: '/thumbs/yanagisawa-pass.jpg', thumb: { ...G.japan, glyph: '🗻' } },
      { id: 'ebino-plateau', place: 'Ebino Plateau', region: 'Kirishima', distanceKm: 78.3, elevationM: 1689, difficulty: 3, map: '/routes/ebino-plateau.svg', strava: 'https://www.strava.com/activities/14296994570', date: '2025-04-27', photo: '/thumbs/ebino-plateau.jpg', thumb: { ...G.japan, glyph: '♨️' } },
      { id: 'miyazaki-castle', place: 'Miyazaki Castle Loop', region: 'Miyazaki', distanceKm: 89, elevationM: 1628, difficulty: 3, map: '/routes/miyazaki-castle.svg', strava: 'https://www.strava.com/activities/14016329206', date: '2025-03-29', photo: '/thumbs/miyazaki-castle.jpg', thumb: { ...G.japan, glyph: '🏯' } },
      { id: 'ibusuki-skyline', place: 'Ibusuki Skyline', region: 'Kagoshima', distanceKm: 129.5, elevationM: 1810, difficulty: 4, map: '/routes/ibusuki-skyline.svg', strava: 'https://www.strava.com/activities/14025912543', date: '2025-03-30', photo: '/thumbs/ibusuki-skyline.jpg', thumb: { ...G.japan, glyph: '🌅' } },
      { id: 'sakurajima', place: 'Sakurajima Loop', region: 'Kagoshima', distanceKm: 39.9, elevationM: 504, difficulty: 1, map: '/routes/sakurajima-loop.svg', strava: 'https://www.strava.com/activities/14034856898', date: '2025-03-31', photo: '/thumbs/sakurajima.jpg', thumb: { ...G.japan, glyph: '🌋' } },
      { id: 'maruo-falls', place: 'Maruo Falls', region: 'Kirishima', distanceKm: 67.4, elevationM: 1328, difficulty: 3, map: '/routes/maruo-falls.svg', strava: 'https://www.strava.com/activities/14112225203', date: '2025-04-08', photo: '/thumbs/maruo-falls.jpg', thumb: { ...G.japan, glyph: '💧' } },
      { id: 'mt-aso', place: 'Mt Aso Loop', region: 'Kumamoto', distanceKm: 96.5, elevationM: 1782, difficulty: 3, map: '/routes/mt-aso-loop.svg', strava: 'https://www.strava.com/activities/14151735311', date: '2025-04-12', photo: '/thumbs/mt-aso.jpg', thumb: { ...G.japan, glyph: '🌋' } },
      { id: 'mt-unzen', place: 'Mt Unzen', region: 'Nagasaki', distanceKm: 54.8, elevationM: 1377, difficulty: 3, map: '/routes/mt-unzen.svg', strava: 'https://www.strava.com/activities/14161608687', date: '2025-04-13', photo: '/thumbs/mt-unzen.jpg', thumb: { ...G.japan, glyph: '♨️' } },
      { id: 'kusenbuyama-sefuri', place: 'Kusenbuyama × Mt Sefuri', region: 'Fukuoka / Saga', distanceKm: 78.3, elevationM: 2013, difficulty: 4, map: '/routes/kusenbuyama-sefuri.svg', strava: 'https://www.strava.com/activities/14209826948', date: '2025-04-18', photo: '/thumbs/kusenbuyama-sefuri.jpg', thumb: { ...G.japan, glyph: '🌲' } },
      { id: 'mt-wanitsuka', place: 'Mt Wanitsuka', region: 'Miyazaki', distanceKm: 124.3, elevationM: 1818, difficulty: 4, map: '/routes/mt-wanitsuka.svg', strava: 'https://www.strava.com/activities/14219032226', date: '2025-04-19', photo: '/thumbs/mt-wanitsuka.jpg', thumb: { ...G.japan, glyph: '⛰️' } },
    ],
  },
  {
    id: 'taiwan',
    name: 'Taiwan',
    flag: '🇹🇼',
    routes: [
      { id: 'wuling-west', place: 'Wuling from the West', region: 'Taichung', distanceKm: 106.1, elevationM: 2878, difficulty: 5, map: '/routes/wuling-west.svg', strava: 'https://www.strava.com/activities/8254219087', date: '2022-12-16', photo: '/thumbs/wuling-west.jpg', thumb: { ...G.taiwan, glyph: '⛰️' } },
      { id: 'yangmingshan', place: 'Yangmingshan Loop', region: 'Taipei', distanceKm: 71.1, elevationM: 1073, difficulty: 2, map: '/routes/yangmingshan.svg', strava: 'https://www.strava.com/activities/8265456508', date: '2022-12-19', photo: '/thumbs/yangmingshan.jpg', thumb: { ...G.taiwan, glyph: '♨️' } },
      { id: 'taiwan-kom', place: 'Taiwan KOM', region: 'Hualien', distanceKm: 82.2, elevationM: 3487, difficulty: 5, map: '/routes/taiwan-kom.svg', strava: 'https://www.strava.com/activities/8784051260', date: '2023-03-27', photo: '/thumbs/taiwan-kom.jpg', thumb: { ...G.taiwan, glyph: '🏔️' } },
      { id: 'taipei-northern', place: 'Taipei Northern Loop', region: 'Taipei', distanceKm: 148.1, elevationM: 2166, difficulty: 4, map: '/routes/taipei-northern.svg', strava: 'https://www.strava.com/activities/8768345655', date: '2023-03-24', photo: '/thumbs/taipei-northern.jpg', thumb: { ...G.taiwan, glyph: '🌃' } },
    ],
  },
  {
    id: 'australia',
    name: 'Australia',
    flag: '🇦🇺',
    routes: [
      { id: 'ku-ring-gai', place: 'Ku-ring-gai', region: 'Sydney, NSW', distanceKm: 95.7, elevationM: 1313, difficulty: 3, map: '/routes/ku-ring-gai.svg', strava: 'https://www.strava.com/activities/7963727145', date: '2022-10-15', photo: '/thumbs/ku-ring-gai.jpg', thumb: { ...G.australia, glyph: '🌳' } },
      { id: 'royal-np', place: 'Royal National Park', region: 'Sydney, NSW', distanceKm: 123.1, elevationM: 1446, difficulty: 3, map: '/routes/royal-np.svg', strava: 'https://www.strava.com/activities/7969344091', date: '2022-10-16', photo: '/thumbs/royal-np.jpg', thumb: { ...G.australia, glyph: '🏖️' } },
    ],
  },
  {
    id: 'hongkong',
    name: 'Hong Kong',
    flag: '🇭🇰',
    routes: [
      { id: 'tai-mo-shan', place: 'Tai Mo Shan', region: 'New Territories', distanceKm: 48.3, elevationM: 1226, difficulty: 2, map: '/routes/tai-mo-shan.svg', strava: 'https://www.strava.com/activities/12505353236', date: '2024-09-26', photo: '/thumbs/tai-mo-shan.jpg', thumb: { ...G.hongkong, glyph: '🌫️' }, blogPath: '/blog/tai-mo-shan/index.html', script: taiMoShan },
      { id: 'lantau-island', place: 'Lantau Island', region: 'Lantau', distanceKm: 44.2, elevationM: 1115, difficulty: 2, map: '/routes/lantau-island.svg', strava: 'https://www.strava.com/activities/12519843808', date: '2024-09-28', photo: '/thumbs/lantau-island.jpg', thumb: { ...G.hongkong, glyph: '⛰️' } },
    ],
  },
  // Not ridden yet — kept as empty shelves so the map of where Leonard's been is honest.
  { id: 'singapore', name: 'Singapore', flag: '🇸🇬', routes: [] },
  { id: 'malaysia', name: 'Malaysia', flag: '🇲🇾', routes: [] },
  { id: 'indonesia', name: 'Indonesia', flag: '🇮🇩', routes: [] },
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
export function routeScript(route: Route): ScriptLine[] {
  if (route.script?.length) return route.script.map((l) => (typeof l === 'string' ? { say: l } : l))
  const note = DIFFICULTY_NOTE[Math.min(route.difficulty, 5) - 1] ?? DIFFICULTY_NOTE[2]
  return [
    `Right then — ${route.place}. You’re gonna love this.`,
    `${route.distanceKm} km through ${route.region}, about ${route.elevationM} m of climbing.`,
    note,
    'Stick with me and just enjoy the ride.',
  ].map((say) => ({ say }))
}
