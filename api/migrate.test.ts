import { readFileSync } from 'node:fs'
import { assert, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { splitStatements } from './_lib/schema.js'

const schema = readFileSync(new URL('./_lib/schema.sql', import.meta.url), 'utf8')

test('every statement in the schema survives the split', () => {
  const statements = splitStatements(schema)
  const created = statements.filter((statement) => /^create /i.test(statement))

  // Counted from the file rather than written down here, so adding a table cannot
  // make this pass by moving the goalposts. A splitter that drops a statement leaves
  // the migration silently incomplete, which is only discovered against a real
  // database.
  const inSource = (schema.replace(/--.*$/gm, '').match(/^\s*create /gim) ?? []).length
  assert.equal(created.length, inSource, statements.map((s) => s.split('\n')[0]).join('\n'))
  assert.ok(created.length >= 8, 'the schema should still have its four tables and indexes')
})

test('the migration builds the schema one statement at a time', async () => {
  // Exactly how the migration runs against Neon, whose HTTP driver takes one
  // statement per request.
  const db = await PGlite.create()
  for (const statement of splitStatements(schema)) {
    await db.query(statement)
  }

  const tables = await db.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' order by 1",
  )
  assert.deepEqual(
    tables.rows.map((row) => row.table_name),
    ['devices', 'link_codes', 'players', 'results'],
  )

  const indexes = await db.query<{ indexname: string }>(
    "select indexname from pg_indexes where schemaname = 'public' and indexname like '%results%' order by 1",
  )
  assert.ok(
    indexes.rows.some((row) => row.indexname === 'results_one_daily_per_player'),
    'the daily idempotency index must exist',
  )

  await db.close()
})

test('the migration is safe to run twice', async () => {
  const db = await PGlite.create()
  for (const pass of [1, 2]) {
    for (const statement of splitStatements(schema)) {
      await db.query(statement).catch((error: Error) => {
        throw new Error(`pass ${pass} failed: ${error.message}\n${statement.split('\n')[0]}`)
      })
    }
  }
  await db.close()
})
