import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev-only endpoint behind the collision editor's "Save" button. POST the boxes
 * to `/__save-colliders` and it does what you'd otherwise do by hand: rewrites
 * the `MANUAL_COLLIDERS` array in src/config/colliders.data.ts and git-commits
 * it. So `Save` = the old Copy JSON → paste → commit, in one click. Only mounted
 * on the dev server (the built app has no filesystem/git), so hitting Save on the
 * deployed site simply 404s and the button reports it.
 */
const DATA_FILE = 'src/config/colliders.data.ts'
const BLOCK_RE = /export const MANUAL_COLLIDERS: BoxCollider\[\] = \[[\s\S]*?\n\]/

interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const round = (n: number) => Math.round(n * 10) / 10

function renderBlock(boxes: Box[]): string {
  const lines = boxes
    .map(
      (b) =>
        `  { minX: ${round(b.minX)}, maxX: ${round(b.maxX)}, minZ: ${round(b.minZ)}, maxZ: ${round(b.maxZ)} },`,
    )
    .join('\n')
  return (
    'export const MANUAL_COLLIDERS: BoxCollider[] = [\n' +
    '  // Hand-drawn in ?edit (Leonard), saved straight from the browser editor.\n' +
    (lines ? lines + '\n' : '') +
    ']'
  )
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

// ---- Interaction zones ("door" boxes) — twin of the collider save above. ----
const ZONES_FILE = 'src/config/zones.data.ts'
const ZONES_BLOCK_RE = /export const INTERACT_ZONES: InteractZone\[\] = \[[\s\S]*?\n\]/

interface Zone extends Box {
  id: string
  verb?: string
}

function renderZonesBlock(zones: Zone[]): string {
  const lines = zones
    .map((z) => {
      const parts = [`id: ${JSON.stringify(z.id)}`]
      if (z.verb) parts.push(`verb: ${JSON.stringify(z.verb)}`)
      parts.push(
        `minX: ${round(z.minX)}`,
        `maxX: ${round(z.maxX)}`,
        `minZ: ${round(z.minZ)}`,
        `maxZ: ${round(z.maxZ)}`,
      )
      return `  { ${parts.join(', ')} },`
    })
    .join('\n')
  return (
    'export const INTERACT_ZONES: InteractZone[] = [\n' +
    '  // Hand-drawn in ?zones (Leonard), saved straight from the browser editor.\n' +
    (lines ? lines + '\n' : '') +
    ']'
  )
}

function saveZones(): Plugin {
  return {
    name: 'save-zones',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-zones', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void (async () => {
          try {
            const zones = JSON.parse(await readBody(req)) as Zone[]
            if (!Array.isArray(zones)) throw new Error('expected an array of zones')

            const path = resolve(server.config.root, ZONES_FILE)
            const src = readFileSync(path, 'utf8')
            if (!ZONES_BLOCK_RE.test(src))
              throw new Error(`INTERACT_ZONES block not found in ${ZONES_FILE}`)
            writeFileSync(path, src.replace(ZONES_BLOCK_RE, renderZonesBlock(zones)), 'utf8')

            let committed = true
            try {
              execFileSync('git', ['add', ZONES_FILE], { cwd: server.config.root })
              execFileSync(
                'git',
                ['commit', '-m', `Save interaction zones (${zones.length}) from ?zones`],
                { cwd: server.config.root },
              )
            } catch {
              committed = false
            }

            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, count: zones.length, committed }))
          } catch (err) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })()
      })
    },
  }
}

function saveColliders(): Plugin {
  return {
    name: 'save-colliders',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-colliders', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void (async () => {
          try {
            const boxes = JSON.parse(await readBody(req)) as Box[]
            if (!Array.isArray(boxes)) throw new Error('expected an array of boxes')

            const path = resolve(server.config.root, DATA_FILE)
            const src = readFileSync(path, 'utf8')
            if (!BLOCK_RE.test(src)) throw new Error(`MANUAL_COLLIDERS block not found in ${DATA_FILE}`)
            writeFileSync(path, src.replace(BLOCK_RE, renderBlock(boxes)), 'utf8')

            // Commit it — no-op-safe: if the write changed nothing, `git commit`
            // exits non-zero and we report committed:false rather than erroring.
            let committed = true
            try {
              execFileSync('git', ['add', DATA_FILE], { cwd: server.config.root })
              execFileSync(
                'git',
                ['commit', '-m', `Save collision layout (${boxes.length} boxes) from ?edit`],
                { cwd: server.config.root },
              )
            } catch {
              committed = false
            }

            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, count: boxes.length, committed }))
          } catch (err) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })()
      })
    },
  }
}

// ---- Café colliders — twin of the town collider save above, but the target is
// the CAFE.colliders array in src/config/cafe.ts (the café interior's obstacle
// boxes), driven by the café's ?edit editor. ----
const CAFE_FILE = 'src/config/cafe.ts'
const CAFE_BLOCK_RE = /  colliders: \[[\s\S]*?\n  \] as BoxCollider\[\],/
const CAFE_ZONES_BLOCK_RE = /  zones: \[[\s\S]*?\n  \] as InteractZone\[\],/

function renderCafeBlock(boxes: Box[]): string {
  const lines = boxes
    .map(
      (b) =>
        `    { minX: ${round(b.minX)}, maxX: ${round(b.maxX)}, minZ: ${round(b.minZ)}, maxZ: ${round(b.maxZ)} },`,
    )
    .join('\n')
  return (
    '  colliders: [\n' +
    '    // Hand-drawn in ?edit inside the café (Leonard), saved from the editor.\n' +
    (lines ? lines + '\n' : '') +
    '  ] as BoxCollider[],'
  )
}

function saveCafeColliders(): Plugin {
  return {
    name: 'save-cafe-colliders',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-cafe-colliders', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void (async () => {
          try {
            const boxes = JSON.parse(await readBody(req)) as Box[]
            if (!Array.isArray(boxes)) throw new Error('expected an array of boxes')

            const path = resolve(server.config.root, CAFE_FILE)
            const src = readFileSync(path, 'utf8')
            if (!CAFE_BLOCK_RE.test(src))
              throw new Error(`CAFE.colliders block not found in ${CAFE_FILE}`)
            writeFileSync(path, src.replace(CAFE_BLOCK_RE, renderCafeBlock(boxes)), 'utf8')

            let committed = true
            try {
              execFileSync('git', ['add', CAFE_FILE], { cwd: server.config.root })
              execFileSync(
                'git',
                ['commit', '-m', `Save café collision (${boxes.length} boxes) from ?edit`],
                { cwd: server.config.root },
              )
            } catch {
              committed = false
            }

            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, count: boxes.length, committed }))
          } catch (err) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })()
      })
    },
  }
}

function renderCafeZonesBlock(zones: Zone[]): string {
  const lines = zones
    .map((z) => {
      const parts = [`id: ${JSON.stringify(z.id)}`]
      if (z.verb) parts.push(`verb: ${JSON.stringify(z.verb)}`)
      parts.push(
        `minX: ${round(z.minX)}`,
        `maxX: ${round(z.maxX)}`,
        `minZ: ${round(z.minZ)}`,
        `maxZ: ${round(z.maxZ)}`,
      )
      return `    { ${parts.join(', ')} },`
    })
    .join('\n')
  return (
    '  zones: [\n' +
    '    // Hand-drawn in ?zones inside the café (Leonard), saved from the editor.\n' +
    (lines ? lines + '\n' : '') +
    '  ] as InteractZone[],'
  )
}

function saveCafeZones(): Plugin {
  return {
    name: 'save-cafe-zones',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-cafe-zones', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void (async () => {
          try {
            const zones = JSON.parse(await readBody(req)) as Zone[]
            if (!Array.isArray(zones)) throw new Error('expected an array of zones')

            const path = resolve(server.config.root, CAFE_FILE)
            const src = readFileSync(path, 'utf8')
            if (!CAFE_ZONES_BLOCK_RE.test(src))
              throw new Error(`CAFE.zones block not found in ${CAFE_FILE}`)
            writeFileSync(path, src.replace(CAFE_ZONES_BLOCK_RE, renderCafeZonesBlock(zones)), 'utf8')

            let committed = true
            try {
              execFileSync('git', ['add', CAFE_FILE], { cwd: server.config.root })
              execFileSync(
                'git',
                ['commit', '-m', `Save café interaction zones (${zones.length}) from ?zones`],
                { cwd: server.config.root },
              )
            } catch {
              committed = false
            }

            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, count: zones.length, committed }))
          } catch (err) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })()
      })
    },
  }
}

// ---- Journal screenshots: save a browser canvas capture straight to disk. ----
// POST { name, dataUrl } to /__save-shot and it decodes the base64 image and
// writes it to journal-assets/<name> — a milestone screenshot to embed in
// journal.html. Keeps the image bytes off any other path (they go straight
// browser → dev server → file). Dev-only like the editors above; the deployed
// site has no endpoint. Does NOT commit — the shot lands with its journal entry.
function saveShot(): Plugin {
  return {
    name: 'save-shot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-shot', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void (async () => {
          try {
            const { name, dataUrl } = JSON.parse(await readBody(req)) as {
              name: string
              dataUrl: string
            }
            if (!name || !/^[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(name))
              throw new Error('bad or missing image name')
            const m = /^data:image\/\w+;base64,(.+)$/.exec(dataUrl || '')
            if (!m) throw new Error('expected a base64 image data URL')
            const buf = Buffer.from(m[1], 'base64')
            writeFileSync(resolve(server.config.root, 'journal-assets', name), buf)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: `journal-assets/${name}`, bytes: buf.length }))
          } catch (err) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveColliders(), saveCafeColliders(), saveZones(), saveCafeZones(), saveShot()],
})
