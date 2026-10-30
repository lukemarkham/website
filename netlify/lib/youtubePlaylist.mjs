// The videos in Luke's featured YouTube playlist, read from the playlist's
// public page so no API key is needed, as { videoId, title }. Read by the Video
// page's grid through netlify/functions/youtube-playlist.mjs.

export const PLAYLIST_ID = 'PLb3uq0jpJ8q-KEpFbTwJdOXcoNcaZoneA'

function collectLockups(value, lockups = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLockups(item, lockups))
  } else if (value && typeof value === 'object') {
    if (value.lockupViewModel) lockups.push(value.lockupViewModel)
    Object.values(value).forEach((item) => collectLockups(item, lockups))
  }
  return lockups
}

export function parsePlaylist(html) {
  const data = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1]
  if (!data) return []
  return collectLockups(JSON.parse(data))
    .filter((lockup) => lockup.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO')
    .map((lockup) => ({
      videoId: lockup.contentId,
      title: lockup.metadata?.lockupMetadataViewModel?.title?.content,
    }))
    .filter((video) => video.videoId && video.title)
}

export async function fetchPlaylistVideos() {
  const response = await fetch(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'en' },
  })
  if (!response.ok) throw new Error(`Playlist answered ${response.status}`)
  const videos = parsePlaylist(await response.text())
  if (videos.length === 0) throw new Error('No videos on the playlist page')
  return videos
}
