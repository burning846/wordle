/**
 * Generates the word data committed under src/data/.
 *
 * Two lists are produced per word length:
 *   guesses-N.ts — every word accepted as a guess (SCOWL dictionary via `word-list`)
 *   answers-N.ts — the smaller pool an answer is drawn from, ordered by everyday
 *                  usage so that practice difficulty can slice it into tiers
 *
 * They are TypeScript modules holding a newline-separated string rather than plain
 * text files, because the API routes need the same lists as the browser and Vite's
 * `?raw` import is a bundler feature the server cannot use. A module imports cleanly
 * everywhere, and one word per line keeps diffs readable.
 *
 * The answer pool is SCOWL's everyday vocabulary, ranked by a frequency list. The
 * frequency list only orders the pool; it does not define it. Using it as the source
 * instead would cut the pool to a third of its size, since a word has to be inside
 * the corpus's top entries to appear at all.
 *
 * answers-N.txt is ordered most-common-first. That single ordering does double duty:
 * practice difficulty slices it into tiers, and the daily sequence is a seeded
 * shuffle of it computed at runtime in src/game/shuffle.ts.
 *
 * Run with: npm run words
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import wordListPath from 'word-list'

const require = createRequire(import.meta.url)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(ROOT, 'src/data')
const CACHE = resolve(ROOT, 'scripts/.cache/frequency.txt')

/** Word lengths the game supports. */
const LENGTHS = [4, 5, 6, 7]

/**
 * Word frequencies from a 50,000-word subtitle corpus — spoken English, which is a
 * good proxy for "everyday usage". Only used for ordering.
 */
const FREQUENCY_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt'

/**
 * SCOWL size buckets, smallest first. Sizes up to 35 are everyday vocabulary; beyond
 * that the lists reach into proper nouns, brands and technical jargon. This is the
 * answer pool: words a player can fairly be expected to know.
 */
const COMMON_SIZES = [10, 20, 35]

/**
 * How far down the frequency list a stem may sit and still count as an everyday word.
 * The corpus has a long tail of noise — "chao" and "bree" both appear in it — and
 * without a cut-off those swallow "chaos" and "breed".
 */
const STEM_RANK_LIMIT = 8000

/** Informal spellings that SCOWL lists but no one wants as a puzzle answer. */
const INFORMAL = new Set(['gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'outta', 'dunno', 'lotta'])

async function frequencyList() {
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8')
  const res = await fetch(FREQUENCY_URL)
  if (!res.ok) throw new Error(`frequency list download failed: ${res.status}`)
  const text = await res.text()
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, text)
  return text
}

/**
 * Everyday vocabulary, lowercase only. Capitalised entries are proper nouns and
 * initialisms, which make unfair answers, so they are dropped rather than folded.
 */
function commonVocabulary() {
  const words = COMMON_SIZES.flatMap((size) => [
    ...require(`wordlist-english/english-words-${size}.json`),
    ...require(`wordlist-english/american-words-${size}.json`),
  ])
  return new Set(words.filter((word) => /^[a-z]+$/.test(word)))
}

/**
 * Recognises a word as an inflected form of a shorter one, returning that base.
 *
 * Answers should be base words: "beads", "voted" and "going" make dull targets and
 * give away their ending. Guesses are left alone, so a player can still type a
 * plural freely.
 *
 * A suffix is only stripped when what remains is itself an everyday word. That keeps
 * words whose endings merely look inflected — "thing", "bring", "speed", "chaos",
 * "focus" and "glass" all survive, because "th", "br", "spe", "chao", "focu" and
 * "glas" are not words anyone uses. Where the two directions conflict it keeps the
 * word: a stray "used" in the pool costs less than losing "need" from it.
 */
function inflectedFrom(word, isWord, { comparatives = false } = {}) {
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
    // Three letters minimum, or "need" strips to "ne" and disappears.
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

  // Borrowed Latin plurals, which no amount of English suffix stripping catches.
  if (word.endsWith('i') && has(word.slice(0, -1) + 'us')) return word.slice(0, -1) + 'us' // radii -> radius
  if (word.endsWith('es') && has(word.slice(0, -2) + 'is')) return word.slice(0, -2) + 'is' // oases -> oasis

  /**
   * Comparatives are only stripped for words the corpus never saw. The rule is
   * otherwise far too eager — "cover" would reduce to "cove", "offer" to "off" and
   * "tower" to "tow" — but every one of those is a word people actually say, so being
   * absent from a 50,000-word corpus is strong evidence a word really is a comparative
   * nobody uses. It leaves agent nouns like "baker" and "miner" alone for the same
   * reason.
   */
  if (comparatives) {
    if (word.endsWith('er')) {
      if (has(word.slice(0, -2))) return word.slice(0, -2) // huger -> hug... only if unranked
      if (has(word.slice(0, -1))) return word.slice(0, -1) // abler -> able
      if (word.endsWith('ier') && has(word.slice(0, -3) + 'y')) return word.slice(0, -3) + 'y' // icier -> icy
    }
    if (word.endsWith('est')) {
      if (has(word.slice(0, -3))) return word.slice(0, -3) // slowest -> slow
      if (has(word.slice(0, -2))) return word.slice(0, -2) // weest -> wee
      if (word.endsWith('iest') && has(word.slice(0, -4) + 'y')) return word.slice(0, -4) + 'y' // iciest -> icy
    }
  }

  return null
}

/** Words contain no backticks or `${`, so a template literal needs no escaping. */
const module = (words) =>
  `// Generated by scripts/build-words.mjs. Do not edit; run \`npm run words\`.\nexport default \`${words.join('\n')}\`\n`

const lines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0]?.toLowerCase())
    .filter(Boolean)

const dictionary = new Set(lines(readFileSync(wordListPath, 'utf8')))
const common = commonVocabulary()

/** Position in the frequency list; absent words sort after every ranked one. */
const rank = new Map()
lines(await frequencyList()).forEach((word, index) => {
  if (!rank.has(word)) rank.set(word, index)
})
const rankOf = (word) => rank.get(word) ?? Number.MAX_SAFE_INTEGER

/**
 * A stem counts as a word if everyday vocabulary knows it, or — for stems long enough
 * not to be a stray fragment — if both the dictionary and the frequency list do.
 */
const isWord = (stem) =>
  common.has(stem) ||
  (stem.length >= 4 && dictionary.has(stem) && rankOf(stem) < STEM_RANK_LIMIT)

mkdirSync(DATA_DIR, { recursive: true })

for (const length of LENGTHS) {
  const rightLength = (word) => word.length === length

  const guesses = [...dictionary].filter((word) => rightLength(word) && /^[a-z]+$/.test(word)).sort()

  // Intersected with the guess dictionary for two reasons: it guarantees every answer
  // is a word the game will accept, and that dictionary is profanity-filtered while
  // the SCOWL size buckets are not.
  const eligible = [...common].filter(
    (word) => rightLength(word) && dictionary.has(word) && !INFORMAL.has(word),
  )
  const answers = eligible
    .filter((word) => !inflectedFrom(word, isWord, { comparatives: !rank.has(word) }))
    // Most common first, then alphabetically among words the corpus never saw.
    .sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b))

  if (answers.length === 0) throw new Error(`no answers found for length ${length}`)

  writeFileSync(resolve(DATA_DIR, `guesses-${length}.ts`), module(guesses))
  writeFileSync(resolve(DATA_DIR, `answers-${length}.ts`), module(answers))

  const unranked = answers.filter((word) => !rank.has(word)).length
  console.log(
    `length ${length}: ${guesses.length} guesses, ${answers.length} answers ` +
      `(from ${eligible.length} common words, ${eligible.length - answers.length} inflected, ` +
      `${unranked} unranked)`,
  )
}
