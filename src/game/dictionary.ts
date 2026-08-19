import { dailyOrder } from './shuffle.ts'
import type { WordLength } from './types.ts'

export interface Dictionary {
  length: WordLength
  /** Answers ordered by descending everyday usage — the difficulty ranking. */
  ranked: string[]
  /** The same words in the fixed daily order, so day n is everyone's day n. */
  daily: string[]
  /** Everything accepted as a guess, answers included. */
  guesses: Set<string>
}

/**
 * Static import map rather than a template literal: Vite needs the specifiers
 * spelled out to code-split each length into its own chunk, so a player on
 * 5 letters never downloads the 265KB 7-letter list.
 */
const SOURCES: Record<WordLength, () => Promise<[string, string]>> = {
  4: () => load(import('../data/answers-4.ts'), import('../data/guesses-4.ts')),
  5: () => load(import('../data/answers-5.ts'), import('../data/guesses-5.ts')),
  6: () => load(import('../data/answers-6.ts'), import('../data/guesses-6.ts')),
  7: () => load(import('../data/answers-7.ts'), import('../data/guesses-7.ts')),
}

type RawModule = Promise<{ default: string }>

async function load(answers: RawModule, guesses: RawModule): Promise<[string, string]> {
  const [a, g] = await Promise.all([answers, guesses])
  return [a.default, g.default]
}

const cache = new Map<WordLength, Promise<Dictionary>>()

export function loadDictionary(length: WordLength): Promise<Dictionary> {
  const cached = cache.get(length)
  if (cached) return cached

  const pending = SOURCES[length]().then(([rawAnswers, rawGuesses]) => {
    const ranked = split(rawAnswers)
    const dictionary: Dictionary = {
      length,
      ranked,
      daily: dailyOrder(ranked, length),
      // Answers are already a subset of the dictionary, but union them anyway so
      // a regenerated list can never reject a word the game itself might pick.
      guesses: new Set([...split(rawGuesses), ...ranked]),
    }
    return dictionary
  })

  cache.set(length, pending)
  return pending
}

function split(raw: string): string[] {
  return raw.split('\n').filter(Boolean)
}
