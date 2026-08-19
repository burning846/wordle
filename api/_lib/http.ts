import { getDatabase, type Database } from './db.js'
import { hashSecret } from './identity.js'

/**
 * A deployment that is missing something it needs, as opposed to a bug. Its message
 * is safe to show a caller: it names configuration, never internals.
 */
export class ConfigurationError extends Error {}

/**
 * Runs a route with an error boundary.
 *
 * An uncaught throw becomes Vercel's generic 500, which says nothing at all — and on
 * a deployment you cannot run locally, "500" is the least useful thing a server can
 * say. Configuration problems are named; anything else is logged for the runtime
 * logs and reported without internals.
 */
export async function route(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (cause) {
    if (cause instanceof ConfigurationError) {
      console.error('[api] configuration:', cause.message)
      return error(cause.message, 503)
    }
    console.error('[api] unhandled:', cause)
    return error('The server hit an unexpected error', 500)
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export interface Player {
  id: string
  nickname: string
}

/**
 * Resolves the bearer token to a player, and marks the device as seen.
 *
 * The token is hashed before it reaches the query, so a token can only be recognised,
 * never recovered from the database.
 */
export async function authenticate(
  request: Request,
  db: Database = getDatabase(),
): Promise<Player | null> {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) return null

  const rows = await db.query<Player>(
    `update devices set last_seen_at = now()
       where token_hash = $1
       returning (select id from players where players.id = devices.player_id) as id,
                 (select nickname from players where players.id = devices.player_id) as nickname`,
    [hashSecret(token)],
  )

  const player = rows[0] ?? null
  if (player) {
    await db.query('update players set last_seen_at = now() where id = $1', [player.id])
  }
  return player
}
