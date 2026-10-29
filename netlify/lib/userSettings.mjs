// Each person's settings on the practice tools, kept under their practice-log
// PIN so a toggle on one device is there the next time they practise on any.
// Production keeps them in Netlify Blobs (netlify/functions/user-settings.mjs);
// local dev in a gitignored JSON file (vite.config.js). The browser side is
// src/lib/userSettings.js.
//
// GET ?pin=1234                        { settings: { tool: { name: value } } }
// POST { pin, tool, settings: { name: value } }   merged into that tool's

import { findByPin } from './practiceLog.mjs'
import { SETTINGS_TOOLS } from '../../src/lib/settingsTools.js'

const MAX_BODY_BYTES = 8000
const MAX_SETTINGS = 40

// Plain values only: numbers, short strings, booleans, null, and small arrays
// or objects of them. A value is a setting, not a store for anything else.
function isSettingValue(value, depth = 0) {
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.length <= 100
  if (depth > 1) return false
  if (Array.isArray(value)) return value.length <= 40 && value.every((item) => isSettingValue(item, depth + 1))
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length <= 40 && entries.every(([key, item]) => /^[\w-]{1,40}$/.test(key) && isSettingValue(item, depth + 1))
  }
  return false
}

export function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null
  const entries = Object.entries(settings)
  if (entries.length > MAX_SETTINGS) return null
  if (!entries.every(([name, value]) => /^[a-zA-Z][\w-]{0,40}$/.test(name) && isSettingValue(value))) return null
  return Object.fromEntries(entries)
}

const json = (statusCode, payload) => ({ statusCode, payload })

/**
 * @param {{ method: string, query: URLSearchParams, bodyText: string }} request
 * @param {{ get(slug): Promise<object>, merge(slug, tool, settings): Promise<void> }} store
 */
export async function handleUserSettingsRequest({ method, query, bodyText }, store) {
  if (method === 'GET') {
    const person = findByPin(query.get('pin'))
    if (!person) return json(404, { error: 'Unknown PIN' })
    return json(200, { settings: await store.get(person.slug) })
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
    if (!SETTINGS_TOOLS.includes(body.tool)) return json(400, { error: 'Bad tool' })
    const settings = sanitizeSettings(body.settings)
    if (!settings) return json(400, { error: 'Bad settings' })
    await store.merge(person.slug, body.tool, settings)
    return json(200, { ok: true })
  }

  return json(405, { error: 'Method not allowed' })
}
