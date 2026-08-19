import { readJson, removeKey, writeJson } from './storage.ts'
import type { Difficulty } from './difficulty.ts'
import type { GameMode, WordLength } from './types.ts'

/**
 * The wire contract, shared by the browser and the API routes so the two cannot
 * drift, plus the client that speaks it.
 */
export interface Account {
  playerId: string
  nickname: string
  /** Bearer credential for this device. Never leaves localStorage except as a header. */
  token: string
}

export interface SubmittedResult {
  mode: GameMode
  length: WordLength
  difficulty: Difficulty | null
  dayIndex: number | null
  guesses: string[]
  won: boolean
  hardMode: boolean
  /** Milliseconds from the first keystroke to the winning guess, when known. */
  durationMs: number | null
}

export interface LeaderboardRow {
  rank: number
  nickname: string
  guessCount: number
  durationMs: number | null
  hardMode: boolean
}

export interface Leaderboard {
  dayIndex: number
  length: WordLength
  entries: LeaderboardRow[]
}

export interface HistoryEntry {
  mode: GameMode
  length: WordLength
  difficulty: Difficulty | null
  dayIndex: number | null
  answer: string
  guesses: string[]
  won: boolean
  hardMode: boolean
  durationMs: number | null
  playedAt: string
}

export interface Totals {
  mode: GameMode
  length: WordLength
  difficulty: Difficulty | null
  played: number
  won: number
  bestGuessCount: number | null
  averageGuessCount: number | null
}

export interface Profile {
  player: { id: string; nickname: string }
  totals: Totals[]
  history: HistoryEntry[]
}

const ACCOUNT_KEY = 'wordle:account'

export function loadAccount(): Account | null {
  const stored = readJson<Account>(ACCOUNT_KEY)
  if (!stored?.token || !stored.playerId || !stored.nickname) return null
  return stored
}

export function saveAccount(account: Account): void {
  writeJson(ACCOUNT_KEY, account)
}

export function forgetAccount(): void {
  removeKey(ACCOUNT_KEY)
}

/** Thrown when the API is reachable but declined the request. */
export class ApiError extends Error {}

/**
 * Thrown when the API is missing or answered with something that is not JSON — a
 * local build, a deploy without the routes, or a crashing function. Carries the
 * status so a broken deployment can be told apart from one that simply has no API.
 */
export class ApiUnavailable extends Error {
  readonly status: number | undefined

  constructor(status?: number) {
    super(
      status === undefined || status === 404
        ? 'Player accounts are not available on this deployment'
        : `The server returned ${status} instead of JSON — the API may be misconfigured`,
    )
    this.status = status
  }
}

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiUnavailable()
  }

  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    // A deployment without the API serves the SPA's index.html for /api/* too.
    throw new ApiUnavailable(response.status)
  }

  if (!response.ok) {
    throw new ApiError((body as { error?: string }).error ?? `request failed (${response.status})`)
  }
  return body as T
}

export function registerPlayer(nickname: string): Promise<Account> {
  return call<Account>('register', { method: 'POST', body: JSON.stringify({ nickname }) })
}

export function requestLinkCode(token: string): Promise<{ code: string; expiresInMs: number }> {
  return call('link', { method: 'POST', body: JSON.stringify({}) }, token)
}

export function redeemLinkCode(code: string): Promise<Account> {
  return call<Account>('link', { method: 'POST', body: JSON.stringify({ code }) })
}

export function submitResult(token: string, result: SubmittedResult): Promise<{ stored: boolean }> {
  return call('results', { method: 'POST', body: JSON.stringify(result) }, token)
}

export function fetchLeaderboard(length: WordLength, dayIndex?: number): Promise<Leaderboard> {
  const params = new URLSearchParams({ length: String(length) })
  if (dayIndex !== undefined) params.set('dayIndex', String(dayIndex))
  return call<Leaderboard>(`leaderboard?${params}`)
}

export function fetchProfile(token: string): Promise<Profile> {
  return call<Profile>('me', {}, token)
}
