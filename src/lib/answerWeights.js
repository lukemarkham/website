// How someone is doing with each kind of question a quiz tool asks, and how
// much more (or less) often each should come up because of it. Pure, so the
// server (netlify/lib/answerStats.mjs) keeps the record with the same rules
// the page uses to show it.
//
// An item is a short id for one kind of question, like `p:tritone-sub` for a
// progression or `c:tritone-sub:1` for one chord of it. Its record:
//   n         answers to it
//   right     of them correct
//   accuracy  recent share correct, 0 to 1, weighted toward the latest
//   time      recent seconds to a correct answer (null until there is one)

export const ANSWER_TOOLS = ['ear-training', 'chord-progressions']

// How far each new answer moves the recent figures: a third of the way, so a
// few right answers in a row are enough to ease off something that was hard.
const RECENT = 0.3

export function recordAnswer(items, { item, correct, seconds }) {
  const record = items[item] ?? { n: 0, right: 0, accuracy: null, time: null }
  const score = correct ? 1 : 0
  const timed = correct && Number.isFinite(seconds)
  return {
    ...items,
    [item]: {
      n: record.n + 1,
      right: record.right + score,
      accuracy: record.accuracy === null ? score : record.accuracy + RECENT * (score - record.accuracy),
      time: !timed ? record.time : record.time === null ? seconds : record.time + RECENT * (seconds - record.time),
    },
  }
}

// The middle answer time across the items starting with `prefix`, which is
// what one item's own time is measured against.
export function typicalAnswerTime(items, prefix) {
  const times = Object.entries(items)
    .filter(([item, record]) => item.startsWith(prefix) && record.time !== null)
    .map(([, record]) => record.time)
    .sort((a, b) => a - b)
  if (times.length === 0) return null
  const middle = Math.floor(times.length / 2)
  return times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2
}

// How often an item comes up next to one never asked (1). Misses push it up,
// to three times as often for one that is always missed; answering it quicker
// than usual eases it down, to about two thirds as often for the fastest, and
// slower than usual nudges it up. A record of only an answer or two counts for
// less, so one slip doesn't swing it.
export function answerWeight(record, typicalTime) {
  if (!record || record.n === 0) return 1
  let weight = 1 + 2 * (1 - record.accuracy)
  if (record.time !== null && typicalTime) {
    weight *= Math.min(1.5, Math.max(0.6, record.time / typicalTime)) ** 0.75
  }
  const confidence = record.n / (record.n + 2)
  return 1 + confidence * (weight - 1)
}

export function pickWeighted(choices, weightOf) {
  const weights = choices.map(weightOf)
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0)
  for (let index = 0; index < choices.length; index += 1) {
    roll -= weights[index]
    if (roll < 0) return choices[index]
  }
  return choices[choices.length - 1]
}
