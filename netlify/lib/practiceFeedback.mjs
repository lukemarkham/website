// Votes and notes on what the practice generators produce, sent from their
// pages: the Fill Generator, the Sticking Generator, Independence, Set Ups, the
// Ear Trainer and Chord Progressions. Each tool's entries are kept apart,
// picked by the `tool` query parameter.
//
// Production keeps them in Netlify Blobs (netlify/functions/practice-feedback.mjs);
// local dev keeps them in gitignored JSON files (vite.config.js). Both hand a
// store to handleFeedbackRequest so the validation lives in one place.
//
// Only Luke votes: a vote must carry his practice PIN, and the pages show
// the vote buttons only while his PIN is entered. Reading stays open, as
// every visitor's generators skip the downvoted picks.

import { PRACTICE_ONLY } from './students.mjs'

export const FEEDBACK_TOOLS = ['fill', 'sticking', 'independence', 'setups', 'ear-training', 'chord-progressions']

const OWNER_PIN = PRACTICE_ONLY['luke-markham'].pin

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
  // Chord Progressions has no tempo; every other tool sends one.
  if (tempo !== undefined && !isWholeNumberInRange(tempo, 30, 300)) return null
  if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) return null
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) return null
  if (!tags.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= MAX_TAG_LENGTH)) return null
  return { vote, ...(tempo !== undefined && { tempo }), note: note.trim(), tags }
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

  // Strokes as PAS writes sticking: lR a flam, llR a drag, - a rest (rests
  // only in true rudiments, which also send their PAS number).
  sticking(body) {
    const { strokes, rateId, beats, accents, cells, rudiment } = body
    const stroke = '(?:(?:ll?|rr?)?[RL]|-)'
    if (typeof strokes !== 'string' || !new RegExp(`^${stroke}{2,32}$`).test(strokes)) return null
    if (!['sixteenth', 'triplet'].includes(rateId)) return null
    if (!isWholeNumberInRange(beats, 1, 4)) return null
    if (typeof accents !== 'boolean') return null
    if (!Array.isArray(cells) || cells.length > 32 || !cells.every((cell) => typeof cell === 'string' && new RegExp(`^${stroke}{1,32}$`).test(cell))) return null
    if (cells.join('') !== strokes) return null
    if (rudiment !== undefined && !isWholeNumberInRange(rudiment, 1, 40)) return null
    return { strokes, rateId, beats, accents, cells, ...(rudiment !== undefined && { rudiment }) }
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

  // The key spells out the piece: feel|bars|set-ups|cues|form (see
  // generateSetUpPhrase in src/lib/setUps.js). Sight Reading keeps the
  // tool id it had as Set Ups.
  setups(body) {
    const { key, feel } = body
    if (typeof key !== 'string' || !/^(swing|straight|latin|bossa)\|(8|16|32)\|[0-9a-z@;,|+:/-]{4,2400}$/.test(key)) return null
    if (!['swing', 'straight', 'latin', 'bossa'].includes(feel)) return null
    return { key, feel }
  },

  // The key spells out the question as it sounded (see questionKey in
  // App.jsx): progression|key pc|chords as numeral.root.quality[.secondary]
  // after shading|blanks|instrument/bass/pattern. `answers` is what was typed
  // for each blank and how it was graded, absent when the answer was revealed.
  'ear-training'(body) {
    const { key, answers } = body
    if (typeof key !== 'string' || !/^[a-z0-9-]{2,60}\|\d{1,2}\|[A-Za-z0-9♭♯#ø.,]{4,400}\|[\d,]{1,40}\|[\w-]{1,30}\/[\w-]{1,30}\/[\w-]{1,30}$/u.test(key)) return null
    if (answers === undefined) return { key }
    if (!Array.isArray(answers) || answers.length > 16) return null
    const valid = answers.every((answer) => answer && typeof answer === 'object'
      && isWholeNumberInRange(answer.index, 0, 15)
      && (answer.typed === null || (typeof answer.typed === 'string' && answer.typed.length <= 40))
      && typeof answer.status === 'string' && /^[a-zA-Z]{1,20}$/.test(answer.status)
      && isWholeNumberInRange(answer.points, 0, 3))
    if (!valid) return null
    return { key, answers: answers.map(({ index, typed, status, points }) => ({ index, typed, status, points })) }
  },

  // The key spells out the question: progression|key pc|chord symbols (see
  // questionFor in src/lib/chordProgressions.js). `reached` is how many
  // chords had been played right when the vote was cast, `revealed` whether
  // the answer was showing.
  'chord-progressions'(body) {
    const { key, reached, revealed } = body
    if (typeof key !== 'string' || !/^[a-z0-9-]{2,60}\|\d{1,2}\|[^|]{2,300}$/u.test(key)) return null
    if (!isWholeNumberInRange(reached, 0, 16)) return null
    if (typeof revealed !== 'boolean') return null
    return { key, reached, revealed }
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

  if (body?.pin !== OWNER_PIN) {
    return { statusCode: 403, payload: { error: 'Only the site owner can leave feedback' } }
  }

  const feedback = sanitizeFeedback(tool, body)
  if (!feedback) {
    return { statusCode: 400, payload: { error: 'Invalid feedback' } }
  }

  const entry = { id: newId(), createdAt: new Date().toISOString(), ...feedback }
  await store.add(entry)
  return { statusCode: 201, payload: { entry } }
}
