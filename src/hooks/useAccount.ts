import { useCallback, useState } from 'react'
import {
  ApiUnavailable,
  forgetAccount,
  loadAccount,
  redeemLinkCode,
  registerPlayer,
  saveAccount,
  submitResult,
  type Account,
  type SubmittedResult,
} from '../game/api.ts'
import type { FinishedGame } from './useGame.ts'

export interface AccountApi {
  account: Account | null
  /** True while a request the player is waiting on is in flight. */
  busy: boolean
  register: (nickname: string) => Promise<void>
  redeem: (code: string) => Promise<void>
  signOut: () => void
  /** Fire-and-forget: a failed sync must never interrupt play. */
  sync: (game: FinishedGame) => void
}

/**
 * The player's identity on this device, and the calls that change it.
 *
 * Everything here degrades quietly: with no account, or no API deployed, the game
 * is exactly the offline game it was in v1.
 */
export function useAccount(notify: (message: string) => void): AccountApi {
  const [account, setAccount] = useState<Account | null>(loadAccount)
  const [busy, setBusy] = useState(false)

  const adopt = useCallback((next: Account) => {
    saveAccount(next)
    setAccount(next)
  }, [])

  const run = useCallback(
    async (action: () => Promise<Account>, success: (account: Account) => string) => {
      setBusy(true)
      try {
        const next = await action()
        adopt(next)
        notify(success(next))
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Something went wrong')
        throw error
      } finally {
        setBusy(false)
      }
    },
    [adopt, notify],
  )

  const register = useCallback(
    (nickname: string) => run(() => registerPlayer(nickname), (next) => `Playing as ${next.nickname}`),
    [run],
  )

  const redeem = useCallback(
    (code: string) => run(() => redeemLinkCode(code), (next) => `Linked to ${next.nickname}`),
    [run],
  )

  const signOut = useCallback(() => {
    forgetAccount()
    setAccount(null)
    notify('Signed out on this device')
  }, [notify])

  const sync = useCallback(
    (game: FinishedGame) => {
      if (!account) return

      const payload: SubmittedResult = {
        mode: game.puzzle.mode,
        length: game.puzzle.length,
        difficulty: game.puzzle.mode === 'practice' ? game.puzzle.difficulty : null,
        dayIndex: game.dayIndex,
        guesses: game.guesses,
        won: game.won,
        hardMode: game.hardMode,
        durationMs: game.durationMs,
      }

      void submitResult(account.token, payload).catch((error: unknown) => {
        // Silent when the deployment simply has no API; otherwise say what went wrong,
        // since a result that failed to sync will not appear on the leaderboard.
        if (error instanceof ApiUnavailable) return
        notify(error instanceof Error ? `Not synced: ${error.message}` : 'Not synced')
      })
    },
    [account, notify],
  )

  return { account, busy, register, redeem, signOut, sync }
}
