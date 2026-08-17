import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  backspaceDraft,
  draftFrom,
  draftWord,
  emptyDraft,
  typeIntoDraft,
  type Draft,
} from './draft.ts'
import { knownLetters } from './evaluate.ts'

const show = (draft: Draft) => draft.slots.map((letter) => letter ?? '_').join('')

const typeAll = (draft: Draft, word: string) =>
  [...word].reduce((current, letter) => typeIntoDraft(current, letter), draft)

test('typing fills left to right', () => {
  assert.equal(show(typeAll(emptyDraft(5), 'cra')), 'cra__')
  assert.equal(draftWord(typeAll(emptyDraft(5), 'crane')), 'crane')
})

test('a full row ignores further letters', () => {
  const full = typeAll(emptyDraft(4), 'nope')
  assert.equal(show(typeIntoDraft(full, 'x')), 'nope')
})

test('typing skips over pre-filled positions', () => {
  // S and E are known; the three letters typed land in the gap between them.
  const seeded = draftFrom(['s', null, null, null, 'e'])
  assert.equal(show(seeded), 's___e')
  assert.equal(draftWord(typeAll(seeded, 'olv')), 'solve')
})

test('backspace undoes the most recent letter, not the rightmost', () => {
  // With E pre-filled at the end, backspace must take the L that was just typed.
  const draft = typeAll(draftFrom([null, null, null, null, 'e']), 'slat')
  assert.equal(show(draft), 'slate')
  assert.equal(show(backspaceDraft(draft)), 'sla_e')
})

test('pre-filled letters can be cleared once nothing newer remains', () => {
  let draft = draftFrom(['s', null, null, null, 'e'])
  draft = typeAll(draft, 'olv')
  for (let i = 0; i < 3; i++) draft = backspaceDraft(draft)
  assert.equal(show(draft), 's___e')

  // The hints go last, newest first: E was seeded after S.
  assert.equal(show(backspaceDraft(draft)), 's____')
  assert.equal(show(backspaceDraft(backspaceDraft(draft))), '_____')
})

test('backspace on an empty row is a no-op', () => {
  assert.equal(show(backspaceDraft(emptyDraft(5))), '_____')
})

test('a row with gaps yields a word shorter than the board', () => {
  const draft = typeAll(draftFrom([null, null, null, null, 'e']), 'cr')
  // "cre" is 3 letters against a 5-letter board, so it reads as not enough letters.
  assert.equal(draftWord(draft), 'cre')
})

test('known letters collect greens from every guess', () => {
  // "crane" pins E at index 4 against "solve"; "spine" adds S at index 0.
  assert.deepEqual(knownLetters(['crane', 'spine'], 'solve', 5), ['s', null, null, null, 'e'])
})

test('known letters ignore yellows', () => {
  // Only the E of "oxide" is in place; its O appears in "solve" but at another index.
  assert.deepEqual(knownLetters(['oxide'], 'solve', 5), [null, null, null, null, 'e'])
})

test('a fresh board pins nothing', () => {
  assert.deepEqual(knownLetters([], 'solve', 5), [null, null, null, null, null])
})
