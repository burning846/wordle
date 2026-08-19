import { assert, test } from 'vitest'
import { evaluateGuess, hardModeViolation, keyboardStates } from './evaluate.js'

const short = (states: string[]) => states.map((state) => state[0]).join('')

test('marks exact matches and misses', () => {
  assert.equal(short(evaluateGuess('crane', 'crane')), 'ccccc')
  assert.equal(short(evaluateGuess('mould', 'crane')), 'aaaaa')
})

test('marks letters in the wrong position as present', () => {
  assert.equal(short(evaluateGuess('acrid', 'crane')), 'pppaa')
})

test('an exact match claims the answer letter before an earlier duplicate', () => {
  // "llama" / "algae": the answer's single L is spent by the exact match at index 1,
  // so the leading L is absent. Both A's find one of the answer's two.
  assert.equal(short(evaluateGuess('llama', 'algae')), 'acpap')
})

test('a repeated guess letter only earns as many hints as the answer holds', () => {
  // One E in "abbey", so only the first E of "eerie" lights up.
  assert.equal(short(evaluateGuess('eerie', 'abbey')), 'paaaa')
})

test('duplicates in the answer can both be found', () => {
  // "sense" / "geese": the E's at 1 and 4 and the S at 3 land exactly, which leaves
  // the answer with no spare E for the guess's middle stretch.
  assert.equal(short(evaluateGuess('sense', 'geese')), 'acacc')
})

test('keyboard keeps the best state per letter', () => {
  // E is present in the first guess and correct in the second — correct wins.
  const states = keyboardStates(['crane', 'excel'], 'eagle')
  assert.equal(states.e, 'correct')
  assert.equal(states.a, 'present')
  assert.equal(states.r, 'absent')
})

test('hard mode allows a guess that reuses every hint', () => {
  assert.equal(hardModeViolation('eagle', ['crane'], 'eagle'), null)
})

test('hard mode requires known positions to stay put', () => {
  // "crane" against "trace" pins R at index 1; "audio" moves it.
  assert.equal(hardModeViolation('audio', ['crane'], 'trace'), '2nd letter must be R')
})

test('hard mode requires revealed letters to reappear', () => {
  // "steam" against "glade" reveals E and A with nothing in place; "brick" drops both.
  assert.equal(hardModeViolation('brick', ['steam'], 'glade'), 'Guess must contain E')
})

test('hard mode counts repeated hints', () => {
  // "alley" against "lapel" reveals two L's, so "angel" with one is not enough.
  assert.equal(hardModeViolation('angel', ['alley'], 'lapel'), 'Guess must contain 2 L')
})
