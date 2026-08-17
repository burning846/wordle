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
  Progress is saved, so a refresh resumes the board.
- **Practice** — a fresh random word whenever you want one.
- **Word length** — 4 to 7 letters, selectable in the toolbar. You get `length + 1` guesses, so
  the classic 5-letter game gives 6 tries. Each length keeps its own statistics.
- **Hard mode** — every revealed hint has to be reused in later guesses. Only switchable between
  rounds.
- **High contrast** — orange/blue tiles instead of green/yellow.

Statistics, settings, and in-progress boards live in `localStorage`, keyed by mode and length.

## Word lists

`src/data/` holds the committed word lists — two files per length:

| File            | Contents                                                        |
| --------------- | --------------------------------------------------------------- |
| `guesses-N.txt` | every word accepted as a guess (12,578 at five letters)         |
| `answers-N.txt` | the pool puzzle answers are drawn from (1,209 at five letters)  |

Guesses come from the SCOWL dictionary shipped in the `word-list` package. Answers are that
dictionary intersected with a frequency-ranked list, so the target word is always something a
player has plausibly seen, while obscure-but-real words are still accepted as guesses.

Answer lists are shuffled at generation time with a fixed seed. That keeps the daily sequence
identical on every machine without needing a server, and stops day 1 from simply being the most
common word in English.

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
