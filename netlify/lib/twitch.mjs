// Shared Twitch "am I live?" lookup.
//
// This runs on the server only: the Helix API needs an app access token, and
// minting one needs the client secret, which must never reach the browser.
// The Netlify function and the local dev endpoint in vite.config.js both call
// getLiveStatus so there is a single implementation to keep honest.

const DEFAULT_CHANNEL = 'slywalker_sound'
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const STREAMS_URL = 'https://api.twitch.tv/helix/streams'
const STATUS_CACHE_MS = 30_000
const TOKEN_EXPIRY_MARGIN_MS = 60_000
const THUMBNAIL_WIDTH = 640
const THUMBNAIL_HEIGHT = 360

// Module scope, so a warm function instance reuses both across invocations.
let cachedToken = null
let cachedStatus = null

async function getAppToken(clientId, clientSecret) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    throw new Error(`Twitch token request failed with status ${response.status}.`)
  }

  const data = await response.json()
  if (!data.access_token) {
    throw new Error('Twitch token response did not include an access token.')
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 0) * 1000 - TOKEN_EXPIRY_MARGIN_MS,
  }

  return cachedToken.value
}

function buildThumbnail(template) {
  if (!template) {
    return null
  }

  return template
    .replace('{width}', String(THUMBNAIL_WIDTH))
    .replace('{height}', String(THUMBNAIL_HEIGHT))
}

export async function getLiveStatus(env) {
  const clientId = env.TWITCH_CLIENT_ID
  const clientSecret = env.TWITCH_CLIENT_SECRET
  // The channel name is public, so it lives in the code with an env override.
  // Only the credentials have to be kept secret.
  const channel = env.TWITCH_CHANNEL || DEFAULT_CHANNEL

  // Not set up yet (or running a local checkout without a .env): stay quiet
  // rather than erroring, so the site behaves exactly as it did before.
  if (!clientId || !clientSecret) {
    return { statusCode: 200, payload: { live: false, configured: false } }
  }

  if (cachedStatus && cachedStatus.expiresAt > Date.now()) {
    return { statusCode: 200, payload: cachedStatus.payload }
  }

  try {
    const token = await getAppToken(clientId, clientSecret)

    const url = new URL(STREAMS_URL)
    url.searchParams.set('user_login', channel)

    const response = await fetch(url, {
      headers: {
        'Client-Id': clientId,
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      // Token was rejected — drop it so the next call mints a fresh one.
      cachedToken = null
      throw new Error('Twitch rejected the app access token.')
    }

    if (!response.ok) {
      throw new Error(`Twitch streams request failed with status ${response.status}.`)
    }

    const data = await response.json()
    const stream = (data.data || []).find((entry) => entry.type === 'live')

    const payload = stream
      ? {
          live: true,
          configured: true,
          channel: stream.user_login || channel,
          streamId: stream.id,
          title: stream.title || '',
          game: stream.game_name || '',
          viewers: stream.viewer_count ?? 0,
          startedAt: stream.started_at || null,
          thumbnail: buildThumbnail(stream.thumbnail_url),
        }
      : { live: false, configured: true, channel }

    cachedStatus = { payload, expiresAt: Date.now() + STATUS_CACHE_MS }

    return { statusCode: 200, payload }
  } catch (error) {
    // Log the detail server-side; hand the browser a generic code so nothing
    // about the credentials or upstream response leaks into the page.
    console.error('Twitch live lookup failed:', error.message)

    return { statusCode: 502, payload: { live: false, configured: true, error: 'twitch_unavailable' } }
  }
}
