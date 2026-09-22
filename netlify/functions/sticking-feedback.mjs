import { getStore } from '@netlify/blobs'
import { handleFeedbackRequest } from '../lib/stickingFeedback.mjs'

// One blob per entry, so two votes arriving together can't overwrite each other.
function blobStore() {
  const store = getStore({ name: 'sticking-feedback', consistency: 'strong' })

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
  const bodyText = request.method === 'POST' ? await request.text() : ''
  const { statusCode, payload } = await handleFeedbackRequest({ method: request.method, bodyText }, blobStore())

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
