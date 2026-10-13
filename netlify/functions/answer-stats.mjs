import { getStore } from '@netlify/blobs'
import { handleAnswerStatsRequest } from '../lib/answerStats.mjs'
import { recordAnswer } from '../../src/lib/answerWeights.js'

// One blob per person and tool (`<slug>/<tool>`): the items, and the ids of
// the latest answers so one sent twice (by beacon, then again on reopening)
// counts once. Written conditionally and retried, like the practice log.
const SEEN_KEPT = 300

function blobStore() {
  const store = getStore({ name: 'answer-stats', consistency: 'strong' })

  return {
    async getItems(slug, tool) {
      return (await store.get(`${slug}/${tool}`, { type: 'json' }))?.items ?? {}
    },
    async addAnswers(slug, tool, answers) {
      const key = `${slug}/${tool}`
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: 'json' })
        const seen = current?.data?.seen ?? []
        const fresh = answers.filter((answer) => !seen.includes(answer.id))
        if (fresh.length === 0) return
        const items = fresh.reduce(recordAnswer, current?.data?.items ?? {})
        const next = { items, seen: [...seen, ...fresh.map((answer) => answer.id)].slice(-SEEN_KEPT) }
        const options = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
        const { modified } = await store.setJSON(key, next, options)
        if (modified) return
      }
      throw new Error('Answer stats busy')
    },
  }
}

export default async (request) => {
  const query = new URL(request.url).searchParams
  const bodyText = request.method === 'POST' ? await request.text() : ''
  let result
  try {
    result = await handleAnswerStatsRequest({ method: request.method, query, bodyText }, blobStore())
  } catch {
    result = { statusCode: 503, payload: { error: 'Try again' } }
  }

  return new Response(JSON.stringify(result.payload), {
    status: result.statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
