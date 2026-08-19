import type { Settings } from '../game/settings.js'
import { Modal } from './Modal.js'
import './SettingsModal.css'

interface SettingsModalProps {
  open: boolean
  settings: Settings
  /** Hard mode may not be toggled mid-game, so the switch can arrive locked. */
  hardModeLocked: boolean
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
  notify: (message: string) => void
}

export function SettingsModal({
  open,
  settings,
  hardModeLocked,
  onChange,
  onClose,
  notify,
}: SettingsModalProps) {
  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <Toggle
        label="Hard mode"
        description="Any revealed hint must be used in later guesses."
        checked={settings.hardMode}
        disabled={hardModeLocked}
        onChange={(hardMode) => {
          if (hardModeLocked) {
            notify('Hard mode can only be changed at the start of a round')
            return
          }
          onChange({ hardMode })
        }}
      />

      <Toggle
        label="Dark theme"
        checked={settings.theme === 'dark'}
        onChange={(dark) => onChange({ theme: dark ? 'dark' : 'light' })}
      />

      <Toggle
        label="High contrast"
        description="Orange and blue tiles instead of green and yellow."
        checked={settings.highContrast}
        onChange={(highContrast) => onChange({ highContrast })}
      />
    </Modal>
  )
}

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, description, checked, disabled, onChange }: ToggleProps) {
  return (
    <label className={`setting${disabled ? ' is-disabled' : ''}`}>
      <span className="setting__text">
        <span className="setting__label">{label}</span>
        {description && <span className="setting__description">{description}</span>}
      </span>
      <input
        type="checkbox"
        className="setting__input"
        checked={checked}
        // Not the native `disabled` attribute: a click still needs to explain why it's locked.
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={undefined}
      />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}
