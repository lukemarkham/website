// Votes and notes on what the practice generators produce, sent from their
// pages: the Fill Generator, the Sticking Generator and Independence. Each
// tool's entries are kept apart, picked by the `tool` query parameter.
//
// Production keeps them in Netlify Blobs (netlify/functions/practice-feedback.mjs);
// local dev keeps them in gitignored JSON files (vite.config.js). Both hand a
// store to handleFeedbackRequest so the validation lives in one place.
//
// This endpoint is unauthenticated. That is fine while the site is private,
// but it needs a key before the site is shared.

export const FEEDBACK_TOOLS = ['fill', 'sticking', 'independence']

const MAX_NOTE_LENGTH = 2000
const MAX_TAGS = 10
const MAX_TAG_LENGTH = 60
const MAX_BODY_BYTES = 8000

function isWholeNumberInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
}

// The note and tags every tool sends with a vote, checked the same way.
function sanitizeCommon(body) {
  const { vote, tempo, note = '', tags = [] } = body
  if (vote !== 'up' && vote !== 'down') return null
  if (!isWholeNumberInRange(tempo, 30, 300)) return null
  if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) return null
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) return null
  if (!tags.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= MAX_TAG_LENGTH)) return null
  return { vote, tempo, note: note.trim(), tags }
}

// Only the fields each page sends, each checked, so nothing unexpected can be
// written into the store.
const SANITIZERS = {
  fill(body) {
    const { strokes, resolution, rateId, beats, cells, source } = body
    if (typeof strokes !== 'string' || !/^[RLK]{3,32}$/.test(strokes)) return null
    if (!['K', 'R'].includes(resolution)) return null
    if (!['sixteenth', 'triplet'].includes(rateId)) return null
    if (!isWholeNumberInRange(beats, 1, 4)) return null
    if (!Array.isArray(cells) || cells.length > 32 || !cells.every((cell) => /^[RLK]{1,32}$/.test(cell))) return null
    if (cells.join('') !== strokes) return null
    // Sourced fills (written out, not generated) say where they're from.
    if (source !== undefined && (typeof source !== 'string' || !source.trim() || source.length > 80)) return null
    return { strokes, resolution, rateId, beats, cells, ...(source !== undefined && { source: source.trim() }) }
  },

  sticking(body) {
    const { strokes, rateId, beats, accents, cells } = body
    if (typeof strokes !== 'string' || !/^[RL]{2,32}$/.test(strokes)) return null
    if (!['sixteenth', 'triplet'].includes(rateId)) return null
    if (!isWholeNumberInRange(beats, 1, 4)) return null
    if (typeof accents !== 'boolean') return null
    if (!Array.isArray(cells) || cells.length > 32 || !cells.every((cell) => /^[RL]{1,8}$/.test(cell))) return null
    if (cells.join('') !== strokes) return null
    return { strokes, rateId, beats, accents, cells }
  },

  // The key spells out the whole exercise (see src/lib/independence.js), so
  // it can be rebuilt when the feedback is reviewed.
  independence(body) {
    const { key, title, feel } = body
    if (typeof key !== 'string' || !/^[A-Za-z0-9.|:,-]{8,1500}$/.test(key)) return null
    if (typeof title !== 'string' || title.length === 0 || title.length > 120) return null
    if (!['swing', 'straight'].includes(feel)) return null
    return { key, title, feel }
  },
}

export function sanitizeFeedback(tool, body) {
  if (!body || typeof body !== 'object') return null
  const common = sanitizeCommon(body)
  const specific = SANITIZERS[tool]?.(body)
  if (!common || !specific) return null
  return { tool, ...specific, ...common }
}

function newId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
}

// storeFor(tool): { list(): Promise<entry[]>, add(entry): Promise<void> }
export async function handleFeedbackRequest({ method, tool, bodyText }, storeFor) {
  if (!FEEDBACK_TOOLS.includes(tool)) {
    return { statusCode: 400, payload: { error: `Unknown tool; expected one of ${FEEDBACK_TOOLS.join(', ')}` } }
  }
  const store = storeFor(tool)

  if (method === 'GET') {
    const entries = await store.list()
    entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return { statusCode: 200, payload: { entries } }
  }

  if (method !== 'POST') {
    return { statusCode: 405, payload: { error: 'Method not allowed' } }
  }

  if (!bodyText || bodyText.length > MAX_BODY_BYTES) {
    return { statusCode: 400, payload: { error: 'Missing or oversized body' } }
  }

  let body
  try {
    body = JSON.parse(bodyText)
  } catch {
    return { statusCode: 400, payload: { error: 'Body is not JSON' } }
  }

  const feedback = sanitizeFeedback(tool, body)
  if (!feedback) {
    return { statusCode: 400, payload: { error: 'Invalid feedback' } }
  }

  const entry = { id: newId(), createdAt: new Date().toISOString(), ...feedback }
  await store.add(entry)
  return { statusCode: 201, payload: { entry } }
}
