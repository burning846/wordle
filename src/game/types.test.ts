import assert from 'node:assert/strict'
import { test } from 'node:test'
import { guessLimitFor, limitFor, rowsFor } from './types.ts'

test('daily allows one guess more than the word is long', () => {
  assert.equal(guessLimitFor(5), 6)
  assert.equal(guessLimitFor(7), 8)
  assert.equal(limitFor('daily', 5), 6)
})

test('practice has no guess limit', () => {
  assert.equal(limitFor('practice', 5), null)
})

test('a daily board is a fixed height', () => {
  assert.equal(rowsFor('daily', 5, 0, false), 6)
  assert.equal(rowsFor('daily', 5, 6, true), 6)
})

test('a practice board starts at the daily height', () => {
  assert.equal(rowsFor('practice', 5, 0, false), 6)
  assert.equal(rowsFor('practice', 5, 4, false), 6)
})

test('a practice board grows a row per wrong guess past the start', () => {
  // Six wrong guesses leaves a seventh row to type in.
  assert.equal(rowsFor('practice', 5, 6, false), 7)
  assert.equal(rowsFor('practice', 5, 11, false), 12)
})

test('a solved practice board stops growing', () => {
  // Winning on the ninth guess needs nine rows, not a tenth empty one.
  assert.equal(rowsFor('practice', 5, 9, true), 9)
})
