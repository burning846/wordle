/** Colour a tile ends up in once its guess is revealed. */
export type LetterState = 'correct' | 'present' | 'absent'

/** `daily` is one shared puzzle per calendar day; `practice` is unlimited random words. */
export type GameMode = 'daily' | 'practice'

export type GameStatus = 'playing' | 'won' | 'lost'

/** Word lengths with generated dictionaries under src/data/. */
export const WORD_LENGTHS = [4, 5, 6, 7] as const

export type WordLength = (typeof WORD_LENGTHS)[number]

export const DEFAULT_LENGTH: WordLength = 5

export function isWordLength(value: unknown): value is WordLength {
  return WORD_LENGTHS.includes(value as WordLength)
}

/**
 * Guesses allowed for a given length. Classic Wordle gives 6 tries for 5 letters;
 * longer words get proportionally more room.
 */
export function maxGuessesFor(length: WordLength): number {
  return length + 1
}

export interface GameSnapshot {
  answer: string
  guesses: string[]
  status: GameStatus
  /** Days since the daily epoch, or null in practice mode. */
  dayIndex: number | null
}
