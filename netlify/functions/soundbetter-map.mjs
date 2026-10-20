// The client map from Luke's SoundBetter profile, kept current: SoundBetter
// draws it as one Mapbox image with a pin per client, under a line like
// "Luke has helped 65 musicians finish 202 projects in 34 cities on
// SoundBetter". This reads both off the map page and passes them on: the
// image by default, the line as JSON with `?part=summary`. Netlify's CDN
// keeps a copy of each for a day, so SoundBetter is asked at most about once
// a day, and new clients show up within a day of SoundBetter adding them.
// If SoundBetter can't be read, the page falls back to the saved screenshot
// in public/soundbetter-map/ and leaves the line out.

const MAP_PAGE = 'https://soundbetter.com/profiles/45761-luke-markham/map'
const FALLBACK = '/soundbetter-map/client-map.png'
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600',
  'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=86400, stale-while-revalidate=604800',
}

async function readMapPage() {
  const response = await fetch(MAP_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0 (lukemarkham.com client map)' } })
  if (!response.ok) throw new Error(`Map page answered ${response.status}`)
  return response.text()
}

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function mapImageUrl(html) {
  const tag = html.match(/<img[^>]*class="[^"]*map_image[^"]*"[^>]*>/)?.[0]
  const src = tag?.match(/src="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
  if (!src || !src.startsWith('https://api.mapbox.com/')) throw new Error('No map image on the page')
  // Shaped like the homepage's map card (SoundBetter's is wide; Mapbox
  // fits the pins to any size), at twice the pixels for high-density screens.
  return src.replace(/\/\d+x\d+(@2x)?\?/, '/540x640@2x?')
}

// The heading over the map, the only one that says "has helped".
function summary(html) {
  const text = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)]
    .map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .find((line) => /has helped/i.test(line))
  if (!text) throw new Error('No summary on the page')
  return text
}

export default async (request) => {
  const wantsSummary = new URL(request.url).searchParams.get('part') === 'summary'

  try {
    const html = await readMapPage()
    if (wantsSummary) {
      return new Response(JSON.stringify({ summary: summary(html) }), {
        headers: { 'Content-Type': 'application/json', ...CACHE_HEADERS },
      })
    }

    const image = await fetch(mapImageUrl(html))
    if (!image.ok) throw new Error(`Map image answered ${image.status}`)
    return new Response(image.body, {
      headers: { 'Content-Type': image.headers.get('Content-Type') ?? 'image/png', ...CACHE_HEADERS },
    })
  } catch (error) {
    console.warn('SoundBetter map unavailable.', error)
    if (wantsSummary) {
      return new Response(JSON.stringify({ summary: null }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }
    return Response.redirect(new URL(FALLBACK, request.url), 302)
  }
}
