import { getStore } from '@netlify/blobs'
import { handlePracticeLogRequest } from '../lib/practiceLog.mjs'

// Per person, a summary blob (`<slug>`: seconds per day per tool) and a
// marker blob per session (`<slug>/session/<id>`). The summary is updated
// with a conditional write, retried, so two sessions arriving together both
// count.
function blobStore() {
  const store = getStore({ name: 'practice-log', consistency: 'strong' })

  return {
    async getDays(slug) {
      return (await store.get(slug, { type: 'json' }))?.days ?? {}
    },
    async addSession(slug, session) {
      const marker = `${slug}/session/${session.id}`
      if (await store.getMetadata(marker)) return
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await store.getWithMetadata(slug, { type: 'json' })
        const days = current?.data?.days ?? {}
        const day = (days[session.day] ??= {})
        day[session.tool] = (day[session.tool] ?? 0) + session.seconds
        const options = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
        const { modified } = await store.setJSON(slug, { days }, options)
        if (modified) {
          await store.setJSON(marker, session)
          return
        }
      }
      throw new Error('Practice log busy')
    },
  }
}

export default async (request) => {
  const query = new URL(request.url).searchParams
  const bodyText = request.method === 'POST' ? await request.text() : ''
  let result
  try {
    result = await handlePracticeLogRequest({ method: request.method, query, bodyText }, blobStore())
  } catch {
    result = { statusCode: 503, payload: { error: 'Try again' } }
  }

  return new Response(JSON.stringify(result.payload), {
    status: result.statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
