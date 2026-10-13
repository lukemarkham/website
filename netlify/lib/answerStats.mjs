// Right and wrong answers on the quiz tools (Ear Trainer, Chord Progressions),
// kept per person and tool under the practice-log PIN, so the tools can bring
// up what someone misses more often wherever they practise, and their page
// can show it. The record itself is src/lib/answerWeights.js. Production
// keeps it in Netlify Blobs (netlify/functions/answer-stats.mjs); local dev
// in a gitignored JSON file (vite.config.js).
//
// GET ?pin=1234&tool=ear-training   { items } for that person and tool
// GET ?student=slug                 { tools: { tool: items } } for a student page
// POST { pin, tool, answers: [{ id, item, correct, seconds }] }

import { ANSWER_TOOLS } from '../../src/lib/answerWeights.js'
import { STUDENTS } from './students.mjs'
import { findByPin } from './practiceLog.mjs'

const MAX_ANSWERS = 50
const MAX_BODY_BYTES = 10000

function sanitizeAnswer(answer) {
  if (!answer || typeof answer !== 'object') return null
  const { id, item, correct, seconds } = answer
  if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) return null
  if (typeof item !== 'string' || !/^[a-z]:[\w:-]{1,60}$/.test(item)) return null
  if (typeof correct !== 'boolean') return null
  if (seconds !== null && !(typeof seconds === 'number' && seconds >= 0 && seconds <= 3600)) return null
  return { id, item, correct, seconds }
}

const json = (statusCode, payload) => ({ statusCode, payload })

/**
 * @param {{ method: string, query: URLSearchParams, bodyText: string }} request
 * @param {{ getItems(slug, tool): Promise<object>, addAnswers(slug, tool, answers): Promise<void> }} store
 *   addAnswers records each answer unless its id was already counted
 */
export async function handleAnswerStatsRequest({ method, query, bodyText }, store) {
  if (method === 'GET') {
    const pin = query.get('pin')
    if (pin !== null) {
      const person = findByPin(pin)
      const tool = query.get('tool')
      if (!person || !ANSWER_TOOLS.includes(tool)) return json(404, { error: 'Not found' })
      return json(200, { items: await store.getItems(person.slug, tool) })
    }
    const slug = query.get('student')
    if (typeof slug === 'string' && Object.hasOwn(STUDENTS, slug)) {
      const tools = {}
      for (const tool of ANSWER_TOOLS) tools[tool] = await store.getItems(slug, tool)
      return json(200, { tools })
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
    if (!ANSWER_TOOLS.includes(body.tool)) return json(400, { error: 'Bad tool' })
    if (!Array.isArray(body.answers) || body.answers.length > MAX_ANSWERS) return json(400, { error: 'Bad answers' })
    const answers = body.answers.map(sanitizeAnswer)
    if (answers.some((answer) => !answer)) return json(400, { error: 'Bad answer' })
    await store.addAnswers(person.slug, body.tool, answers)
    return json(200, { ok: true, logged: answers.map((answer) => answer.id) })
  }

  return json(405, { error: 'Method not allowed' })
}
