import { useCallback, useEffect, useState } from 'react'
import { Board } from './components/Board.tsx'
import { Header } from './components/Header.tsx'
import { HelpModal } from './components/HelpModal.tsx'
import { Keyboard } from './components/Keyboard.tsx'
import { SettingsModal } from './components/SettingsModal.tsx'
import { StatsModal } from './components/StatsModal.tsx'
import { Toast } from './components/Toast.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { dayIndexFor, puzzleNumber } from './game/daily.ts'
import { loadSettings, saveSettings, type Settings } from './game/settings.ts'
import { readJson, writeJson } from './game/storage.ts'
import type { GameMode, WordLength } from './game/types.ts'
import { useGame } from './hooks/useGame.ts'
import './App.css'

const HELP_SEEN_KEY = 'wordle:help-seen'

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const game = useGame({
    mode: settings.mode,
    length: settings.length,
    hardMode: settings.hardMode,
  })

  const { press, snapshot, resultOpen } = game

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal'
  }, [settings.theme, settings.highContrast])

  // The rules open once, on a player's first visit.
  useEffect(() => {
    if (!readJson<boolean>(HELP_SEEN_KEY)) {
      setHelpOpen(true)
      writeJson(HELP_SEEN_KEY, true)
    }
  }, [])

  const modalOpen = helpOpen || settingsOpen || resultOpen

  useEffect(() => {
    if (modalOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Leave browser and OS shortcuts alone.
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Enter' || event.key === 'Backspace' || /^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault()
        press(event.key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modalOpen, press])

  const finished = snapshot !== null && snapshot.status !== 'playing'
  // Hard mode would otherwise let a player escape the constraint mid-round.
  const hardModeLocked = snapshot !== null && snapshot.guesses.length > 0 && !finished

  const subtitle = [
    settings.mode === 'daily'
      ? `Puzzle #${puzzleNumber(snapshot?.dayIndex ?? dayIndexFor())}`
      : 'Practice',
    `${settings.length} letters`,
    settings.hardMode && 'hard',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="app">
      <Header
        subtitle={subtitle}
        onHelp={() => setHelpOpen(true)}
        onStats={game.openResult}
        onSettings={() => setSettingsOpen(true)}
      />

      <Toolbar
        mode={settings.mode}
        length={settings.length}
        onModeChange={(mode: GameMode) => updateSettings({ mode })}
        onLengthChange={(length: WordLength) => updateSettings({ length })}
        onNewWord={game.newPracticeGame}
      />

      {snapshot ? (
        <Board
          length={settings.length}
          rows={game.rows}
          guesses={snapshot.guesses}
          draft={game.draft}
          greens={game.greens}
          answer={snapshot.answer}
          revealingRow={game.revealingRow}
          shake={game.shake}
          // Bounce only once the row has finished flipping.
          winningRow={
            snapshot.status === 'won' && game.revealingRow === -1 ? snapshot.guesses.length - 1 : -1
          }
        />
      ) : (
        <div className="app__loading" />
      )}

      <div className="app__keyboard">
        <Keyboard keyStates={game.keyStates} onKey={press} disabled={game.loading || finished} />
      </div>

      <Toast message={game.toast} />

      <HelpModal
        open={helpOpen}
        mode={settings.mode}
        length={settings.length}
        onClose={() => setHelpOpen(false)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        hardModeLocked={hardModeLocked}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
        notify={game.notify}
      />

      <StatsModal
        open={resultOpen}
        onClose={game.closeResult}
        stats={game.stats}
        snapshot={snapshot}
        mode={settings.mode}
        length={settings.length}
        hardMode={settings.hardMode}
        highContrast={settings.highContrast}
        onNewWord={game.newPracticeGame}
        notify={game.notify}
      />
    </div>
  )
}
