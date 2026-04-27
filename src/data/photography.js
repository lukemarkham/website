const photoModules = import.meta.glob(
  '../assets/photography/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,avif,AVIF}',
  { eager: true, import: 'default' },
)

function formatLabel(value) {
  return value
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleFromFilename(path) {
  const filename = path.split('/').pop() || 'Photo'
  return formatLabel(filename) || 'Photo'
}

function collectionFromPath(path) {
  const parts = path.split('/')
  const photographyIndex = parts.indexOf('photography')
  const collectionParts = parts.slice(photographyIndex + 1, -1)

  return collectionParts.map(formatLabel).filter(Boolean).join(' / ')
}

export const photographyShots = Object.entries(photoModules)
  .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
  .map(([path, src]) => {
    const title = titleFromFilename(path)
    const collection = collectionFromPath(path)

    return {
      id: path,
      src,
      alt: title,
      title,
      location: collection,
    }
  })
