/**
 * Practice difficulty, graded by how common a word is in everyday use.
 *
 * The answer pool is already restricted to words from a frequency-ranked list, so
 * every tier holds words a player has plausibly met; the tiers just decide how far
 * down that ranking to reach.
 */
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

export const DEFAULT_DIFFICULTY: Difficulty = 'medium'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: 'the most common words',
  medium: 'everyday words',
  hard: 'the least common of the common words',
}

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty)
}

/**
 * How much of the ranked pool each tier gets, as a share of the whole. Equal thirds
 * today; this is the one place to change that. Making easy a tighter set of very
 * common words is `{ easy: 0.2, medium: 0.3, hard: 0.5 }`, for instance.
 *
 * Shares are relative to the pool rather than fixed counts because the pools differ
 * by length — 2,012 words at five letters, 1,519 at four — and a count that suits one
 * would overflow another. They must sum to 1; the last tier takes whatever remains,
 * so every word stays reachable and no word lands in two tiers.
 */
export const TIER_SHARES: Record<Difficulty, number> = {
  easy: 1 / 3,
  medium: 1 / 3,
  hard: 1 / 3,
}

/** Where a tier starts and ends within a pool of `total` words. */
export function tierBounds(total: number, difficulty: Difficulty): [start: number, end: number] {
  const tier = DIFFICULTIES.indexOf(difficulty)

  let start = 0
  for (let i = 0; i < tier; i++) start += Math.round(total * TIER_SHARES[DIFFICULTIES[i]])

  // The last tier absorbs the rounding, so the tiers always cover the pool exactly.
  const end = tier === DIFFICULTIES.length - 1 ? total : start + Math.round(total * TIER_SHARES[difficulty])
  return [Math.min(start, total), Math.min(end, total)]
}

/**
 * The slice of a frequency-ordered pool belonging to one tier, most common first.
 * `ranked` must be ordered by descending everyday usage, which is how
 * src/data/answers-N.txt is generated.
 */
export function poolFor<T>(ranked: readonly T[], difficulty: Difficulty): T[] {
  const [start, end] = tierBounds(ranked.length, difficulty)
  return [...ranked.slice(start, end)]
}
