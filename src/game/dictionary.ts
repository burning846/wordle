import type { WordLength } from './types.ts'

export interface Dictionary {
  length: WordLength
  /** Puzzle answers, pre-shuffled at build time — index n is day n's word. */
  answers: string[]
  /** Everything accepted as a guess, answers included. */
  guesses: Set<string>
}

/**
 * Static import map rather than a template literal: Vite needs the specifiers
 * spelled out to code-split each length into its own chunk, so a player on
 * 5 letters never downloads the 265KB 7-letter list.
 */
const SOURCES: Record<WordLength, () => Promise<[string, string]>> = {
  4: () => load(import('../data/answers-4.txt?raw'), import('../data/guesses-4.txt?raw')),
  5: () => load(import('../data/answers-5.txt?raw'), import('../data/guesses-5.txt?raw')),
  6: () => load(import('../data/answers-6.txt?raw'), import('../data/guesses-6.txt?raw')),
  7: () => load(import('../data/answers-7.txt?raw'), import('../data/guesses-7.txt?raw')),
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
    const answers = split(rawAnswers)
    const dictionary: Dictionary = {
      length,
      answers,
      // Answers are already a subset of the dictionary, but union them anyway so
      // a regenerated list can never reject a word the game itself might pick.
      guesses: new Set([...split(rawGuesses), ...answers]),
    }
    return dictionary
  })

  cache.set(length, pending)
  return pending
}

function split(raw: string): string[] {
  return raw.split('\n').filter(Boolean)
}
