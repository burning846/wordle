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
  await sql.query(statement)
  console.log('✓', statement.split('\n')[0].slice(0, 70))
}

console.log(`\napplied ${statements.length} statements`)
