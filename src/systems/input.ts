/**
 * Hot analog movement vector, written by the on-screen touch stick and read by
 * the player controller every frame. Kept out of React (like `posRef`) so the
 * joystick can update it 60×/s without re-rendering anything.
 *
 * Screen-relative, matching the keyboard mapping: x = right(+)/left(−),
 * z = down(+)/up(−) — so "up-screen" is −z, i.e. forward. Magnitude 0…1.
 */
export const touchMove = { x: 0, z: 0 }

/**
 * 4-way arcade intent (Pac-Man D-pad / swipe). Same screen axes as `touchMove`:
 * x right+, z down+. Magnitude is 0 or 1 — the maze ignores analog.
 */
export const arcadeMove = { x: 0, z: 0 }

/**
 * True when the focus is in a text field (the dev editor panels' name/verb
 * inputs, etc.). Movement/interact keys must yield to it — otherwise the HUD's
 * global keydown listener preventDefault()s "E"/Space/Enter (so you can't type
 * them) and WASD drives the player while you're typing.
 */
export function isTypingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null
  if (!n) return false
  const tag = n.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable
}
