// Practice time: every practice tool reports how long it was in use, tagged
// with the four-digit PIN a student (or Luke) entered, and their page shows
// the totals. Low stakes, so a PIN is all it takes; an unknown PIN logs
// nothing.
//
// Each person's time is kept as one summary, seconds per tool per day (the
// day as the player's own calendar date), plus a marker per session so a
// session sent twice (a page closing sends it by beacon, then again when it
// reopens) counts once. Production keeps both in Netlify Blobs
// (netlify/functions/practice-log.mjs); local dev in a gitignored JSON file
// (vite.config.js).
//
// GET ?pin=1234       { name, days } for the person with that PIN
// GET ?student=slug   { days } for a student page
// POST { pin, sessions: [{ id, tool, day, seconds }] }

import { STUDENTS, PRACTICE_ONLY } from './students.mjs'

export const PRACTICE_TOOLS = ['metronome', 'tempo-guessr', 'fill', 'sticking', 'independence', 'sight-reading', 'ear-training', 'chord-progressions']

const MAX_SESSIONS = 50
const MAX_SECONDS = 6 * 60 * 60
const MAX_BODY_BYTES = 10000

const PEOPLE = { ...STUDENTS, ...PRACTICE_ONLY }

export function findByPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return null
  const entry = Object.entries(PEOPLE).find(([, person]) => person.pin === pin)
  return entry ? { slug: entry[0], name: entry[1].name } : null
}

function sanitizeSession(session) {
  if (!session || typeof session !== 'object') return null
  const { id, tool, day, seconds } = session
  if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) return null
  if (!PRACTICE_TOOLS.includes(tool)) return null
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return null
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_SECONDS) return null
  return { id, tool, day, seconds }
}

const json = (statusCode, payload) => ({ statusCode, payload })

/**
 * @param {{ method: string, query: URLSearchParams, bodyText: string }} request
 * @param {{ getDays(slug): Promise<object>, addSession(slug, session): Promise<void> }} store
 *   addSession adds the session's seconds to the summary unless its id was
 *   already counted
 */
export async function handlePracticeLogRequest({ method, query, bodyText }, store) {
  if (method === 'GET') {
    const pin = query.get('pin')
    if (pin !== null) {
      const person = findByPin(pin)
      if (!person) return json(404, { error: 'Unknown PIN' })
      return json(200, { name: person.name, days: await store.getDays(person.slug) })
    }
    const slug = query.get('student')
    if (typeof slug === 'string' && Object.hasOwn(STUDENTS, slug)) {
      return json(200, { days: await store.getDays(slug) })
    }
    return json(404, { error: 'Not found' })
  }

  if (method === 'POST') {
    if (bodyText.length > MAX_BODY_BYTES) return json(413, { error: 'Too large' })
    let body
    try {
      body = JSON.parse(bodyText)
    } catch {
      return json(400, { error: 'Not JSON' })
    }
    const person = findByPin(body?.pin)
    if (!person) return json(404, { error: 'Unknown PIN' })
    if (!Array.isArray(body.sessions) || body.sessions.length > MAX_SESSIONS) return json(400, { error: 'Bad sessions' })
    const sessions = body.sessions.map(sanitizeSession)
    if (sessions.some((session) => !session)) return json(400, { error: 'Bad session' })
    for (const session of sessions) await store.addSession(person.slug, session)
    return json(200, { ok: true, logged: sessions.map((session) => session.id) })
  }

  return json(405, { error: 'Method not allowed' })
}
