# Working in this repo

## Start every session with a pull

Begin each new session by running `git pull`. Luke works on this site from two
different machines, so the local checkout is often behind — pulling first avoids
editing stale files and creating conflicting commits.

Then read `NOTES.md` for what changed last session and what's still open, and
add a dated entry there at the end of a working session.

## Deployment

Netlify builds and deploys from `main`, so pushing to `main` publishes the site.

## Photography

Originals go in the gitignored `src/assets/photography/`; only the generated
WebPs in `src/assets/photography-optimized/` are committed. See the Photography
section of `README.md` for the full workflow and its gotchas. The music
site's hero photos work the same way: originals in the gitignored
`src/assets/hero-photos/`, committed WebPs in
`src/assets/hero-photos-optimized/` (`npm run hero:optimize`).

## Reviews

The home page review gallery reads Luke's SoundBetter profile once a day
(`netlify/functions/soundbetter-reviews.mjs`, parsing in
`netlify/lib/soundbetterReviews.mjs`) and shows any 5-star review newer than
the saved ones in `src/data/reviews.js`, newest first. The profile only shows
the 20 most recent, so the saved list is what keeps older reviews on the
site. After the start-of-session pull, run `npm run reviews:sync`: it appends
reviews the saved list is missing. Fix only obvious typos in what it adds (a
saved review's wording wins over SoundBetter's), commit, and tell Luke which
reviews were added. Screenshots are no longer needed; the old ones in
`src/assets/reviews/` are only history.

## Student pages

Each student has an unlisted notes page at `/<first-last>` (for example
`/oliver-otto`, matching the addresses on Luke's old Bandzoogle site). The
content is a Google Doc Luke edits directly; the page fetches it on every
load through `netlify/functions/student-notes.mjs` and restyles it, so note
updates never touch the code. To add a student, add an entry to
`netlify/lib/students.mjs` with their name, the Doc's sharing link, and
optionally a Google Drive folder of teaching materials, which is listed at the
bottom of the page. The Doc and folder must be shared as "anyone with the link
can view", or the page shows an error saying so. Student pages are centred
throughout, at Luke's request. The roster is server-only, so the site's code never lists students.

## Bio

`/bio` shows Luke's bio from a Google Doc he edits (ID in
`netlify/lib/bio.mjs`), restyled like the student pages but left-aligned.
Netlify's CDN caches it for five minutes.

## Practice tools

Every practice tool gets a session timer. Drop in the shared `<PracticeTimer />`
(pass `onComplete` to stop the tool's own playback when time is up). Tools with
their own Start/Stop transport, like the metronome and the drum generators,
run the countdown off that transport instead, finishing with
`playSessionCompleteSound`. Every timer's end also opens the shared
`<SessionCompleteDialog />` (add 5, 10 or a chosen number of minutes).
Time running out never cuts off an exercise in progress: the timer reads
"Finishing" and the session ends once the exercise does. `PracticeSession`
plays the current cycle out; with `<PracticeTimer />`, pass `busy` while a
question is asked and not yet answered (Ear Trainer, Tempo Guessr, Chord
Progressions).

Anything that counts the player in uses the standard count-off on the tool's
own click: a bar of half notes, then a bar of quarters, then time starts
(`COUNT_OFF_BEATS` and `countOffCount` in `App.jsx`). No spoken count-ins:
the words' attacks never sit on the beat.

## Practice log

Students (and Luke, PIN 4315) enter a four-digit PIN in the nav (last item, shown
only on practice pages) and their time with each tool is logged, shown on their student page and at
`/practice-stats`. Students choose their own PIN and tell Luke; add it as
`pin` on their entry in `netlify/lib/students.mjs` (PINs must be unique;
people without a notes page go in `PRACTICE_ONLY` there). A new practice
tool goes in `practiceToolMenu` (which also puts the PIN in its nav) and gets `usePracticeLog(tool,
isPlaying)` (or `useRecentActivity()` when it has nothing to start), with
its id added to `PRACTICE_TOOLS` and `PRACTICE_TOOL_LABELS`
(`netlify/lib/practiceLog.mjs`, `src/lib/practiceLog.js`).
A timed metronome session (page or floating) ends by asking whether it
counts as drums or keys, and for drums which kind (matching the Command
Calendar's drum tasks); its time is held back until then and logged as
`metronome-drums-independence`, `-sticking`, `-vocab`, `metronome-drums`
(general), `metronome-keys` or plain `metronome` (`METRONOME_CATEGORIES`).
Luke's Command Calendar app (`~/calendar`, `practice-sync.js`) reads his
totals by PIN to tick off practice tasks, so keep the tool ids and the
`?pin=` response shape stable, or update it there too.

## Answer stats

The quiz tools (Ear Trainer, Chord Progressions) time each answer with the
shared `useAnswerTimer` and record right/wrong per kind of question with
`useAnswerStats(tool)` (`src/lib/answerStats.js`), stored under the
practice-log PIN by `netlify/functions/answer-stats.mjs` (browser-only
without a PIN). Questions the person misses come up more and ones they
answer quickly come up less (`answerWeight`, `src/lib/answerWeights.js`).
Item ids are `p:<progression id>`, `c:<progression id>:<chord index>` and,
on Chord Progressions, `k:<key pitch class>`, so renaming a progression id
or reordering its chords orphans its record. Results show on student
pages and /practice-stats under "Answers". The drum tools don't take part:
their success is self-reported.

## Practice generator feedback

Luke votes mid-practice on what the Fill Generator, Sticking Generator,
Independence tool, Sight Reading (formerly Set Ups; tool id still `setups`), the Ear Trainer (`ear-training`) and Chord Progressions (`chord-progressions`) produce, and downvotes carry notes meant for you. Only Luke votes: the vote buttons show only while his PIN is entered (`useCanVote`), and the endpoint rejects votes without it. After the
start-of-session pull, fetch each tool's entries:

    for tool in fill sticking independence setups ear-training chord-progressions; do
      curl -s "https://lukemarkham.netlify.app/.netlify/functions/practice-feedback?tool=$tool"
    done

Entries come back oldest first. Compare their `id`s with
`feedback/<tool>-feedback.json`, the committed archive of entries already
reviewed. If there are new ones, summarise them for Luke, propose (or make)
the generator changes they point to, then append them to the archive with a
`review` field saying what was done, and commit. Independence entries carry a
`key` that spells out the whole exercise (format in `exerciseKey`,
`src/lib/independence.js`), and Sight Reading keys spell out the piece as
`feel|bars|fillBeats@notes;…|cueNotes|form`, each note `slot-slots` plus `m`
(marcato), `a` (accent), `t` (tenuto) or `s` (staccato). The form is
`/`-separated: `t<bar>-<bars>` a tune section, `x<turn>@<bar>-<bars>`
trading, `s<bar>-<bars>@<notes>` a solo around figures, `r<bar>-<bars>x<times>`
the repeat and `m<bar>:<id>` a direction over the staff, bars counted from 0
(`generateSetUpPhrase`, `src/lib/setUps.js`). Keys from before 2026-10-05
have no form part. Ear Trainer keys spell out the question as heard:
`progression|key pc|chords|blanks|instrument/bass/pattern`, each chord
`numeral.root.quality[.secondary]` after shading (`questionKey` in
`App.jsx`); `answers` holds what was typed for each blank and its grade,
and is absent when the answer was revealed. Chord Progressions keys are
`progression id|key pc|chord symbols`, with `reached` (chords played right
when the vote was cast) and `revealed`. Votes cast against the local dev server land in
the gitignored `feedback/<tool>-feedback.dev.json`, so check those too on the
machine that ran it.
