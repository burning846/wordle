import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { revealDurationFor } from '../game/animation'
import { dailyAnswer, dayIndexFor, randomAnswer } from '../game/daily'
import { loadDictionary, type Dictionary } from '../game/dictionary'
import { hardModeViolation, keyboardStates } from '../game/evaluate'
import { loadStats, recordResult, type Stats } from '../game/stats'
import { readJson, removeKey, writeJson } from '../game/storage'
import {
  maxGuessesFor,
  type GameMode,
  type GameSnapshot,
  type LetterState,
  type WordLength,
} from '../game/types'

const WIN_MESSAGES = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew', 'Nice']
const TOAST_MS = 1800

function gameKey(mode: GameMode, length: WordLength): string {
  return `wordle:game:${mode}:${length}`
}

/** Guards against a stored game from an older build or a hand-edited value. */
function isPlayable(snapshot: GameSnapshot | null, dictionary: Dictionary): snapshot is GameSnapshot {
  if (!snapshot) return false
  const { answer, guesses, status } = snapshot
  return (
    typeof answer === 'string' &&
    answer.length === dictionary.length &&
    Array.isArray(guesses) &&
    guesses.length <= maxGuessesFor(dictionary.length) &&
    guesses.every((guess) => typeof guess === 'string' && guess.length === dictionary.length) &&
    (status === 'playing' || status === 'won' || status === 'lost')
  )
}

function startGame(dictionary: Dictionary, mode: GameMode, length: WordLength): GameSnapshot {
  const stored = readJson<GameSnapshot>(gameKey(mode, length))

  if (mode === 'daily') {
    const dayIndex = dayIndexFor()
    const answer = dailyAnswer(dictionary, dayIndex)
    // Resume only the puzzle for today; yesterday's board is gone.
    if (isPlayable(stored, dictionary) && stored.dayIndex === dayIndex && stored.answer === answer) {
      return stored
    }
    return { answer, guesses: [], status: 'playing', dayIndex }
  }

  if (isPlayable(stored, dictionary)) return stored
  return { answer: randomAnswer(dictionary), guesses: [], status: 'playing', dayIndex: null }
}

export interface Shake {
  row: number
  token: number
}

const NO_SHAKE: Shake = { row: -1, token: 0 }

export interface GameOptions {
  mode: GameMode
  length: WordLength
  hardMode: boolean
}

export interface Game {
  loading: boolean
  snapshot: GameSnapshot | null
  /** Letters typed into the active row but not submitted. */
  draft: string
  /** Index of the row mid-flip, or -1 when nothing is animating. */
  revealingRow: number
  /** Which row was rejected, and a token bumped each time so the shake can replay. */
  shake: Shake
  keyStates: Record<string, LetterState>
  maxGuesses: number
  stats: Stats
  toast: string | null
  resultOpen: boolean
  closeResult: () => void
  openResult: () => void
  press: (key: string) => void
  newPracticeGame: () => void
  notify: (message: string) => void
}

export function useGame({ mode, length, hardMode }: GameOptions): Game {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [draft, setDraft] = useState('')
  const [revealingRow, setRevealingRow] = useState(-1)
  const [shake, setShake] = useState<Shake>(NO_SHAKE)
  const [toast, setToast] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>(() => loadStats(mode, length))
  const [resultOpen, setResultOpen] = useState(false)

  const dictionaryRef = useRef<Dictionary | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const revealTimer = useRef<number | undefined>(undefined)

  /**
   * Mirrors `draft` eagerly. React batches state updates, so a player who types the
   * last letter and hits Enter inside the same batch would otherwise submit the draft
   * as it stood one keystroke ago.
   */
  const draftRef = useRef('')

  const setDraftTo = useCallback((value: string) => {
    draftRef.current = value
    setDraft(value)
  }, [])

  const maxGuesses = maxGuessesFor(length)

  const notify = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const reject = useCallback(
    (message: string, row: number) => {
      notify(message)
      setShake((current) => ({ row, token: current.token + 1 }))
    },
    [notify],
  )

  // Load the dictionary for this length, then resume or start a game.
  useEffect(() => {
    let cancelled = false

    dictionaryRef.current = null
    setSnapshot(null)
    setDraftTo('')
    setRevealingRow(-1)
    setShake(NO_SHAKE)
    setResultOpen(false)
    setStats(loadStats(mode, length))

    void loadDictionary(length).then((dictionary) => {
      if (cancelled) return
      dictionaryRef.current = dictionary
      setSnapshot(startGame(dictionary, mode, length))
    })

    return () => {
      cancelled = true
      window.clearTimeout(revealTimer.current)
    }
  }, [mode, length])

  useEffect(() => {
    if (snapshot) writeJson(gameKey(mode, length), snapshot)
  }, [snapshot, mode, length])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  // A tab left open overnight should pick up the new daily puzzle.
  useEffect(() => {
    if (mode !== 'daily') return

    const check = () => {
      const dictionary = dictionaryRef.current
      if (!dictionary || document.hidden) return
      setSnapshot((current) => {
        if (!current || current.dayIndex === dayIndexFor()) return current
        removeKey(gameKey(mode, length))
        setDraftTo('')
        setRevealingRow(-1)
        setShake(NO_SHAKE)
        setResultOpen(false)
        return startGame(dictionary, mode, length)
      })
    }

    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [mode, length])

  const submit = useCallback(() => {
    const dictionary = dictionaryRef.current
    if (!dictionary || !snapshot || snapshot.status !== 'playing' || revealingRow >= 0) return

    const guess = draftRef.current
    const row = snapshot.guesses.length
    if (guess.length < length) return reject('Not enough letters', row)
    if (!dictionary.guesses.has(guess)) return reject('Not in word list', row)

    if (hardMode) {
      const violation = hardModeViolation(guess, snapshot.guesses, snapshot.answer)
      if (violation) return reject(violation, row)
    }

    const guesses = [...snapshot.guesses, guess]
    const won = guess === snapshot.answer
    const status = won ? 'won' : guesses.length >= maxGuesses ? 'lost' : 'playing'

    setSnapshot({ ...snapshot, guesses, status })
    setDraftTo('')
    setRevealingRow(guesses.length - 1)

    // Recorded here rather than in an effect so a resumed finished game is never counted twice.
    if (status !== 'playing') {
      setStats(recordResult(mode, length, { won, guessCount: guesses.length, dayIndex: snapshot.dayIndex }))
    }

    // Hold the verdict until the tiles have finished flipping.
    window.clearTimeout(revealTimer.current)
    revealTimer.current = window.setTimeout(() => {
      setRevealingRow(-1)
      if (status === 'won') notify(WIN_MESSAGES[guesses.length - 1] ?? 'Great')
      else if (status === 'lost') notify(snapshot.answer.toUpperCase())
      if (status !== 'playing') setResultOpen(true)
    }, revealDurationFor(length))
  }, [hardMode, length, maxGuesses, mode, notify, reject, revealingRow, setDraftTo, snapshot])

  const press = useCallback(
    (key: string) => {
      if (!snapshot || snapshot.status !== 'playing') return

      if (key === 'Enter') return submit()
      if (key === 'Backspace') return setDraftTo(draftRef.current.slice(0, -1))

      if (/^[a-zA-Z]$/.test(key) && draftRef.current.length < length) {
        setDraftTo(draftRef.current + key.toLowerCase())
      }
    },
    [length, setDraftTo, snapshot, submit],
  )

  const newPracticeGame = useCallback(() => {
    const dictionary = dictionaryRef.current
    if (!dictionary) return

    window.clearTimeout(revealTimer.current)
    removeKey(gameKey('practice', length))
    setSnapshot({ answer: randomAnswer(dictionary), guesses: [], status: 'playing', dayIndex: null })
    setDraftTo('')
    setRevealingRow(-1)
    setShake(NO_SHAKE)
    setResultOpen(false)
  }, [length, setDraftTo])

  // The flipping row keeps its keys uncoloured until the reveal lands.
  const keyStates = useMemo(() => {
    if (!snapshot) return {}
    const revealed = revealingRow >= 0 ? snapshot.guesses.slice(0, revealingRow) : snapshot.guesses
    return keyboardStates(revealed, snapshot.answer)
  }, [revealingRow, snapshot])

  return {
    loading: snapshot === null,
    snapshot,
    draft,
    revealingRow,
    shake,
    keyStates,
    maxGuesses,
    stats,
    toast,
    resultOpen,
    closeResult: useCallback(() => setResultOpen(false), []),
    openResult: useCallback(() => setResultOpen(true), []),
    press,
    newPracticeGame,
    notify,
  }
}
