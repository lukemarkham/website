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
section of `README.md` for the full workflow and its gotchas.

## Reviews

The home page review gallery shows text from `src/data/reviews.js`; the
SoundBetter screenshots in `src/assets/reviews/` are only source material, and
Luke adds new ones without transcribing them. After the start-of-session pull,
check that every `screenshot_review_<id>.png` has a `review-<id>` entry:

    diff <(ls src/assets/reviews | sed -n 's/^screenshot_review_\(.*\)\.png$/\1/p' | sort) \
         <(grep -o "review-[0-9]*" src/data/reviews.js | sed 's/review-//' | sort)

For each screenshot missing an entry, read the image and append `{ id, quote,
source, stars }` in id order, keeping the reviewer's wording (fix only obvious
typos; if a screenshot is cut off, keep the complete sentences). Commit the
screenshot with its entry and tell Luke which reviews were added.

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

## Practice tools

Every practice tool gets a session timer. Drop in the shared `<PracticeTimer />`
(pass `onComplete` to stop the tool's own playback when time is up). Tools with
their own Start/Stop transport, like the metronome and the drum generators,
run the countdown off that transport instead, finishing with
`playSessionCompleteSound`.

Anything that counts the player in uses the standard count-off on the tool's
own click: a bar of half notes, then a bar of quarters, then time starts
(`COUNT_OFF_BEATS` and `countOffCount` in `App.jsx`). No spoken count-ins:
the words' attacks never sit on the beat.

## Practice generator feedback

Luke votes mid-practice on what the Fill Generator, Sticking Generator,
Independence tool and Sight Reading (formerly Set Ups; tool id still `setups`) produce, and downvotes carry notes meant for you. After the
start-of-session pull, fetch each tool's entries:

    for tool in fill sticking independence setups; do
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
have no form part. Votes cast against the local dev server land in
the gitignored `feedback/<tool>-feedback.dev.json`, so check those too on the
machine that ran it.
