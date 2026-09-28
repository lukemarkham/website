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

## Practice tools

Every practice tool gets a session timer. Drop in the shared `<PracticeTimer />`
(pass `onComplete` to stop the tool's own playback when time is up). Tools with
their own Start/Stop transport, like the metronome and the drum generators,
run the countdown off that transport instead, finishing with
`playSessionCompleteSound`.

## Practice generator feedback

Luke votes mid-practice on what the Fill Generator, Sticking Generator and
Independence tool produce, and downvotes carry notes meant for you. After the
start-of-session pull, fetch each tool's entries:

    for tool in fill sticking independence; do
      curl -s "https://lukemarkham.netlify.app/.netlify/functions/practice-feedback?tool=$tool"
    done

Entries come back oldest first. Compare their `id`s with
`feedback/<tool>-feedback.json`, the committed archive of entries already
reviewed. If there are new ones, summarise them for Luke, propose (or make)
the generator changes they point to, then append them to the archive with a
`review` field saying what was done, and commit. Independence entries carry a
`key` that spells out the whole exercise (format in `exerciseKey`,
`src/lib/independence.js`). Votes cast against the local dev server land in
the gitignored `feedback/<tool>-feedback.dev.json`, so check those too on the
machine that ran it.
