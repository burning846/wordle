import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { revealDurationFor } from '../game/animation.ts'
import { dailyAnswer, dayIndexFor, msUntilNextPuzzle, randomAnswer } from '../game/daily.ts'
import { loadDictionary, type Dictionary } from '../game/dictionary.ts'
import {
  backspaceDraft,
  draftFrom,
  draftWord,
  emptyDraft,
  typeIntoDraft,
  type Draft,
} from '../game/draft.ts'
import { hardModeViolation, keyboardStates, knownLetters } from '../game/evaluate.ts'
import { loadStats, recordResult, type Stats } from '../game/stats.ts'
import { readJson, removeKey, writeJson } from '../game/storage.ts'
import {
  limitFor,
  rowsFor,
  type GameMode,
  type GameSnapshot,
  type LetterState,
  type WordLength,
} from '../game/types.ts'

const WIN_MESSAGES = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew', 'Nice']
const TOAST_MS = 1800

function gameKey(mode: GameMode, length: WordLength): string {
  return `wordle:game:${mode}:${length}`
}

/** Guards against a stored game from an older build or a hand-edited value. */
function isPlayable(
  snapshot: GameSnapshot | null,
  dictionary: Dictionary,
  mode: GameMode,
  length: WordLength,
  limit: number | null,
): snapshot is GameSnapshot {
  if (!snapshot) return false
  const { answer, guesses, status } = snapshot
  return (
    snapshot.mode === mode &&
    snapshot.length === length &&
    typeof answer === 'string' &&
    answer.length === dictionary.length &&
    Array.isArray(guesses) &&
    (limit === null || guesses.length <= limit) &&
    guesses.every((guess) => typeof guess === 'string' && guess.length === dictionary.length) &&
    (status === 'playing' || status === 'won' || status === 'lost')
  )
}

function startGame(dictionary: Dictionary, mode: GameMode, length: WordLength): GameSnapshot {
  const stored = readJson<GameSnapshot>(gameKey(mode, length))
  const limit = limitFor(mode, length)

  if (mode === 'daily') {
    const dayIndex = dayIndexFor()
    const answer = dailyAnswer(dictionary, dayIndex)
    // Resume only the puzzle for today; yesterday's board is gone.
    if (
      isPlayable(stored, dictionary, mode, length, limit) &&
      stored.dayIndex === dayIndex &&
      stored.answer === answer
    ) {
      return stored
    }
    return { answer, guesses: [], status: 'playing', dayIndex, mode, length }
  }

  if (isPlayable(stored, dictionary, mode, length, limit)) return stored
  return {
    answer: randomAnswer(dictionary),
    guesses: [],
    status: 'playing',
    dayIndex: null,
    mode,
    length,
  }
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
  /** The row being typed, as one slot per position. */
  draft: Draft
  /** Letters proven to sit at each position; these seed each new row. */
  greens: (string | null)[]
  /** Index of the row mid-flip, or -1 when nothing is animating. */
  revealingRow: number
  /** Which row was rejected, and a token bumped each time so the shake can replay. */
  shake: Shake
  keyStates: Record<string, LetterState>
  /** Rows the board should render, which grows as practice guesses pile up. */
  rows: number
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
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(length))
  const [revealingRow, setRevealingRow] = useState(-1)
  const [shake, setShake] = useState<Shake>(NO_SHAKE)
  const [toast, setToast] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>(() => loadStats(mode, length))
  const [resultOpen, setResultOpen] = useState(false)

  const dictionaryRef = useRef<Dictionary | null>(null)
  const snapshotRef = useRef<GameSnapshot | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const revealTimer = useRef<number | undefined>(undefined)

  /**
   * Mirrors `draft` eagerly. React batches state updates, so a player who types the
   * last letter and hits Enter inside the same batch would otherwise submit the draft
   * as it stood one keystroke ago.
   */
  const draftRef = useRef<Draft>(emptyDraft(length))

  const setDraftTo = useCallback((value: Draft) => {
    draftRef.current = value
    setDraft(value)
  }, [])

  const limit = limitFor(mode, length)

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

  /** A fresh row, pre-filled with whatever the guesses so far have pinned down. */
  const seededDraft = useCallback(
    (current: GameSnapshot) =>
      current.status === 'playing'
        ? draftFrom(knownLetters(current.guesses, current.answer, length))
        : emptyDraft(length),
    [length],
  )

  // Load the dictionary for this length, then resume or start a game.
  useEffect(() => {
    let cancelled = false

    dictionaryRef.current = null
    setSnapshot(null)
    setDraftTo(emptyDraft(length))
    setRevealingRow(-1)
    setShake(NO_SHAKE)
    setResultOpen(false)
    setStats(loadStats(mode, length))

    void loadDictionary(length).then((dictionary) => {
      if (cancelled) return
      dictionaryRef.current = dictionary
      const started = startGame(dictionary, mode, length)
      setSnapshot(started)
      // A resumed game re-seeds its row, so greens survive a refresh.
      setDraftTo(seededDraft(started))
    })

    return () => {
      cancelled = true
      window.clearTimeout(revealTimer.current)
    }
  }, [mode, length, seededDraft, setDraftTo])

  useEffect(() => {
    // Mirrored for the rollover check below, which runs from timers and listeners
    // rather than from a render.
    snapshotRef.current = snapshot
    // The identity check matters on a mode or length switch: this effect re-runs with
    // the previous game still in state, which would otherwise clobber the new key.
    if (snapshot && snapshot.mode === mode && snapshot.length === length) {
      writeJson(gameKey(mode, length), snapshot)
    }
  }, [snapshot, mode, length])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  // A tab left open overnight should pick up the new daily puzzle.
  useEffect(() => {
    if (mode !== 'daily') return

    let rollover: number | undefined

    const check = () => {
      const dictionary = dictionaryRef.current
      const current = snapshotRef.current
      // Ignore a snapshot still belonging to the board we just switched away from.
      if (!dictionary || current?.mode !== mode || current.length !== length) return
      if (current.dayIndex === dayIndexFor()) return

      removeKey(gameKey(mode, length))
      setSnapshot(startGame(dictionary, mode, length))
      setDraftTo(emptyDraft(length))
      setRevealingRow(-1)
      setShake(NO_SHAKE)
      setResultOpen(false)
    }

    /**
     * A timer covers the tab that simply stays open past midnight, since neither
     * `focus` nor `visibilitychange` fires then. The listeners still matter: a
     * sleeping machine won't have run the timer on time.
     */
    const schedule = () => {
      // A second of slack so the clock has definitely crossed over.
      rollover = window.setTimeout(() => {
        check()
        schedule()
      }, msUntilNextPuzzle() + 1000)
    }

    schedule()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)

    return () => {
      window.clearTimeout(rollover)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [length, mode, setDraftTo])

  const submit = useCallback(() => {
    const dictionary = dictionaryRef.current
    if (!dictionary || !snapshot || snapshot.status !== 'playing' || revealingRow >= 0) return

    const guess = draftWord(draftRef.current)
    const row = snapshot.guesses.length
    if (guess.length < length) return reject('Not enough letters', row)
    if (!dictionary.guesses.has(guess)) return reject('Not in word list', row)

    if (hardMode) {
      const violation = hardModeViolation(guess, snapshot.guesses, snapshot.answer)
      if (violation) return reject(violation, row)
    }

    const guesses = [...snapshot.guesses, guess]
    const won = guess === snapshot.answer
    // Practice has no limit: a wrong guess just adds a row, so it is never lost.
    const status = won ? 'won' : limit !== null && guesses.length >= limit ? 'lost' : 'playing'
    const next: GameSnapshot = { ...snapshot, guesses, status }

    setSnapshot(next)
    setDraftTo(emptyDraft(length))
    setRevealingRow(guesses.length - 1)

    // Recorded here rather than in an effect so a resumed finished game is never counted twice.
    if (status !== 'playing') {
      setStats(recordResult(mode, length, { won, guessCount: guesses.length, dayIndex: snapshot.dayIndex }))
    }

    // Hold the verdict until the tiles have finished flipping.
    window.clearTimeout(revealTimer.current)
    revealTimer.current = window.setTimeout(() => {
      setRevealingRow(-1)
      // Seeding after the flip keeps the greens from appearing before they're revealed.
      setDraftTo(seededDraft(next))
      if (status === 'won') notify(WIN_MESSAGES[guesses.length - 1] ?? 'Solved')
      else if (status === 'lost') notify(snapshot.answer.toUpperCase())
      if (status !== 'playing') setResultOpen(true)
    }, revealDurationFor(length))
  }, [hardMode, length, limit, mode, notify, reject, revealingRow, seededDraft, setDraftTo, snapshot])

  const press = useCallback(
    (key: string) => {
      if (!snapshot || snapshot.status !== 'playing') return

      if (key === 'Enter') return submit()
      if (key === 'Backspace') return setDraftTo(backspaceDraft(draftRef.current))

      if (/^[a-zA-Z]$/.test(key)) {
        setDraftTo(typeIntoDraft(draftRef.current, key.toLowerCase()))
      }
    },
    [setDraftTo, snapshot, submit],
  )

  const newPracticeGame = useCallback(() => {
    const dictionary = dictionaryRef.current
    if (!dictionary) return

    window.clearTimeout(revealTimer.current)
    removeKey(gameKey('practice', length))
    setSnapshot({
      answer: randomAnswer(dictionary),
      guesses: [],
      status: 'playing',
      dayIndex: null,
      mode: 'practice',
      length,
    })
    setDraftTo(emptyDraft(length))
    setRevealingRow(-1)
    setShake(NO_SHAKE)
    setResultOpen(false)
  }, [length, setDraftTo])

  // The flipping row keeps its keys uncoloured until the reveal lands.
  const revealed = useMemo(() => {
    if (!snapshot) return []
    return revealingRow >= 0 ? snapshot.guesses.slice(0, revealingRow) : snapshot.guesses
  }, [revealingRow, snapshot])

  const keyStates = useMemo(
    () => (snapshot ? keyboardStates(revealed, snapshot.answer) : {}),
    [revealed, snapshot],
  )

  const greens = useMemo(
    () => (snapshot ? knownLetters(revealed, snapshot.answer, length) : []),
    [length, revealed, snapshot],
  )

  return {
    loading: snapshot === null,
    snapshot,
    draft,
    greens,
    revealingRow,
    shake,
    keyStates,
    rows: rowsFor(
      mode,
      length,
      snapshot?.guesses.length ?? 0,
      snapshot !== null && snapshot.status !== 'playing',
    ),
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
