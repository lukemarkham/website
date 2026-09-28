import { getStore } from '@netlify/blobs'
import { handleFeedbackRequest } from '../lib/practiceFeedback.mjs'

// One store per tool and one blob per entry, so two votes arriving together
// can't overwrite each other. (The older `sticking-feedback` store holds only
// the archived deploy check from when fills were called stickings.)
function blobStore(tool) {
  const store = getStore({ name: `feedback-${tool}`, consistency: 'strong' })

  return {
    async list() {
      const { blobs } = await store.list()
      const entries = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })))
      return entries.filter(Boolean)
    },
    async add(entry) {
      await store.setJSON(entry.id, entry)
    },
  }
}

export default async (request) => {
  const tool = new URL(request.url).searchParams.get('tool')
  const bodyText = request.method === 'POST' ? await request.text() : ''
  const { statusCode, payload } = await handleFeedbackRequest({ method: request.method, tool, bodyText }, blobStore)

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
