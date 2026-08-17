/** Shared by the flip CSS and the hook that waits for it, so they can't drift apart. */
export const REVEAL_STEP_MS = 220
export const FLIP_MS = 500

/** How long a full row takes to finish flipping. */
export function revealDurationFor(length: number): number {
  return (length - 1) * REVEAL_STEP_MS + FLIP_MS
}
