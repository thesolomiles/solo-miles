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

/**
 * Point-and-go target (Dota-style click / tap to move). Written by
 * three/PointToMove on canvas pointer events, consumed by the player controller:
 * it walks straight at (x, z) and clears `active` on arrival. `held` = the finger
 * / mouse is still down, so the target tracks the pointer (drag-to-steer) and
 * isn't abandoned on arrival or when blocked. Any keyboard / stick input cancels it.
 * `seq` bumps on every fresh press so the marker can replay its pop-in.
 */
export const pointMove = { active: false, held: false, x: 0, z: 0, seq: 0 }

/** Drop any point-and-go target (keyboard took over, a dialogue opened, etc.). */
export function cancelPointMove() {
  pointMove.active = false
  pointMove.held = false
}
