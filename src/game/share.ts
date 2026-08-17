import { evaluateGuess } from './evaluate.ts'
import { puzzleNumber } from './daily.ts'
import { maxGuessesFor, type GameMode, type GameStatus, type LetterState, type WordLength } from './types.ts'

const TILES: Record<LetterState, string> = { correct: '🟩', present: '🟨', absent: '⬛' }
const TILES_HIGH_CONTRAST: Record<LetterState, string> = { correct: '🟧', present: '🟦', absent: '⬛' }

export interface ShareInput {
  mode: GameMode
  length: WordLength
  dayIndex: number | null
  guesses: string[]
  answer: string
  status: GameStatus
  hardMode: boolean
  highContrast: boolean
}

/** The emoji grid, spoiler-free: colours only, never letters. */
export function buildShareText(input: ShareInput): string {
  const tiles = input.highContrast ? TILES_HIGH_CONTRAST : TILES
  const score = input.status === 'won' ? input.guesses.length : 'X'
  const title =
    input.mode === 'daily' && input.dayIndex !== null
      ? `Wordle ${puzzleNumber(input.dayIndex)}`
      : `Wordle ${input.length}-letter practice`

  const heading = `${title} ${score}/${maxGuessesFor(input.length)}${input.hardMode ? '*' : ''}`
  const grid = input.guesses.map((guess) =>
    evaluateGuess(guess, input.answer)
      .map((state) => tiles[state])
      .join(''),
  )

  return [heading, '', ...grid].join('\n')
}

/** Uses the async clipboard API when available, with a legacy fallback for http origins. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or insecure context — fall through.
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch {
    return false
  }
}
