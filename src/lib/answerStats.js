// The quiz tools' side of answer stats (src/lib/answerWeights.js): what this
// person gets right and wrong, and how long their answers take.
//
// With a practice PIN the record lives on the server
// (netlify/lib/answerStats.mjs), so it follows the student between devices
// and shows on their page; answers are queued here until the server has
// them, like practice time. Without one it's kept in this browser only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ANSWER_TOOLS, recordAnswer } from './answerWeights.js'
import { usePracticePin } from './practiceLog.js'

const ENDPOINT = '/.netlify/functions/answer-stats'
const OUTBOX_KEY = 'answer-stats-outbox'
const localKey = (pin, tool) => `answer-stats:${pin ?? 'guest'}:${tool}`

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
    // Without storage the record lasts as long as the page.
  }
}

const groups = (queued) => {
  const byPinAndTool = new Map()
  for (const { pin, tool, answer } of queued) {
    const groupKey = `${pin}/${tool}`
    if (!byPinAndTool.has(groupKey)) byPinAndTool.set(groupKey, { pin, tool, answers: [] })
    byPinAndTool.get(groupKey).answers.push(answer)
  }
  return [...byPinAndTool.values()].map((group) => ({ ...group, answers: group.answers.slice(0, 50) }))
}

let flushing = false

async function flushAnswers() {
  if (flushing) return
  const queued = readJson(OUTBOX_KEY, [])
  if (queued.length === 0) return
  flushing = true
  try {
    for (const body of groups(queued)) {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      // Sent, or never going to be accepted: off the queue either way.
      if (response.ok || response.status === 404 || response.status === 400) {
        const done = new Set(body.answers.map((answer) => answer.id))
        writeJson(OUTBOX_KEY, readJson(OUTBOX_KEY, []).filter((item) => !done.has(item.answer.id)))
      }
    }
  } catch {
    // Offline: the queue keeps them.
  } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const body of groups(readJson(OUTBOX_KEY, []))) {
      navigator.sendBeacon?.(ENDPOINT, new Blob([JSON.stringify(body)], { type: 'application/json' }))
    }
  })
}

// { tool: items } for whoever has this PIN.
export async function fetchAnswerStatsByPin(pin) {
  const tools = {}
  for (const tool of ANSWER_TOOLS) {
    const response = await fetch(`${ENDPOINT}?pin=${encodeURIComponent(pin)}&tool=${encodeURIComponent(tool)}`)
    if (!response.ok) throw new Error('Answer stats unavailable')
    tools[tool] = (await response.json()).items
  }
  return tools
}

export async function fetchStudentAnswerStats(slug) {
  const response = await fetch(`${ENDPOINT}?student=${encodeURIComponent(slug)}`)
  if (!response.ok) throw new Error('Answer stats unavailable')
  return (await response.json()).tools
}

/**
 * The record for `tool` ({ item: record }) and `record(answers)`, which adds
 * [{ item, correct, seconds }] to it. `seconds` is null for an answer that
 * wasn't timed, like a revealed one.
 */
export function useAnswerStats(tool) {
  const person = usePracticePin()
  const pin = person?.pin ?? null
  const storageKey = localKey(pin, tool)
  const [state, setState] = useState(() => ({ key: storageKey, items: readJson(storageKey, {}) }))
  // A different PIN (or tool) is a different record, picked up as it changes.
  if (state.key !== storageKey) setState({ key: storageKey, items: readJson(storageKey, {}) })

  useEffect(() => {
    writeJson(state.key, state.items)
  }, [state])

  // The server's record wins once it arrives, with anything still on its way
  // there played on top.
  useEffect(() => {
    if (!pin) return undefined
    let cancelled = false
    flushAnswers()
    fetch(`${ENDPOINT}?pin=${encodeURIComponent(pin)}&tool=${encodeURIComponent(tool)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const pending = readJson(OUTBOX_KEY, []).filter((item) => item.pin === pin && item.tool === tool)
        setState({ key: localKey(pin, tool), items: pending.map((item) => item.answer).reduce(recordAnswer, data.items) })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pin, tool])

  const record = useCallback((answers) => {
    const stamped = answers.map((answer) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      ...answer,
      seconds: Number.isFinite(answer.seconds) ? Math.round(answer.seconds * 10) / 10 : null,
    }))
    setState((current) => ({ ...current, items: stamped.reduce(recordAnswer, current.items) }))
    if (!pin) return
    writeJson(OUTBOX_KEY, [...readJson(OUTBOX_KEY, []), ...stamped.map((answer) => ({ pin, tool, answer }))])
    flushAnswers()
  }, [pin, tool])

  return { items: state.items, record }
}

/**
 * Times answers. `start(delayMs)` begins the clock, after `delayMs` if the
 * question hasn't really begun yet (its music is still on the way to the
 * part being asked about). `pause()` and `resume()` hold it, along with
 * whatever is left of the delay; a hidden tab holds it too. `lap()` gives
 * the seconds since the last lap (or the start) and `stop()` the seconds
 * since the start, ending the clock; both null when it isn't running, and
 * `stop()` null too when the clock never got going.
 */
export function useAnswerTimer() {
  const clockRef = useRef(null)

  const elapsed = (clock, now) => clock.banked + (clock.since === null ? 0 : Math.max(0, now - clock.since))

  const pause = useCallback(() => {
    const clock = clockRef.current
    if (!clock || clock.since === null) return
    const now = performance.now()
    clock.banked = elapsed(clock, now)
    clock.delayLeft = Math.max(0, clock.since - now)
    clock.since = null
  }, [])

  const resume = useCallback(() => {
    const clock = clockRef.current
    if (!clock || clock.since !== null) return
    clock.since = performance.now() + clock.delayLeft
  }, [])

  const start = useCallback((delayMs = 0) => {
    clockRef.current = { banked: 0, since: performance.now() + Math.max(0, delayMs), delayLeft: 0, lapAt: 0 }
    if (document.visibilityState === 'hidden') pause()
  }, [pause])

  const lap = useCallback(() => {
    const clock = clockRef.current
    if (!clock) return null
    const now = elapsed(clock, performance.now())
    const seconds = (now - clock.lapAt) / 1000
    clock.lapAt = now
    return seconds
  }, [])

  const stop = useCallback(() => {
    const clock = clockRef.current
    if (!clock) return null
    clockRef.current = null
    // Answered before the question reached the part being asked about: a
    // guess, not a time.
    const seconds = elapsed(clock, performance.now()) / 1000
    return seconds > 0 ? seconds : null
  }, [])

  useEffect(() => {
    // A hidden tab holds the clock only if it wasn't already held.
    let heldByHiding = false
    const onVisibility = () => {
      const clock = clockRef.current
      if (document.visibilityState === 'hidden') {
        heldByHiding = Boolean(clock && clock.since !== null)
        pause()
      } else if (heldByHiding) {
        heldByHiding = false
        resume()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause, resume])

  return useMemo(() => ({ start, pause, resume, lap, stop }), [start, pause, resume, lap, stop])
}
