import type { LetterState } from '../game/types'
import './Keyboard.css'

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

interface KeyboardProps {
  keyStates: Record<string, LetterState>
  onKey: (key: string) => void
  disabled: boolean
}

export function Keyboard({ keyStates, onKey, disabled }: KeyboardProps) {
  return (
    <div className="keyboard" role="group" aria-label="Keyboard">
      {ROWS.map((row, index) => (
        <div className="keyboard__row" key={row}>
          {/* The last row is bracketed by Enter and Backspace. */}
          {index === 2 && <Key label="Enter" value="Enter" wide onKey={onKey} disabled={disabled} />}

          {[...row].map((letter) => (
            <Key
              key={letter}
              label={letter}
              value={letter}
              state={keyStates[letter]}
              onKey={onKey}
              disabled={disabled}
            />
          ))}

          {index === 2 && (
            <Key label="⌫" value="Backspace" wide ariaLabel="Backspace" onKey={onKey} disabled={disabled} />
          )}
        </div>
      ))}
    </div>
  )
}

interface KeyProps {
  label: string
  value: string
  state?: LetterState
  wide?: boolean
  ariaLabel?: string
  onKey: (key: string) => void
  disabled: boolean
}

function Key({ label, value, state, wide, ariaLabel, onKey, disabled }: KeyProps) {
  return (
    <button
      type="button"
      className={['key', wide && 'key--wide', state && `key--${state}`].filter(Boolean).join(' ')}
      // Keeps focus on the document so physical Enter never re-fires the last key clicked.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onKey(value)}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
    >
      {label}
    </button>
  )
}
