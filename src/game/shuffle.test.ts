import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shuffled } from './shuffle.ts'

const items = Array.from({ length: 50 }, (_, index) => index)

test('the same seed always gives the same order', () => {
  assert.deepEqual(shuffled(items, 123), shuffled(items, 123))
})

test('different seeds give different orders', () => {
  assert.notDeepEqual(shuffled(items, 123), shuffled(items, 124))
})

test('every item survives, exactly once', () => {
  assert.deepEqual([...shuffled(items, 7)].sort((a, b) => a - b), items)
})

test('the input is left alone', () => {
  const original = [...items]
  shuffled(items, 7)
  assert.deepEqual(items, original)
})

test('the order actually changes', () => {
  // A shuffle that returned its input would satisfy every test above.
  assert.notDeepEqual(shuffled(items, 7), items)
})
