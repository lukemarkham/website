// Practice time from this browser: whoever's PIN is remembered here, and
// how long each tool was in use. The server keeps the totals
// (netlify/lib/practiceLog.mjs).
//
// A tool is in use while it plays (usePracticeLog(tool, isPlaying)), or,
// for tools with nothing to start, while someone is working the page
// (useRecentActivity). Time stops while the tab is hidden and picks up when
// it's back. Each stretch becomes a session, queued here until the server
// confirms it, so nothing is lost offline; a closing page also sends the
// queue by beacon, and the server counts a resent session once.

import { useEffect, useRef, useState } from 'react'

const PIN_KEY = 'practice-pin'
const OUTBOX_KEY = 'practice-log-outbox'
const ENDPOINT = '/.netlify/functions/practice-log'
// Shorter stretches (a stray click on Start) aren't practice.
const MIN_SECONDS = 10
// Without a transport, a page counts as in use this long after the last
// key, click or note.
const ACTIVITY_WINDOW_MS = 90 * 1000

export const PRACTICE_TOOL_LABELS = {
  metronome: 'Metronome',
  'tempo-guessr': 'Tempo Guessr',
  fill: 'Fill Generator',
  sticking: 'Sticking Generator',
  independence: 'Independence',
  'sight-reading': 'Sight Reading',
  'ear-training': 'Ear Trainer',
  'chord-progressions': 'Chord Progressions',
}

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Without storage, practice simply isn't logged from this browser.
  }
}

const listeners = new Set()

export function readPracticePin() {
  return readJson(PIN_KEY, null)
}

// { pin, name } once the server knows the PIN, or null to forget it.
export function rememberPracticePin(person) {
  writeJson(PIN_KEY, person)
  listeners.forEach((listener) => listener(person))
  if (person) flushPracticeLog()
}

export function usePracticePin() {
  const [person, setPerson] = useState(readPracticePin)
  useEffect(() => {
    listeners.add(setPerson)
    return () => listeners.delete(setPerson)
  }, [])
  return person
}

// The person's days ({ 'YYYY-MM-DD': { tool: seconds } }) and name, or
// null for a PIN the server doesn't know.
export async function lookUpPracticePin(pin) {
  const response = await fetch(`${ENDPOINT}?pin=${encodeURIComponent(pin)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Practice log unavailable')
  return response.json()
}

export async function fetchStudentPractice(slug) {
  const response = await fetch(`${ENDPOINT}?student=${encodeURIComponent(slug)}`)
  if (!response.ok) throw new Error('Practice log unavailable')
  return (await response.json()).days
}

function localDay(date) {
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function queueSession(tool, startedAt, seconds) {
  const person = readPracticePin()
  if (!person || seconds < MIN_SECONDS) return
  const id = `${startedAt.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const session = { id, tool, day: localDay(startedAt), seconds: Math.min(Math.round(seconds), 6 * 60 * 60) }
  writeJson(OUTBOX_KEY, [...readJson(OUTBOX_KEY, []), { pin: person.pin, session }])
}

let flushing = false

export async function flushPracticeLog() {
  if (flushing) return
  const queued = readJson(OUTBOX_KEY, [])
  if (queued.length === 0) return
  flushing = true
  try {
    for (const pin of new Set(queued.map((item) => item.pin))) {
      const sessions = queued.filter((item) => item.pin === pin).map((item) => item.session).slice(0, 50)
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, sessions }) })
      // Sent, or never going to be accepted (a PIN since removed): either way
      // off the queue. Anything else waits for the next try.
      if (response.ok || response.status === 404 || response.status === 400) {
        const done = new Set(sessions.map((session) => session.id))
        writeJson(OUTBOX_KEY, readJson(OUTBOX_KEY, []).filter((item) => !done.has(item.session.id)))
      }
    }
  } catch {
    // Offline: the queue keeps them.
  } finally {
    flushing = false
  }
}

function beaconPracticeLog() {
  const queued = readJson(OUTBOX_KEY, [])
  for (const pin of new Set(queued.map((item) => item.pin))) {
    const sessions = queued.filter((item) => item.pin === pin).map((item) => item.session).slice(0, 50)
    navigator.sendBeacon?.(ENDPOINT, new Blob([JSON.stringify({ pin, sessions })], { type: 'application/json' }))
  }
}

/**
 * Logs `tool` as practised for as long as `isActive` is true and the page
 * is showing.
 */
export function usePracticeLog(tool, isActive) {
  const startedRef = useRef(null)

  useEffect(() => {
    flushPracticeLog()
  }, [])

  useEffect(() => {
    const begin = () => {
      if (!startedRef.current && document.visibilityState === 'visible') startedRef.current = new Date()
    }
    const end = () => {
      const started = startedRef.current
      if (!started) return
      startedRef.current = null
      queueSession(tool, started, (Date.now() - started.getTime()) / 1000)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        end()
        beaconPracticeLog()
      } else if (isActive) {
        begin()
        flushPracticeLog()
      }
    }
    const onPageHide = () => {
      end()
      beaconPracticeLog()
    }

    if (isActive) begin()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      end()
      flushPracticeLog()
    }
  }, [tool, isActive])
}

// Pages without a transport call this on anything that isn't a key or a
// click, like a note from a MIDI keyboard.
export function notePracticeActivity() {
  window.dispatchEvent(new Event('practice-activity'))
}

/** True while a key, click or note came in the last 90 seconds. */
export function useRecentActivity() {
  const [isActive, setIsActive] = useState(false)
  const timeoutRef = useRef(0)

  useEffect(() => {
    const onActivity = () => {
      setIsActive(true)
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setIsActive(false), ACTIVITY_WINDOW_MS)
    }
    const events = ['pointerdown', 'keydown', 'practice-activity']
    events.forEach((name) => window.addEventListener(name, onActivity))
    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity))
      window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return isActive
}

// Totals from a person's days, for showing: this week (the last 7 days
// including today), all time, the daily average and each tool's share of
// them, and the current streak of days in a row. The daily average is over
// the last 30 days, or since the first day logged when that's sooner, rest
// days included.
export function summarizePractice(days, today = new Date()) {
  const dayKey = (offset) => {
    const date = new Date(today)
    date.setDate(date.getDate() - offset)
    return localDay(date)
  }
  const sum = (tools) => Object.values(tools ?? {}).reduce((total, seconds) => total + seconds, 0)
  const week = new Set(Array.from({ length: 7 }, (_, offset) => dayKey(offset)))
  const logged = Object.keys(days).filter((day) => sum(days[day]) > 0).sort()
  const sinceFirst = logged.length ? Math.round((Date.parse(dayKey(0)) - Date.parse(logged[0])) / 86400000) + 1 : 1
  const averageDays = Math.max(1, Math.min(30, sinceFirst))
  const averageWindow = new Set(Array.from({ length: averageDays }, (_, offset) => dayKey(offset)))

  const tools = {}
  let allTime = 0
  let weekTotal = 0
  let averageTotal = 0
  for (const [day, byTool] of Object.entries(days)) {
    for (const [tool, seconds] of Object.entries(byTool)) {
      tools[tool] ??= { week: 0, allTime: 0, dailyAverage: 0 }
      tools[tool].allTime += seconds
      allTime += seconds
      if (week.has(day)) {
        tools[tool].week += seconds
        weekTotal += seconds
      }
      if (averageWindow.has(day)) {
        tools[tool].dailyAverage += seconds / averageDays
        averageTotal += seconds
      }
    }
  }
  // A streak still counts today before anything is logged today.
  let streak = 0
  for (let offset = sum(days[dayKey(0)]) > 0 ? 0 : 1; sum(days[dayKey(offset)]) > 0; offset += 1) streak += 1
  return { week: weekTotal, allTime, dailyAverage: averageTotal / averageDays, averageDays, streak, tools }
}

export { localDay }
