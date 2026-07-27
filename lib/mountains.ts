import mountainsData from '@/data/mountains.json'

export type Mountain = {
  slug: string
  name: string
  place: string
  lat: number
  lon: number
}

export const MOUNTAINS: Mountain[] = mountainsData

export function formatCoords({ lat, lon }: Pick<Mountain, 'lat' | 'lon'>) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`
}
