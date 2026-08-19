# Wordle

A Wordle clone in React + TypeScript + Vite. Daily puzzle, unlimited practice mode, and a
switchable word length from 4 to 7 letters.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173, API included
npm test         # game logic and API tests
npm run build    # typecheck + production build into dist/
```

`npm run dev` also serves the `api/` routes, backed by a Postgres compiled to WebAssembly and kept
in `.pglite/`. Nothing to provision: the player system works locally out of the box, running the
same route modules that Vercel runs.

## Gameplay

- **Daily** — one word per calendar day, the same for everyone, rolling over at local midnight.
  You get `length + 1` guesses, so the classic 5-letter game gives 6 tries. Progress is saved, so a
  refresh resumes the board.
- **Practice** — a fresh random word whenever you want one, with no guess limit: a wrong guess
  simply adds another row. The board starts at the daily height and grows, shrinking its tiles to
  fit and scrolling once they reach their minimum size.
- **Difficulty** (practice only) — graded by how common a word is in everyday use. The answer pool
  is frequency-ranked, and Easy, Medium and Hard take equal thirds of it, most common first — about
  666 words each at five letters. The split lives in `TIER_SHARES` in `src/game/difficulty.ts`;
  change those shares to move the boundaries. Daily keeps drawing from the whole pool, since it has
  to be the same word for everyone. Each tier keeps its own in-progress board and its own record.
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

Statistics, settings, and in-progress boards live in `localStorage`, keyed by mode, length and
difficulty. Signing in as a player additionally syncs finished games to the server.

## Players

There are no passwords. Registering a nickname mints a token that this browser keeps and sends as a
bearer credential; only its hash is stored, so a leaked database hands out no working credentials.

A token in one browser is invisible to another, so cross-device play goes through a **link code**: the
device you already use issues a short-lived, single-use code, and entering it on a second device
binds that device to the same player. Both then hold their own token.

Finished games are replayed server-side before being stored. The client scores its own guesses — the
answer is in its bundle — so this cannot prove anyone played fairly. What it does reject is anything
incoherent: a word that was not that puzzle's answer, a guess that is not a real word, an outcome
that disagrees with the grid, a puzzle not yet published, a practice answer from a difficulty other
than the one claimed, or a solve faster than the keystrokes would take.

| Route              | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `POST /api/register`    | Create a player and bind this device                     |
| `POST /api/link`        | Issue a link code, or redeem one on a second device      |
| `POST /api/results`     | Submit a finished game, after server-side validation      |
| `GET /api/leaderboard`  | The day's ranking: fewest guesses, then fastest           |
| `GET /api/me`           | The caller's own totals and recent games                  |

Everything degrades quietly. With no player, or no database behind the deployment, the game is
exactly the offline game it was in v1.

## Word lists

`src/data/` holds the committed word lists — two files per length:

| File            | Contents                                                       |
| --------------- | -------------------------------------------------------------- |
| `guesses-N.txt` | every word accepted as a guess (12,578 at five letters)        |
| `answers-N.txt` | the pool answers are drawn from (1,997 at five letters)        |

Guesses come from the SCOWL dictionary shipped in the `word-list` package. Answers are SCOWL's
everyday vocabulary (sizes 10-35, via `wordlist-english`) intersected with that dictionary, which
both guarantees every answer is guessable and inherits the dictionary's profanity filtering.
Capitalised entries are dropped rather than folded, so proper nouns never become answers.

A frequency list of 50,000 words from a subtitle corpus **orders** the pool but does not define it;
using it as the source instead would cut the pool to a third of its size, since a word would have
to be in the corpus at all to appear. `answers-N.txt` is written most-common-first, and that single
ordering does double duty: practice difficulty slices it into tiers, and the daily sequence is a
seeded shuffle of it computed at runtime (`src/game/shuffle.ts`). Changing that seed or the shuffle
re-orders every future daily puzzle, so both are fixed now that the game is live.

Inflected forms are dropped from answers — plurals, `-ed`, `-ing`, borrowed Latin plurals, and
comparatives. A suffix is only stripped when what remains is itself an everyday word, so `thing`,
`bring`, `speed`, `chaos` and `focus` survive while `books`, `voted` and `going` do not.
Comparatives are stripped only for words the corpus never saw, since otherwise `cover` reduces to
`cove` and `offer` to `off`.

All of this applies to answers only. Plurals remain perfectly legal guesses — the point is just
that the hidden word is a base form.

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

Configured for Vercel via `vercel.json` (Vite preset, `dist` output, `api/` served as functions).
Import the repository at [vercel.com/new](https://vercel.com/new), or from the CLI:

```bash
npx vercel        # preview
npx vercel --prod # production
```

The player system needs a Postgres database. Add Neon from the project's Storage tab, which sets
`DATABASE_URL`, then create the tables once:

```bash
DATABASE_URL='...' npm run migrate
```

`api/_lib/schema.sql` is written to be re-runnable, so this is safe to repeat after a deploy. Without
`DATABASE_URL` the game still deploys and plays; only the player routes are unavailable.
