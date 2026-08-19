import { getDatabase } from './_lib/db.ts'
import { authenticate, error, json } from './_lib/http.ts'

const HISTORY_LIMIT = 60

export interface HistoryEntry {
  mode: 'daily' | 'practice'
  length: number
  difficulty: string | null
  dayIndex: number | null
  answer: string
  guesses: string[]
  won: boolean
  hardMode: boolean
  durationMs: number | null
  playedAt: string
}

export interface Totals {
  mode: 'daily' | 'practice'
  length: number
  difficulty: string | null
  played: number
  won: number
  bestGuessCount: number | null
  averageGuessCount: number | null
}

/**
 * Everything the player's own history page needs: who they are, their totals per
 * board, and their recent games. Totals are aggregated in the database rather than
 * derived from the history rows, so the numbers stay right past the history limit.
 */
export async function GET(request: Request): Promise<Response> {
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
}
