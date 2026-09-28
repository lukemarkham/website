# Working notes

A running log of what changed and what's still open, so work can pick up on
either machine. Newest first.

## 2026-09-28 (night) — Student notes pages, review check

### What changed

- **Student pages**: `/<first-last>` (for example `/oliver-otto`) shows that
  student's Google Doc in the site's styling, fetched fresh on every load. On
  the server, `netlify/lib/studentNotes.mjs` keeps only the Doc's structure:
  headings, paragraphs, bold, italic and underline, links (Google's redirect
  wrappers removed), lists with nesting, tables, rules and Google-hosted
  images. Output is built from an allowlist. The roster is
  `netlify/lib/students.mjs`, server-only. Pages carry noindex and nothing
  links to them. Unknown addresses get a new "Page not found" page.
- **Reviews**: CLAUDE.md now has every session check for screenshots in
  `src/assets/reviews/` with no entry in `reviews.js`, and transcribe them.
  There never was an automated tool; past sessions did it when they noticed.

- Oliver Otto's Doc and his Drive materials folder are connected. The folder
  is read from Drive's embed view and listed in the site's styling (folders
  first, each with a type badge and date, opening in Drive), not framed.
  Student pages are centred throughout.

### Open items / ideas
- Once lukemarkham.com points at Netlify, the old Bandzoogle student links
  keep working as-is.

## 2026-09-28 (evening) — ii-Vs, Ear Trainer moved, piano samples

### What changed

- **ii-Vs** (`/ii-vs`, under Keys): a random major or minor key comes up.
  Play its ii and then its V on a MIDI keyboard, and the next key follows on
  its own about 1.4 s after the V lands. `src/lib/twoFives.js` checks each
  chord against the notes held down. It needs 3 or more notes including the
  3rd and 7th. The root and 5th are optional, and any other note must be a
  tension the chord takes. The ii is m7 in major and ø7 in minor. The V takes
  any usual dominant tension, natural or altered. A chord released without
  matching shows "Not the ii: that sounded like X". There is a Major / Minor /
  Both filter, a Sound on/off toggle (for keyboards without speakers), Show
  Answer, Skip, and stats: solved, streak, best, average time. Show Answer or
  Skip breaks the streak.
- **Ear Trainer** is now a top-level Practice Tools item, next to Metronome
  and Tempo Guessr. Keys holds only ii-Vs.

- ii-Vs now wants the resolution too: ii, V, then I, before moving on. The
  I needs its 3rd plus a 7th or 6th (maj7 or 6 in major). The minor i takes
  m6, m7 or m(maj7), and is shown as m6.
- ii-Vs plays what you play on a sampled acoustic piano: Salamander Grand
  Piano, CC BY 3.0, credited on the page. There are 21 MP3s in
  `public/audio/piano` (C2–C7, one every minor third, 1.3 MB), played through
  `src/lib/pianoSampler.js`, which also follows the sustain pedal. The synth
  piano covers the moment before the samples load.

### Open items / ideas

- Next for ii-Vs: specific extensions on the V (for example ♭9 in minor, 13
  in major), and maybe voice-leading checks.
- The Ear Trainer could use the sampled piano for its live notes too.

## 2026-09-28 (later) — Fill Generator rename, new Sticking Generator, Independence

### What changed

- **Fill Generator** (`/fill-generator`): the old Sticking Generator, renamed.
  Behaviour unchanged. This browser's fill history, downvotes and unsent votes
  move from `lm-sticking-*` to `lm-fill-*` keys once, on first load.
- **Sticking Generator** (`/sticking-generator`), new and hands-only: a 1, 2
  or 4-beat cycle chained from rudiment cells (`src/lib/handStickings.js`),
  repeated through a bar in 16ths or triplets, with optional accents on each
  cell's first stroke. No hand plays three in a row, including across the loop.
- **Independence** (`/independence`), new: four-limb exercises from
  `src/lib/independence.js`, in five families. Two are basics: comping under a
  swing ride, and a moving bass drum or ghost notes under a straight groove.
  Three draw on Ari Hoenig: a hand phrase with sticking over a foot ostinato
  (clave, bossa, samba, tumbao, Charleston, feathered 4), groupings that cycle
  against the bar (3s and 6s in 16ths, 3s in swung 8ths, 2s and 4s in
  triplets), and metric modulation, with either the hands or the feet playing
  time in the new tempo. Filter by Swing, Straight or Either. Every exercise
  is marked Swing or Straight. Swing is written in 8ths; straight is written in
  16ths or explicit triplets. Multi-bar exercises show the whole cycle, and a
  session's new exercise waits for the cycle to finish.
- **Notation**: `src/lib/drumNotation.js` draws grid-based grooves in
  VexFlow: hands stems up, feet stems down, with sticking and count rows and
  repeat barlines. Fills still use `fillNotation.js`.
- **Shared pieces**: `PracticeSession` (was `StickingPracticeSession`) takes
  an `itemName` and `cycleBars`. `GeneratorFeedbackDialog` takes the tool's
  tags. `drawFresh` handles history and downvotes for all three generators.
- **Feedback**: one function, `practice-feedback?tool=fill|sticking|independence`
  (`netlify/lib/practiceFeedback.mjs`), with a Blobs store per tool
  (`feedback-<tool>`). Archives are in `feedback/<tool>-feedback.json`. The
  old `sticking-feedback` function is gone. Its Blobs store holds only the
  archived deploy check.
- The Drums menu now lists Fill Generator, Sticking Generator and
  Independence, and the home page has cards for all three.

### Open items / ideas

- Luke is sending specific Ari Hoenig and Steve Lyman exercises. Steve Lyman's
  approach isn't modelled yet.
- Independence plays only a click. Playing the exercise back on drum sounds
  would help with the modulations and groupings.
- No quintuplet or 5- and 7-groupings yet: they take five or more bars to
  come around, and the grid has no quintuplets.

## 2026-09-28 — Practice Tools menu split into Drums and Keys

### What changed

- The Practice Tools nav dropdown now lists Drums, Keys, Metronome and Tempo
  Guessr. Drums and Keys open a flyout (hover, or tap on touch screens) with
  their tools: Sticking Generator and Ear Trainer. On phones the flyout opens
  in place under its row. The list is `practiceToolMenu` in `src/App.jsx`;
  an entry with `tools` becomes a submenu (`NavSubmenu`).

### Open items / ideas

- The home page's Practice Tools section is still one flat grid; it could
  mirror the Drums / Keys split.

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
