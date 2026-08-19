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

/** Registration, or joining a player who already exists on another device. */
function SignedOut({ account }: { account: AccountApi }) {
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState('')

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
          void account.register(nickname.trim()).catch(() => undefined)
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
            onChange={(event) => setNickname(event.target.value)}
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
      </form>

      <form
        className="account__form account__form--divided"
        onSubmit={(event) => {
          event.preventDefault()
          void account.redeem(code.trim()).catch(() => undefined)
        }}
      >
        <label className="account__label" htmlFor="code">
          Already playing on another device?
        </label>
        <div className="account__row">
          <input
            id="code"
            className="account__input account__input--code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
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
  const [code, setCode] = useState<string | null>(null)
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
        {code ? (
          <>
            <p className="account__label">Enter this on your other device, within 10 minutes:</p>
            <code className="account__code">{code}</code>
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
                .then((issued) => setCode(issued.code))
                .catch((error: unknown) =>
                  notify(error instanceof Error ? error.message : 'Could not make a code'),
                )
            }}
          >
            Link another device
          </button>
        )}
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
