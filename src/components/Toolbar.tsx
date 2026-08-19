import { DIFFICULTIES, DIFFICULTY_HINTS, DIFFICULTY_LABELS, type Difficulty } from '../game/difficulty.js'
import { MODE_LABELS } from '../game/settings.js'
import { WORD_LENGTHS, type GameMode, type WordLength } from '../game/types.js'
import './Toolbar.css'

interface ToolbarProps {
  mode: GameMode
  length: WordLength
  difficulty: Difficulty
  onModeChange: (mode: GameMode) => void
  onLengthChange: (length: WordLength) => void
  onDifficultyChange: (difficulty: Difficulty) => void
  onNewWord: () => void
}

export function Toolbar({
  mode,
  length,
  difficulty,
  onModeChange,
  onLengthChange,
  onDifficultyChange,
  onNewWord,
}: ToolbarProps) {
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

      {/* Difficulty only means something in practice: the daily word is the same for
          everyone, drawn from the whole pool. */}
      {mode === 'practice' && (
        <>
          <div className="segmented" role="group" aria-label="Difficulty">
            {DIFFICULTIES.map((value) => (
              <button
                key={value}
                type="button"
                className={`segmented__option${value === difficulty ? ' is-active' : ''}`}
                aria-pressed={value === difficulty}
                title={DIFFICULTY_HINTS[value]}
                onClick={() => onDifficultyChange(value)}
              >
                {DIFFICULTY_LABELS[value]}
              </button>
            ))}
          </div>

          <button type="button" className="toolbar__action" onClick={onNewWord}>
            New word
          </button>
        </>
      )}
    </div>
  )
}
