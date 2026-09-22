# Working notes

A running log of what changed and what's still open, so work can pick up on
either machine. Newest first.

## 2026-09-22 — Sticking Generator overhaul, session timers everywhere

### What changed

**Sticking Generator (`/sticking-generator`)** — rebuilt around linear fills.

- One linear line of hands (R/L) and kick (K), replacing the old separate
  hand and foot lines.
- Fills are chained from rudiment cells: singles, doubles, paradiddle,
  inverted paradiddle, double paradiddle, paradiddle-diddle and five-stroke
  roll, plus kick versions of them (`RLRK`, `RLKK`, `RKKR`, `RRLLK`, ...).
  Each has a mirrored left-lead version. The "Built From" card names the cells.
- Rules: no limb three times in a row, either played into the landing or
  looped end-to-start; never two kicks into the landing. Checked against
  48,000 generated fills.
- Settings: rate (16ths / triplets), resolve on (kick / snare), length (1–4
  beats), and tempo range (a two-handle slider, default 90–150). Every new fill
  picks its own tempo from the range.
- Notation: fills are drawn with VexFlow (`src/lib/fillNotation.js`, loaded
  only on this page). Each fill ends a 4/4 bar, with rests first. Kick is in
  the F space and hands in the C space. After the barline comes the landing
  note. The sticking and counts sit under each note, counted from where the
  fill falls in the bar.
- No repeats: the last 300 fills are kept in localStorage and avoided.
- Practice session panel: session length, new-fill interval, and a 4/4 click
  at the fill's tempo. When the interval is up, a chime plays on the next
  downbeat, the new fill scrambles into place, and a spoken "one, two, three,
  four" counts back in. The screen stays awake during a session.
- Voting: thumbs up / thumbs down on each fill. Thumbs down pauses the
  session, asks what was off (quick tags plus a note), then brings in a new
  fill. Downvoted fills never come back, on either machine.

**Feedback pipeline**

- `netlify/functions/sticking-feedback.mjs` stores votes in Netlify Blobs;
  `netlify/lib/stickingFeedback.mjs` validates them. The local dev server
  writes to the gitignored `feedback/sticking-feedback.dev.json` instead.
- Votes cast offline queue in localStorage and send later.
- Reviewed feedback is archived in `feedback/sticking-feedback.json`. The
  review routine is in `CLAUDE.md`.

**Count-in audio** — `public/audio/count-in/{1..4}.wav`, rendered from the
macOS "Daniel" voice by `scripts/generate-count-in.sh`.

**Session timers on every practice tool** — a shared `PracticeTimer` card
(start, pause, resume and reset, with a chime at the end) was added to the Ear
Trainer and Tempo Guessr. The Metronome and Sticking Generator time sessions
from their own Start buttons. `CLAUDE.md` now requires a session timer on
every practice tool.

### Open items / ideas

- Review the first real batch of sticking feedback (see `CLAUDE.md`).
- About half of kick-landing fills end on a single kick right before the
  landing kick. The rules allow it; consider banning it for a cleaner landing.
- Short filler cells (`RL`, `K`) can make fills feel fragmented. Consider
  requiring at least one full rudiment cell per fill.
- Listen to the spoken count-in. Swap the voice or record your own if it's
  off. Apple's voice licence may not cover a public site, so own recordings
  are the safer bet before launch.
- The feedback endpoint has no authentication. Add a key before the site is
  shared publicly.
- Phones: a full 4-beat bar of notation scrolls sideways, and the Ear
  Trainer's timer sits at the bottom of the page. Both are fine for now.
