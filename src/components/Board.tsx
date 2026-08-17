import { FLIP_MS, REVEAL_STEP_MS } from '../game/animation.ts'
import { evaluateGuess } from '../game/evaluate.ts'
import type { Shake } from '../hooks/useGame.ts'
import type { LetterState, WordLength } from '../game/types.ts'
import './Board.css'

interface BoardProps {
  length: WordLength
  maxGuesses: number
  guesses: string[]
  draft: string
  answer: string
  /** Row currently flipping its tiles, or -1. */
  revealingRow: number
  /** The rejected row and a token that changes each rejection. */
  shake: Shake
  /** Plays the win bounce on this row, or -1. */
  winningRow: number
}

export function Board({
  length,
  maxGuesses,
  guesses,
  draft,
  answer,
  revealingRow,
  shake,
  winningRow,
}: BoardProps) {
  const activeRow = guesses.length

  return (
    <div
      className="board"
      style={{ '--cols': length, '--rows': maxGuesses } as React.CSSProperties}
      role="grid"
      aria-label={`${maxGuesses} guesses of ${length} letters`}
    >
      {Array.from({ length: maxGuesses }, (_, row) => {
        const guess = guesses[row]
        const letters = guess ?? (row === activeRow ? draft : '')
        const shaking = row === shake.row

        return (
          <Row
            // The token is part of the shaking row's key, so React remounts it and
            // the animation restarts even on a second rejection in the same row.
            key={shaking ? `${row}-${shake.token}` : row}
            length={length}
            letters={letters}
            states={guess ? evaluateGuess(guess, answer) : null}
            revealing={row === revealingRow}
            shake={shaking}
            win={row === winningRow}
          />
        )
      })}
    </div>
  )
}

interface RowProps {
  length: number
  letters: string
  states: LetterState[] | null
  revealing: boolean
  shake: boolean
  win: boolean
}

function Row({ length, letters, states, revealing, shake, win }: RowProps) {
  const classes = ['row', shake && 'row--shake', win && 'row--win'].filter(Boolean).join(' ')

  return (
    <div className={classes} role="row">
      {Array.from({ length }, (_, column) => {
        const letter = letters[column] ?? ''
        const state = states?.[column]

        return (
          <div
            key={column}
            role="gridcell"
            aria-label={state ? `${letter} ${state}` : letter || 'empty'}
            className={[
              'tile',
              letter && !state && 'tile--filled',
              state && `tile--${state}`,
              revealing && 'tile--revealing',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              {
                '--flip-ms': `${FLIP_MS}ms`,
                '--flip-delay': `${column * REVEAL_STEP_MS}ms`,
                '--bounce-delay': `${column * 90}ms`,
              } as React.CSSProperties
            }
          >
            {letter}
          </div>
        )
      })}
    </div>
  )
}
