import { assert, test } from 'vitest'
import { dailyAnswer, dayIndexFor, formatCountdown, msUntilNextPuzzle, dailyNumber } from './daily.js'

const daily = ['crane', 'slate', 'audio']

/** An instant, written in the puzzle's own zone. */
const at = (iso: string) => new Date(`${iso}+08:00`)

test('the epoch is puzzle 1', () => {
  assert.equal(dayIndexFor(at('2026-01-01T00:00:00')), 0)
  assert.equal(dailyNumber(dayIndexFor(at('2026-01-01T00:00:00'))), 1)
})

test('day index advances one per day', () => {
  assert.equal(dayIndexFor(at('2026-01-02T00:00:00')), 1)
  assert.equal(dayIndexFor(at('2026-02-01T00:00:00')), 31)
})

test('the puzzle turns over at midnight UTC+8, not before', () => {
  assert.equal(dayIndexFor(at('2026-01-05T23:59:59')), 4)
  assert.equal(dayIndexFor(at('2026-01-06T00:00:00')), 5)
})

test('the index does not depend on the machine running it', () => {
  // The same instant, expressed in three zones: one puzzle day, whoever is asking.
  const instant = '2026-08-20T01:30:00'
  assert.equal(dayIndexFor(new Date(`${instant}+08:00`)), 231)
  assert.equal(dayIndexFor(new Date(`${instant}+08:00`)), dayIndexFor(new Date('2026-08-19T17:30:00Z')))
  assert.equal(dayIndexFor(new Date('2026-08-19T10:30:00-07:00')), 231)
})

test('daylight saving elsewhere cannot shift the day', () => {
  // UTC+8 has none, so these days are exactly 24 hours apart whatever the runtime does.
  assert.equal(dayIndexFor(at('2026-03-09T12:00:00')) - dayIndexFor(at('2026-03-08T12:00:00')), 1)
  assert.equal(dayIndexFor(at('2026-11-02T12:00:00')) - dayIndexFor(at('2026-11-01T12:00:00')), 1)
})

test('dates before the epoch clamp to the first puzzle', () => {
  assert.equal(dayIndexFor(at('2020-01-01T00:00:00')), 0)
})

test('answers cycle once the list runs out', () => {
  assert.equal(dailyAnswer(daily, 0), 'crane')
  assert.equal(dailyAnswer(daily, 3), 'crane')
  assert.equal(dailyAnswer(daily, 4), 'slate')
})

test('countdown is zero padded', () => {
  assert.equal(formatCountdown(0), '00:00:00')
  assert.equal(formatCountdown(3 * 3600_000 + 4 * 60_000 + 5_000), '03:04:05')
})

test('the countdown ends at the next midnight UTC+8', () => {
  const noon = at('2026-06-10T12:00:00')
  assert.equal(noon.getTime() + msUntilNextPuzzle(noon), at('2026-06-11T00:00:00').getTime())
})

test('the countdown is a full day at the moment one starts', () => {
  assert.equal(msUntilNextPuzzle(at('2026-06-10T00:00:00')), 24 * 3600_000)
})
