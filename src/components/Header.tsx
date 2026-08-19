import './Header.css'

interface HeaderProps {
  subtitle: string
  /** Shown on the player button when signed in. */
  nickname: string | null
  onHelp: () => void
  onStats: () => void
  onAccount: () => void
  onSettings: () => void
}

export function Header({ subtitle, nickname, onHelp, onStats, onAccount, onSettings }: HeaderProps) {
  return (
    <header className="header">
      <button type="button" className="icon-button" onClick={onHelp} aria-label="How to play">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9a2.8 2.8 0 1 1 3.6 2.7c-.6.2-.8.7-.8 1.3v.5" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div className="header__title">
        <h1>Wordle</h1>
        <p>{subtitle}</p>
      </div>

      <div className="header__actions">
        <button
          type="button"
          className={`icon-button${nickname ? ' is-active' : ''}`}
          onClick={onAccount}
          aria-label={nickname ? `Player: ${nickname}` : 'Sign in'}
          title={nickname ?? 'Player'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
        </button>
        <button type="button" className="icon-button" onClick={onStats} aria-label="Statistics">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 20V11M12 20V4M19 20v-6" />
          </svg>
        </button>
        <button type="button" className="icon-button" onClick={onSettings} aria-label="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2m0 14v2M4.2 7.5l1.7 1M18.1 15.5l1.7 1M4.2 16.5l1.7-1M18.1 8.5l1.7-1" />
          </svg>
        </button>
      </div>
    </header>
  )
}
