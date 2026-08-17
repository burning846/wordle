import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dailyAnswer, dayIndexFor, formatCountdown, msUntilNextPuzzle, puzzleNumber } from './daily.ts'
import type { Dictionary } from './dictionary.ts'

const dictionary: Dictionary = {
  length: 5,
  answers: ['crane', 'slate', 'audio'],
  guesses: new Set(['crane', 'slate', 'audio']),
}

test('the epoch is puzzle 1', () => {
  assert.equal(dayIndexFor(new Date(2026, 0, 1)), 0)
  assert.equal(puzzleNumber(dayIndexFor(new Date(2026, 0, 1))), 1)
})

test('day index advances one per calendar day', () => {
  assert.equal(dayIndexFor(new Date(2026, 0, 2)), 1)
  assert.equal(dayIndexFor(new Date(2026, 1, 1)), 31)
})

test('the time of day does not affect the index', () => {
  assert.equal(dayIndexFor(new Date(2026, 0, 5, 0, 0, 1)), dayIndexFor(new Date(2026, 0, 5, 23, 59, 59)))
})

test('a daylight-saving boundary still advances exactly one day', () => {
  // US DST starts 2026-03-08, making that local day 23 hours long.
  assert.equal(dayIndexFor(new Date(2026, 2, 9)) - dayIndexFor(new Date(2026, 2, 8)), 1)
})

test('dates before the epoch clamp to the first puzzle', () => {
  assert.equal(dayIndexFor(new Date(2020, 0, 1)), 0)
})

test('answers cycle once the list runs out', () => {
  assert.equal(dailyAnswer(dictionary, 0), 'crane')
  assert.equal(dailyAnswer(dictionary, 3), 'crane')
  assert.equal(dailyAnswer(dictionary, 4), 'slate')
})

test('countdown is zero padded', () => {
  assert.equal(formatCountdown(0), '00:00:00')
  assert.equal(formatCountdown(3 * 3600_000 + 4 * 60_000 + 5_000), '03:04:05')
})

test('the countdown ends at the next local midnight', () => {
  const noon = new Date(2026, 5, 10, 12, 0, 0)
  assert.equal(noon.getTime() + msUntilNextPuzzle(noon), new Date(2026, 5, 11).getTime())
})

test('the countdown follows daylight saving, not a flat 24 hours', () => {
  // Spring forward and fall back in the America/Los_Angeles zone the tests run in:
  // those local days are 23 and 25 hours long, so a fixed +24h would miss midnight.
  assert.equal(msUntilNextPuzzle(new Date(2026, 2, 8)), 23 * 3600_000)
  assert.equal(msUntilNextPuzzle(new Date(2026, 10, 1)), 25 * 3600_000)
})
