import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

/** Route files under api/, by URL path. */
const ROUTES = ['register', 'link', 'results', 'leaderboard', 'me', 'health'] as const

type Handler = (request: Request) => Promise<Response>

/**
 * Serves the api/ routes from the dev server, backed by an on-disk Postgres compiled
 * to WebAssembly.
 *
 * Vite only serves the client, so without this `npm run dev` has no API at all and
 * the account features can only be exercised against a deployed database. This runs
 * the very same route modules Vercel will run, so what works here works there.
 *
 * Development only — `apply: 'serve'` keeps it out of the production build.
 */
export function devApi(): Plugin {
  return {
    name: 'wordle-dev-api',
    // Vitest counts as serve mode, and the database this opens would keep its process
    // alive after the tests finish.
    apply: (_config, env) => env.command === 'serve' && !process.env.VITEST,

    async configureServer(server: ViteDevServer) {
      const { PGlite } = await import('@electric-sql/pglite')
      // Kept on disk under .pglite so players and results survive a restart.
      const database = await PGlite.create('.pglite')
      try {
        await database.exec(readFileSync(new URL('../api/_lib/schema.sql', import.meta.url), 'utf8'))
      } catch (cause) {
        // Usually a new constraint that the accumulated development data violates.
        // Worth saying loudly, but not worth refusing to serve the game over.
        server.config.logger.warn(
          `  ➜  API:      schema not applied — ${(cause as Error).message}\n` +
            '             delete .pglite to start the development database over',
        )
      }

      const connection = {
        query: async (text: string, params: unknown[] = []) =>
          (await database.query(text, params as never[])).rows,
      }

      /**
       * Re-injected on every request rather than once at start-up. Editing anything in
       * the API's import graph makes Vite rebuild those modules, and the fresh copy of
       * db.ts has no database — which used to look like a deployment with DATABASE_URL
       * missing until the server was restarted.
       */
      const connect = async () => {
        const { setDatabase } = (await server.ssrLoadModule('/api/_lib/db.ts')) as {
          setDatabase: (db: typeof connection) => void
        }
        setDatabase(connection)
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const path = (req.url ?? '').split('?')[0]
        const name = path.startsWith('/api/') ? path.slice(5) : null
        if (!name || !ROUTES.includes(name as (typeof ROUTES)[number])) return next()

        try {
          await connect()
          const module = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<string, Handler>
          const handler = module[req.method ?? 'GET']
          if (!handler) {
            res.statusCode = 405
            return res.end(JSON.stringify({ error: `use ${Object.keys(module).join(' or ')}` }))
          }

          const response = await handler(await toRequest(req))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch (error) {
          server.config.logger.error(`dev-api ${name}: ${(error as Error).stack}`)
          res.statusCode = 500
          res.end(JSON.stringify({ error: (error as Error).message }))
        }
      })

      server.config.logger.info('  ➜  API:      /api/* (dev Postgres in .pglite)')
    },
  }
}

/** Node's request stream, as the Request object the route expects. */
async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)

  return new Request(`http://localhost${req.url ?? '/'}`, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value] as [string, string]] : [],
    ),
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  })
}
