import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

// storage.ts reads window.localStorage on each call, so an in-memory stand-in is
// enough. Installed before the dynamic import so nothing touches a missing global.
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

const { loadStats, recordResult, winPercentage } = await import('./stats.ts')

beforeEach(() => store.clear())

test('a fresh player has zeroed stats sized to the guess count', () => {
  const stats = loadStats('daily', 5)
  assert.equal(stats.played, 0)
  assert.equal(stats.currentStreak, 0)
  assert.equal(stats.distribution.length, 6)
  assert.equal(winPercentage(stats), 0)
})

test('a win lands in the right distribution bucket', () => {
  const stats = recordResult('daily', 5, { won: true, guessCount: 3, dayIndex: 10 })
  assert.deepEqual(stats.distribution, [0, 0, 1, 0, 0, 0])
  assert.equal(stats.played, 1)
  assert.equal(winPercentage(stats), 100)
})

test('consecutive days extend the streak', () => {
  recordResult('daily', 5, { won: true, guessCount: 4, dayIndex: 10 })
  const stats = recordResult('daily', 5, { won: true, guessCount: 2, dayIndex: 11 })
  assert.equal(stats.currentStreak, 2)
  assert.equal(stats.maxStreak, 2)
})

test('a skipped day restarts the streak at one', () => {
  recordResult('daily', 5, { won: true, guessCount: 4, dayIndex: 10 })
  recordResult('daily', 5, { won: true, guessCount: 4, dayIndex: 11 })
  const stats = recordResult('daily', 5, { won: true, guessCount: 4, dayIndex: 20 })
  assert.equal(stats.currentStreak, 1)
  assert.equal(stats.maxStreak, 2)
})

test('a loss clears the streak but keeps the record', () => {
  recordResult('daily', 5, { won: true, guessCount: 4, dayIndex: 10 })
  const stats = recordResult('daily', 5, { won: false, guessCount: 6, dayIndex: 11 })
  assert.equal(stats.currentStreak, 0)
  assert.equal(stats.maxStreak, 1)
  assert.equal(stats.played, 2)
  assert.equal(stats.won, 1)
})

test('the same daily puzzle is never counted twice', () => {
  // Two tabs finishing the same day would otherwise double the totals.
  recordResult('daily', 5, { won: true, guessCount: 3, dayIndex: 10 })
  const stats = recordResult('daily', 5, { won: true, guessCount: 3, dayIndex: 10 })
  assert.equal(stats.played, 1)
  assert.equal(stats.currentStreak, 1)
  assert.deepEqual(stats.distribution, [0, 0, 1, 0, 0, 0])
})

test('practice games accumulate without a day index', () => {
  recordResult('practice', 5, { won: true, guessCount: 2, dayIndex: null })
  const stats = recordResult('practice', 5, { won: true, guessCount: 2, dayIndex: null })
  assert.equal(stats.played, 2)
  assert.equal(stats.currentStreak, 2)
})

test('each length keeps its own stats', () => {
  recordResult('daily', 5, { won: true, guessCount: 3, dayIndex: 10 })
  assert.equal(loadStats('daily', 7).played, 0)
  assert.equal(loadStats('daily', 7).distribution.length, 8)
})
