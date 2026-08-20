import { readFileSync } from 'node:fs'
import { afterAll, assert, beforeAll, beforeEach, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { setDatabase } from './_lib/db.js'
import { dailyAnswer, dayIndexFor } from '../src/game/daily.js'
import { dailyOrder } from '../src/game/shuffle.js'
import { poolFor } from '../src/game/difficulty.js'
import { loadWords } from '../src/game/words.js'
import { POST as register } from './register.js'
import { POST as link } from './link.js'
import { POST as results } from './results.js'
import { GET as leaderboard } from './leaderboard.js'
import { GET as me } from './me.js'
import { GET as health } from './health.js'

/**
 * Runs the routes against a real Postgres compiled to WebAssembly, so the schema,
 * constraints and queries under test are the ones that ship — no stand-in for the
 * database.
 */
let pg: PGlite

beforeAll(async () => {
  pg = await PGlite.create()
  setDatabase({
    query: async (text, params = []) => (await pg.query(text, params)).rows as never[],
  })
})

afterAll(async () => {
  setDatabase(null)
  await pg.close()
})

beforeEach(async () => {
  await pg.exec('drop table if exists results, link_codes, devices, players cascade')
  await pg.exec(readFileSync(new URL('./_lib/schema.sql', import.meta.url), 'utf8'))
})

const post = (path: string, body: unknown, token?: string) =>
  new Request(`https://wordle.test/api/${path}`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  })

const get = (path: string, token?: string) =>
  new Request(`https://wordle.test/api/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

async function signUp(nickname: string) {
  const response = await register(post('register', { nickname }))
  assert.equal(response.status, 201, `register failed: ${await response.clone().text()}`)
  return (await response.json()) as {
    playerId: string
    token: string
    nickname: string
  }
}

/** A winning daily submission, solved in `guessCount` guesses. */
function dailyWin(
  length: 4 | 5 | 6 | 7,
  guessCount: number,
  durationMs = 60_000,
  // Each day has its own word, so a submission for another day needs that day's answer.
  dayIndex = dayIndexFor(),
) {
  const words = loadWords(length)
  const answer = dailyAnswer(dailyOrder(words.answers, length), dayIndex)
  const fillers = words.guesses.filter((word) => word !== answer).slice(0, guessCount - 1)
  return {
    mode: 'daily',
    length,
    difficulty: null,
    dayIndex,
    guesses: [...fillers, answer],
    won: true,
    hardMode: false,
    durationMs,
  }
}

test('health reports a working deployment', async () => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@db.example.com/neondb'
  const body = (await (await health()).json()) as Record<string, string | boolean>

  assert.equal(body.ok, true)
  assert.equal(body.database, 'ok')
  assert.match(String(body.databaseUrl), /^set \(db\.example\.com\)$/)
  // The password must never appear, since this response is meant to be pasted around.
  assert.notMatch(JSON.stringify(body), /pass@|:pass/)
})

test('health answers even with no database at all', async () => {
  setDatabase(null)
  const saved = process.env.DATABASE_URL
  delete process.env.DATABASE_URL

  try {
    const response = await health()
    assert.equal(response.status, 200, 'health must answer, not fail like the other routes')
    const body = (await response.json()) as Record<string, string | boolean>
    assert.equal(body.ok, false)
    assert.match(String(body.databaseUrl), /missing/)
    assert.match(String(body.database), /DATABASE_URL is not set/)
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved
    setDatabase({ query: async (text, params = []) => (await pg.query(text, params)).rows as never[] })
  }
})

test('health names a database that is missing its tables', async () => {
  await pg.exec('drop table if exists results, link_codes, devices, players cascade')
  const body = (await (await health()).json()) as Record<string, string | boolean>

  assert.equal(body.ok, false)
  assert.match(String(body.database), /0\/4 tables exist/)
})

test('a deployment with no database says so, rather than failing opaquely', async () => {
  // The state a fresh preview deploy is in before DATABASE_URL is set for it.
  setDatabase(null)
  const saved = process.env.DATABASE_URL
  delete process.env.DATABASE_URL

  try {
    const response = await register(post('register', { nickname: 'burning' }))
    assert.equal(response.status, 503)
    assert.match((await response.json() as { error: string }).error, /DATABASE_URL is not set/)
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved
    setDatabase({ query: async (text, params = []) => (await pg.query(text, params)).rows as never[] })
  }
})

test('an unexpected failure is caught and reported without internals', async () => {
  setDatabase({
    query: async () => {
      throw new Error('connection to 10.0.0.1:5432 refused (password=hunter2)')
    },
  })

  try {
    const response = await register(post('register', { nickname: 'burning' }))
    assert.equal(response.status, 500)
    const { error: message } = (await response.json()) as { error: string }
    assert.equal(message, 'The server hit an unexpected error')
    assert.notMatch(message, /hunter2|10\.0\.0\.1/, 'internals must not reach the client')
  } finally {
    setDatabase({ query: async (text, params = []) => (await pg.query(text, params)).rows as never[] })
  }
})

test('registering issues a token that identifies the player', async () => {
  const player = await signUp('burning')
  assert.match(player.playerId, /^[0-9a-f-]{36}$/)
  assert.ok(player.token.length > 20)

  const response = await me(get('me', player.token))
  assert.equal(response.status, 200)
  const body = (await response.json()) as { player: { nickname: string } }
  assert.equal(body.player.nickname, 'burning')
})

test('a nickname is required and bounded', async () => {
  for (const nickname of ['', '   ', 'x'.repeat(21), 'drop<table>']) {
    const response = await register(post('register', { nickname }))
    assert.equal(response.status, 400, `accepted ${JSON.stringify(nickname)}`)
  }
})

test('an unknown token is rejected', async () => {
  assert.equal((await me(get('me', 'not-a-real-token'))).status, 401)
  assert.equal((await me(get('me'))).status, 401)
})

test('a link code binds a second device to the same player', async () => {
  const first = await signUp('burning')

  const issued = await link(post('link', {}, first.token))
  assert.equal(issued.status, 200)
  const { code } = (await issued.json()) as { code: string }
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

  // Typed on the second device, spacing and casing as the player pleases.
  const redeemed = await link(post('link', { code: code.toLowerCase().replace(/-/g, ' ') }))
  assert.equal(redeemed.status, 200)
  const second = (await redeemed.json()) as {
    playerId: string
    token: string
    nickname: string
  }

  assert.equal(second.playerId, first.playerId, 'both devices should be the same player')
  assert.notEqual(second.token, first.token, 'each device gets its own token')
  assert.equal(second.nickname, 'burning')
})

test('a link code works only once', async () => {
  const player = await signUp('burning')
  const { code } = (await (await link(post('link', {}, player.token))).json()) as { code: string }

  assert.equal((await link(post('link', { code }))).status, 200)
  assert.equal((await link(post('link', { code }))).status, 409)
})

test('a redemption failure says which of the three things went wrong', async () => {
  const player = await signUp('burning')

  const unknown = await link(post('link', { code: 'AAAA-BBBB-CCCC' }))
  assert.equal(unknown.status, 404)
  assert.match(((await unknown.json()) as { error: string }).error, /No code like that/)

  const { code } = (await (await link(post('link', {}, player.token))).json()) as { code: string }
  await link(post('link', { code }))
  const reused = await link(post('link', { code }))
  assert.equal(reused.status, 409)
  assert.match(((await reused.json()) as { error: string }).error, /already been used/)

  const { code: stale } = (await (
    await link(post('link', {}, player.token))
  ).json()) as { code: string }
  await pg.exec("update link_codes set expires_at = now() - interval '1 minute' where used_at is null")
  const expired = await link(post('link', { code: stale }))
  assert.equal(expired.status, 410)
  assert.match(((await expired.json()) as { error: string }).error, /expired/)
})

test('an expired link code is refused', async () => {
  const player = await signUp('burning')
  await (await link(post('link', {}, player.token))).json()
  await pg.exec("update link_codes set expires_at = now() - interval '1 minute'")

  const { code } = (await (await link(post('link', {}, player.token))).json()) as { code: string }
  await pg.exec("update link_codes set expires_at = now() - interval '1 minute'")
  assert.equal((await link(post('link', { code }))).status, 410)
})

test('a valid daily result is stored', async () => {
  const player = await signUp('burning')
  const response = await results(post('results', dailyWin(5, 3), player.token))
  assert.equal(response.status, 201, await response.clone().text())

  const stored = await pg.query('select mode, length, won, cardinality(guesses) as n from results')
  assert.deepEqual(stored.rows, [{ mode: 'daily', length: 5, won: true, n: 3 }])
})

test('the same daily puzzle is only stored once', async () => {
  const player = await signUp('burning')
  const submission = dailyWin(5, 3)

  assert.equal((await results(post('results', submission, player.token))).status, 201)
  // A retry after a dropped connection must not double-count.
  assert.equal((await results(post('results', submission, player.token))).status, 200)

  const stored = await pg.query('select count(*) as n from results')
  assert.equal(Number((stored.rows[0] as { n: string }).n), 1)
})

test('a fabricated answer is refused', async () => {
  const player = await signUp('burning')
  const submission = { ...dailyWin(5, 2), guesses: ['crane', 'slate'] }

  const response = await results(post('results', submission, player.token))
  assert.equal(response.status, 422)
  assert.match(((await response.json()) as { error: string }).error, /outcome does not match/)
})

test('guesses have to be real words', async () => {
  const player = await signUp('burning')
  const win = dailyWin(5, 2)
  const submission = { ...win, guesses: ['zzzzz', win.guesses[1]] }

  const response = await results(post('results', submission, player.token))
  assert.equal(response.status, 422)
  assert.match(((await response.json()) as { error: string }).error, /not a word/)
})

test('a hard mode claim is checked, not taken on trust', async () => {
  // The marker shows on the leaderboard, so a normal-mode grid must not carry it.
  const player = await signUp('burning')
  const words = loadWords(5)
  const dayIndex = dayIndexFor()
  const answer = dailyAnswer(dailyOrder(words.answers, 5), dayIndex)

  // A second guess that throws away what the first revealed is not hard mode.
  const first = words.guesses.find(
    (word) => word !== answer && [...word].some((letter, i) => letter === answer[i]),
  ) as string
  const careless = words.guesses.find(
    (word) => word !== answer && word !== first && ![...word].some((l, i) => l === first[i]),
  ) as string

  const submission = {
    mode: 'daily',
    length: 5,
    difficulty: null,
    dayIndex,
    guesses: [first, careless, answer],
    won: true,
    hardMode: true,
    durationMs: 60_000,
  }

  const response = await results(post('results', submission, player.token))
  assert.equal(response.status, 422)
  assert.match(((await response.json()) as { error: string }).error, /not a hard mode game/)

  // The same grid is fine once it stops claiming hard mode.
  const honest = await results(post('results', { ...submission, hardMode: false }, player.token))
  assert.equal(honest.status, 201, await honest.clone().text())
})

test('an impossibly fast game is refused', async () => {
  const player = await signUp('burning')
  const response = await results(post('results', dailyWin(5, 4, 100), player.token))
  assert.equal(response.status, 422)
  assert.match(((await response.json()) as { error: string }).error, /impossibly fast/)
})

test("tomorrow's puzzle cannot be claimed early", async () => {
  // The puzzle day is fixed to UTC+8, so nobody is legitimately ahead of the server.
  const player = await signUp('burning')
  const submission = dailyWin(5, 3, 60_000, dayIndexFor() + 1)

  const response = await results(post('results', submission, player.token))
  assert.equal(response.status, 422)
  assert.match(((await response.json()) as { error: string }).error, /not been published/)
})

test('a practice answer must belong to the difficulty it claims', async () => {
  const player = await signUp('burning')
  const words = loadWords(5)
  const hardWord = poolFor(words.answers, 'hard')[0]

  const honest = {
    mode: 'practice',
    length: 5,
    difficulty: 'hard',
    dayIndex: null,
    guesses: ['crane', hardWord],
    won: true,
    hardMode: false,
    durationMs: 30_000,
  }
  assert.equal((await results(post('results', honest, player.token))).status, 201)

  const lying = { ...honest, difficulty: 'easy' }
  const response = await results(post('results', lying, player.token))
  assert.equal(response.status, 422)
  assert.match(((await response.json()) as { error: string }).error, /not in that difficulty/)
})

test('the leaderboard ranks by guesses, then by time', async () => {
  const fast = await signUp('fast')
  const lucky = await signUp('lucky')
  const slow = await signUp('slow')

  await results(post('results', dailyWin(5, 4, 40_000), fast.token))
  await results(post('results', dailyWin(5, 2, 90_000), lucky.token))
  await results(post('results', dailyWin(5, 4, 80_000), slow.token))

  const response = await leaderboard(get('leaderboard?length=5'))
  assert.equal(response.status, 200)
  const { entries } = (await response.json()) as {
    entries: { rank: number; nickname: string }[]
  }

  assert.deepEqual(
    entries.map((entry) => [entry.rank, entry.nickname]),
    [
      [1, 'lucky'],
      [2, 'fast'],
      [3, 'slow'],
    ],
  )
})

test('a malformed limit does not reach the database', async () => {
  // LIMIT -1 is a Postgres error, and this route is public.
  for (const limit of ['-1', '0', 'abc', '1e9', '']) {
    const response = await leaderboard(get(`leaderboard?length=5&limit=${limit}`))
    assert.equal(response.status, 200, `limit=${limit} should not fail`)
  }
})

test('the leaderboard never returns more rows than it caps', async () => {
  const player = await signUp('burning')
  await results(post('results', dailyWin(5, 3), player.token))

  const body = (await (
    await leaderboard(get('leaderboard?length=5&limit=9999'))
  ).json()) as { entries: unknown[] }
  assert.ok(body.entries.length <= 50)
})

test('the leaderboard keeps lengths and days apart', async () => {
  const player = await signUp('burning')
  await results(post('results', dailyWin(5, 3), player.token))

  const other = (await (await leaderboard(get('leaderboard?length=6'))).json()) as {
    entries: unknown[]
  }
  assert.deepEqual(other.entries, [])

  const yesterday = (await (
    await leaderboard(get(`leaderboard?length=5&dayIndex=${dayIndexFor() - 1}`))
  ).json()) as { entries: unknown[] }
  assert.deepEqual(yesterday.entries, [])
})

test('history and totals come back per board', async () => {
  const player = await signUp('burning')
  const words = loadWords(5)
  const easyWord = poolFor(words.answers, 'easy')[0]

  await results(post('results', dailyWin(5, 3), player.token))
  await results(
    post(
      'results',
      {
        mode: 'practice',
        length: 5,
        difficulty: 'easy',
        dayIndex: null,
        guesses: ['crane', easyWord],
        won: true,
        hardMode: false,
        durationMs: 20_000,
      },
      player.token,
    ),
  )

  const body = (await (await me(get('me', player.token))).json()) as {
    totals: {
      mode: string
      difficulty: string | null
      played: number
      won: number
      bestGuessCount: number
    }[]
    history: { mode: string; answer: string }[]
  }

  assert.equal(body.history.length, 2)
  assert.deepEqual(
    body.totals.map((t) => [t.mode, t.difficulty, t.played, t.won, t.bestGuessCount]),
    [
      ['daily', null, 1, 1, 3],
      ['practice', 'easy', 1, 1, 2],
    ],
  )
})

test('one player cannot see another player through their token', async () => {
  const mine = await signUp('mine')
  const theirs = await signUp('theirs')
  await results(post('results', dailyWin(5, 3), theirs.token))

  const body = (await (await me(get('me', mine.token))).json()) as {
    history: unknown[]
  }
  assert.deepEqual(body.history, [], 'history must be scoped to the caller')
})
