import { readJson, writeJson } from './storage.js'
import { guessLimitFor, puzzleKey, type Puzzle } from './types.js'

export interface Stats {
  played: number
  won: number
  currentStreak: number
  maxStreak: number
  /** distribution[i] counts wins that took i + 1 guesses. */
  distribution: number[]
  /** Guesses summed over every win, so an average can be shown. */
  totalGuesses: number
  /** Fewest guesses in a win. */
  best: number | null
  /** Day index of the last recorded daily result, used to detect a broken streak. */
  lastDayIndex: number | null
}

/** One record per puzzle: a 7-letter streak and a hard-practice average are separate things. */
function key(puzzle: Puzzle): string {
  return `wordle:stats:${puzzleKey(puzzle)}`
}

/**
 * Practice has no guess ceiling, so it carries one extra bucket that collects every
 * win slower than the daily limit.
 */
export function distributionSize(puzzle: Puzzle): number {
  return guessLimitFor(puzzle.length) + (puzzle.mode === 'practice' ? 1 : 0)
}

function empty(puzzle: Puzzle): Stats {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: Array.from({ length: distributionSize(puzzle) }, () => 0),
    totalGuesses: 0,
    best: null,
    lastDayIndex: null,
  }
}

export function loadStats(puzzle: Puzzle): Stats {
  const stored = readJson<Partial<Stats>>(key(puzzle))
  const base = empty(puzzle)
  if (!stored) return base

  return {
    played: stored.played ?? 0,
    won: stored.won ?? 0,
    currentStreak: stored.currentStreak ?? 0,
    maxStreak: stored.maxStreak ?? 0,
    // Resized rather than trusted, in case the bucket count has changed since.
    distribution: base.distribution.map((_, index) => stored.distribution?.[index] ?? 0),
    totalGuesses: stored.totalGuesses ?? 0,
    best: stored.best ?? null,
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

export function recordResult(puzzle: Puzzle, result: Result): Stats {
  const previous = loadStats(puzzle)

  // Each daily puzzle counts once. Two tabs open on the same day would otherwise both
  // record it, inflating the totals and resetting the streak against itself.
  if (result.dayIndex !== null && result.dayIndex === previous.lastDayIndex) return previous

  // A daily win only extends the streak if it lands the day after the last one.
  const continues =
    result.dayIndex === null || previous.lastDayIndex === null
      ? true
      : result.dayIndex === previous.lastDayIndex + 1

  const currentStreak = result.won ? (continues ? previous.currentStreak : 0) + 1 : 0

  const distribution = [...previous.distribution]
  if (result.won) {
    // Wins past the last bucket land in it: that bucket means "this many or more".
    const bucket = Math.min(result.guessCount, distribution.length) - 1
    if (bucket >= 0) distribution[bucket] += 1
  }

  const next: Stats = {
    played: previous.played + 1,
    won: previous.won + (result.won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(previous.maxStreak, currentStreak),
    distribution,
    totalGuesses: previous.totalGuesses + (result.won ? result.guessCount : 0),
    best: result.won ? Math.min(previous.best ?? Infinity, result.guessCount) : previous.best,
    lastDayIndex: result.dayIndex ?? previous.lastDayIndex,
  }

  writeJson(key(puzzle), next)
  return next
}

export function winPercentage(stats: Stats): number {
  return stats.played === 0 ? 0 : Math.round((stats.won / stats.played) * 100)
}

/** Mean guesses per win, to one decimal. Zero when nothing has been won yet. */
export function averageGuesses(stats: Stats): number {
  return stats.won === 0 ? 0 : Math.round((stats.totalGuesses / stats.won) * 10) / 10
}
