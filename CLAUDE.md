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
