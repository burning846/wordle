import answers4 from '../data/answers-4.ts'
import answers5 from '../data/answers-5.ts'
import answers6 from '../data/answers-6.ts'
import answers7 from '../data/answers-7.ts'
import guesses4 from '../data/guesses-4.ts'
import guesses5 from '../data/guesses-5.ts'
import guesses6 from '../data/guesses-6.ts'
import guesses7 from '../data/guesses-7.ts'
import type { WordLength } from './types.ts'

export interface Words {
  /** Answers ordered by descending everyday usage — the difficulty ranking. */
  answers: string[]
  guesses: string[]
}

/**
 * Every length, loaded eagerly. The browser uses `dictionary.ts` instead, which
 * imports one length at a time so a five-letter player never downloads the rest;
 * this module is for the API routes and tests, where the lists are already on disk
 * and code splitting buys nothing.
 */
const SOURCES: Record<WordLength, [string, string]> = {
  4: [answers4, guesses4],
  5: [answers5, guesses5],
  6: [answers6, guesses6],
  7: [answers7, guesses7],
}

const cache = new Map<WordLength, Words>()

export function loadWords(length: WordLength): Words {
  const cached = cache.get(length)
  if (cached) return cached

  const [answers, guesses] = SOURCES[length]
  const words: Words = { answers: split(answers), guesses: split(guesses) }
  cache.set(length, words)
  return words
}

function split(raw: string): string[] {
  return raw.split('\n').filter(Boolean)
}
