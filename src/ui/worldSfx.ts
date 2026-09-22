import openUrl from '../../assets/audio/open-menu.mp3'
import closeUrl from '../../assets/audio/close-menu.mp3'
import hoverUrl from '../../assets/audio/hover-world.mp3'
import selectUrl from '../../assets/audio/world-selected.mp3'

/** One-shot menu stings for the bike world selector. */
export type WorldSfxName = 'open' | 'close' | 'hover' | 'select'

const URLS: Record<WorldSfxName, string> = {
  open: openUrl,
  close: closeUrl,
  hover: hoverUrl,
  select: selectUrl,
}

const VOL: Record<WorldSfxName, number> = {
  open: 0.55,
  close: 0.5,
  hover: 0.38,
  select: 0.6,
}

const clips = {} as Record<WorldSfxName, HTMLAudioElement>
for (const name of Object.keys(URLS) as WorldSfxName[]) {
  const a = new Audio(URLS[name])
  a.preload = 'auto'
  a.volume = VOL[name]
  clips[name] = a
}

/** Retrigger from the start so a fast sweep across cards stays a tick, not a smear. */
export function playWorldSfx(name: WorldSfxName) {
  const a = clips[name]
  a.volume = VOL[name]
  a.currentTime = 0
  a.play().catch(() => {})
}
