import { getLiveStatus } from '../lib/twitch.mjs'

export default async () => {
  const { statusCode, payload } = await getLiveStatus(process.env)

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      // Short cache: going live shows up within about half a minute, without
      // every page view costing a Helix call.
      'Cache-Control': 'public, max-age=30',
    },
  })
}
