/**
 * The row being typed. Once confirmed letters are pre-filled at their own positions,
 * a plain string no longer describes the row: entries can sit either side of a gap,
 * so each position is tracked separately.
 */
export interface Draft {
  /** One slot per position; null where nothing has been entered yet. */
  slots: (string | null)[]
  /**
   * Positions in the order they were filled. Backspace undoes the most recent entry,
   * which puts pre-filled hints last in line rather than first — deleting them takes
   * clearing everything typed after them, the same as any other letter.
   */
  order: number[]
}

export function emptyDraft(length: number): Draft {
  return { slots: Array.from({ length }, () => null), order: [] }
}

/** Starts a row from confirmed letters, leaving unknown positions empty. */
export function draftFrom(known: (string | null)[]): Draft {
  return {
    slots: [...known],
    order: known.flatMap((letter, position) => (letter === null ? [] : [position])),
  }
}

/** Writes into the leftmost empty slot; a full row is left untouched. */
export function typeIntoDraft(draft: Draft, letter: string): Draft {
  const position = draft.slots.indexOf(null)
  if (position === -1) return draft

  const slots = [...draft.slots]
  slots[position] = letter
  return { slots, order: [...draft.order, position] }
}

export function backspaceDraft(draft: Draft): Draft {
  if (draft.order.length === 0) return draft

  const order = [...draft.order]
  const position = order.pop() as number
  const slots = [...draft.slots]
  slots[position] = null
  return { slots, order }
}

/**
 * The word to submit. Gaps are simply skipped, so a row with holes yields something
 * shorter than the board — which is what makes it read as "not enough letters".
 */
export function draftWord(draft: Draft): string {
  return draft.slots.map((letter) => letter ?? '').join('')
}
