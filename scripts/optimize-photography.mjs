import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

// Full-resolution originals live outside the repo so they never get committed.
// Override with PHOTO_SOURCE=/some/other/folder npm run photography:optimize
const sourceRoot = process.env.PHOTO_SOURCE
  ? path.resolve(process.env.PHOTO_SOURCE)
  : path.join(os.homedir(), 'Pictures', 'Website Photography')

// The optimized WebPs *are* committed — that is what Netlify builds and ships.
const outputRoot = path.resolve('src/assets/photography-optimized')
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif'])
const maxWidth = 1800
const webpQuality = 78

async function findImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const images = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }

    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      images.push(...await findImages(entryPath))
      continue
    }

    if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      images.push(entryPath)
    }
  }

  return images
}

function outputPathFor(sourcePath) {
  const relativePath = path.relative(sourceRoot, sourcePath)
  const parsedPath = path.parse(relativePath)

  return path.join(outputRoot, parsedPath.dir, `${parsedPath.name}.webp`)
}

async function isUpToDate(sourcePath, destinationPath) {
  try {
    const [source, destination] = await Promise.all([
      stat(sourcePath),
      stat(destinationPath),
    ])

    return destination.mtimeMs >= source.mtimeMs
  } catch {
    return false
  }
}

async function optimizeImage(sourcePath) {
  const destinationPath = outputPathFor(sourcePath)

  if (await isUpToDate(sourcePath, destinationPath)) {
    return { destinationPath, skipped: true }
  }

  await mkdir(path.dirname(destinationPath), { recursive: true })
  await sharp(sourcePath)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: webpQuality })
    .toFile(destinationPath)

  return { destinationPath, skipped: false }
}

// Drop optimized files whose original has been renamed or deleted, so removing a
// photo from the source folder also removes it from the site.
async function pruneOrphans(expectedPaths) {
  const existing = await findImages(outputRoot).catch(() => [])
  const expected = new Set(expectedPaths)
  const orphans = existing.filter((entryPath) => !expected.has(entryPath))

  await Promise.all(orphans.map((orphan) => rm(orphan, { force: true })))

  return orphans.length
}

async function main() {
  const sourceExists = await stat(sourceRoot).then((entry) => entry.isDirectory()).catch(() => false)

  // Netlify (and any fresh clone) has no originals — the committed WebPs are
  // already correct, so leave them untouched rather than wiping the gallery.
  if (!sourceExists) {
    console.log(`No photography source at ${sourceRoot} — using the committed optimized images.`)
    return
  }

  await mkdir(outputRoot, { recursive: true })

  const images = await findImages(sourceRoot)
  const results = await Promise.all(images.map(optimizeImage))
  const pruned = await pruneOrphans(results.map((result) => result.destinationPath))

  const written = results.filter((result) => !result.skipped).length
  const skipped = results.length - written
  const summary = [
    `Optimized ${written} photography image${written === 1 ? '' : 's'}`,
    skipped > 0 ? `${skipped} unchanged` : null,
    pruned > 0 ? `${pruned} removed` : null,
  ].filter(Boolean)

  console.log(`${summary.join(', ')}. Source: ${sourceRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
