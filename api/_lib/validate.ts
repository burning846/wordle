import { dailyAnswer, dayIndexFor } from '../../src/game/daily.js'
import { poolFor, isDifficulty, type Difficulty } from '../../src/game/difficulty.js'
import { dailyOrder } from '../../src/game/shuffle.js'
import { loadWords } from '../../src/game/words.js'
import { isWordLength, limitFor, type GameMode, type WordLength } from '../../src/game/types.js'

export interface SubmittedResult {
  mode: GameMode
  length: WordLength
  difficulty: Difficulty | null
  dayIndex: number | null
  guesses: string[]
  won: boolean
  hardMode: boolean
  durationMs: number | null
}

/**
 * The client scores its own guesses, so the answer is in its bundle and a determined
 * player can always submit a perfect game. What the server can do — and does here —
 * is refuse anything that isn't a coherent game: the word has to be the one this
 * puzzle actually had, every guess a real word, the outcome consistent with the
 * grid, and the clock not obviously fabricated.
 */
export type Validation =
  { ok: true; result: SubmittedResult; answer: string } | { ok: false; error: string }

/** Nobody types a five-letter word in under a third of a second, six times over. */
const MIN_MS_PER_GUESS = 300

/** How far back a result may be submitted, so an old device can still sync up. */
const MAX_DAYS_LATE = 2

export function validateResult(body: unknown, now: Date = new Date()): Validation {
  if (typeof body !== 'object' || body === null)
    return { ok: false, error: 'body must be an object' }
  const raw = body as Record<string, unknown>

  const mode = raw.mode
  if (mode !== 'daily' && mode !== 'practice') return { ok: false, error: 'unknown mode' }

  const length = raw.length
  if (!isWordLength(length)) return { ok: false, error: 'unsupported word length' }

  const guesses = raw.guesses
  if (!Array.isArray(guesses) || guesses.length === 0) return { ok: false, error: 'no guesses' }
  if (
    !guesses.every(
      (guess) => typeof guess === 'string' && new RegExp(`^[a-z]{${length}}$`).test(guess),
    )
  ) {
    return { ok: false, error: 'malformed guess' }
  }

  const limit = limitFor(mode, length)
  if (limit !== null && guesses.length > limit) return { ok: false, error: 'too many guesses' }

  const words = loadWords(length)
  const accepted = new Set(words.guesses)
  const unknown = guesses.find((guess: string) => !accepted.has(guess))
  if (unknown) return { ok: false, error: `not a word: ${unknown}` }

  // Work out what the answer must have been, rather than trusting the client's.
  let answer: string
  let difficulty: Difficulty | null = null
  let dayIndex: number | null = null

  if (mode === 'daily') {
    if (typeof raw.dayIndex !== 'number' || !Number.isInteger(raw.dayIndex)) {
      return { ok: false, error: 'missing day index' }
    }
    dayIndex = raw.dayIndex
    const today = dayIndexFor(now)
    if (dayIndex > today) return { ok: false, error: 'that puzzle has not been published yet' }
    if (dayIndex < today - MAX_DAYS_LATE) return { ok: false, error: 'that puzzle has closed' }

    answer = dailyAnswer(dailyOrder(words.answers, length), dayIndex)
  } else {
    if (!isDifficulty(raw.difficulty)) return { ok: false, error: 'missing difficulty' }
    difficulty = raw.difficulty
    const last = guesses.at(-1) as string
    // Practice words are random, so the answer is whatever was solved — but it still
    // has to be a word that tier could actually have produced.
    if (!poolFor(words.answers, difficulty).includes(last)) {
      return { ok: false, error: 'answer is not in that difficulty' }
    }
    answer = last
  }

  const won = guesses.at(-1) === answer
  if (raw.won !== won) return { ok: false, error: 'outcome does not match the guesses' }
  if (!won && limit !== null && guesses.length !== limit) {
    return { ok: false, error: 'a lost game must use every guess' }
  }
  if (guesses.slice(0, -1).includes(answer))
    return { ok: false, error: 'the answer was guessed early' }
  if (new Set(guesses).size !== guesses.length) return { ok: false, error: 'a guess was repeated' }

  const durationMs = raw.durationMs
  if (durationMs !== null && durationMs !== undefined) {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
      return { ok: false, error: 'invalid duration' }
    }
    if (durationMs < guesses.length * MIN_MS_PER_GUESS) {
      return { ok: false, error: 'impossibly fast' }
    }
  }

  return {
    ok: true,
    answer,
    result: {
      mode,
      length,
      difficulty,
      dayIndex,
      guesses: guesses as string[],
      won,
      hardMode: raw.hardMode === true,
      durationMs: typeof durationMs === 'number' ? Math.round(durationMs) : null,
    },
  }
}
