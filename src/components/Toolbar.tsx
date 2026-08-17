import { MODE_LABELS } from '../game/settings.ts'
import { WORD_LENGTHS, type GameMode, type WordLength } from '../game/types.ts'
import './Toolbar.css'

interface ToolbarProps {
  mode: GameMode
  length: WordLength
  onModeChange: (mode: GameMode) => void
  onLengthChange: (length: WordLength) => void
  onNewWord: () => void
}

export function Toolbar({ mode, length, onModeChange, onLengthChange, onNewWord }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="segmented" role="group" aria-label="Game mode">
        {(Object.keys(MODE_LABELS) as GameMode[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`segmented__option${value === mode ? ' is-active' : ''}`}
            aria-pressed={value === mode}
            onClick={() => onModeChange(value)}
          >
            {MODE_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="segmented" role="group" aria-label="Word length">
        {WORD_LENGTHS.map((value) => (
          <button
            key={value}
            type="button"
            className={`segmented__option${value === length ? ' is-active' : ''}`}
            aria-pressed={value === length}
            aria-label={`${value} letters`}
            onClick={() => onLengthChange(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {mode === 'practice' && (
        <button type="button" className="toolbar__action" onClick={onNewWord}>
          New word
        </button>
      )}
    </div>
  )
}
