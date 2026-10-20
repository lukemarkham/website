// Saves reviews from SoundBetter that src/data/reviews.js doesn't have yet.
// The live page only ever shows the 20 most recent, so this file is what
// keeps the older ones on the site. Run at the start of a session
// (`npm run reviews:sync`) and commit what it adds.
import { readFile, writeFile } from 'node:fs/promises'
import { fetchSoundBetterReviews } from '../netlify/lib/soundbetterReviews.mjs'

const FILE = new URL('../src/data/reviews.js', import.meta.url)

const source = await readFile(FILE, 'utf8')
const saved = new Set(source.match(/review-\d+/g) ?? [])
const fresh = (await fetchSoundBetterReviews())
  .filter((review) => !saved.has(review.id))
  .sort((a, b) => Number(a.id.slice(7)) - Number(b.id.slice(7)))

if (fresh.length === 0) {
  console.log('Reviews are up to date.')
} else {
  const entries = fresh
    .map((review) => `  {\n    id: '${review.id}',\n    quote:\n      ${JSON.stringify(review.quote)},\n    source: ${JSON.stringify(review.source)},\n    stars: ${review.stars},\n  },\n`)
    .join('')
  const end = source.lastIndexOf(']')
  await writeFile(FILE, source.slice(0, end) + entries + source.slice(end))
  fresh.forEach((review) => console.log(`Added ${review.id} by ${review.source}: ${review.quote.slice(0, 60)}…`))
}
