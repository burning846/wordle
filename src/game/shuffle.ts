/**
 * Deterministic shuffle used to turn the frequency-ordered answer pool into the daily
 * sequence. Being seeded is what lets every player share a daily word with no server
 * involved, and it also stops day 1 from simply being the most common word in English.
 *
 * Changing the algorithm or a seed re-orders every future daily puzzle, so treat both
 * as fixed once the game is live.
 */

/** mulberry32 — small, fast, and stable across engines. */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items]
  const next = random(seed)

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }

  return out
}
