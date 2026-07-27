import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { TopoCycle } from './topo-cycle'

// Order matches the ride order given for the background cycle.
const MOUNTAIN_SLUGS = ['utsukushigahara', 'taebaeksan', 'aso', 'shibu-pass'] as const

async function loadMountains() {
  const dir = path.join(process.cwd(), 'public', 'topo')
  return Promise.all(
    MOUNTAIN_SLUGS.map(async (slug) => ({
      slug,
      svg: await readFile(path.join(dir, `${slug}.svg`), 'utf8'),
    })),
  )
}

export async function TopoBackground() {
  const mountains = await loadMountains()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 text-ink-300 opacity-50">
        <TopoCycle mountains={mountains} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(86% 70% at 50% 48%, transparent 0%, rgba(2,3,3,.42) 66%, rgba(2,3,3,.88) 100%)',
        }}
      />

      <div className="absolute left-5 top-5 h-4 w-4 border-t border-l border-white/40" />
      <div className="absolute right-5 top-5 h-4 w-4 border-t border-r border-white/40" />
      <div className="absolute bottom-5 left-5 h-4 w-4 border-b border-l border-white/40" />
      <div className="absolute right-5 bottom-5 h-4 w-4 border-b border-r border-white/40" />

      <div className="absolute top-[23%] left-[19%] h-[3px] w-[3px] bg-white/45" />
      <div className="absolute top-[34%] right-[22%] h-1 w-1 bg-hivis-400" />
      <div className="absolute bottom-[28%] left-[31%] h-[3px] w-[3px] bg-white/30" />
      <div className="absolute bottom-[35%] right-[15%] h-[3px] w-[3px] bg-white/40" />
    </div>
  )
}
