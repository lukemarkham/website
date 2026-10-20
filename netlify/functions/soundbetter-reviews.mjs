import { fetchSoundBetterReviews } from '../lib/soundbetterReviews.mjs'

// The latest reviews from SoundBetter for the homepage gallery. Netlify's CDN
// keeps a copy for a day, so a new review shows up within a day; the page
// keeps showing its saved reviews if this fails.
export default async () => {
  try {
    const reviews = await fetchSoundBetterReviews()
    return new Response(JSON.stringify({ reviews }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    console.warn('SoundBetter reviews unavailable.', error)
    return new Response(JSON.stringify({ reviews: null }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
}
