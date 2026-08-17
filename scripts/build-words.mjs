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

mkdirSync(DATA_DIR, { recursive: true })

for (const length of LENGTHS) {
  const alphabetic = (word) => word.length === length && /^[a-z]+$/.test(word)

  const guesses = [...dictionary].filter(alphabetic).sort()
  // Frequency order is preserved: it is the difficulty ranking.
  const answers = frequency.filter(
    (word) => alphabetic(word) && dictionary.has(word) && common.has(word),
  )

  if (answers.length === 0) throw new Error(`no answers found for length ${length}`)

  writeFileSync(resolve(DATA_DIR, `guesses-${length}.txt`), guesses.join('\n') + '\n')
  writeFileSync(resolve(DATA_DIR, `answers-${length}.txt`), answers.join('\n') + '\n')

  const tier = Math.ceil(answers.length / 3)
  const rejected = frequency.filter(
    (word) => alphabetic(word) && dictionary.has(word) && !common.has(word),
  ).length
  console.log(
    `length ${length}: ${guesses.length} guesses, ${answers.length} answers ` +
      `(${tier} per difficulty tier, ${rejected} rejected as uncommon)`,
  )
}
