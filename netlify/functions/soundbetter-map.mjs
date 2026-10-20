// The client map from Luke's SoundBetter profile, kept current: SoundBetter
// draws it as one Mapbox image with a pin per client, so this reads that
// image's address off the map page and passes the image on. Netlify's CDN
// keeps a copy for a day, so SoundBetter is asked at most about once a day,
// and the map picks up new clients within a day of SoundBetter adding them.
// If SoundBetter can't be read, the page falls back to the saved screenshot
// in public/soundbetter-map/.

const MAP_PAGE = 'https://soundbetter.com/profiles/45761-luke-markham/map'
const FALLBACK = '/soundbetter-map/client-map.png'

async function currentMapImageUrl() {
  const response = await fetch(MAP_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0 (lukemarkham.com client map)' } })
  if (!response.ok) throw new Error(`Map page answered ${response.status}`)
  const html = await response.text()
  const tag = html.match(/<img[^>]*class="[^"]*map_image[^"]*"[^>]*>/)?.[0]
  const src = tag?.match(/src="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
  if (!src || !src.startsWith('https://api.mapbox.com/')) throw new Error('No map image on the page')
  // Shaped like the homepage's map card (SoundBetter's is wide; Mapbox
  // fits the pins to any size), at twice the pixels for high-density screens.
  return src.replace(/\/\d+x\d+(@2x)?\?/, '/540x640@2x?')
}

export default async (request) => {
  try {
    const image = await fetch(await currentMapImageUrl())
    if (!image.ok) throw new Error(`Map image answered ${image.status}`)
    return new Response(image.body, {
      headers: {
        'Content-Type': image.headers.get('Content-Type') ?? 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    console.warn('SoundBetter map unavailable, sending the saved screenshot.', error)
    return Response.redirect(new URL(FALLBACK, request.url), 302)
  }
}
