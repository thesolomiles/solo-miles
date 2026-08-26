/**
 * Where the arcade camera should look — the maze player's world position, written
 * by the minigame each frame and read by OrthoRig.
 *
 * The town's Player owns `posRef`, but it's unmounted inside a minigame (the maze
 * runs its own tile-based controller), so this is that seam: plain mutable data,
 * like `touchMove`, so it can update 60×/s without re-rendering anything.
 */
export const arcadeFocus = { x: 0, z: 0 }
