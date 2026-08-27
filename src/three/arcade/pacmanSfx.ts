import eatUrl from '../../../assets/Game sound/pacman/eat.mp3'
import loseUrl from '../../../assets/Game sound/pacman/lose.mp3'
import specialUrl from '../../../assets/Game sound/pacman/special.mp3'
import winUrl from '../../../assets/Game sound/pacman/win.mp3'
import type { PacmanSfx } from '../../arcade/pacman'

/**
 * One-shot arcade SFX for Pac-Man. Same HTMLAudio pattern as the café/town
 * loops, but these retrigger from the start (pellets fire faster than the eat
 * clip, so a single voice that rewinds is the waka — stacking clones would
 * smear). Win/lose cut the munching so the sting sits on top.
 */
const VOL: Record<PacmanSfx, number> = {
  eat: 0.48,
  special: 0.55,
  lose: 0.62,
  win: 0.62,
}

const URLS: Record<PacmanSfx, string> = {
  eat: eatUrl,
  special: specialUrl,
  lose: loseUrl,
  win: winUrl,
}

export function createPacmanSfx() {
  const clips = {} as Record<PacmanSfx, HTMLAudioElement>
  for (const name of Object.keys(URLS) as PacmanSfx[]) {
    const a = new Audio(URLS[name])
    a.preload = 'auto'
    a.volume = VOL[name]
    clips[name] = a
  }
  if (import.meta.env?.DEV) (window as unknown as { __pacmanSfx?: typeof clips }).__pacmanSfx = clips

  // PacmanWorld mounts after the SELECT fade, so the click's user-activation
  // may already have expired (Safari). Prime the elements muted; if that's
  // blocked, the next tap unlocks them — same fallback as Café BGM.
  let priming = true
  const unlock = () => {
    for (const a of Object.values(clips)) {
      const vol = a.volume
      a.volume = 0
      a.play()
        .then(() => {
          if (!priming) return
          a.pause()
          a.currentTime = 0
          a.volume = vol
        })
        .catch(() => {
          if (priming) a.volume = vol
        })
    }
  }
  unlock()
  window.addEventListener('pointerdown', unlock, { once: true })

  let resume: PacmanSfx[] = []

  const play = (name: PacmanSfx) => {
    priming = false
    if (name === 'win' || name === 'lose') {
      clips.eat.pause()
      clips.special.pause()
    }
    const a = clips[name]
    a.volume = VOL[name]
    a.currentTime = 0
    a.play().catch(() => {})
  }

  return {
    play(events: PacmanSfx[]) {
      for (const e of events) play(e)
    },
    setPaused(paused: boolean) {
      if (paused) {
        resume = []
        for (const name of Object.keys(clips) as PacmanSfx[]) {
          const a = clips[name]
          if (!a.paused) {
            a.pause()
            resume.push(name)
          }
        }
      } else {
        for (const name of resume) clips[name].play().catch(() => {})
        resume = []
      }
    },
    dispose() {
      window.removeEventListener('pointerdown', unlock)
      resume = []
      if (import.meta.env?.DEV) {
        const w = window as unknown as { __pacmanSfx?: typeof clips }
        if (w.__pacmanSfx === clips) w.__pacmanSfx = undefined
      }
      for (const a of Object.values(clips)) {
        a.pause()
        a.src = ''
      }
    },
  }
}
