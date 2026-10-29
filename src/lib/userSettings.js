// Settings on the practice tools, remembered per person. With a practice PIN
// they're kept on the server (netlify/lib/userSettings.mjs) and follow the
// person between devices; without one they stay in this browser. Either way
// they're cached here per PIN, so a tool opens on the right settings at once.
//
// useSetting(tool, name, fallback) works like useState. When settings arrive
// from elsewhere (a PIN entered or forgotten, or the server's copy differing
// from this browser's) the tool's version moves on, and <RememberedSettings>
// remounts the tool so whatever it built from the old settings is rebuilt.

import { createElement, Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { onPracticePinChange, readPracticePin } from './practiceLog.js'

const ENDPOINT = '/.netlify/functions/user-settings'
const OUTBOX_KEY = 'settings-outbox'
const SEND_DELAY_MS = 800
const EMPTY = {}

const cacheKey = (pin) => `settings:${pin ?? 'guest'}`

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Without storage, settings last as long as the page.
  }
}

const hasWindow = typeof window !== 'undefined'
let pin = hasWindow ? readPracticePin()?.pin ?? null : null
let values = hasWindow ? readJson(cacheKey(pin), {}) : {}
let versions = {}
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Replaces every tool's settings at once, moving on the version of each tool
// whose settings changed.
function replaceValues(next) {
  const tools = new Set([...Object.keys(values), ...Object.keys(next)])
  const changed = [...tools].filter((tool) => JSON.stringify(values[tool] ?? {}) !== JSON.stringify(next[tool] ?? {}))
  values = next
  writeJson(cacheKey(pin), values)
  if (changed.length === 0) return
  versions = { ...versions }
  changed.forEach((tool) => {
    versions[tool] = (versions[tool] ?? 0) + 1
  })
  notify()
}

// Changes waiting for the server, merged per person and tool:
// { 'pin|tool': { name: value } }.
function queue(forPin, tool, settings) {
  const outbox = readJson(OUTBOX_KEY, {})
  const key = `${forPin}|${tool}`
  writeJson(OUTBOX_KEY, { ...outbox, [key]: { ...outbox[key], ...settings } })
  scheduleSend()
}

let sendTimer = null

function scheduleSend() {
  if (!hasWindow) return
  window.clearTimeout(sendTimer)
  sendTimer = window.setTimeout(flushSettings, SEND_DELAY_MS)
}

async function flushSettings() {
  const outbox = readJson(OUTBOX_KEY, {})
  for (const [key, settings] of Object.entries(outbox)) {
    const [forPin, tool] = key.split('|')
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: forPin, tool, settings }),
      })
      // Saved, or never going to be accepted: off the queue either way,
      // unless it changed again while on its way.
      if (response.ok || response.status === 400 || response.status === 404) {
        const latest = readJson(OUTBOX_KEY, {})
        if (JSON.stringify(latest[key]) === JSON.stringify(settings)) {
          delete latest[key]
          writeJson(OUTBOX_KEY, latest)
        }
      }
    } catch {
      return // Offline: the queue keeps them for next time.
    }
  }
}

function pendingFor(forPin) {
  const pending = {}
  for (const [key, settings] of Object.entries(readJson(OUTBOX_KEY, {}))) {
    const [keyPin, tool] = key.split('|')
    if (keyPin === forPin) pending[tool] = settings
  }
  return pending
}

// The server's copy wins, with anything still on its way there on top. Someone
// with nothing saved yet keeps what this browser was set to before their PIN
// went in, and that becomes their saved settings.
async function loadFromServer(forPin) {
  let data
  try {
    const response = await fetch(`${ENDPOINT}?pin=${encodeURIComponent(forPin)}`)
    if (!response.ok) return
    data = await response.json()
  } catch {
    return
  }
  if (forPin !== pin || !data?.settings) return

  let server = data.settings
  if (Object.keys(server).length === 0 && Object.keys(values).length === 0) {
    const guest = readJson(cacheKey(null), {})
    Object.entries(guest).forEach(([tool, settings]) => queue(forPin, tool, settings))
    server = guest
  }
  const pending = pendingFor(forPin)
  const merged = { ...server }
  Object.entries(pending).forEach(([tool, settings]) => {
    merged[tool] = { ...merged[tool], ...settings }
  })
  replaceValues(merged)
}

if (hasWindow) {
  onPracticePinChange((person) => {
    const nextPin = person?.pin ?? null
    if (nextPin === pin) return
    pin = nextPin
    replaceValues(readJson(cacheKey(pin), {}))
    if (pin) loadFromServer(pin)
  })
  if (pin) loadFromServer(pin)
  flushSettings()
  window.addEventListener('pagehide', () => {
    for (const [key, settings] of Object.entries(readJson(OUTBOX_KEY, {}))) {
      const [forPin, tool] = key.split('|')
      navigator.sendBeacon?.(ENDPOINT, new Blob([JSON.stringify({ pin: forPin, tool, settings })], { type: 'application/json' }))
    }
  })
}

function setSetting(tool, name, value) {
  values = { ...values, [tool]: { ...values[tool], [name]: value } }
  writeJson(cacheKey(pin), values)
  if (pin) queue(pin, tool, { [name]: value })
  notify()
}

// A saved value is used only if it still looks like the fallback (same type,
// array or not) and passes `isValid`, so a setting saved by an older version
// of a tool can't break it.
function usable(stored, fallback, isValid) {
  if (stored === undefined) return false
  if (fallback !== null && (typeof stored !== typeof fallback || Array.isArray(stored) !== Array.isArray(fallback))) return false
  return isValid ? isValid(stored) : true
}

/**
 * Like useState, but remembered for this person. `fallback` (or a function
 * returning it, called once) is used until something is saved.
 */
export function useSetting(tool, name, fallback, isValid) {
  const [initial] = useState(() => (typeof fallback === 'function' ? fallback() : fallback))
  const isValidRef = useRef(isValid)
  useEffect(() => {
    isValidRef.current = isValid
  })

  const stored = useSyncExternalStore(subscribe, () => (values[tool] ?? EMPTY)[name])
  const value = usable(stored, initial, isValid) ? stored : initial

  const set = useCallback((next) => {
    const saved = (values[tool] ?? EMPTY)[name]
    const current = usable(saved, initial, isValidRef.current) ? saved : initial
    setSetting(tool, name, typeof next === 'function' ? next(current) : next)
  }, [tool, name, initial])

  return [value, set]
}

/** Remounts `children` when the tool's settings arrive from elsewhere. */
export function RememberedSettings({ tool, children }) {
  const version = useSyncExternalStore(subscribe, () => versions[tool] ?? 0)
  return createElement(Fragment, { key: version }, children)
}
