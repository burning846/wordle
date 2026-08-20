import { useEffect, useState } from 'react'
import { fetchProfile, requestLinkCode, type Profile } from '../game/api.js'
import { DIFFICULTY_LABELS } from '../game/difficulty.js'
import { dailyNumber } from '../game/daily.js'
import type { AccountApi } from '../hooks/useAccount.js'
import { Modal } from './Modal.js'
import './AccountModal.css'

interface AccountModalProps {
  open: boolean
  onClose: () => void
  account: AccountApi
  notify: (message: string) => void
}

export function AccountModal({ open, onClose, account, notify }: AccountModalProps) {
  return (
    <Modal open={open} title="Player" onClose={onClose}>
      {account.account ? (
        <SignedIn account={account} open={open} notify={notify} />
      ) : (
        <SignedOut account={account} />
      )}
    </Modal>
  )
}

/**
 * Entering a code issued elsewhere. Offered signed in as well as signed out: a device
 * that already registered its own player has no other way to join an existing one,
 * and doing so is exactly how two accidental players get merged into one.
 */
function RedeemForm({
  account,
  label,
  hint,
}: {
  account: AccountApi
  label: string
  hint?: string
}) {
  const [code, setCode] = useState('')

  return (
    <form
      className="account__form"
      onSubmit={(event) => {
        event.preventDefault()
        void account.redeem(code.trim()).catch(() => undefined)
      }}
    >
      <label className="account__label" htmlFor="code">
        {label}
      </label>
      {hint && <p className="account__hint">{hint}</p>}
      <div className="account__row">
        <input
          id="code"
          className="account__input account__input--code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button
          type="submit"
          className="button button--ghost"
          disabled={account.busy || code.trim() === ''}
        >
          Link
        </button>
      </div>
    </form>
  )
}

/** Registration, or joining a player who already exists on another device. */
function SignedOut({ account }: { account: AccountApi }) {
  const [nickname, setNickname] = useState('')
  const [taken, setTaken] = useState<string | null>(null)

  return (
    <>
      <p className="account__lead">
        A player carries your record across devices and puts you on the daily leaderboard.
        There is no password — this device is remembered, and a link code brings in another.
      </p>

      <form
        className="account__form"
        onSubmit={(event) => {
          event.preventDefault()
          const wanted = nickname.trim()
          // Remembered so the field can say which name was refused, even after the
          // toast has gone.
          void account.register(wanted).catch(() => setTaken(wanted))
        }}
      >
        <label className="account__label" htmlFor="nickname">
          Choose a nickname
        </label>
        <div className="account__row">
          <input
            id="nickname"
            className="account__input"
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value)
              setTaken(null)
            }}
            maxLength={20}
            placeholder="up to 20 characters"
            autoComplete="off"
          />
          <button
            type="submit"
            className="button button--primary"
            disabled={account.busy || nickname.trim() === ''}
          >
            Create
          </button>
        </div>
        {taken !== null && taken === nickname.trim() && (
          <p className="account__hint account__hint--warn">
            Someone is already playing as “{taken}”. Pick another name, or link this device
            to that player with a code from it.
          </p>
        )}
      </form>

      <div className="account__form--divided">
        <RedeemForm account={account} label="Already playing on another device?" />
      </div>
    </>
  )
}

function SignedIn({
  account,
  open,
  notify,
}: {
  account: AccountApi
  open: boolean
  notify: (message: string) => void
}) {
  const [issued, setIssued] = useState<{ code: string; expiresAt: number } | null>(null)
  const remaining = useCountdown(issued?.expiresAt ?? null)
  const profile = useProfile(open, account.account?.token)

  return (
    <>
      <div className="account__identity">
        <span className="account__nickname">{account.account?.nickname}</span>
        <button type="button" className="account__signout" onClick={account.signOut}>
          Sign out
        </button>
      </div>

      <div className="account__link">
        {issued && remaining ? (
          <>
            <p className="account__label">
              Enter this on your other device{remaining.expired ? '' : `, within ${remaining.label}`}:
            </p>
            <code className="account__code">{issued.code}</code>
            {remaining.expired && (
              <p className="account__hint">
                This code has expired. Make another one when the other device is ready.
              </p>
            )}
          </>
        ) : (
          <button
            type="button"
            className="button button--ghost"
            disabled={account.busy}
            onClick={() => {
              const token = account.account?.token
              if (!token) return
              void requestLinkCode(token)
                .then((next) => setIssued({ code: next.code, expiresAt: Date.now() + next.expiresInMs }))
                .catch((error: unknown) =>
                  notify(error instanceof Error ? error.message : 'Could not make a code'),
                )
            }}
          >
            Link another device
          </button>
        )}
      </div>

      <div className="account__form--divided">
        <RedeemForm
          account={account}
          label="Joining a player from another device?"
          hint={`This device would stop being ${account.account?.nickname} and join them instead.`}
        />
      </div>

      <h3 className="account__heading">Record</h3>
      {profile === null ? (
        <p className="account__empty">Loading…</p>
      ) : profile.totals.length === 0 ? (
        <p className="account__empty">Nothing synced yet — finish a game to start your record.</p>
      ) : (
        <table className="account__totals">
          <thead>
            <tr>
              <th>Board</th>
              <th>Played</th>
              <th>Won</th>
              <th>Best</th>
              <th>Avg</th>
            </tr>
          </thead>
          <tbody>
            {profile.totals.map((total) => (
              <tr key={`${total.mode}-${total.length}-${total.difficulty ?? ''}`}>
                <td>
                  {total.mode === 'daily'
                    ? 'Daily'
                    : DIFFICULTY_LABELS[total.difficulty ?? 'medium']}{' '}
                  <span className="account__dim">{total.length}</span>
                </td>
                <td>{total.played}</td>
                <td>{total.won}</td>
                <td>{total.bestGuessCount ?? '—'}</td>
                <td>{total.averageGuessCount ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {profile !== null && profile.history.length > 0 && (
        <>
          <h3 className="account__heading">Recent games</h3>
          <ul className="account__history">
            {profile.history.slice(0, 12).map((entry, index) => (
              <li key={index}>
                <span className="account__word">{entry.answer}</span>
                <span className="account__dim">
                  {entry.mode === 'daily' ? `#${dailyNumber(entry.dayIndex ?? 0)}` : 'practice'}
                </span>
                <span>{entry.won ? `${entry.guesses.length} guesses` : 'lost'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

interface Countdown {
  label: string
  expired: boolean
}

/** Counts a link code down to its expiry, so nobody walks off with a stale one. */
function useCountdown(expiresAt: number | null): Countdown | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (expiresAt === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  if (expiresAt === null) return null

  const left = Math.max(0, expiresAt - now)
  const minutes = Math.floor(left / 60_000)
  const seconds = Math.floor((left % 60_000) / 1000)

  return {
    expired: left === 0,
    label: minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`,
  }
}

/** Loads the profile each time the dialog opens, so it never shows stale totals. */
function useProfile(open: boolean, token: string | undefined): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!open || !token) return

    let cancelled = false
    setProfile(null)
    void fetchProfile(token)
      .then((next) => {
        if (!cancelled) setProfile(next)
      })
      .catch(() => {
        if (!cancelled) setProfile({ player: { id: '', nickname: '' }, totals: [], history: [] })
      })

    return () => {
      cancelled = true
    }
  }, [open, token])

  return profile
}
