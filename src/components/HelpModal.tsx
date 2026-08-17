import { maxGuessesFor, type LetterState, type WordLength } from '../game/types.ts'
import { Modal } from './Modal.tsx'
import './HelpModal.css'

interface HelpModalProps {
  open: boolean
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

export function HelpModal({ open, length, onClose }: HelpModalProps) {
  return (
    <Modal open={open} title="How to play" onClose={onClose}>
      <p className="help__lead">
        Guess the word in {maxGuessesFor(length)} tries. Each guess must be a valid {length}-letter
        word. The colour of the tiles shows how close you were.
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
          <strong>Daily</strong> is the same word for everyone on a given date. <strong>Practice</strong>{' '}
          gives you a fresh random word whenever you want one.
        </li>
        <li>Word length is switchable from 4 to 7 letters — each length keeps its own stats.</li>
        <li>
          <strong>Hard mode</strong> (in settings) forces every revealed hint into your later guesses.
        </li>
      </ul>
    </Modal>
  )
}
