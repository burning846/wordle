import { getDatabase } from './_lib/db.ts'
import { createToken, hashSecret } from './_lib/identity.ts'
import { error, json, readJson } from './_lib/http.ts'

const NICKNAME = /^[\p{L}\p{N} _-]{1,20}$/u

/**
 * Creates a player and binds the calling device to it. There is no password: the
 * token returned here is the credential, stored in the browser and sent as a bearer
 * token from then on. A second device joins the same player through /api/link.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await readJson(request)) as { nickname?: unknown } | null
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''
  if (!NICKNAME.test(nickname)) {
    return error('nickname must be 1-20 letters, numbers, spaces, hyphens or underscores')
  }

  const db = getDatabase()
  const token = createToken()

  const [player] = await db.query<{ id: string }>(
    'insert into players (nickname) values ($1) returning id',
    [nickname],
  )
  await db.query('insert into devices (token_hash, player_id) values ($1, $2)', [
    hashSecret(token),
    player.id,
  ])

  // The only time the raw token is ever transmitted.
  return json({ playerId: player.id, nickname, token }, 201)
}
