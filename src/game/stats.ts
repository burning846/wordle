import { readJson, writeJson } from './storage'
import { maxGuessesFor, type GameMode, type WordLength } from './types'

export interface Stats {
  played: number
  won: number
  currentStreak: number
  maxStreak: number
  /** distribution[i] counts wins that took i + 1 guesses. */
  distribution: number[]
  /** Day index of the last recorded daily result, used to detect a broken streak. */
  lastDayIndex: number | null
}

/** Stats are tracked per mode and per length — a 7-letter streak is its own thing. */
function key(mode: GameMode, length: WordLength): string {
  return `wordle:stats:${mode}:${length}`
}

function empty(length: WordLength): Stats {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: Array.from({ length: maxGuessesFor(length) }, () => 0),
    lastDayIndex: null,
  }
}

export function loadStats(mode: GameMode, length: WordLength): Stats {
  const stored = readJson<Partial<Stats>>(key(mode, length))
  const base = empty(length)
  if (!stored) return base

  return {
    played: stored.played ?? 0,
    won: stored.won ?? 0,
    currentStreak: stored.currentStreak ?? 0,
    maxStreak: stored.maxStreak ?? 0,
    // Resize rather than trust the stored length, in case max guesses ever change.
    distribution: base.distribution.map((_, index) => stored.distribution?.[index] ?? 0),
    lastDayIndex: stored.lastDayIndex ?? null,
  }
}

export interface Result {
  won: boolean
  /** Guesses used, 1-based. Only meaningful on a win. */
  guessCount: number
  /** Present in daily mode only. */
  dayIndex: number | null
}

export function recordResult(mode: GameMode, length: WordLength, result: Result): Stats {
  const previous = loadStats(mode, length)

  // A daily win only extends the streak if it lands the day after the last one.
  const continues =
    result.dayIndex === null || previous.lastDayIndex === null
      ? true
      : result.dayIndex === previous.lastDayIndex + 1

  const currentStreak = result.won ? (continues ? previous.currentStreak : 0) + 1 : 0

  const distribution = [...previous.distribution]
  if (result.won) {
    const bucket = result.guessCount - 1
    if (bucket >= 0 && bucket < distribution.length) distribution[bucket] += 1
  }

  const next: Stats = {
    played: previous.played + 1,
    won: previous.won + (result.won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(previous.maxStreak, currentStreak),
    distribution,
    lastDayIndex: result.dayIndex ?? previous.lastDayIndex,
  }

  writeJson(key(mode, length), next)
  return next
}

export function winPercentage(stats: Stats): number {
  return stats.played === 0 ? 0 : Math.round((stats.won / stats.played) * 100)
}
