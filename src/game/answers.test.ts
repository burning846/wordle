import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { WORD_LENGTHS, type WordLength } from './types.ts'

/** The committed word lists, read straight from disk rather than through Vite. */
const read = (name: string) =>
  readFileSync(new URL(`../data/${name}.txt`, import.meta.url), 'utf8').split('\n').filter(Boolean)

const answers = (length: WordLength) => read(`answers-${length}`)
const guesses = (length: WordLength) => new Set(read(`guesses-${length}`))

test('every answer is also an accepted guess', () => {
  for (const length of WORD_LENGTHS) {
    const accepted = guesses(length)
    const missing = answers(length).filter((word) => !accepted.has(word))
    assert.deepEqual(missing, [], `length ${length}`)
  }
})

test('answers are the right length and lowercase', () => {
  for (const length of WORD_LENGTHS) {
    const wrong = answers(length).filter((word) => !new RegExp(`^[a-z]{${length}}$`).test(word))
    assert.deepEqual(wrong, [], `length ${length}`)
  }
})

test('answers hold no duplicates', () => {
  for (const length of WORD_LENGTHS) {
    const pool = answers(length)
    assert.equal(new Set(pool).size, pool.length, `length ${length}`)
  }
})

test('inflected forms are not answers', () => {
  const pool = new Set(WORD_LENGTHS.flatMap(answers))
  for (const word of ['books', 'birds', 'going', 'asked', 'voted', 'tries', 'dying', 'wives']) {
    assert.ok(!pool.has(word), `${word} should have been filtered out`)
  }
})

test('words that only look inflected are kept', () => {
  // The filter strips a suffix only when a real word remains, so these must survive.
  const pool = new Set(WORD_LENGTHS.flatMap(answers))
  for (const word of ['thing', 'bring', 'speed', 'chaos', 'class', 'focus', 'need', 'king']) {
    assert.ok(pool.has(word), `${word} should have been kept`)
  }
})

test('no answer is the plural of another answer', () => {
  const pool = new Set(WORD_LENGTHS.flatMap(answers))
  const plurals = [...pool].filter((word) => word.endsWith('s') && pool.has(word.slice(0, -1)))
  assert.deepEqual(plurals, [])
})

test('plurals are still accepted as guesses', () => {
  // Filtering answers must never make a legitimate guess illegal.
  const accepted = guesses(5)
  for (const word of ['tears', 'walks', 'books', 'going', 'asked']) {
    assert.ok(accepted.has(word), `${word} should still be guessable`)
  }
})

test('each pool is large enough to keep the daily sequence fresh for years', () => {
  for (const length of WORD_LENGTHS) {
    assert.ok(answers(length).length > 600, `length ${length} pool is too small`)
  }
})
