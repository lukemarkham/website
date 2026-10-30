import { fetchPlaylistVideos } from '../lib/youtubePlaylist.mjs'

// The videos for the Video page's grid. Netlify's CDN keeps a copy for an hour,
// so a change to the playlist shows up within the hour; the page falls back to
// YouTube's own playlist player if this fails.
export default async () => {
  try {
    const videos = await fetchPlaylistVideos()
    return new Response(JSON.stringify({ videos }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=3600, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    console.warn('YouTube playlist unavailable.', error)
    return new Response(JSON.stringify({ videos: null }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
}
