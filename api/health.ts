import { getDatabase } from './_lib/db.ts'
import { json, route } from './_lib/http.ts'

/**
 * Diagnostics for a deployment that cannot be run locally.
 *
 * A 500 from a serverless function says nothing about which layer failed: the
 * runtime, the import graph, the environment, or the database. This answers all four
 * in one request, and deliberately reports only whether things are present and
 * working — never a value that would be worth stealing.
 */
export function GET(): Promise<Response> {
  return route(async () => {
    const url = process.env.DATABASE_URL

    let database = 'not configured'
    if (url) {
      try {
        const [row] = await getDatabase().query<{ tables: number }>(
          `select count(*)::int as tables
             from information_schema.tables
            where table_schema = 'public'
              and table_name in ('players', 'devices', 'link_codes', 'results')`,
        )
        database =
          row.tables === 4 ? 'ok' : `reachable, but ${row.tables}/4 tables exist — run npm run migrate`
      } catch (cause) {
        database = `unreachable: ${(cause as Error).message}`
      }
    }

    return json({
      ok: database === 'ok',
      runtime: process.version,
      // Host only, so the response can be pasted anywhere without leaking credentials.
      databaseUrl: url ? `set (${new URL(url).host})` : 'missing for this environment',
      database,
    })
  })
}
