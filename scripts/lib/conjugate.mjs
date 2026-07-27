// Wraps kamiya-codec (rule-based conjugator, github.com/fasiha/kamiya-codec,
// based on Taeko Kamiya's "Handbook of Japanese Verbs/Adjectives") with the
// specific index-selection rules verified empirically against known-correct
// forms (see scripts/lib/conjugate.test.mjs) — the library returns multiple
// candidates for several conjugations (an intermediate stem alongside the
// complete word, or a formal/colloquial pair), and one real bug, so a naive
// "always take result[0]" or "always take the last result" does not hold
// uniformly across verb classes.
import * as codec from 'kamiya-codec'

export const VERB_FORM_LABELS = [
  'Polite',
  'Polite past',
  'Polite neg.',
  'Plain neg.',
  'Plain past',
  'Te-form',
  'Potential',
  'Volitional',
  'Progressive',
]

export const ADJECTIVE_FORM_LABELS = [
  'Polite',
  'Polite past',
  'Polite neg.',
  'Plain neg.',
  'Plain past',
  'Plain past neg.',
  'Te-form',
  'Adverbial',
]

export const NOUN_FORM_LABELS = [
  'Plain',
  'Polite',
  'Polite past',
  'Polite neg.',
  'Plain neg.',
  'Plain past',
  'Plain past neg.',
  'Te-form',
]

/**
 * @param {string} word dictionary form, kanji or kana
 * @param {boolean} typeII true = ichidan (一段), false = godan (五段)
 * @param {boolean} isSuruLike true for する itself or any noun+する compound
 *   (kamiya-codec only recognizes the bare string "する"/"来る", not
 *   suffixed compounds like 勉強する, so those are conjugated by splitting
 *   off the noun prefix, conjugating "する" alone, and re-attaching it)
 * @returns {[string, string][]} one [word, romaji-placeholder] pair per
 *   VERB_FORM_LABELS — romaji is filled in by the caller (kamiya-codec only
 *   produces kanji/kana), left as '' here.
 */
export function conjugateVerb(word, typeII, isSuruLike) {
  const prefix = isSuruLike ? word.slice(0, word.length - 2) : ''
  const base = isSuruLike ? 'する' : word

  const masuDict = codec.conjugateAuxiliaries(base, ['Masu'], 'Dictionary', typeII)[0]
  const masuTa = codec.conjugateAuxiliaries(base, ['Masu'], 'Ta', typeII)[0]
  // Masu+Negative returns [present-negative, past-negative] — take the present.
  const masuNeg = codec.conjugateAuxiliaries(base, ['Masu'], 'Negative', typeII)[0]
  // Negative alone returns [incomplete stem, complete word] — take the last.
  const plainNegResults = codec.conjugate(base, 'Negative', typeII)
  const plainNeg = plainNegResults[plainNegResults.length - 1]
  const plainPast = codec.conjugate(base, 'Ta', typeII)[0]
  const te = codec.conjugate(base, 'Te', typeII)[0]

  let potential
  if (isSuruLike) {
    // する's potential is the suppletive できる, which kamiya-codec doesn't
    // know about (it would otherwise produce the non-word "すれる").
    potential = 'できる'
  } else if (word === '来る' || word === 'くる') {
    potential = codec.conjugateAuxiliaries(base, ['ReruRareru'], 'Dictionary', typeII)[0]
  } else if (typeII) {
    // Ichidan "Potential" aux gives the colloquial ra-nuki form (食べれる);
    // ReruRareru gives the traditional textbook form (食べられる).
    potential = codec.conjugateAuxiliaries(base, ['ReruRareru'], 'Dictionary', typeII)[0]
  } else {
    potential = codec.conjugateAuxiliaries(base, ['Potential'], 'Dictionary', typeII)[0]
  }

  // Volitional: godan returns [incomplete stem, complete word] (take last);
  // ichidan/irregular has a bug appending a spurious extra う to the SECOND
  // candidate (食べよう, 食べようう) — take the first there instead.
  const volResults = codec.conjugate(base, 'Volitional', typeII)
  const volitional = typeII || isSuruLike || word === '来る' || word === 'くる' ? volResults[0] : volResults[volResults.length - 1]

  // TeIru returns [full "-te iru", contracted "-teru"] — take the full form.
  const progressive = codec.conjugateAuxiliaries(base, ['TeIru'], 'Dictionary', typeII)[0]

  const attach = (s) => prefix + s

  return [
    attach(masuDict),
    attach(masuTa),
    attach(masuNeg),
    attach(plainNeg),
    attach(plainPast),
    attach(te),
    attach(potential),
    attach(volitional),
    attach(progressive),
  ]
}

/**
 * @param {string} word dictionary form, without な for na-adjectives
 * @param {boolean} isIAdjective
 * @returns {string[]} one entry per ADJECTIVE_FORM_LABELS
 */
export function conjugateAdjective(word, isIAdjective) {
  if (isIAdjective) {
    const present = codec.adjConjugate(word, 'Present', true)[0]
    const past = codec.adjConjugate(word, 'Past', true)[0]
    const neg = codec.adjConjugate(word, 'Negative', true)[0]
    const negPast = codec.adjConjugate(word, 'NegativePast', true)[0]
    // ConjunctiveTe returns [incomplete stem, complete "-kute"] — take the last.
    const teResults = codec.adjConjugate(word, 'ConjunctiveTe', true)
    const te = teResults[teResults.length - 1]
    const adverbial = codec.adjConjugate(word, 'Adverbial', true)[0]
    return [
      present + 'です',
      past + 'です',
      neg + 'です',
      neg,
      past,
      negPast,
      te,
      adverbial,
    ]
  }

  // na-adjective: 'Present'/'Past' etc. already return multiple registers
  // directly (だ/です/でございます, etc.) — index into those instead of
  // concatenating です ourselves.
  const present = codec.adjConjugate(word, 'Present', false) // [da, desu, gozaimasu]
  const past = codec.adjConjugate(word, 'Past', false) // [datta, deshita]
  const neg = codec.adjConjugate(word, 'Negative', false) // [dewanai, denai, janai, dewaarimasen]
  const negPast = codec.adjConjugate(word, 'NegativePast', false) // [dewanakatta, denakatta, janakatta, dewaarimasendeshita]
  const te = codec.adjConjugate(word, 'ConjunctiveTe', false)[0]
  const adverbial = codec.adjConjugate(word, 'Adverbial', false)[0]

  return [
    present[1], // です
    past[1], // でした
    neg[3], // ではありません
    neg[2], // じゃない
    past[0], // だった
    negPast[2], // じゃなかった
    te, // で
    adverbial, // に
  ]
}

/** Nouns don't conjugate; only the だ/です copula attached to them does, via
 * a fixed set of suffixes with no exceptions — no external conjugator
 * needed. */
export function conjugateNoun(word) {
  return [
    word + 'だ',
    word + 'です',
    word + 'でした',
    word + 'ではありません',
    word + 'じゃない',
    word + 'だった',
    word + 'じゃなかった',
    word + 'で',
  ]
}
