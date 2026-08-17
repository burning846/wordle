/**
 * localStorage wrappers that never throw. Private browsing and disabled storage
 * both surface as exceptions on access, and losing saved progress is preferable
 * to an unplayable board.
 */
export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable or full — the game stays playable, just not resumable.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // See above.
  }
}
