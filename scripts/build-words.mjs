/**
 * Generates the word data committed under src/data/.
 *
 * Two lists are produced per word length:
 *   guesses-N.txt — every word accepted as a guess (SCOWL dictionary via `word-list`)
 *   answers-N.txt — the far smaller pool a puzzle answer is drawn from, i.e. the
 *                   dictionary intersected with a frequency list so answers stay fair
 *
 * Answers are shuffled with a fixed seed so the daily sequence is stable across
 * machines and rebuilds, and so day 1 isn't simply the most common word in English.
 *
 * Run with: npm run words
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import wordListPath from 'word-list'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(ROOT, 'src/data')
const CACHE = resolve(ROOT, 'scripts/.cache/frequency.txt')

/** Word lengths the game supports. */
const LENGTHS = [4, 5, 6, 7]

/** Frequency-ranked English words, most common first. */
const FREQUENCY_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt'

/**
 * The frequency list is web-corpus derived, so it carries a handful of entries
 * that are real words but poor puzzle answers (jargon, units, netspeak).
 */
const ANSWER_BLOCKLIST = new Set([
  'http', 'html', 'jpeg', 'aspx', 'blogs', 'urls', 'faqs', 'pdfs', 'isbn',
  'kbps', 'mbps', 'ghz', 'php', 'asin', 'href', 'ebay', 'aol', 'msn',
])

async function frequencyList() {
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8')
  const res = await fetch(FREQUENCY_URL)
  if (!res.ok) throw new Error(`frequency list download failed: ${res.status}`)
  const text = await res.text()
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, text)
  return text
}

/** mulberry32 — small seeded PRNG, keeps the shuffle reproducible. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(words, seed) {
  const out = [...words]
  const random = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const lines = (text) =>
  text
    .split('\n')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

const dictionary = new Set(lines(readFileSync(wordListPath, 'utf8')))
const frequency = lines(await frequencyList())

mkdirSync(DATA_DIR, { recursive: true })

for (const length of LENGTHS) {
  const alphabetic = (word) => word.length === length && /^[a-z]+$/.test(word)

  const guesses = [...dictionary].filter(alphabetic).sort()
  const answers = shuffled(
    frequency.filter((word) => alphabetic(word) && dictionary.has(word) && !ANSWER_BLOCKLIST.has(word)),
    // Distinct seed per length so the lists aren't correlated.
    0x5eed + length,
  )

  if (answers.length === 0) throw new Error(`no answers found for length ${length}`)

  writeFileSync(resolve(DATA_DIR, `guesses-${length}.txt`), guesses.join('\n') + '\n')
  writeFileSync(resolve(DATA_DIR, `answers-${length}.txt`), answers.join('\n') + '\n')

  console.log(`length ${length}: ${guesses.length} guesses, ${answers.length} answers`)
}
