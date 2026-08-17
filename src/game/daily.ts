import type { Dictionary } from './dictionary.ts'

/**
 * Day 1 of the daily puzzle. Everything is computed in the player's local time,
 * so the puzzle rolls over at their own midnight.
 */
const EPOCH = new Date(2026, 0, 1)

const DAY_MS = 24 * 60 * 60 * 1000

function midnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Built from the calendar date rather than by adding 24 hours: a daylight-saving
 * transition makes the local day 23 or 25 hours long.
 */
function nextMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
}

/**
 * Days elapsed since the epoch; 0 on launch day. Rounded rather than floored, so a
 * 23- or 25-hour daylight-saving day still counts as exactly one day.
 */
export function dayIndexFor(date: Date = new Date()): number {
  return Math.max(0, Math.round((midnight(date) - midnight(EPOCH)) / DAY_MS))
}

/** Human-facing puzzle number. */
export function dailyNumber(dayIndex: number): number {
  return dayIndex + 1
}

/**
 * The word for a given day. The daily order is a seeded shuffle of the answer pool,
 * so walking it gives an unpredictable sequence, and the modulo keeps the game
 * playable past the end of the list.
 */
export function dailyAnswer(dictionary: Dictionary, dayIndex: number): string {
  return dictionary.daily[dayIndex % dictionary.daily.length]
}

/** Practice draws from whichever difficulty tier is selected. */
export function randomAnswer(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

export function msUntilNextPuzzle(now: Date = new Date()): number {
  return nextMidnight(now) - now.getTime()
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}
