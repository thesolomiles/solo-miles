export type Ride = {
  slug: string
  title: string
  place: string
  country: string
  lat: number
  lon: number
  distanceKm: number
  elevationM: number
}

// Placeholder ride data — swap in real ride stats as they're logged. Each
// entry just needs a unique slug (used for /cycling/[slug]) and a lat/lon
// so it can be plotted on the map.
export const RIDES: Ride[] = [
  {
    slug: 'utsukushigahara',
    title: 'Utsukushigahara Highland Loop',
    place: 'Utsukushigahara, Nagano',
    country: 'Japan',
    lat: 36.15,
    lon: 138.18,
    distanceKm: 62,
    elevationM: 1450,
  },
  {
    slug: 'taebaeksan',
    title: 'Taebaeksan Summit Climb',
    place: 'Taebaeksan, South Korea',
    country: 'South Korea',
    lat: 37.1,
    lon: 128.92,
    distanceKm: 45,
    elevationM: 980,
  },
  {
    slug: 'aso',
    title: 'Aso Caldera Circuit',
    place: 'Mount Aso, Kumamoto',
    country: 'Japan',
    lat: 32.88,
    lon: 131.1,
    distanceKm: 78,
    elevationM: 1200,
  },
  {
    slug: 'shibu-pass',
    title: 'Shibu Pass Ascent',
    place: 'Shibu Tōge, Nagano',
    country: 'Japan',
    lat: 36.72,
    lon: 138.52,
    distanceKm: 54,
    elevationM: 1550,
  },
]
