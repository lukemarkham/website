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

Full-resolution originals are **not** committed. They live on the local machine in:

```
~/Pictures/Website Photography/
```

`scripts/optimize-photography.mjs` reads that folder and writes resized WebPs (max 1800px wide, quality 78) to `src/assets/photography-optimized/`, which **is** committed — that is what Netlify builds and what the site serves. `src/data/photography.js` globs the optimized folder, deriving each photo's title from its filename and its collection from any subfolder.

### Adding or removing photos

1. Drop the full-res file into `~/Pictures/Website Photography/` (subfolders become collection labels).
2. Run `npm run photography:optimize` — or just `npm run dev`, which runs it first.
3. Commit the new `.webp` files in `src/assets/photography-optimized/`.

Deleting an original and re-running the script removes its WebP too. Unchanged photos are skipped, so repeat runs are fast.

Point the script at a different folder with `PHOTO_SOURCE=/path/to/photos npm run photography:optimize`.

When the source folder is missing — on Netlify, or a fresh clone — the script no-ops and leaves the committed WebPs alone, so the build still succeeds.
