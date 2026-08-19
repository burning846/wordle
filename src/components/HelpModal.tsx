import { guessLimitFor, type GameMode, type LetterState, type WordLength } from '../game/types.js'
import { Modal } from './Modal.js'
import './HelpModal.css'

interface HelpModalProps {
  open: boolean
  mode: GameMode
  length: WordLength
  onClose: () => void
}

interface Example {
  word: string
  /** Index of the letter being demonstrated. */
  index: number
  state: LetterState
  caption: string
}

const EXAMPLES: Example[] = [
  { word: 'weary', index: 0, state: 'correct', caption: 'W is in the word and in the right spot.' },
  { word: 'pills', index: 1, state: 'present', caption: 'I is in the word but in the wrong spot.' },
  { word: 'vague', index: 3, state: 'absent', caption: 'U is not in the word at all.' },
]

export function HelpModal({ open, mode, length, onClose }: HelpModalProps) {
  return (
    <Modal open={open} title="How to play" onClose={onClose}>
      <p className="help__lead">
        {mode === 'daily'
          ? `Guess the word in ${guessLimitFor(length)} tries.`
          : 'Guess the word in as many tries as you need.'}{' '}
        Each guess must be a valid {length}-letter word. The colour of the tiles shows how close you
        were.
      </p>

      <div className="help__examples">
        {EXAMPLES.map((example) => (
          <div className="help__example" key={example.word}>
            <div className="example-row">
              {[...example.word].map((letter, index) => (
                <div
                  key={index}
                  className={`tile${index === example.index ? ` tile--${example.state}` : ''}`}
                >
                  {letter}
                </div>
              ))}
            </div>
            <p>{example.caption}</p>
          </div>
        ))}
      </div>

      <ul className="help__notes">
        <li>
          A green letter is carried into your next guess automatically, outlined rather than filled.
          Backspace clears it if you'd rather try something else there.
        </li>
        <li>
          <strong>Daily</strong> is the same word for everyone on a given date, with{' '}
          {guessLimitFor(length)} tries. <strong>Practice</strong> gives you a fresh random word and
          no limit — a wrong guess just adds another row.
        </li>
        <li>
          Practice <strong>difficulty</strong> is graded by how common a word is in everyday use:
          Easy draws from the most common third of the pool, Hard from the least common third. Each
          tier keeps its own record.
        </li>
        <li>Word length is switchable from 4 to 7 letters — each length keeps its own stats.</li>
        <li>
          <strong>Hard mode</strong> (in settings) forces every revealed hint into your later guesses.
        </li>
      </ul>
    </Modal>
  )
}
