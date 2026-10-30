import { fetchShopListingCount } from '../lib/reverbShop.mjs'

// Whether the Reverb shop has listings, for the nav. Netlify's CDN keeps a copy
// for an hour, so Gear Shop appears or disappears within the hour.
export default async () => {
  try {
    const listings = await fetchShopListingCount()
    return new Response(JSON.stringify({ listings }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.warn('Reverb shop unavailable.', error)
    return new Response(JSON.stringify({ listings: null }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
}
