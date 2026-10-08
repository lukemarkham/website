import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { getLiveStatus } from './netlify/lib/twitch.mjs'
import { handleFeedbackRequest } from './netlify/lib/practiceFeedback.mjs'
import { handleStudentNotesRequest } from './netlify/lib/studentNotes.mjs'
import { handlePracticeLogRequest } from './netlify/lib/practiceLog.mjs'

const TWITCH_STATUS_PATH = '/.netlify/functions/twitch-status'
const PRACTICE_FEEDBACK_PATH = '/.netlify/functions/practice-feedback'
const STUDENT_NOTES_PATH = '/.netlify/functions/student-notes'
const PRACTICE_LOG_PATH = '/.netlify/functions/practice-log'

// `vite` alone does not run Netlify functions, so serve the Twitch endpoint
// from the same module during local dev. Without this the card is simply never
// shown locally, which makes it impossible to work on.
function twitchStatusDevEndpoint(env) {
  return {
    name: 'twitch-status-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(TWITCH_STATUS_PATH, async (_req, res) => {
        const { statusCode, payload } = await getLiveStatus(env)

        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      })
    },
  }
}

// Netlify Blobs only exists on Netlify, so local votes go to gitignored files
// (feedback/<tool>-feedback.dev.json) instead, through the same request
// handling as production.
function practiceFeedbackDevEndpoint() {
  function storeFor(tool) {
    const file = `feedback/${tool}-feedback.dev.json`
    const store = {
      async list() {
        try {
          return JSON.parse(await readFile(file, 'utf8'))
        } catch {
          return []
        }
      },
      async add(entry) {
        const entries = await store.list()
        await writeFile(file, `${JSON.stringify([...entries, entry], null, 2)}\n`)
      },
    }
    return store
  }

  return {
    name: 'practice-feedback-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(PRACTICE_FEEDBACK_PATH, async (req, res) => {
        let bodyText = ''
        for await (const chunk of req) bodyText += chunk
        const tool = new URL(req.url, 'http://localhost').searchParams.get('tool')
        const { statusCode, payload } = await handleFeedbackRequest({ method: req.method, tool, bodyText }, storeFor)

        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      })
    },
  }
}

// Student notes come straight from Google Docs, so dev can serve them the
// same way production does.
function studentNotesDevEndpoint() {
  return {
    name: 'student-notes-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(STUDENT_NOTES_PATH, async (req, res) => {
        const slug = new URL(req.url, 'http://localhost').searchParams.get('slug')
        const { statusCode, payload } = await handleStudentNotesRequest({ slug })

        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      })
    },
  }
}

// Practice time logged in dev goes to a gitignored file,
// feedback/practice-log.dev.json, through the same request handling.
function practiceLogDevEndpoint() {
  const file = 'feedback/practice-log.dev.json'
  const read = async () => {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch {
      return { days: {}, sessions: {} }
    }
  }
  const store = {
    async getDays(slug) {
      return (await read()).days[slug] ?? {}
    },
    async addSession(slug, session) {
      const data = await read()
      const key = `${slug}/${session.id}`
      if (data.sessions[key]) return
      data.sessions[key] = session
      const day = ((data.days[slug] ??= {})[session.day] ??= {})
      day[session.tool] = (day[session.tool] ?? 0) + session.seconds
      await writeFile(file, `${JSON.stringify(data, null, 2)}\n`)
    },
  }

  return {
    name: 'practice-log-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(PRACTICE_LOG_PATH, async (req, res) => {
        let bodyText = ''
        for await (const chunk of req) bodyText += chunk
        const query = new URL(req.url, 'http://localhost').searchParams
        const { statusCode, payload } = await handlePracticeLogRequest({ method: req.method, query, bodyText }, store)

        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Third argument '' loads every var, not just the VITE_ prefixed ones. These
  // stay in the dev server process and are never bundled into the client.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), twitchStatusDevEndpoint(env), practiceFeedbackDevEndpoint(), studentNotesDevEndpoint(), practiceLogDevEndpoint()],
  }
})
