import { evaluateGuess } from './evaluate.js'
import { dailyNumber } from './daily.js'
import { guessLimitFor, type GameMode, type GameStatus, type LetterState, type WordLength } from './types.js'

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
  const hard = input.hardMode ? '*' : ''

  // Practice has no guess limit, so "n/6" would be meaningless there.
  const heading =
    input.dayIndex === null
      ? `Wordle practice · ${input.length} letters · ${input.guesses.length} guesses${hard}`
      : `Wordle ${dailyNumber(input.dayIndex)} ${
          input.status === 'won' ? input.guesses.length : 'X'
        }/${guessLimitFor(input.length)}${hard}`
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
