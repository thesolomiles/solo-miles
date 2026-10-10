# Forest opening prototype

The trail begins with three single-jump obstacles. Climbing stays disabled.
The wisp quietly watches from the background until the player lands in the
wide gap's lower hollow. It approaches, demonstrates two rises and introduces
another jump while airborne. After escaping, the player can follow it to the
existing ancient remains encounter.

After the fall, the player has eight seconds to try alone. The wisp then takes
nine seconds to approach through the tree layers, pausing twice, and watches
nearby for three seconds before its unchanged four-second double-rise gesture.
The second jump is available as the gesture begins, so discovery can happen
without text. The keycap tip appears only after another eight seconds of
practice if the player is still stuck. An escape during the gesture or practice
goes straight to guiding and keeps the tip hidden. These timers pause with
dialogue, transitions, the remains reveal and a hidden tab.

The hollow now has an authored terrain pass: eroded earth banks, mossy turf
lips, exposed roots, stones and a dry lower bed. The story lesson remains a
prototype for pacing and interaction review. Progress resets on each forest visit. Double jump follows the existing physics: press again near the
first jump's apex, rather than holding Space or immediately double-tapping.

Local previews (development only):
- `http://localhost:5173/?forest` — the full opening.
- `http://localhost:5173/?forest&opening` — approach to the gap.
- `http://localhost:5173/?forest&hollow` — start in the hollow for the lesson.
- Existing `&viewpoint` and `&stones` previews bypass the opening lesson.

Run `node output/forest-opening/check-opening.cjs` from the repository root.
The checks transpile and exercise the actual Walker callback, wisp motion,
lesson store and touch event handlers. They cover 20/30/60/120 Hz movement,
locked and taught escapes in both directions, authored obstacles, climbing,
input edges, pause/reset behaviour and quiet background watching. Camera checks
also keep the hollow's framing fixed while the player jumps inside it.
Foreground checks verify foliage scrolls consistently beside the banks while
the opening remains fixed, with matching colour and depth-mask cuts. The
authored terrain supplies the stationary rim without freezing nearby bushes.

Browser checks covered the full trail, double-jump escape, guiding to the
remains reveal, and portrait framing. Screenshots are saved alongside this
file. Physical phone touch/GPU behaviour still needs an on-device check.
