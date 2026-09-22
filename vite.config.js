import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { getLiveStatus } from './netlify/lib/twitch.mjs'
import { handleFeedbackRequest } from './netlify/lib/stickingFeedback.mjs'

const TWITCH_STATUS_PATH = '/.netlify/functions/twitch-status'
const STICKING_FEEDBACK_PATH = '/.netlify/functions/sticking-feedback'
const STICKING_FEEDBACK_DEV_FILE = 'feedback/sticking-feedback.dev.json'

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

// Netlify Blobs only exists on Netlify, so local votes go to a gitignored file
// instead, through the same request handling as production.
function stickingFeedbackDevEndpoint() {
  const store = {
    async list() {
      try {
        return JSON.parse(await readFile(STICKING_FEEDBACK_DEV_FILE, 'utf8'))
      } catch {
        return []
      }
    },
    async add(entry) {
      const entries = await store.list()
      await writeFile(STICKING_FEEDBACK_DEV_FILE, `${JSON.stringify([...entries, entry], null, 2)}\n`)
    },
  }

  return {
    name: 'sticking-feedback-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(STICKING_FEEDBACK_PATH, async (req, res) => {
        let bodyText = ''
        for await (const chunk of req) bodyText += chunk
        const { statusCode, payload } = await handleFeedbackRequest({ method: req.method, bodyText }, store)

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
    plugins: [react(), twitchStatusDevEndpoint(env), stickingFeedbackDevEndpoint()],
  }
})
