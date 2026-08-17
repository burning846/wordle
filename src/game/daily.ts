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
export function puzzleNumber(dayIndex: number): number {
  return dayIndex + 1
}

/**
 * The word for a given day. Answer lists are shuffled at build time, so walking
 * them in order gives an unpredictable sequence, and the modulo keeps the game
 * playable past the end of the list.
 */
export function dailyAnswer(dictionary: Dictionary, dayIndex: number): string {
  return dictionary.answers[dayIndex % dictionary.answers.length]
}

export function randomAnswer(dictionary: Dictionary): string {
  return dictionary.answers[Math.floor(Math.random() * dictionary.answers.length)]
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
