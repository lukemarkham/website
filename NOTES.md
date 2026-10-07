# Working notes

A running log of what changed and what's still open, so work can pick up on
either machine. Newest first.

## 2026-10-07 — ii-Vs becomes Chord Progressions

### What changed

- **Renamed** Chord Progressions, at `/chord-progressions` (`/ii-vs`
  redirects). `src/lib/twoFives.js` became `src/lib/chordProgressions.js`.
- A key and a progression come up, and each chord is played in turn on a
  MIDI keyboard. Seven types, each toggled on its own in a Progressions row
  (all on by default, never none, remembered in localStorage). Each type is
  as likely as the next, however many progressions it holds:
  - **ii–Vs**: ii–V–I, minor iiø–V–i.
  - **Backdoor**: iv7–♭VII7–I, and ii–V into the backdoor.
  - **Tritone subs**: ii–♭II7–I, minor iiø–♭II7–i, ♭vi7–♭II7–I, and the
    I–♭III7–ii–♭II7 turnaround.
  - **Turnarounds**: I–vi–ii–V, I–V/ii–ii–V, iii–V/ii–ii–V, minor
    i–♭VImaj7–iiø–V.
  - **Secondary ii–Vs**: to IV, ii, vi and V (ii/IV–V/IV–IVmaj7 and so on).
  - **Neo soul**: IVmaj7–V/vi–vi7, minor plagal IVmaj7–iv–I, ii–V7sus–I,
    iv–V7sus–i, ♭VImaj7–♭VII7–I.
  - **Passing diminished**: I–♯i°7–ii–V, iii–♭iii°7–ii–V.
- The Keys filter (Both / Major / Minor) stays. Minor with only
  major-key types picked shows a note instead of a question.
- Chord boxes are labelled in chart parlance (ii7, V7, ♭II7, V/ii, iiø/vi,
  ♯i°7, V7sus) so the quality is never a guess, with the progression's name
  under the key. Spelling goes through `chordSymbol`, so ♭II in A is B♭.
- New chord checks: a sus V needs the 4th and ♭7 and no 3rd; a non-tonic
  maj7 needs 3rd and 7th; °7 needs ♭3 and °7; the minor-plagal iv takes m6
  or m7.
- A chord now only counts once a key has gone down since the last chord
  matched. Without that, letting go of a Cmaj7 could play the Am7 its top
  notes spell, and a Dm7 could double as the G7sus after it.
- Checked in headless Chrome with a fake MIDI input: progressions of every
  length solved, the empty-filter note shows, and five-chord progressions
  wrap 3 + 2 on a phone with no sideways scroll.

### Sight Reading feedback (3 downvotes from 2026-10-06)

- **Beat 3 always shows**: a note from beat 2 that runs past beat 3 is a
  quarter tied to the rest, never a dotted quarter (`notePieces`).
- **Bar 1 looked different**: the hand-drawn rehearsal boxes, bar numbers
  and repeat wings left their line width and colour on the VexFlow context,
  so every stave after bar 1 drew at 1.5px and some clefs came out grey.
  That drawing is now inside `ctx.save()` / `ctx.restore()`.
- **Muddy walking bass at fast tempos**: the upright's 0.3 s release came on
  top of the written length. In Sight Reading it now fits inside it, so no
  bass note rings into the next. `BASS_INSTRUMENTS.upright` takes an
  optional `release`; the Ear Trainer's bass is unchanged.

### Open items / ideas

- Luke to play through each type and say what is missing (Coltrane
  changes, chromatic ii–Vs, sus planing and Rhythm changes are in the Ear
  Trainer's list and could come across).
- Still open from ii-Vs: specific extensions on the V, voice-leading checks.

## 2026-10-05 — Set Ups becomes Sight Reading: solos, repeats, directions

### What changed

- **Renamed** Sight Reading, at `/sight-reading` (`/set-ups` redirects).
  The feedback tool id stays `setups`, so the archive and votes carry on.
- **Drum solo in every piece** (`pickForm`, `src/lib/setUps.js`). 8 bars:
  4 bars of tune, then a 4-bar solo around figures ending on the final hit.
  16 bars: an 8-bar tune, then an 8-bar solo around figures. 32 bars (AABA):
  swing trades 4s (one 8-bar section or two) or 8s (two sections), or solos
  around figures; straight 8ths, Latin and bossa solo around figures. A
  solo in the middle is followed by a section marked "Time".
  - Trading: the band's turn comes first. In the drummer's turn the band
    lays out completely: no bass, no comping.
  - Around figures: band figures in the staff, about three bars in five and
    never more than two empty bars in a row. The band plays only the hits.
  - The drummer's turns get a "SOLO" bracket, drawn like the FILL one.
- **Repeats** with winged repeat signs (wings drawn by hand in
  `chartNotation.js`). Each piece has an 80% chance of one: a whole
  8-bar section played twice, or 4 bars of a tune section played 2, 3 or 4
  times, with "3x"/"4x" over the end repeat. A solo or trade repeats whole.
  The last bar never repeats, and no fill, figure or tie crosses a repeat
  sign. There's a new **Repeats On/Off** control.
  - Scrolling: until the last time through, the chart holds with the
    repeated section's first line at the top, so the whole section stays in
    view for the jump back. Checked in headless Chrome over a 4x repeat:
    it held for all four passes, then moved on, never jumping backwards.
  - The band plays the piece as performed (`performPhrase`), each played
    bar taking its written bar's chords.
- **Directions over the staff** (`planMarks`): swing starts in "2 feel"
  about two pieces in three, often "2 feel, walk 2nd x" over a repeat
  from bar 1, then "Walk" or "In 4" at the next section. In 2 the bass
  plays half notes on 1 and 3. Straight 8ths: "Hi-hats", then "To ride" /
  "To hi-hats". Latin: "Hi-hats" or "Cáscara", then "To ride" or "To bell".
  Bossa: "Cross stick", then "To ride". Solos are headed "Trade 4s",
  "Trade 8s" or "Solo around figures".
- The feedback key has a fifth part, the form (see `CLAUDE.md`); the
  feedback function's key check was widened to accept it.
- Checked: 8,000 pieces across every length, feel and setting break no rule
  (no time sounding in a solo, 2 feel only on 1 and 3, every played figure
  has horns, nothing over a repeat sign, keys accepted by the function).

### Open items / ideas

- Luke to read through a few of each and play them: the mark wording, how
  dense the solo figures are, and whether trading should sometimes start
  with the drums.
- 1st and 2nd endings would be the natural next step after plain repeats.
- During the band's turn when trading, only the rhythm section plays. A
  horn soloist line would make it sound more like real trading.

## 2026-10-03 — Set Ups: "All" feel

### What changed

- The Feel control has an **All** chip. Each new phrase then picks a feel
  at random, weighted swing 3 : straight 2 : bossa 1 (it can repeat), and
  a tempo from that feel's own range;
  the Tempo Range slider is replaced by "Set by each feel" while All is on.
- Bossa bass now plays the traditional bar: root on 1, fifth on the & of 2,
  fifth on 3, root on the & of 4. A pattern note that lands under a band
  figure drops out, so the bass plays the figure instead of doubling it.
- New **Latin** feel (straight 8ths, 150–210 BPM): a tumbao bass on the
  & of 2 and beat 4, the 4 anticipating the next bar's root and held over
  the barline, under a two-bar montuno-style piano comp, with Afro-Cuban
  jazz changes (minor montuno vamp, mambo minor ii–Vs, a major tune). All's
  weights are now swing 6 : straight 4 : Latin 3 : bossa 2.

## 2026-10-03 (end of day) — Set Ups ties and stem direction

### What changed

- Luke's two notes (archived): rhythmic slashes in the staff are now stems
  down, and ties are heavier and more arched (`renderOptions` cp1 12, cp2
  19), drawn over the notes, so one over a barline no longer blends in. The
  fill bracket over hits inside a fill sits lower now the stems point down.

### Open items / ideas

- Luke still to listen to the Straight 8ths and Bossa Nova bands and the mix.
- Towards full charts: ensemble 8th-note lines, dynamics, more forms (blues,
  32-bar ABAC).

## 2026-10-03 (later) — Set Ups: longer pieces, scrolling, styles, Luke's fill rules

### What changed

- **Luke's notes** (archived with reviews): the fill line takes no rhythmic
  space; fill brackets start and end on downbeats (barline to barline for a
  full bar); figures in any bar with fill are written in the staff as
  rhythmic slashes (`note.staff`), with an 8th rest showing an &, and plain
  slashes on beats with nothing written; the piece ends on its final figure
  in the last bar, with rests after it, on the tonic.
- **Lengths**: 8, 16 or 32 bars (default 32: 6–7 set-ups). Rehearsal
  letters every eight bars with double bars between sections; 32 bars play
  AABA over one A and a bridge.
- **Scrolling**: the chart sits in a window that fits the screen. When a
  session starts the board scrolls into view, then the chart slides with the
  music (`scrollToBeat`), the current line rising from the second row to the
  top so the next lines are always visible. Checked in headless Chrome over
  a whole 32-bar piece at 1280×800.
- **Styles**: Swing (100–200), Straight 8ths (90–140) and Bossa Nova
  (110–150), each with its own progressions and bridge. Straight 8ths has an
  8th-note bass groove and busier comping; bossa has root–fifth bass in the
  bossa rhythm and the two-bar comping pattern. Both play &s straight.
- Fixed: the chart was drawn 16px short, clipping the last line.
- Checked: 6,000 pieces across all lengths and styles break no rule.

## 2026-10-03 — Set Ups: hits inside fills, ending on a hit, a rhythm section

### What changed

- **Hits inside fills** (`role: 'fillHit'`): 30% of 2-beat fills and 50% of
  1-bar fills have one or two short band hits in them, never in the fill's
  first or last 8th. They're written in the staff as rhythmic slashes
  (stemmed slash noteheads with ^, an 8th rest before an &), and the bracket
  rises over them. Key: `beats@figure+fillHits`.
- **Phrases end on a hit**: the last set-up's figure starts in the last two
  bars, and no rhythm cue comes after its fill.
- **Band** (`src/lib/setUpBand.js`): each 8 bars takes one of five
  standard-style progressions (rhythm changes A, I–VI–ii–V, A Train II7,
  Autumn Leaves-style cycle, Bird-style ii–Vs) in F, B♭, E♭, C, G or A♭, all
  ending on the tonic.
  - The bass walks in quarters: the root on each chord change, chord tones
    in between, and a chromatic or fifth-below approach into the next root.
    It catches set-ups and fill hits with the horns, then walks on.
  - The piano (sampled Salamander, new `playAt` in `pianoSampler.js`) comps
    in bars with nothing written, plays every figure, and lays out under
    fills.
  - The horns voice the chord sounding at the time; a figure on an &
    anticipates the next beat's chord.
  - Walking and comping stop at the final set-up.
- Settings: Band (Full band / Horns only / Off) and Click (On / Off). The
  count-off always clicks (`click` prop on `PracticeSession`).
- Checked: 4,000 phrases break no rule (including band range, no comping in
  fills, nothing after the final hit). In headless Chrome every bass, piano
  and horn note lands on the beat or the swung &.

### Open items / ideas

- Mix levels and sounds are set by reasoning, not by ear: Luke to listen.
- Next towards full charts: rehearsal letters, ensemble 8th-note lines,
  dynamics, more forms (blues, AABA 32).

## 2026-10-02 (late night) — Set Ups engraving rules from Luke's notes

### What changed

Seven downvotes, all engraving (archived in `feedback/setups-feedback.json`).
The rules now sit at the top of `src/lib/chartNotation.js`:

- A note on the & of 1 or the & of 3 that lasts to the middle or end of the
  bar is a dotted quarter (tied on over the barline if it carries on).
- Under a fill, the 8th rest before an off-beat figure is always printed.
- Figures sit exactly over their slashes. Both voices had stems up, so
  VexFlow nudged the cue noteheads aside; the slashes' hidden stems now
  point down.
- A lone held hit on the beat is a quarter with a tenuto (new articulation,
  key code `t`), not a dotted quarter and an 8th rest. A dotted quarter
  straight into another note stays.

## 2026-10-02 (night) — Set Ups: 8-bar phrases, engraving, rhythm cues

### What changed

- **Phrases** are 8 bars (2 set-ups) or 16 bars (3 or 4), one set-up per
  stretch of the phrase. The fill starts in bar 2 at the earliest and always
  runs straight into its figure, with at least a beat of space after the
  figure before it.
- **Figures** (`SETUP_FIGURES`): single short or held hits, pushes on the &
  of 4 tied over the barline, "doo-DAT" (& into a short beat), "da-DAT",
  held-then-kick, staccato quarters into a punch, and off-beat stabs.
  Pushes and downbeats come up twice as often.
- **Rhythm cues** (on by default): free bars after bar 1 get a one-bar
  comping rhythm 60% of the time (`CUE_FIGURES`). The band plays them
  quieter than the set-ups.
- **Engraving** (Luke's three downvotes, archived): rests combine, so beats
  1–2 or 3–4 make a half rest, three beats from beat 1 or 2 a dotted half, and
  an empty bar a whole rest. Beats 2–3 stay two quarters so beat 3 shows,
  per the usual 4/4 rule. Notes split at beats and barlines with ties drawn
  over the notes, and a tie across a line break is drawn in two halves.
  No rests are printed under a fill.
- **Fill bracket**: now just over the staff, ticked at both ends, from the
  first fill slash to the figure. The slashes under it take the bracket's
  colour.
- **Tempo marking**: "Swing ♩ = 160" over bar 1, as on a part. Bar numbers
  at the start of each line.
- Checked: 5,000 generated phrases break no placement rule, and in headless
  Chrome the band's hits land on every written slot.

## 2026-10-02 (evening) — Set Ups

### What changed

- **Set Ups** (`/set-ups`, under Drums, and on the home page): four bars of
  time with one ensemble hit, drawn like a big band drum part
  (`src/lib/chartNotation.js`): stemless slashes, the figure cued in rhythm
  above the staff, and a "(FILL - - -|" bracket that always runs straight
  into the hit. The fill starts in bar 2 at the earliest. Hits are short
  (^: a quarter on the beat, an 8th off it) or long (>: a half note on the
  beat, an 8th tied into the next beat off it), and stay inside their bar.
  Settings: Swing / Straight, fill length (1 beat, 2 beats, 1 bar, Mix),
  Band on/off, tempo range (default 100–180).
- The band plays the hit on a synthesized brass voicing (`playHornHit`), with
  an & swung to the last third of the beat. Checked in headless Chrome:
  hits land on the written bar and beat, 2/3 of a beat after the click in
  swing, 1/2 in straight.
- `PracticeSession` gained `onBeat` (lets a page play along with the click),
  `rotationOptions` and `defaultRotation`, and an "Every phrase" rotation
  (`PRACTICE_EVERY_CYCLE`), which Set Ups uses by default.
- Feedback: tool `setups`, archive `feedback/setups-feedback.json`.

### Open items / ideas

- Where this is heading (Luke's goal): generated big band sight-reading
  charts, modelled on real drum parts (rehearsal letters, figures over
  slashes, ties across barlines, staccatos, ensemble 8th-note lines, fill
  brackets, dynamics, repeats). The play-along would follow jazz standard
  harmony with a walking bass, simple piano comping, and horn hits on the
  figures, so students can hear whether they're reading it correctly.
  Get Set Ups right first.
- (Done in the night entry.) Next for Set Ups: figures of two or more notes, anticipations tied over
  the barline (the & of 4 pushed into the next bar), staccato quarters.

## 2026-10-02 (later) — Click count-off replaces the spoken count-in

### What changed

- The generators' practice sessions (Fill, Sticking, Independence) now count
  off on the click: a bar of half notes, then a bar of quarters, at the new
  item's tempo. The spoken count-in felt late because each word peaks 75–117
  ms after its beat, by a different amount per word. The WAVs and
  `scripts/generate-count-in.sh` are gone, which also settles the voice
  licence question. CLAUDE.md makes this count-off the standard.
- Checked in headless Chrome across two fill changes: at 144 and 141 BPM the
  half notes and quarters land within a millisecond of the grid.

## 2026-10-02 — Sourced fills in the Fill Generator

### What changed

- **Sourced fills**: `SOURCED_FILLS` in `App.jsx` holds fills written out
  whole, each with a `source`. The first is Luke's `RLKKRLRLKRLKRLRL`
  (16ths, 4 beats), source "Original". When the settings fit (rate, length,
  and the landing passes the playability rules), a draw offers a sourced fill
  1 time in 4 (`SOURCED_FILL_CHANCE`), still subject to history and
  downvotes. It's played as written, never mirrored.
- A badge in the board's top-right corner names the source while a sourced
  fill is up. Built From shows "<source> fill". Votes on it carry `source`,
  and the feedback validator now accepts cells up to 32 strokes.

### Open items / ideas

- Fills from other drummers go in `SOURCED_FILLS` with the drummer's name as
  `source`. A fill that only works on one landing needs no flag: the rules
  check pick its landings.

## 2026-09-30 — Chuck Anello's page, floating metronome

### What changed

- Added `/chuck-anello`, connected to his practice log Doc (checked it's
  shared publicly), plus his Drive materials folder.
- **Floating metronome on every student page** (`FloatingMetronome` in
  `App.jsx`): a bottom-left pill with play/pause and a BPM field (bottom-right
  is the Twitch card). The chevron opens beat dots, a tempo slider with ±1,
  tap tempo, beats per bar, subdivision (quarter, eighth, triplet, sixteenth),
  an accent on beat 1, volume and a session timer run off its transport.
  Settings are remembered per browser. Checked in headless Chrome: stays
  pinned while scrolling, and 120 BPM eighths land 0.25 s apart.

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
- (Done 2026-10-02: replaced by a click count-off.) Listen to the spoken count-in. Swap the voice or record your own if it's
  off. Apple's voice licence may not cover a public site, so own recordings
  are the safer bet before launch.
- The feedback endpoint has no authentication. Add a key before the site is
  shared publicly.
- Phones: a full 4-beat bar of notation scrolls sideways, and the Ear
  Trainer's timer sits at the bottom of the page. Both are fine for now.
