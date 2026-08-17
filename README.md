# Wordle

A Wordle clone in React + TypeScript + Vite. Daily puzzle, unlimited practice mode, and a
switchable word length from 4 to 7 letters.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # game logic tests
npm run build    # typecheck + production build into dist/
```

## Gameplay

- **Daily** — one word per calendar day, the same for everyone, rolling over at local midnight.
  You get `length + 1` guesses, so the classic 5-letter game gives 6 tries. Progress is saved, so a
  refresh resumes the board.
- **Practice** — a fresh random word whenever you want one, with no guess limit: a wrong guess
  simply adds another row. The board starts at the daily height and grows, shrinking its tiles to
  fit and scrolling once they reach their minimum size.
- **Difficulty** (practice only) — graded by how common a word is in everyday use. The answer pool
  is frequency-ranked, and Easy, Medium and Hard take equal thirds of it, most common first. Daily
  keeps drawing from the whole pool, since it has to be the same word for everyone. Each tier keeps
  its own in-progress board and its own record.
- **Green letters carry forward** — a letter proven to be in the right place is filled into your
  next guess automatically, outlined rather than filled so the row still reads as unsubmitted.
  Backspace undoes entries newest-first, so a carried-over letter only clears once nothing typed
  after it remains.
- **Word length** — 4 to 7 letters, selectable in the toolbar. Statistics are kept per mode, length
  and difficulty: daily tracks win rate and streaks, while practice — which can't be lost — tracks
  your best and average guess count instead.
- **Hard mode** — every revealed hint has to be reused in later guesses. Only switchable between
  rounds.
- **High contrast** — orange/blue tiles instead of green/yellow.

Statistics, settings, and in-progress boards live in `localStorage`, keyed by mode and length.

## Word lists

`src/data/` holds the committed word lists — two files per length:

| File            | Contents                                                       |
| --------------- | -------------------------------------------------------------- |
| `guesses-N.txt` | every word accepted as a guess (12,578 at five letters)        |
| `answers-N.txt` | the pool answers are drawn from (1,103 at five letters)        |

Guesses come from the SCOWL dictionary shipped in the `word-list` package. Answers are that
dictionary intersected with a frequency-ranked list, so the target is always something a player has
plausibly seen, while obscure-but-real words are still accepted as guesses.

The frequency list is web-corpus derived, so answers are additionally required to appear in SCOWL's
common-vocabulary buckets (sizes 10-35, via `wordlist-english`). Without that the pool offers up
`texas`, `linux`, `anime` and `devel`; about a hundred such entries per length are excluded — as
answers only, never as guesses.

`answers-N.txt` is ordered by everyday usage, most common word first. That single ordering does
double duty: practice difficulty slices it into thirds, and the daily sequence is a seeded shuffle
of it computed at runtime (`src/game/shuffle.ts`). Changing that seed or the shuffle re-orders every
future daily puzzle, so both are fixed now that the game is live.

To regenerate (only needed when changing lengths or sources):

```bash
npm run words
```

Each length is loaded as its own lazily-imported chunk, so playing at five letters never downloads
the 265KB seven-letter list.

## Layout

```
scripts/build-words.mjs   generates src/data/*.txt
src/game/                 rules, dictionary loading, daily schedule, stats, sharing
src/hooks/useGame.ts      board state, input handling, persistence
src/components/           board, keyboard, modals
```

## Deploying

Configured for Vercel via `vercel.json` (Vite preset, `dist` output). Import the repository at
[vercel.com/new](https://vercel.com/new) and it builds with no further setup, or from the CLI:

```bash
npx vercel        # preview
npx vercel --prod # production
```
