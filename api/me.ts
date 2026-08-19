import { getDatabase } from './_lib/db.js'
import { authenticate, error, json, route } from './_lib/http.js'
import type { HistoryEntry, Totals } from '../src/game/api.js'

const HISTORY_LIMIT = 60

/**
 * Everything the player's own history page needs: who they are, their totals per
 * board, and their recent games. Totals are aggregated in the database rather than
 * derived from the history rows, so the numbers stay right past the history limit.
 */
export function GET(request: Request): Promise<Response> {
  return route(async () => {
    const db = getDatabase()
    const player = await authenticate(request, db)
    if (!player) return error('unknown device', 401)

    const totals = await db.query<Totals & { played: string; won: string }>(
      `select mode,
              length,
              difficulty,
              count(*) as played,
              count(*) filter (where won) as won,
              min(cardinality(guesses)) filter (where won) as "bestGuessCount",
              round(avg(cardinality(guesses)) filter (where won), 2) as "averageGuessCount"
         from results
        where player_id = $1
        group by mode, length, difficulty
        order by mode, length, difficulty`,
      [player.id],
    )

    const history = await db.query<HistoryEntry>(
      `select mode,
              length,
              difficulty,
              day_index as "dayIndex",
              answer,
              guesses,
              won,
              hard_mode as "hardMode",
              duration_ms as "durationMs",
              created_at as "playedAt"
         from results
        where player_id = $1
        order by created_at desc
        limit $2`,
      [player.id, HISTORY_LIMIT],
    )

    return json({
      player,
      // Postgres returns counts as strings over the wire; the client wants numbers.
      totals: totals.map((row) => ({
        ...row,
        played: Number(row.played),
        won: Number(row.won),
        bestGuessCount: row.bestGuessCount === null ? null : Number(row.bestGuessCount),
        averageGuessCount: row.averageGuessCount === null ? null : Number(row.averageGuessCount),
      })),
      history,
    })
  })
}
