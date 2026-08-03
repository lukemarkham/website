# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Photography

Drop full-resolution originals into `src/assets/photography/`. That folder is **gitignored** — the originals stay on your machine and never bloat the repo.

`scripts/optimize-photography.mjs` reads it and writes resized WebPs (max 1800px wide, quality 78) to `src/assets/photography-optimized/`, which **is** committed — that is what Netlify builds and what the site serves. `src/data/photography.js` globs the optimized folder, deriving each photo's title from its filename and its collection from any subfolder.

### Adding a photo

1. Drop the full-res file into `src/assets/photography/` (subfolders become collection labels).
2. Run `npm run dev` — the `predev` hook optimizes it automatically.
3. Commit the new `.webp` in `src/assets/photography-optimized/` and push.

Step 3 needs `git add -A` (or a GUI). The new WebP is an untracked file, so `git commit -am` will silently skip it and the photo will never reach the site.

### Removing a photo

Delete the original and re-run the script — it prunes the orphaned WebP, which shows up as a normal tracked deletion. Removing the *last* photo is the exception: the script treats an empty source folder as "nothing to do" (see below), so delete its WebP by hand.

### Notes

- Unchanged photos are skipped by timestamp, so repeat runs are fast.
- `PHOTO_SOURCE=/path/to/photos npm run photography:optimize` points the script somewhere else, e.g. an external drive.
- When the source folder is empty or missing — on Netlify, or any fresh clone — the script no-ops and leaves the committed WebPs alone, so the build still succeeds.
- Because the originals are gitignored, git is **not** backing them up, and `git clean -xfd` would delete them. Keep them somewhere else too.
