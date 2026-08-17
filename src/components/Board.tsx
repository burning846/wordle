import { useEffect, useRef, useState } from 'react'
import { FLIP_MS, REVEAL_STEP_MS } from '../game/animation.ts'
import type { Draft } from '../game/draft.ts'
import { evaluateGuess } from '../game/evaluate.ts'
import type { Shake } from '../hooks/useGame.ts'
import type { LetterState, WordLength } from '../game/types.ts'
import './Board.css'

/** Must match the grid gap in Board.css. */
const GAP = 5
const MIN_TILE = 28
const MAX_TILE = 62

interface BoardProps {
  length: WordLength
  /** Grows as practice guesses pile up. */
  rows: number
  guesses: string[]
  draft: Draft
  /** Letters pinned to a position, used to mark the pre-filled tiles. */
  greens: (string | null)[]
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
  rows,
  guesses,
  draft,
  greens,
  answer,
  revealingRow,
  shake,
  winningRow,
}: BoardProps) {
  const [scrollRef, tile] = useTileSize(rows, length)
  const activeRow = guesses.length

  // Practice boards outgrow the viewport; keep the row being typed in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [rows, scrollRef])

  return (
    <main className="board-scroll" ref={scrollRef}>
      <div
        className="board"
        style={{ '--cols': length, '--tile': `${tile}px` } as React.CSSProperties}
        role="grid"
        aria-label={`Guesses of ${length} letters`}
      >
        {Array.from({ length: rows }, (_, row) => {
          const guess = guesses[row]
          const active = row === activeRow
          const letters: (string | null)[] = guess
            ? [...guess]
            : active
              ? draft.slots
              : Array.from({ length }, () => null)
          const shaking = row === shake.row

          return (
            <Row
              // The token is part of the shaking row's key, so React remounts it and
              // the animation restarts even on a second rejection in the same row.
              key={shaking ? `${row}-${shake.token}` : row}
              length={length}
              letters={letters}
              states={guess ? evaluateGuess(guess, answer) : null}
              // Only the row being typed shows which letters were filled in for you.
              greens={active ? greens : null}
              revealing={row === revealingRow}
              shake={shaking}
              win={row === winningRow}
            />
          )
        })}
      </div>
    </main>
  )
}

interface RowProps {
  length: number
  letters: (string | null)[]
  states: LetterState[] | null
  greens: (string | null)[] | null
  revealing: boolean
  shake: boolean
  win: boolean
}

function Row({ length, letters, states, greens, revealing, shake, win }: RowProps) {
  const classes = ['row', shake && 'row--shake', win && 'row--win'].filter(Boolean).join(' ')

  return (
    <div className={classes} role="row">
      {Array.from({ length }, (_, column) => {
        const letter = letters[column] ?? ''
        const state = states?.[column]
        const hint = !state && letter !== '' && greens?.[column] === letter

        return (
          <div
            key={column}
            role="gridcell"
            aria-label={state ? `${letter} ${state}` : letter || 'empty'}
            className={[
              'tile',
              letter && !state && 'tile--filled',
              hint && 'tile--hint',
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

/**
 * Sizes tiles to the space actually available rather than to the viewport, so the
 * board fits on a short screen and a growing practice board stops shrinking at
 * MIN_TILE and scrolls instead.
 */
function useTileSize(rows: number, cols: number) {
  const ref = useRef<HTMLElement>(null)
  const [tile, setTile] = useState(MAX_TILE)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // contentRect excludes the container's padding, which is the space tiles get.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const byWidth = (width - (cols - 1) * GAP) / cols
      const byHeight = (height - (rows - 1) * GAP) / rows
      setTile(Math.max(MIN_TILE, Math.min(MAX_TILE, Math.floor(Math.min(byWidth, byHeight)))))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [rows, cols])

  return [ref, tile] as const
}
