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
 * The slice of a frequency-ordered pool belonging to one tier — equal thirds, most
 * common first. `ranked` must be ordered by descending everyday usage, which is how
 * src/data/answers-N.txt is generated.
 */
export function poolFor<T>(ranked: readonly T[], difficulty: Difficulty): T[] {
  const size = Math.ceil(ranked.length / DIFFICULTIES.length)
  const tier = DIFFICULTIES.indexOf(difficulty)
  return [...ranked.slice(tier * size, (tier + 1) * size)]
}
