import { handleBioRequest } from '../lib/bio.mjs'

// Serves the bio from its Google Doc. Netlify's CDN keeps it for five
// minutes, so an edit shows up within that.
export default async () => {
  const { statusCode, payload } = await handleBioRequest()

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Netlify-CDN-Cache-Control': statusCode === 200 ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'no-store',
    },
  })
}
