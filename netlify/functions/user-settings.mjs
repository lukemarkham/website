import { getStore } from '@netlify/blobs'
import { handleUserSettingsRequest } from '../lib/userSettings.mjs'

// One blob per person ({ tool: { name: value } }), merged conditionally and
// retried so two devices saving at once don't lose each other's changes.
function blobStore() {
  const store = getStore({ name: 'user-settings', consistency: 'strong' })

  return {
    async get(slug) {
      return (await store.get(slug, { type: 'json' })) ?? {}
    },
    async merge(slug, tool, settings) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await store.getWithMetadata(slug, { type: 'json' })
        const data = current?.data ?? {}
        const next = { ...data, [tool]: { ...data[tool], ...settings } }
        const options = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
        const { modified } = await store.setJSON(slug, next, options)
        if (modified) return
      }
      throw new Error('Settings busy')
    },
  }
}

export default async (request) => {
  const query = new URL(request.url).searchParams
  const bodyText = request.method === 'POST' ? await request.text() : ''
  let result
  try {
    result = await handleUserSettingsRequest({ method: request.method, query, bodyText }, blobStore())
  } catch {
    result = { statusCode: 503, payload: { error: 'Try again' } }
  }

  return new Response(JSON.stringify(result.payload), {
    status: result.statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
