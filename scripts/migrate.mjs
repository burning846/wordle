/**
 * Applies api/_lib/schema.sql to the database in DATABASE_URL.
 *
 * The schema is written to be re-runnable, so this is safe to repeat after a deploy.
 * Run with: npm run migrate
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
// The .ts extension, unlike everywhere else: this script is run by node directly,
// which resolves the real file rather than the one TypeScript would emit.
import { splitStatements } from '../api/_lib/schema.ts'

// Convenience for local runs: .env is gitignored, so the connection string can live
// there instead of being retyped. A real environment variable still wins.
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env')

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is not set.\n' +
      'Copy the connection string from the Storage tab of your Vercel project, then either:\n' +
      "  echo \"DATABASE_URL='postgresql://...'\" > .env && npm run migrate\n" +
      "  DATABASE_URL='postgresql://...' npm run migrate",
  )
  process.exit(1)
}

const schema = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../api/_lib/schema.sql'),
  'utf8',
)

const sql = neon(url)
const statements = splitStatements(schema)

for (const statement of statements) {
  try {
    await sql.query(statement)
  } catch (cause) {
    if (/players_nickname_unique/.test(statement)) {
      const clashes = await sql.query(
        `select lower(nickname) as name, count(*)::int as players
           from players group by 1 having count(*) > 1 order by 2 desc`,
      )
      console.error(
        `\n✗ Nicknames are not unique yet, so the index cannot be created.\n` +
          clashes.map((row) => `    "${row.name}" is used by ${row.players} players`).join('\n') +
          '\n  Rename or merge those players, then run this again.\n',
      )
    }
    throw cause
  }
  console.log('✓', statement.split('\n')[0].slice(0, 70))
}

console.log(`\napplied ${statements.length} statements`)
