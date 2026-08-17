import type { Difficulty } from './difficulty.ts'

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
 * Guesses allowed in daily mode. Classic Wordle gives 6 tries for 5 letters; longer
 * words get proportionally more room. Practice mode has no limit, but still uses this
 * as its starting board size.
 */
export function guessLimitFor(length: WordLength): number {
  return length + 1
}

/** Null in practice mode, where a wrong guess simply adds another row. */
export function limitFor(mode: GameMode, length: WordLength): number | null {
  return mode === 'daily' ? guessLimitFor(length) : null
}

/**
 * Rows the board shows. Practice starts at the daily size so it looks familiar, then
 * grows one row at a time; a solved board stops growing.
 */
export function rowsFor(
  mode: GameMode,
  length: WordLength,
  guessCount: number,
  finished: boolean,
): number {
  const base = guessLimitFor(length)
  if (mode === 'daily') return base
  return Math.max(base, guessCount + (finished ? 0 : 1))
}

/**
 * Identifies one puzzle stream. Games and statistics are stored per puzzle, so a
 * 7-letter hard practice run keeps its own progress and its own record.
 */
export interface Puzzle {
  mode: GameMode
  length: WordLength
  /** Only meaningful for practice; the daily word is drawn from the whole pool. */
  difficulty: Difficulty
}

export function samePuzzle(a: Puzzle, b: Puzzle): boolean {
  if (a.mode !== b.mode || a.length !== b.length) return false
  return a.mode === 'daily' || a.difficulty === b.difficulty
}

/** Storage key fragment. Daily leaves difficulty out, since it doesn't apply. */
export function puzzleKey(puzzle: Puzzle): string {
  return puzzle.mode === 'daily'
    ? `daily:${puzzle.length}`
    : `practice:${puzzle.length}:${puzzle.difficulty}`
}

export interface GameSnapshot {
  answer: string
  guesses: string[]
  status: GameStatus
  /** Days since the daily epoch, or null in practice mode. */
  dayIndex: number | null
  /**
   * The puzzle this belongs to. Redundant with its storage key, but it makes the
   * snapshot self-identifying: switching puzzle re-runs the save effect while the
   * previous game is still in state, and without this the old game would be written
   * over the new key.
   */
  puzzle: Puzzle
}
