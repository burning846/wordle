import { getDatabase } from './_lib/db.ts'
import {
  createLinkCode,
  createToken,
  hashLinkCode,
  hashSecret,
  LINK_CODE_TTL_MS,
} from './_lib/identity.ts'
import { authenticate, error, json, readJson } from './_lib/http.ts'

/**
 * Cross-device play without accounts.
 *
 * POST with a token issues a short-lived code on the device you already use; POST
 * with that code on a second device binds it to the same player. The code is
 * single-use and hashed at rest, so reading the database gives no way to take over
 * a player.
 */
export async function POST(request: Request): Promise<Response> {
  const db = getDatabase()
  const body = (await readJson(request)) as { code?: unknown } | null

  if (typeof body?.code === 'string' && body.code.trim() !== '') {
    return redeem(body.code, db)
  }

  const player = await authenticate(request, db)
  if (!player) return error('unknown device', 401)

  const code = createLinkCode()
  await db.query(
    `insert into link_codes (code_hash, player_id, expires_at)
       values ($1, $2, now() + ($3 || ' milliseconds')::interval)`,
    [hashLinkCode(code), player.id, String(LINK_CODE_TTL_MS)],
  )

  return json({ code, expiresInMs: LINK_CODE_TTL_MS })
}

async function redeem(code: string, db: ReturnType<typeof getDatabase>): Promise<Response> {
  // Claiming and marking used in one statement, so two devices racing the same code
  // cannot both win it.
  const [claimed] = await db.query<{ player_id: string }>(
    `update link_codes set used_at = now()
       where code_hash = $1 and used_at is null and expires_at > now()
       returning player_id`,
    [hashLinkCode(code)],
  )

  if (!claimed) return error('that code is wrong, used, or expired', 400)

  const token = createToken()
  await db.query('insert into devices (token_hash, player_id) values ($1, $2)', [
    hashSecret(token),
    claimed.player_id,
  ])

  const [player] = await db.query<{ nickname: string }>(
    'select nickname from players where id = $1',
    [claimed.player_id],
  )

  return json({ playerId: claimed.player_id, nickname: player.nickname, token })
}
