import { assert, beforeEach, test } from 'vitest'
import { adoptFinishedDailies } from './sync.js'
import { loadStats } from './stats.js'
import type { HistoryEntry } from './api.js'

const store = new Map<string, string>()
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  },
  writable: true,
})

beforeEach(() => store.clear())

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  mode: 'daily',
  length: 5,
  difficulty: null,
  dayIndex: 100,
  answer: 'solve',
  guesses: ['crane', 'solve'],
  won: true,
  hardMode: false,
  durationMs: 40_000,
  playedAt: '2026-08-21T00:00:00Z',
  ...over,
})

const board = (length = 5) => store.get(`wordle:game:daily:${length}`)

test("today's finished daily is written to this device", () => {
  assert.equal(adoptFinishedDailies([entry()], 100), 1)

  const stored = JSON.parse(board() as string)
  assert.equal(stored.status, 'won')
  assert.equal(stored.answer, 'solve')
  assert.deepEqual(stored.guesses, ['crane', 'solve'])
  assert.equal(stored.puzzle.mode, 'daily')
})

test('a lost daily is adopted too, so it is not offered again', () => {
  adoptFinishedDailies([entry({ won: false, guesses: ['crane', 'slate'] })], 100)
  assert.equal(JSON.parse(board() as string).status, 'lost')
})

test('every length comes across', () => {
  adoptFinishedDailies([entry(), entry({ length: 7, answer: 'crystal' })], 100)
  assert.ok(board(5))
  assert.ok(board(7))
})

test('other days and practice games are left alone', () => {
  const adopted = adoptFinishedDailies(
    [entry({ dayIndex: 99 }), entry({ mode: 'practice', difficulty: 'easy', dayIndex: null })],
    100,
  )
  assert.equal(adopted, 0)
  assert.equal(board(), undefined)
})

test('a board already finished here is not rewritten', () => {
  adoptFinishedDailies([entry()], 100)
  const before = board()

  // The same result arriving again must not disturb what is already there.
  assert.equal(adoptFinishedDailies([entry({ guesses: ['other', 'solve'] })], 100), 0)
  assert.equal(board(), before)
})

test('a game in progress here gives way to the finished one', () => {
  // The player finished it elsewhere; this half-typed board is no longer playable.
  store.set(
    'wordle:game:daily:5',
    JSON.stringify({
      answer: 'solve',
      guesses: ['crane'],
      status: 'playing',
      dayIndex: 100,
      puzzle: { mode: 'daily', length: 5, difficulty: 'medium' },
    }),
  )

  assert.equal(adoptFinishedDailies([entry()], 100), 1)
  assert.equal(JSON.parse(board() as string).status, 'won')
})

test('an adopted result counts once, however many times it arrives', () => {
  adoptFinishedDailies([entry()], 100)
  adoptFinishedDailies([entry()], 100)

  const stats = loadStats({ mode: 'daily', length: 5, difficulty: 'medium' })
  assert.equal(stats.played, 1)
  assert.equal(stats.won, 1)
  assert.equal(stats.distribution[1], 1, 'a two-guess win belongs in the second bucket')
})
