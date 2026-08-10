/**
 * Hot analog movement vector, written by the on-screen touch stick and read by
 * the player controller every frame. Kept out of React (like `posRef`) so the
 * joystick can update it 60×/s without re-rendering anything.
 *
 * Screen-relative, matching the keyboard mapping: x = right(+)/left(−),
 * z = down(+)/up(−) — so "up-screen" is −z, i.e. forward. Magnitude 0…1.
 */
export const touchMove = { x: 0, z: 0 }
