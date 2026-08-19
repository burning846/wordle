import { getDatabase } from './_lib/db.ts'
import { authenticate, error, json, readJson } from './_lib/http.ts'
import { validateResult } from './_lib/validate.ts'

/**
 * Records a finished game. The submission is replayed server-side before it is
 * stored, so the leaderboard is built from grids that are at least internally
 * coherent rather than from whatever a client felt like posting.
 */
export async function POST(request: Request): Promise<Response> {
  const db = getDatabase()
  const player = await authenticate(request, db)
  if (!player) return error('unknown device', 401)

  const validation = validateResult(await readJson(request))
  if (!validation.ok) return error(validation.error, 422)

  const { result, answer } = validation

  const rows = await db.query<{ id: string }>(
    `insert into results
       (player_id, mode, length, difficulty, day_index, answer, guesses, won, hard_mode, duration_ms)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict do nothing
     returning id`,
    [
      player.id,
      result.mode,
      result.length,
      result.difficulty,
      result.dayIndex,
      answer,
      result.guesses,
      result.won,
      result.hardMode,
      result.durationMs,
    ],
  )

  // The unique index turns a replayed daily submission into a no-op rather than an
  // error: the client may retry after a dropped connection.
  const stored = rows.length > 0
  return json({ stored, guessCount: result.guesses.length }, stored ? 201 : 200)
}
