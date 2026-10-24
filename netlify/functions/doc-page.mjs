import { handleDocPageRequest } from '../lib/docPages.mjs'

// Serves a page's text from its Google Doc (?page=bio). Netlify's CDN keeps
// it for five minutes, so an edit shows up within that.
export default async (request) => {
  const page = new URL(request.url).searchParams.get('page')
  const { statusCode, payload } = await handleDocPageRequest({ page })

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Netlify-CDN-Cache-Control': statusCode === 200 ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'no-store',
    },
  })
}
