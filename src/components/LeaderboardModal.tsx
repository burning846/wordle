import { useEffect, useState } from 'react'
import { fetchLeaderboard, ApiUnavailable, type Leaderboard } from '../game/api.js'
import { dailyNumber, dayIndexFor } from '../game/daily.js'
import type { WordLength } from '../game/types.js'
import { Modal } from './Modal.js'
import './LeaderboardModal.css'

interface LeaderboardModalProps {
  open: boolean
  onClose: () => void
  length: WordLength
  /** Highlights the signed-in player's own row. */
  nickname: string | null
}

type State = { status: 'loading' } | { status: 'ready'; board: Leaderboard } | { status: 'error'; message: string }

export function LeaderboardModal({ open, onClose, length, nickname }: LeaderboardModalProps) {
  const state = useLeaderboard(open, length)

  return (
    <Modal
      open={open}
      title={state.status === 'ready' ? `Daily #${dailyNumber(state.board.dayIndex)}` : 'Leaderboard'}
      onClose={onClose}
    >
      <p className="leaderboard__lead">
        Today's {length}-letter puzzle, fewest guesses first and fastest as the tie-break.
      </p>

      {state.status === 'loading' && <p className="leaderboard__note">Loading…</p>}
      {state.status === 'error' && <p className="leaderboard__note">{state.message}</p>}

      {state.status === 'ready' &&
        (state.board.entries.length === 0 ? (
          <p className="leaderboard__note">Nobody has solved it yet today. Be first.</p>
        ) : (
          <ol className="leaderboard">
            {state.board.entries.map((entry) => (
              <li
                key={`${entry.rank}-${entry.nickname}`}
                className={entry.nickname === nickname ? 'is-you' : undefined}
              >
                <span className="leaderboard__rank">{entry.rank}</span>
                <span className="leaderboard__name">
                  {entry.nickname}
                  {entry.hardMode && <span className="leaderboard__hard" title="Hard mode">*</span>}
                </span>
                <span className="leaderboard__score">{entry.guessCount}</span>
                <span className="leaderboard__time">{formatDuration(entry.durationMs)}</span>
              </li>
            ))}
          </ol>
        ))}
    </Modal>
  )
}

function useLeaderboard(open: boolean, length: WordLength): State {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setState({ status: 'loading' })

    // Sent explicitly rather than left to the server's default, so the board shown is
    // the one being played even if the two ever compute the day differently.
    void fetchLeaderboard(length, dayIndexFor())
      .then((board) => {
        if (!cancelled) setState({ status: 'ready', board })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            error instanceof ApiUnavailable
              ? 'No leaderboard on this deployment yet.'
              : error instanceof Error
                ? error.message
                : 'Could not load the leaderboard',
        })
      })

    return () => {
      cancelled = true
    }
  }, [open, length])

  return state
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
