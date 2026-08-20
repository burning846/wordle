import { dayIndexFor } from './daily.js'
import { DEFAULT_DIFFICULTY } from './difficulty.js'
import { recordResult } from './stats.js'
import { readJson, writeJson } from './storage.js'
import { puzzleKey, type GameSnapshot, type Puzzle, type WordLength } from './types.js'
import type { HistoryEntry } from './api.js'

function gameKey(puzzle: Puzzle): string {
  return `wordle:game:${puzzleKey(puzzle)}`
}

/**
 * Brings a device up to date with dailies the player has already finished elsewhere.
 *
 * Without this, a freshly linked device offers today's puzzle as though it were
 * untouched. Playing it again is not merely redundant: the server records one daily
 * result per player, so the second attempt is discarded and the effort is lost.
 *
 * Only finished dailies are adopted, and only for today — a board in progress is
 * private to the device typing it, and yesterday's is over.
 */
export function adoptFinishedDailies(history: HistoryEntry[], today = dayIndexFor()): number {
  let adopted = 0

  for (const entry of history) {
    if (entry.mode !== 'daily' || entry.dayIndex !== today) continue

    const puzzle: Puzzle = {
      mode: 'daily',
      length: entry.length as WordLength,
      // Daily ignores difficulty, but a Puzzle carries one; keep it canonical so the
      // storage key matches the one the game itself writes.
      difficulty: DEFAULT_DIFFICULTY,
    }

    const stored = readJson<GameSnapshot>(gameKey(puzzle))
    if (stored?.status === 'won' || stored?.status === 'lost') continue

    const snapshot: GameSnapshot = {
      answer: entry.answer,
      guesses: entry.guesses,
      status: entry.won ? 'won' : 'lost',
      dayIndex: entry.dayIndex,
      puzzle,
    }
    writeJson(gameKey(puzzle), snapshot)

    // Idempotent for dailies: a day already counted is ignored, so a device that
    // played it locally does not count it twice.
    recordResult(puzzle, {
      won: entry.won,
      guessCount: entry.guesses.length,
      dayIndex: entry.dayIndex,
    })

    adopted++
  }

  return adopted
}
