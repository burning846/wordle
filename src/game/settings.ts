import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from './difficulty.js'
import { readJson, writeJson } from './storage.js'
import { DEFAULT_LENGTH, isWordLength, type GameMode, type WordLength } from './types.js'

export type Theme = 'light' | 'dark'

export interface Settings {
  mode: GameMode
  length: WordLength
  /** Practice only: how far down the everyday-usage ranking answers are drawn from. */
  difficulty: Difficulty
  /** Revealed hints must be reused in every later guess. */
  hardMode: boolean
  theme: Theme
  /** Orange/blue palette instead of green/yellow, for colour-blind players. */
  highContrast: boolean
}

const KEY = 'wordle:settings'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(KEY)

  return {
    mode: stored?.mode === 'practice' ? 'practice' : 'daily',
    length: isWordLength(stored?.length) ? stored.length : DEFAULT_LENGTH,
    difficulty: isDifficulty(stored?.difficulty) ? stored.difficulty : DEFAULT_DIFFICULTY,
    hardMode: stored?.hardMode === true,
    theme: stored?.theme === 'dark' || stored?.theme === 'light' ? stored.theme : systemTheme(),
    highContrast: stored?.highContrast === true,
  }
}

export function saveSettings(settings: Settings): void {
  writeJson(KEY, settings)
}

export const MODE_LABELS: Record<GameMode, string> = {
  daily: 'Daily',
  practice: 'Practice',
}
