/**
 * Generates the word data committed under src/data/.
 *
 * Two lists are produced per word length:
 *   guesses-N.txt — every word accepted as a guess (SCOWL dictionary via `word-list`)
 *   answers-N.txt — the far smaller pool a puzzle answer is drawn from, i.e. the
 *                   dictionary intersected with a frequency list so answers stay fair
 *
 * answers-N.txt is ordered by everyday usage, most common word first. That order is
 * what practice mode's difficulty tiers slice up, and the daily sequence shuffles it
 * at runtime with a fixed seed — so this one file drives both.
 *
 * Run with: npm run words
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import wordListPath from 'word-list'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(ROOT, 'src/data')
const CACHE = resolve(ROOT, 'scripts/.cache/frequency.txt')

/** Word lengths the game supports. */
const LENGTHS = [4, 5, 6, 7]

/** Frequency-ranked English words, most common first. */
const FREQUENCY_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt'

/**
 * SCOWL size buckets, smallest first. Sizes up to 35 are the everyday vocabulary;
 * beyond that the lists reach into proper nouns, brands and technical jargon.
 *
 * The frequency list is web-corpus derived, so without this an answer pool drawn
 * from it offers up "texas", "linux", "anime" and "devel". Requiring a word to also
 * appear in the common buckets removes about a hundred such entries per length.
 * American spelling lists are unioned in so "color" and "honor" survive; every
 * excluded word is still accepted as a *guess*, it just can't be the answer.
 */
const COMMON_SIZES = [10, 20, 35]

/**
 * Recognises a word as an inflected form of a shorter one, returning that base.
 *
 * Answers should be base words: "beads", "voted" and "going" make dull targets and
 * give away their last letter. Guesses are left alone, so a player can still type a
 * plural freely.
 *
 * The rule is that a suffix can be stripped only if what remains is itself an
 * everyday word. That keeps genuine words whose endings merely look inflected —
 * "thing", "bring", "speed", "chaos", "focus", "glass" all survive, because "th",
 * "br", "spe", "chao", "focu" and "glas" are not words anyone uses. It errs towards
 * keeping words: a stray "used" in the pool costs far less than losing "need".
 */
function inflectedFrom(word, isWord) {
  // Two-letter stems must be genuinely common ("go", "us"), since the wider lists
  // carry fragments like "ne" that would swallow "need".
  const has = (stem) => stem.length >= 2 && isWord(stem)

  if (word.endsWith('s') && !word.endsWith('ss')) {
    if (has(word.slice(0, -1))) return word.slice(0, -1) // beads -> bead
    if (word.endsWith('es') && has(word.slice(0, -2))) return word.slice(0, -2) // boxes -> box
    if (word.endsWith('ies') && has(word.slice(0, -3) + 'y')) return word.slice(0, -3) + 'y' // bodies -> body
    if (word.endsWith('ves')) {
      if (has(word.slice(0, -3) + 'f')) return word.slice(0, -3) + 'f' // leaves -> leaf
      if (has(word.slice(0, -3) + 'fe')) return word.slice(0, -3) + 'fe' // wives -> wife
    }
  }

  if (word.endsWith('ed')) {
    const base = word.slice(0, -2)
    // Three letters minimum here, or "need" strips to "ne" and disappears.
    if (base.length >= 3 && has(base)) return base // asked -> ask
    if (base.length >= 3 && has(word.slice(0, -1))) return word.slice(0, -1) // voted -> vote
    if (word.endsWith('ied') && has(word.slice(0, -3) + 'y')) return word.slice(0, -3) + 'y' // tried -> try
    if (base.length >= 3 && base.at(-1) === base.at(-2) && has(base.slice(0, -1))) {
      return base.slice(0, -1) // dropped -> drop
    }
  }

  if (word.endsWith('ing')) {
    const base = word.slice(0, -3)
    if (has(base)) return base // going -> go
    if (base.length >= 3 && has(base + 'e')) return base + 'e' // hoping -> hope
    if (word.endsWith('ying') && has(word.slice(0, -4) + 'ie')) return word.slice(0, -4) + 'ie' // dying -> die
    if (base.length >= 3 && base.at(-1) === base.at(-2) && has(base.slice(0, -1))) {
      return base.slice(0, -1) // sitting -> sit
    }
  }

  return null
}

function commonVocabulary() {
  const words = COMMON_SIZES.flatMap((size) => [
    ...require(`wordlist-english/english-words-${size}.json`),
    ...require(`wordlist-english/american-words-${size}.json`),
  ])
  return new Set(words.map((word) => word.toLowerCase()))
}

async function frequencyList() {
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8')
  const res = await fetch(FREQUENCY_URL)
  if (!res.ok) throw new Error(`frequency list download failed: ${res.status}`)
  const text = await res.text()
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, text)
  return text
}

const lines = (text) =>
  text
    .split('\n')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

const dictionary = new Set(lines(readFileSync(wordListPath, 'utf8')))
const frequency = lines(await frequencyList())
const common = commonVocabulary()
const frequent = new Set(frequency)

/**
 * A stem counts as a real word if the dictionary knows it and people actually use it.
 * Short stems must clear the stricter common-vocabulary bar; longer ones may instead
 * appear in the frequency list, which is what catches "sucking" or "dying".
 */
const isWord = (stem) =>
  dictionary.has(stem) && (common.has(stem) || (stem.length >= 4 && frequent.has(stem)))

mkdirSync(DATA_DIR, { recursive: true })

for (const length of LENGTHS) {
  const alphabetic = (word) => word.length === length && /^[a-z]+$/.test(word)

  const guesses = [...dictionary].filter(alphabetic).sort()
  // Frequency order is preserved: it is the difficulty ranking.
  const eligible = frequency.filter(
    (word) => alphabetic(word) && dictionary.has(word) && common.has(word),
  )
  const answers = eligible.filter((word) => !inflectedFrom(word, isWord))

  if (answers.length === 0) throw new Error(`no answers found for length ${length}`)

  writeFileSync(resolve(DATA_DIR, `guesses-${length}.txt`), guesses.join('\n') + '\n')
  writeFileSync(resolve(DATA_DIR, `answers-${length}.txt`), answers.join('\n') + '\n')

  const tier = Math.ceil(answers.length / 3)
  const uncommon = frequency.filter(
    (word) => alphabetic(word) && dictionary.has(word) && !common.has(word),
  ).length
  console.log(
    `length ${length}: ${guesses.length} guesses, ${answers.length} answers ` +
      `(${tier} per tier; dropped ${uncommon} uncommon, ${eligible.length - answers.length} inflected)`,
  )
}
