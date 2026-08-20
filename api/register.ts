import { getDatabase, isUniqueViolation } from './_lib/db.js'
import { createToken, hashSecret } from './_lib/identity.js'
import { error, json, readJson, route } from './_lib/http.js'

const NICKNAME = /^[\p{L}\p{N} _-]{1,20}$/u

/** Trimmed, with runs of spaces collapsed, so "a  b" cannot sit beside "a b". */
function tidy(nickname: string): string {
  return nickname.trim().replace(/\s+/g, ' ')
}

/**
 * Creates a player and binds the calling device to it. There is no password: the
 * token returned here is the credential, stored in the browser and sent as a bearer
 * token from then on. A second device joins the same player through /api/link.
 */
export function POST(request: Request): Promise<Response> {
  return route(async () => {
    const body = (await readJson(request)) as { nickname?: unknown } | null
    const nickname = typeof body?.nickname === 'string' ? tidy(body.nickname) : ''
    if (!NICKNAME.test(nickname)) {
      return error('nickname must be 1-20 letters, numbers, spaces, hyphens or underscores')
    }

    const db = getDatabase()
    const token = createToken()

    // Left to the unique index rather than checked first: a prior SELECT would still
    // race two people registering the same name at the same moment.
    let player: { id: string }
    try {
      ;[player] = await db.query<{ id: string }>(
        'insert into players (nickname) values ($1) returning id',
        [nickname],
      )
    } catch (cause) {
      if (isUniqueViolation(cause)) return error(`"${nickname}" is taken — try another`, 409)
      throw cause
    }
    await db.query('insert into devices (token_hash, player_id) values ($1, $2)', [
      hashSecret(token),
      player.id,
    ])

    // The only time the raw token is ever transmitted.
    return json({ playerId: player.id, nickname, token }, 201)
  })
}
