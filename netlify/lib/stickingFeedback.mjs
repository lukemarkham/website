// Votes and notes on generated stickings, sent from the practice page.
//
// Production keeps them in Netlify Blobs (netlify/functions/sticking-feedback.mjs);
// local dev keeps them in a gitignored JSON file (vite.config.js). Both hand a
// store to handleFeedbackRequest so the validation lives in one place.
//
// This endpoint is unauthenticated. That is fine while the site is private,
// but it needs a key before the site is shared.

const RATE_IDS = ['sixteenth', 'triplet']
const RESOLUTION_STROKES = ['K', 'R']
const MAX_NOTE_LENGTH = 2000
const MAX_TAGS = 10
const MAX_TAG_LENGTH = 60
const MAX_BODY_BYTES = 8000

function isWholeNumberInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
}

// Only the fields the page sends, each checked, so nothing unexpected can be
// written into the store.
export function sanitizeFeedback(body) {
  if (!body || typeof body !== 'object') return null

  const { vote, strokes, resolution, rateId, beats, tempo, cells, note = '', tags = [] } = body
  if (vote !== 'up' && vote !== 'down') return null
  if (typeof strokes !== 'string' || !/^[RLK]{3,32}$/.test(strokes)) return null
  if (!RESOLUTION_STROKES.includes(resolution)) return null
  if (!RATE_IDS.includes(rateId)) return null
  if (!isWholeNumberInRange(beats, 1, 4)) return null
  if (!isWholeNumberInRange(tempo, 30, 300)) return null
  if (!Array.isArray(cells) || cells.length > 32 || !cells.every((cell) => /^[RLK]{1,8}$/.test(cell))) return null
  if (cells.join('') !== strokes) return null
  if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) return null
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) return null
  if (!tags.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= MAX_TAG_LENGTH)) return null

  return { vote, strokes, resolution, rateId, beats, tempo, cells, note: note.trim(), tags }
}

function newId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
}

// store: { list(): Promise<entry[]>, add(entry): Promise<void> }
export async function handleFeedbackRequest({ method, bodyText }, store) {
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

  const feedback = sanitizeFeedback(body)
  if (!feedback) {
    return { statusCode: 400, payload: { error: 'Invalid feedback' } }
  }

  const entry = { id: newId(), createdAt: new Date().toISOString(), ...feedback }
  await store.add(entry)
  return { statusCode: 201, payload: { entry } }
}
