import { create } from 'zustand'

/**
 * Live ride telemetry for the game-style HUD (speed / distance / elevation /
 * time / gradient). Written from a useFrame in the ride scene (throttled ~10Hz,
 * not per-frame) and read by ui/RideHud.tsx. Decorative — the numbers are
 * synthesised from the ride's constant scroll + a rolling gradient profile, not
 * from real physics.
 */
export interface RideHudState {
  speed: number // km/h
  distanceKm: number
  elevationM: number // metres climbed
  timeS: number // seconds elapsed
  grade: number // current gradient, %
}

export const useRideHud = create<RideHudState>(() => ({
  speed: 0,
  distanceKm: 0,
  elevationM: 0,
  timeS: 0,
  grade: 0,
}))
