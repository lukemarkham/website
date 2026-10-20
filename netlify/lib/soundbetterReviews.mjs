// Luke's reviews as his SoundBetter profile shows them: the 20 most recent,
// newest first, as { id: 'review-<SoundBetter id>', quote, source, stars,
// date }. Read by the homepage's review gallery through
// netlify/functions/soundbetter-reviews.mjs, and by `npm run reviews:sync`,
// which saves new ones to src/data/reviews.js so they outlast the 20.

const PROFILE = 'https://soundbetter.com/profiles/45761-luke-markham'

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function plainText(markup) {
  return decodeEntities(markup.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

export function parseReviews(html) {
  return [...html.matchAll(/<li class="review[ "][\s\S]*?<\/li>/g)]
    .map(([item]) => {
      const id = item.match(/\/reviews\/(\d+)\/download/)?.[1]
      const quote = item.match(/class="review__body">([\s\S]*?)<\/div>/)?.[1]
      const source = item.match(/by <\/span><span><strong>(?:<a[^>]*>)?([^<]+)/)?.[1]
      if (!id || !quote || !source) return null
      return {
        id: `review-${id}`,
        quote: plainText(quote),
        source: plainText(source),
        stars: (item.match(/>star<\/i>/g) ?? []).length,
        date: item.match(/datetime="(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      }
    })
    .filter((review) => review && review.quote && review.stars > 0)
}

export async function fetchSoundBetterReviews() {
  const response = await fetch(PROFILE, { headers: { 'User-Agent': 'Mozilla/5.0 (lukemarkham.com reviews)' } })
  if (!response.ok) throw new Error(`Profile answered ${response.status}`)
  const reviews = parseReviews(await response.text())
  if (reviews.length === 0) throw new Error('No reviews on the profile')
  return reviews
}
