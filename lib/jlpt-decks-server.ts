import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { KINDS, LEVELS, type Card, type Kind, type Level } from './jlpt-decks'

type JlptData = {
  formLabels: Record<Kind, string[]>
  decks: Record<Level, Record<Kind, Card[]>>
}

let cached: JlptData | null = null

async function loadData(): Promise<JlptData> {
  if (cached) return cached
  const filePath = path.join(process.cwd(), 'data', 'generated', 'jlpt-decks.json')
  const raw = await readFile(filePath, 'utf8')
  cached = JSON.parse(raw)
  return cached!
}

export async function getFormLabels(kind: Kind): Promise<string[]> {
  const data = await loadData()
  return data.formLabels[kind]
}

export async function getCards(level: Level, kind: Kind): Promise<Card[]> {
  const data = await loadData()
  return data.decks[level]?.[kind] ?? []
}

export async function getCounts(): Promise<Record<Level, Record<Kind, number>>> {
  const data = await loadData()
  const counts = {} as Record<Level, Record<Kind, number>>
  for (const level of LEVELS) {
    counts[level] = {} as Record<Kind, number>
    for (const kind of KINDS) {
      counts[level][kind] = data.decks[level]?.[kind]?.length ?? 0
    }
  }
  return counts
}
