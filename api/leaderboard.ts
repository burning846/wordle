import { getDatabase } from './_lib/db.js'
import { dayIndexFor } from '../src/game/daily.js'
import { error, json, route } from './_lib/http.js'
import { isWordLength } from '../src/game/types.js'
import type { LeaderboardRow } from '../src/game/api.js'

const MAX_ROWS = 50
const DEFAULT_ROWS = 20

/**
 * The day's ranking for one word length: fewest guesses first, then fastest. Losses
 * are left out — there is nothing to rank them by.
 */
export function GET(request: Request): Promise<Response> {
  return route(async () => {
    const params = new URL(request.url).searchParams
    const length = Number(params.get('length') ?? 5)
    if (!isWordLength(length)) return error('unsupported word length')

    // Clients pass their own day, since the puzzle rolls over at each player's local
    // midnight; the server's date is only a fallback.
    const requested = params.get('dayIndex')
    const dayIndex = requested === null ? dayIndexFor() : Number(requested)
    if (!Number.isInteger(dayIndex) || dayIndex < 0) return error('invalid day index')

    // Clamped at both ends: a negative limit is a Postgres error, and an unbounded
    // one is a public request for the whole table.
    const requestedLimit = Number(params.get('limit') ?? DEFAULT_ROWS)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_ROWS)
      : DEFAULT_ROWS

    const rows = await getDatabase().query<{
      nickname: string
      guess_count: number
      duration_ms: number | null
      hard_mode: boolean
    }>(
      `select p.nickname,
              cardinality(r.guesses) as guess_count,
              r.duration_ms,
              r.hard_mode
         from results r
         join players p on p.id = r.player_id
        where r.mode = 'daily' and r.won and r.day_index = $1 and r.length = $2
        -- Nulls last so a client that reported no timing never outranks one that did.
        order by guess_count asc, r.duration_ms asc nulls last, r.created_at asc
        limit $3`,
      [dayIndex, length, limit],
    )

    const entries: LeaderboardRow[] = rows.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      guessCount: Number(row.guess_count),
      durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
      hardMode: row.hard_mode,
    }))

    return json({ dayIndex, length, entries })
  })
}
