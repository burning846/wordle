/**
 * Applies api/_lib/schema.sql to the database in DATABASE_URL.
 *
 * The schema is written to be re-runnable, so this is safe to repeat after a deploy.
 * Run with: npm run migrate
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Copy it from the Neon tab in your Vercel project.')
  process.exit(1)
}

const schema = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../api/_lib/schema.sql'),
  'utf8',
)

const sql = neon(url)
// Split on blank lines between statements: the HTTP driver takes one at a time.
const statements = schema
  .split(/;\s*\n/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith('--'))

for (const statement of statements) {
  await sql.query(statement)
  console.log('✓', statement.split('\n')[0].slice(0, 70))
}

console.log(`\napplied ${statements.length} statements`)
