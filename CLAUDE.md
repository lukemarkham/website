# Working in this repo

## Start every session with a pull

Begin each new session by running `git pull`. Luke works on this site from two
different machines, so the local checkout is often behind — pulling first avoids
editing stale files and creating conflicting commits.

## Deployment

Netlify builds and deploys from `main`, so pushing to `main` publishes the site.

## Photography

Originals go in the gitignored `src/assets/photography/`; only the generated
WebPs in `src/assets/photography-optimized/` are committed. See the Photography
section of `README.md` for the full workflow and its gotchas.

## Practice tools

Every practice tool gets a session timer. Drop in the shared `<PracticeTimer />`
(pass `onComplete` to stop the tool's own playback when time is up). Tools with
their own Start/Stop transport, like the metronome and the sticking generator,
run the countdown off that transport instead, finishing with
`playSessionCompleteSound`.

## Sticking generator feedback

Luke votes on generated stickings mid-practice, and downvotes carry notes
meant for you. After the start-of-session pull, fetch them:

    curl -s https://lukemarkham.netlify.app/.netlify/functions/sticking-feedback

Entries come back oldest first. Compare their `id`s with
`feedback/sticking-feedback.json`, the committed archive of entries already
reviewed. If there are new ones, summarise them for Luke, propose (or make)
the generator changes they point to, then append them to the archive with a
`review` field saying what was done, and commit. Votes cast against the local
dev server land in the gitignored `feedback/sticking-feedback.dev.json`, so
check that too on the machine that ran it.
