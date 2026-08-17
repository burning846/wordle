import { useEffect, useState } from 'react'
import { formatCountdown, msUntilNextPuzzle } from '../game/daily.ts'
import { buildShareText, copyToClipboard } from '../game/share.ts'
import { averageGuesses, winPercentage, type Stats } from '../game/stats.ts'
import type { GameMode, GameSnapshot, WordLength } from '../game/types.ts'
import { Modal } from './Modal.tsx'
import './StatsModal.css'

interface StatsModalProps {
  open: boolean
  onClose: () => void
  stats: Stats
  snapshot: GameSnapshot | null
  mode: GameMode
  length: WordLength
  hardMode: boolean
  highContrast: boolean
  onNewWord: () => void
  notify: (message: string) => void
}

export function StatsModal({
  open,
  onClose,
  stats,
  snapshot,
  mode,
  length,
  hardMode,
  highContrast,
  onNewWord,
  notify,
}: StatsModalProps) {
  const finished = snapshot !== null && snapshot.status !== 'playing'
  const highest = Math.max(1, ...stats.distribution)
  const currentBucket = snapshot?.status === 'won' ? snapshot.guesses.length : -1
  const countdown = useCountdown(open && finished && mode === 'daily')

  const share = async () => {
    if (!snapshot || snapshot.status === 'playing') return
    const text = buildShareText({
      mode,
      length,
      dayIndex: snapshot.dayIndex,
      guesses: snapshot.guesses,
      answer: snapshot.answer,
      status: snapshot.status,
      hardMode,
      highContrast,
    })
    notify((await copyToClipboard(text)) ? 'Copied to clipboard' : 'Copy failed')
  }

  return (
    <Modal open={open} title="Statistics" onClose={onClose}>
      {finished && snapshot && (
        <p className="stats__verdict">
          {snapshot.status === 'won' ? 'Solved in ' : 'The word was '}
          <strong>
            {snapshot.status === 'won'
              ? `${snapshot.guesses.length} ${snapshot.guesses.length === 1 ? 'guess' : 'guesses'}`
              : snapshot.answer.toUpperCase()}
          </strong>
        </p>
      )}

      {/* Practice can't be lost, so a win rate and streaks would always read 100% and
          "every game so far". Guess counts are the only meaningful measure there. */}
      <div className="stats__figures">
        <Figure value={stats.played} label="Played" />
        {mode === 'daily' ? (
          <>
            <Figure value={winPercentage(stats)} label="Win %" />
            <Figure value={stats.currentStreak} label="Current streak" />
            <Figure value={stats.maxStreak} label="Max streak" />
          </>
        ) : (
          <>
            <Figure value={stats.best ?? 0} label="Best" />
            <Figure value={averageGuesses(stats)} label="Average" />
          </>
        )}
      </div>

      <h3 className="stats__heading">Guess distribution</h3>
      {stats.won === 0 ? (
        <p className="stats__empty">No wins recorded for {length}-letter {mode} yet.</p>
      ) : (
        <div className="distribution">
          {stats.distribution.map((count, index) => (
            <div className="distribution__row" key={index}>
              {/* Practice's final bucket collects everything slower than it. */}
              <span className="distribution__label">
                {index + 1}
                {mode === 'practice' && index === stats.distribution.length - 1 ? '+' : ''}
              </span>
              <div className="distribution__track">
                <div
                  className={`distribution__bar${index + 1 === currentBucket ? ' is-current' : ''}`}
                  // A sliver of width keeps the count readable when the bar is zero.
                  style={{ width: `${Math.max(7, (count / highest) * 100)}%` }}
                >
                  {count}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {finished && (
        <div className="stats__footer">
          {mode === 'daily' ? (
            <div className="stats__next">
              <span>Next word</span>
              <strong>{countdown}</strong>
            </div>
          ) : (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                onNewWord()
                onClose()
              }}
            >
              New word
            </button>
          )}

          <button type="button" className="button button--primary" onClick={share}>
            Share
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        </div>
      )}
    </Modal>
  )
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="figure">
      <span className="figure__value">{value}</span>
      <span className="figure__label">{label}</span>
    </div>
  )
}

/** Ticks once a second while the modal is open; stays frozen otherwise. */
function useCountdown(active: boolean): string {
  const [remaining, setRemaining] = useState(() => msUntilNextPuzzle())

  useEffect(() => {
    if (!active) return
    setRemaining(msUntilNextPuzzle())
    const timer = window.setInterval(() => setRemaining(msUntilNextPuzzle()), 1000)
    return () => window.clearInterval(timer)
  }, [active])

  return formatCountdown(remaining)
}
