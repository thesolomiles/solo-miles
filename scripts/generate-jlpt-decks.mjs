#!/usr/bin/env node
// Build-time pipeline: real JLPT level tagging + real dictionary data + a
// real rule-based conjugator, never hand-typed or LLM-generated vocabulary
// or conjugations.
//
// 1. Tanos-style JLPT word lists (github.com/elzup/jlpt-word-list, MIT,
//    itself digitized from tanos.co.uk's community-standard JLPT lists) —
//    solves level (N5..N1) assignment, since JMdict carries no JLPT tags.
// 2. JMdict-simplified (github.com/scriptin/jmdict-simplified, EDRDG
//    licence) — cross-referenced by kanji+reading to pull the verified
//    kanji, reading, English gloss, and part-of-speech tags (which encode
//    conjugation class: v1/v1-s ichidan, v5* godan, vs-i/vk suru/kuru,
//    adj-i/adj-ix i-adjective, adj-na na-adjective).
// 3. kamiya-codec (github.com/fasiha/kamiya-codec, Unlicense) — rule-based
//    conjugator, generates every inflected form live from the dictionary
//    form + verb/adjective class. See scripts/lib/conjugate.mjs for the
//    empirically-verified rules for picking the right candidate out of the
//    library's output (it sometimes returns an intermediate stem alongside
//    the complete word, or a formal/colloquial pair).
// 4. wanakana (MIT) — mechanical kana->romaji transliteration (not a
//    grammar step, just a fixed lookup table) for both the headword and
//    every generated form.
//
// Output is cached to data/generated/jlpt-decks.json and committed — the
// app reads that file, it does not hit any of these sources at request time.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import AdmZip from 'adm-zip'
import { toRomaji } from 'wanakana'
import { classify } from './lib/pos.mjs'
import { conjugateVerb, conjugateAdjective, conjugateNoun, VERB_FORM_LABELS, ADJECTIVE_FORM_LABELS, NOUN_FORM_LABELS } from './lib/conjugate.mjs'

const ROOT = process.cwd()
const CACHE_DIR = path.join(ROOT, 'data', 'generated', '.cache')
const OUT_PATH = path.join(ROOT, 'data', 'generated', 'jlpt-decks.json')

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const TANOS_BASE = 'https://raw.githubusercontent.com/elzup/jlpt-word-list/master/src'
const JMDICT_RELEASE_API = 'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest'

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true })
}

async function fetchCached(url, cacheName, { binary = false } = {}) {
  const cachePath = path.join(CACHE_DIR, cacheName)
  if (existsSync(cachePath)) {
    return binary ? readFile(cachePath) : readFile(cachePath, 'utf8')
  }
  console.log(`  fetching ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(cachePath, buf)
  return binary ? buf : buf.toString('utf8')
}

async function loadTanosLevel(level) {
  const csvText = await fetchCached(`${TANOS_BASE}/${level.toLowerCase()}.csv`, `tanos-${level.toLowerCase()}.csv`)
  return parse(csvText, { columns: true, skip_empty_lines: true })
}

async function loadJmdict() {
  const jsonCachePath = path.join(CACHE_DIR, 'jmdict-eng-common.json')
  if (existsSync(jsonCachePath)) {
    console.log('  using cached jmdict-eng-common.json')
    return JSON.parse(await readFile(jsonCachePath, 'utf8'))
  }

  console.log('  looking up latest jmdict-simplified release...')
  const releaseRes = await fetch(JMDICT_RELEASE_API)
  if (!releaseRes.ok) throw new Error(`Failed to look up jmdict-simplified release: ${releaseRes.status}`)
  const release = await releaseRes.json()
  const asset = release.assets.find((a) => /^jmdict-eng-common-.*\.json\.zip$/.test(a.name))
  if (!asset) throw new Error('Could not find jmdict-eng-common .json.zip asset in latest release')

  const zipBuf = await fetchCached(asset.browser_download_url, 'jmdict-eng-common.json.zip', { binary: true })
  const zip = new AdmZip(zipBuf)
  const entry = zip.getEntries().find((e) => e.entryName.endsWith('.json'))
  const json = JSON.parse(entry.getData().toString('utf8'))
  await writeFile(jsonCachePath, JSON.stringify(json))
  return json
}

function buildJmdictIndex(jmdict) {
  const byKanjiKana = new Map()
  const byKanaOnly = new Map()

  for (const entry of jmdict.words) {
    const kanjiList = entry.kanji.length ? entry.kanji : []
    const kanaList = entry.kana

    for (const kana of kanaList) {
      if (!byKanaOnly.has(kana.text)) byKanaOnly.set(kana.text, [])
      byKanaOnly.get(kana.text).push(entry)

      for (const kanji of kanjiList) {
        const key = `${kanji.text}|${kana.text}`
        if (!byKanjiKana.has(key)) byKanjiKana.set(key, entry)
      }
    }
  }

  return { byKanjiKana, byKanaOnly }
}

function lookupEntry(index, expression, reading) {
  const direct = index.byKanjiKana.get(`${expression}|${reading}`)
  if (direct) return direct
  const kanaMatches = index.byKanaOnly.get(reading)
  if (kanaMatches && kanaMatches.length) return kanaMatches[0]
  return null
}

function firstGloss(entry) {
  for (const sense of entry.sense) {
    for (const gloss of sense.gloss) {
      if (gloss.lang === 'eng' && gloss.text) return gloss.text
    }
  }
  return null
}

function pickKanjiForm(entry, fallback) {
  if (!entry.kanji.length) return fallback
  const common = entry.kanji.find((k) => k.common)
  return (common || entry.kanji[0]).text
}

function pickKanaForm(entry, fallback) {
  if (!entry.kana.length) return fallback
  const common = entry.kana.find((k) => k.common)
  return (common || entry.kana[0]).text
}

// Note: these check the KANA reading's ending, not the kanji form's — a
// kanji root doesn't spell out its own reading (e.g. 帰る is just "帰" + "る"
// with no literal え), so "does this look like an ichidan verb" can only be
// answered from the pronunciation.
function verbGroupLabel(typeII, isSuruLike, kanjiWord, kanaWord) {
  if (isSuruLike) return kanjiWord === 'する' ? 'Irregular' : 'Irregular · suru-verb'
  if (kanjiWord === '来る' || kanjiWord === 'くる') return 'Irregular'
  if (typeII) return 'Ichidan'
  if (kanjiWord === '行く') return 'Godan · irregular te/past'
  if (/[えい]る$/.test(kanaWord)) return 'Godan · looks ichidan'
  return 'Godan'
}

function adjGroupLabel(isIAdjective, kanjiWord, kanaWord) {
  if (isIAdjective) {
    if (kanjiWord === '良い' || kanjiWord === 'いい') return 'I-adjective · irregular stem'
    return 'I-adjective'
  }
  if (/い$/.test(kanaWord)) return 'Na-adjective · looks i-adjective'
  return 'Na-adjective'
}

function buildCard({ kind, typeII, isSuruLike, isIAdjective, kanjiWord, kanaWord, en }) {
  let forms
  let group
  if (kind === 'verb') {
    const kanjiForms = conjugateVerb(kanjiWord, typeII, isSuruLike)
    const kanaForms = conjugateVerb(kanaWord, typeII, isSuruLike)
    forms = kanjiForms.map((jp, i) => [jp, toRomaji(kanaForms[i])])
    group = verbGroupLabel(typeII, isSuruLike, kanjiWord, kanaWord)
  } else if (kind === 'adjective') {
    const kanjiForms = conjugateAdjective(kanjiWord, isIAdjective)
    const kanaForms = conjugateAdjective(kanaWord, isIAdjective)
    forms = kanjiForms.map((jp, i) => [jp, toRomaji(kanaForms[i])])
    group = adjGroupLabel(isIAdjective, kanjiWord, kanaWord)
  } else {
    const kanjiForms = conjugateNoun(kanjiWord)
    const kanaForms = conjugateNoun(kanaWord)
    forms = kanjiForms.map((jp, i) => [jp, toRomaji(kanaForms[i])])
    group = ''
  }

  return {
    en,
    kanji: kanjiWord,
    kana: kanaWord,
    romaji: toRomaji(kanaWord),
    group,
    forms,
  }
}

async function main() {
  await ensureCacheDir()

  console.log('Loading JMdict (eng, common-only)...')
  const jmdict = await loadJmdict()
  console.log(`  ${jmdict.words.length} entries`)
  const index = buildJmdictIndex(jmdict)

  const output = {}
  const seenPerLevelKind = {}

  for (const level of LEVELS) {
    console.log(`\n${level}`)
    const rows = await loadTanosLevel(level)
    // The pre-2010 JLPT had 4 levels (4=easiest..1=hardest); the current
    // 5-level system introduced N3 as a new tier with no old equivalent.
    // This dataset carries "JLPT_N5"/"JLPT_N4" tags for the two levels
    // where old and new numbering overlap, but only the OLD numbering
    // (JLPT_3/JLPT_2/JLPT_1) for N3/N2/N1 — so those three fall back to it.
    const tag = { N5: 'JLPT_N5', N4: 'JLPT_N4', N3: 'JLPT_3', N2: 'JLPT_2', N1: 'JLPT_1' }[level]
    const levelRows = rows.filter((r) => r.tags && r.tags.split(' ').includes(tag))
    console.log(`  ${levelRows.length} Tanos entries tagged ${tag}`)

    const pools = { verbs: [], adjectives: [], nouns: [] }
    const seenWords = { verbs: new Set(), adjectives: new Set(), nouns: new Set() }
    let unmatched = 0
    let unclassified = 0

    for (const row of levelRows) {
      const expression = row.expression?.trim()
      const rawReading = row.reading?.trim()
      if (!expression || !rawReading) continue

      // Tanos marks suru-capable nouns by appending a literal " (する)" to
      // the reading column (e.g. "べんきょう (する)") — not part of the
      // actual reading, so it has to be stripped before matching JMdict.
      const suruMarked = /\(\s*する\s*\)/.test(rawReading)
      const reading = rawReading.replace(/\s*\(\s*する\s*\)\s*/, '').trim()

      const entry = lookupEntry(index, expression, reading)
      if (!entry) {
        unmatched++
        continue
      }

      const classification = classify(entry, expression)
      if (!classification) {
        unclassified++
        continue
      }

      const kanjiWord = pickKanjiForm(entry, reading)
      const kanaWord = pickKanaForm(entry, reading)
      const en = firstGloss(entry) || row.meaning || ''
      const poolKey = classification.kind === 'verb' ? 'verbs' : classification.kind === 'adjective' ? 'adjectives' : 'nouns'

      // Some Tanos rows repeat the same headword across close levels'
      // source lists, or JMdict entries collide on reading alone — skip
      // duplicates within a level+kind pool.
      const dedupeKey = `${kanjiWord}|${kanaWord}`
      if (seenWords[poolKey].has(dedupeKey)) continue
      seenWords[poolKey].add(dedupeKey)

      try {
        const card = buildCard({
          kind: classification.kind,
          typeII: classification.typeII,
          isSuruLike: classification.isSuruLike,
          isIAdjective: classification.isIAdjective,
          kanjiWord,
          kanaWord,
          en,
        })
        pools[poolKey].push(card)
      } catch (err) {
        console.warn(`  ! failed to conjugate ${kanjiWord} (${kanaWord}): ${err.message}`)
      }

      // Tanos flagged this noun as suru-capable and it isn't already a verb
      // itself — also generate the noun+する compound as its own verb card
      // (e.g. 勉強 "study" -> also 勉強する "to study").
      if (suruMarked && classification.kind === 'noun') {
        const suruKanji = kanjiWord + 'する'
        const suruKana = kanaWord + 'する'
        const suruDedupeKey = `${suruKanji}|${suruKana}`
        if (!seenWords.verbs.has(suruDedupeKey)) {
          seenWords.verbs.add(suruDedupeKey)
          try {
            const card = buildCard({
              kind: 'verb',
              typeII: false,
              isSuruLike: true,
              kanjiWord: suruKanji,
              kanaWord: suruKana,
              en: `to ${en}`.replace(/^to to /, 'to '),
            })
            pools.verbs.push(card)
          } catch (err) {
            console.warn(`  ! failed to conjugate ${suruKanji} (${suruKana}): ${err.message}`)
          }
        }
      }
    }

    console.log(`  matched: verbs=${pools.verbs.length} adjectives=${pools.adjectives.length} nouns=${pools.nouns.length}`)
    console.log(`  unmatched against JMdict: ${unmatched}, unclassified POS: ${unclassified}`)

    output[level] = pools
    seenPerLevelKind[level] = { verbs: pools.verbs.length, adjectives: pools.adjectives.length, nouns: pools.nouns.length }
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  await writeFile(
    OUT_PATH,
    JSON.stringify({
      formLabels: { verbs: VERB_FORM_LABELS, adjectives: ADJECTIVE_FORM_LABELS, nouns: NOUN_FORM_LABELS },
      decks: output,
    }),
  )
  console.log(`\nWrote ${path.relative(ROOT, OUT_PATH)}`)
  console.log(JSON.stringify(seenPerLevelKind, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
