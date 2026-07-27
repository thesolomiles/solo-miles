// Types and pure constants only — safe to import from client components.
// The actual data loading (reads data/generated/jlpt-decks.json off disk)
// lives in lib/jlpt-decks-server.ts, since Node's fs can't be bundled for
// the browser.

export type Card = {
  en: string
  kanji: string
  kana: string
  romaji: string
  group: string
  forms: [string, string][]
}

export type Kind = 'verbs' | 'adjectives' | 'nouns'
export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']
export const KINDS: Kind[] = ['verbs', 'adjectives', 'nouns']

export const KIND_META: Record<Kind, { name: string; glyph: string; singular: string }> = {
  verbs: { name: 'Verbs', glyph: '動', singular: 'Verb' },
  adjectives: { name: 'Adjectives', glyph: '形', singular: 'Adjective' },
  nouns: { name: 'Nouns', glyph: '名', singular: 'Noun' },
}

export function isLevel(value: string): value is Level {
  return (LEVELS as string[]).includes(value)
}

export function isKind(value: string): value is Kind {
  return (KINDS as string[]).includes(value)
}
