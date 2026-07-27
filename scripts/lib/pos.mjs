// Classifies a JMdict entry (by its part-of-speech tags, collected across
// all its senses) into one of our three flashcard "kinds", and — for verbs —
// which conjugation class kamiya-codec needs (godan vs ichidan) plus whether
// it's する/来る or a noun+する compound.

const GODAN_TAGS = new Set(['v5k', 'v5g', 'v5s', 'v5t', 'v5n', 'v5b', 'v5m', 'v5r', 'v5u', 'v5k-s', 'v5u-s', 'v5aru', 'v5r-i', 'v5uru'])
const ICHIDAN_TAGS = new Set(['v1', 'v1-s'])
const SURU_TAGS = new Set(['vs-i', 'vs-s'])
const KURU_TAGS = new Set(['vk'])
const I_ADJ_TAGS = new Set(['adj-i', 'adj-ix'])
const NA_ADJ_TAGS = new Set(['adj-na'])
const NOUN_TAGS = new Set(['n', 'n-t', 'n-adv', 'n-pref', 'n-suf'])

export function allPosTags(entry) {
  const tags = new Set()
  for (const sense of entry.sense) {
    for (const p of sense.partOfSpeech) tags.add(p)
  }
  return tags
}

/**
 * @returns one of:
 *   { kind: 'verb', typeII: boolean, isSuruLike: boolean }
 *   { kind: 'adjective', isIAdjective: boolean }
 *   { kind: 'noun' }
 *   null (not something we can build a card for)
 */
export function classify(entry, expression) {
  const tags = allPosTags(entry)

  if (tags.has('v1') || tags.has('v1-s')) return { kind: 'verb', typeII: true, isSuruLike: false }
  for (const t of GODAN_TAGS) if (tags.has(t)) return { kind: 'verb', typeII: false, isSuruLike: false }
  if ([...KURU_TAGS].some((t) => tags.has(t)) || expression === '来る' || expression === 'くる') {
    return { kind: 'verb', typeII: false, isSuruLike: false }
  }
  if ([...SURU_TAGS].some((t) => tags.has(t)) || expression === 'する') {
    return { kind: 'verb', typeII: false, isSuruLike: true }
  }

  if (I_ADJ_TAGS.has('adj-i') && tags.has('adj-i')) return { kind: 'adjective', isIAdjective: true }
  if (tags.has('adj-ix')) return { kind: 'adjective', isIAdjective: true }
  if (tags.has('adj-na')) return { kind: 'adjective', isIAdjective: false }

  for (const t of NOUN_TAGS) if (tags.has(t)) return { kind: 'noun' }

  return null
}
