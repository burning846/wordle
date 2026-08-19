import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DIFFICULTIES, poolFor, tierBounds, TIER_SHARES } from './difficulty.ts'
import { puzzleKey, samePuzzle } from './types.ts'

/** Stands in for a frequency-ordered answer pool, most common first. */
const ranked = Array.from({ length: 9 }, (_, index) => `w${index}`)

test('tiers are equal slices of the frequency ranking', () => {
  assert.deepEqual(poolFor(ranked, 'easy'), ['w0', 'w1', 'w2'])
  assert.deepEqual(poolFor(ranked, 'medium'), ['w3', 'w4', 'w5'])
  assert.deepEqual(poolFor(ranked, 'hard'), ['w6', 'w7', 'w8'])
})

test('every word belongs to exactly one tier', () => {
  const combined = DIFFICULTIES.flatMap((difficulty) => poolFor(ranked, difficulty))
  assert.deepEqual(combined, ranked)
})

test('an uneven pool still covers every word and leaves no tier empty', () => {
  // 10 words over 3 tiers: the rounding has to land on the last tier, not drop words.
  const uneven = Array.from({ length: 10 }, (_, index) => index)
  const tiers = DIFFICULTIES.map((difficulty) => poolFor(uneven, difficulty))
  assert.deepEqual(tiers.flat(), uneven)
  for (const tier of tiers) assert.ok(tier.length > 0)
})

const realAnswers = () =>
  readFileSync(new URL('../data/answers-5.txt', import.meta.url), 'utf8').split('\n').filter(Boolean)

test('the real pools are big enough that words rarely repeat', () => {
  const answers = realAnswers()
  for (const difficulty of DIFFICULTIES) {
    assert.ok(poolFor(answers, difficulty).length > 500, `${difficulty} tier is too small`)
  }
})

test('easy really is more common than hard', () => {
  const answers = realAnswers()
  // The file is frequency-ordered, so every easy word outranks every hard word.
  const easy = poolFor(answers, 'easy')
  const hard = poolFor(answers, 'hard')
  assert.ok(answers.indexOf(easy.at(-1) as string) < answers.indexOf(hard[0]))
})

test('practice stats and games are keyed per difficulty, daily is not', () => {
  const easy = { mode: 'practice', length: 5, difficulty: 'easy' } as const
  const hard = { mode: 'practice', length: 5, difficulty: 'hard' } as const
  assert.notEqual(puzzleKey(easy), puzzleKey(hard))
  assert.ok(!samePuzzle(easy, hard))

  // Daily ignores difficulty entirely: it is the same word for everyone.
  const a = { mode: 'daily', length: 5, difficulty: 'easy' } as const
  const b = { mode: 'daily', length: 5, difficulty: 'hard' } as const
  assert.equal(puzzleKey(a), puzzleKey(b))
  assert.ok(samePuzzle(a, b))
})

test('tier shares sum to the whole pool', () => {
  const total = Object.values(TIER_SHARES).reduce((sum, share) => sum + share, 0)
  assert.ok(Math.abs(total - 1) < 1e-9, `shares sum to ${total}, not 1`)
})

test('tiers tile the pool with no gap or overlap', () => {
  for (const total of [1, 2, 7, 100, 2012, 2013]) {
    let previousEnd = 0
    for (const difficulty of DIFFICULTIES) {
      const [start, end] = tierBounds(total, difficulty)
      assert.equal(start, previousEnd, `${difficulty} starts at ${start}, expected ${previousEnd}`)
      previousEnd = end
    }
    assert.equal(previousEnd, total, `tiers ended at ${previousEnd}, expected ${total}`)
  }
})

test('changing the shares moves the boundaries', () => {
  // Guards the wiring: with equal thirds, easy takes a third of the pool.
  const [start, end] = tierBounds(300, 'easy')
  assert.deepEqual([start, end], [0, 100])
})
