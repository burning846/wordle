/**
 * Splits schema.sql into the statements a driver can run one at a time.
 *
 * Neon's HTTP driver takes a single statement per request, so the file has to be cut
 * up. Comments are stripped before the split rather than filtered afterwards: every
 * table in this schema is introduced by a comment, and dropping "chunks that start
 * with --" silently drops the statement underneath it too.
 */
export function splitStatements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}
