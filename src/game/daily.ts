/**
 * The daily puzzle changes at midnight UTC+8, the same instant for everyone.
 *
 * Deriving the day from each player's own timezone instead would mean the browser and
 * the API disagree for part of every day — the API runs in UTC — and a player far
 * enough east could not submit a result at all during that window. Fixing the zone
 * makes the day a property of the puzzle rather than of whoever is looking at it.
 *
 * UTC+8 observes no daylight saving, so every puzzle day is exactly 24 hours.
 */
const PUZZLE_OFFSET_HOURS = 8

/** Puzzle 1 begins at 2026-01-01 00:00 UTC+8. */
const EPOCH_MS = Date.UTC(2025, 11, 31, 24 - PUZZLE_OFFSET_HOURS)

const DAY_MS = 24 * 60 * 60 * 1000

/** Days elapsed since the epoch; 0 on launch day. */
export function dayIndexFor(date: Date = new Date()): number {
  return Math.max(0, Math.floor((date.getTime() - EPOCH_MS) / DAY_MS))
}

/** Human-facing puzzle number. */
export function dailyNumber(dayIndex: number): number {
  return dayIndex + 1
}

/**
 * The word for a given day, from a pool already in daily order (see `dailyOrder`).
 * The modulo keeps the game playable past the end of the list.
 */
export function dailyAnswer(daily: readonly string[], dayIndex: number): string {
  return daily[dayIndex % daily.length]
}

/** Practice draws from whichever difficulty tier is selected. */
export function randomAnswer(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

export function msUntilNextPuzzle(now: Date = new Date()): number {
  const elapsed = now.getTime() - EPOCH_MS
  return DAY_MS - (((elapsed % DAY_MS) + DAY_MS) % DAY_MS)
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}
