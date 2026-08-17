import type { LetterState } from './types.ts'

/**
 * Scores a guess against the answer.
 *
 * Repeated letters are the subtle part: a letter only earns `present` while the
 * answer still has an unmatched copy of it, and exact matches claim their copy
 * first. Guessing `abbey` against `bebop` yields absent, correct, present,
 * absent, absent — the second `b` is spent by the exact match.
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const states: LetterState[] = Array.from({ length: guess.length }, () => 'absent')
  const unmatched = new Map<string, number>()

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      states[i] = 'correct'
    } else {
      unmatched.set(answer[i], (unmatched.get(answer[i]) ?? 0) + 1)
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (states[i] === 'correct') continue
    const left = unmatched.get(guess[i]) ?? 0
    if (left > 0) {
      states[i] = 'present'
      unmatched.set(guess[i], left - 1)
    }
  }

  return states
}

const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }

/**
 * Best-known state per letter across every guess, for colouring the keyboard.
 * A letter already known to be `correct` never downgrades to `present`.
 */
export function keyboardStates(guesses: string[], answer: string): Record<string, LetterState> {
  const states: Record<string, LetterState> = {}

  for (const guess of guesses) {
    const evaluated = evaluateGuess(guess, answer)
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i]
      const known = states[letter]
      if (!known || RANK[evaluated[i]] > RANK[known]) states[letter] = evaluated[i]
    }
  }

  return states
}

/**
 * Hard mode: any hint already revealed has to be honoured by the next guess.
 * Returns a player-facing message, or null when the guess is allowed.
 */
export function hardModeViolation(
  guess: string,
  previousGuesses: string[],
  answer: string,
): string | null {
  for (const previous of previousGuesses) {
    const evaluated = evaluateGuess(previous, answer)

    for (let i = 0; i < evaluated.length; i++) {
      if (evaluated[i] === 'correct' && guess[i] !== previous[i]) {
        return `${ordinal(i + 1)} letter must be ${previous[i].toUpperCase()}`
      }
    }

    // A letter revealed `present` n times must appear at least n times again.
    const required = new Map<string, number>()
    for (let i = 0; i < evaluated.length; i++) {
      if (evaluated[i] === 'present' || evaluated[i] === 'correct') {
        required.set(previous[i], (required.get(previous[i]) ?? 0) + 1)
      }
    }
    for (const [letter, count] of required) {
      if (countOf(guess, letter) < count) {
        return `Guess must contain ${count > 1 ? `${count} ` : ''}${letter.toUpperCase()}`
      }
    }
  }

  return null
}

function countOf(word: string, letter: string): number {
  let count = 0
  for (const character of word) if (character === letter) count++
  return count
}

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const value = n % 100
  return n + (suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0])
}
