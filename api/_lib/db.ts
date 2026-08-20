import { neon } from '@neondatabase/serverless'
import { ConfigurationError } from './http.js'

/**
 * The narrowest database interface the routes need: parameterised SQL in, rows out.
 *
 * Keeping it this small is what lets the tests run against an in-process Postgres
 * (PGlite) while production talks to Neon over HTTP — same SQL, same assertions, no
 * mock standing in for the database.
 */
export interface Database {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>
}

/** Postgres's unique_violation. Both drivers surface it on the error object. */
const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { code?: unknown }).code === UNIQUE_VIOLATION ||
      // PGlite reports it on a cause, and both spell it out in the message.
      (error as { cause?: { code?: unknown } }).cause?.code === UNIQUE_VIOLATION ||
      /duplicate key value/i.test(String((error as { message?: unknown }).message ?? '')))
  )
}

let database: Database | null = null

/** Tests inject their own Postgres here. */
export function setDatabase(next: Database | null): void {
  database = next
}

export function getDatabase(): Database {
  if (database) return database

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new ConfigurationError(
      'This deployment has no database: DATABASE_URL is not set for its environment',
    )
  }

  const sql = neon(url)
  database = {
    query: async <Row>(text: string, params: unknown[] = []) =>
      (await sql.query(text, params)) as Row[],
  }
  return database
}
