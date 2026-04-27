import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceRoot = path.resolve('src/assets/photography')
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

async function optimizeImage(sourcePath) {
  const destinationPath = outputPathFor(sourcePath)

  await mkdir(path.dirname(destinationPath), { recursive: true })
  await sharp(sourcePath)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: webpQuality })
    .toFile(destinationPath)

  return destinationPath
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })

  const images = await findImages(sourceRoot)
  await Promise.all(images.map(optimizeImage))

  console.log(`Optimized ${images.length} photography image${images.length === 1 ? '' : 's'}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
