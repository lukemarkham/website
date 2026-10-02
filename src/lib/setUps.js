// Set Ups: a phrase of time (8 or 16 bars) with a few ensemble figures to
// set up, each led into by a fill that runs straight into its first note.
// Bars without a set-up can carry shorter rhythm cues, to comp along with on
// the snare or just to keep reading.
//
// Everything sits on an 8th-note grid across the phrase: slot 0 is beat 1 of
// bar 1, slot 1 its &, and so on, 8 slots to a bar. A note is
// { slot, slots, articulation, role }, where articulation is 'marcato' (^,
// short), 'accent' (>, held for its length), 'tenuto' (-, a full quarter) or
// 'staccato' (.), and role is 'setup' or 'cue'. Notes may be tied over a barline.

export const SLOTS_PER_BAR = 8

export const SET_UP_LENGTHS = [8, 16]

export const SET_UP_FILL_LENGTHS = [
  { beats: null, label: 'Mix' },
  { beats: 1, label: '1 beat' },
  { beats: 2, label: '2 beats' },
  { beats: 4, label: '1 bar' },
]

// Weights for Mix: two-beat fills are the everyday set-up.
const MIXED_FILL_BEATS = [1, 2, 2, 2, 4]

export const SET_UP_FEELS = [
  { id: 'swing', label: 'Swing' },
  { id: 'straight', label: 'Straight' },
]

// Figures to set up. `parity` is where the first note falls: 0 on a beat, 1
// on an &. Notes are [offset, slots, articulation] from the first note.
const SETUP_FIGURES = [
  { parity: 0, weight: 4, notes: [[0, 2, 'marcato']] },
  { parity: 1, weight: 4, notes: [[0, 1, 'marcato']] },
  { parity: 0, weight: 2, notes: [[0, 4, 'accent']] },
  // A held quarter. (A lone dotted quarter on the beat tells the drummer
  // nothing a tenuto quarter doesn't, and reads messier.)
  { parity: 0, weight: 2, notes: [[0, 2, 'tenuto']] },
  { parity: 1, weight: 3, notes: [[0, 3, 'accent']] },
  { parity: 1, weight: 2, notes: [[0, 5, 'accent']] },
  // "doo-DAT": an & into a short beat.
  { parity: 1, weight: 3, notes: [[0, 1, 'accent'], [1, 2, 'marcato']] },
  // "da-DAT": a beat and its &.
  { parity: 0, weight: 2, notes: [[0, 1, 'accent'], [1, 1, 'marcato']] },
  // Held, then a short kick off the next &.
  { parity: 0, weight: 2, notes: [[0, 3, 'accent'], [3, 1, 'marcato']] },
  // Short quarters walking into a punch.
  { parity: 0, weight: 1, notes: [[0, 2, 'staccato'], [2, 2, 'staccato'], [4, 2, 'marcato']] },
  // Off-beat stabs a beat apart.
  { parity: 1, weight: 2, notes: [[0, 1, 'marcato'], [2, 1, 'marcato']] },
]

// One-bar rhythms for the bars in between, placed from the start of the bar.
const CUE_FIGURES = [
  [[3, 1, 'marcato']],
  [[0, 2, 'staccato'], [3, 1, 'marcato']],
  [[2, 2, 'staccato'], [6, 2, 'staccato']],
  [[3, 1, 'accent'], [4, 2, 'marcato']],
  [[0, 3, 'accent'], [3, 1, 'marcato']],
  [[1, 1, 'marcato'], [5, 1, 'marcato']],
  [[2, 1, 'staccato'], [3, 1, 'marcato']],
  [[0, 2, 'marcato'], [5, 1, 'marcato']],
  [[3, 3, 'accent'], [6, 2, 'marcato']],
  [[1, 1, 'marcato'], [2, 2, 'staccato'], [6, 2, 'marcato']],
  [[0, 1, 'accent'], [1, 1, 'marcato'], [4, 2, 'staccato']],
  [[7, 1, 'marcato']],
]

// The chance a free bar gets a rhythm cue, when cues are on.
const CUE_CHANCE = 0.6
// Breathing room, in slots, between one figure and the next fill or figure.
const GAP = 2

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function pickWeighted(items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= weightOf(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

const BEAT_NAMES = ['1', '2', '3', '4']

export function describeSlot(slot) {
  const inBar = slot % SLOTS_PER_BAR
  const beat = BEAT_NAMES[Math.floor(inBar / 2)]
  return `${inBar % 2 ? `the & of ${beat}` : `beat ${beat}`} of bar ${Math.floor(slot / SLOTS_PER_BAR) + 1}`
}

function figureEnd(notes) {
  return Math.max(...notes.map((note) => note.slot + note.slots))
}

function setUpDescription(setUp) {
  const { fill, notes } = setUp
  const beats = (fill.end - fill.start) / 2
  const length = beats === 4 ? 'a bar' : `${beats} ${beats === 1 ? 'beat' : 'beats'}`
  const first = notes[0]
  const crosses = Math.floor(first.slot / SLOTS_PER_BAR) !== Math.floor((first.slot + first.slots - 1) / SLOTS_PER_BAR)
  const what = notes.length > 1 ? `a ${notes.length}-note figure starting on` : first.articulation === 'accent' ? 'a held hit on' : 'a short hit on'
  return `Fill for ${length} into ${what} ${describeSlot(first.slot)}${crosses ? ', tied over the barline' : ''}.`
}

const ARTICULATION_CODES = { marcato: 'm', accent: 'a', staccato: 's', tenuto: 't' }

function encodeNotes(notes) {
  return notes.map((note) => `${note.slot}-${note.slots}${ARTICULATION_CODES[note.articulation]}`).join(',')
}

// Draws set-ups one per stretch of the phrase, left to right. Each fill
// starts in bar 2 at the earliest and clear of the figure before it.
function placeSetUps(bars, fillBeats) {
  const total = bars * SLOTS_PER_BAR
  const count = bars === 8 ? 2 : pick([3, 4])
  const setUps = []
  let previousEnd = SLOTS_PER_BAR - GAP

  for (let index = 0; index < count; index += 1) {
    const stretchStart = Math.round((index * bars) / count) * SLOTS_PER_BAR
    const stretchEnd = Math.round(((index + 1) * bars) / count) * SLOTS_PER_BAR
    const beats = fillBeats ?? pick(MIXED_FILL_BEATS)
    const fillSlots = beats * 2

    const options = []
    for (const figure of SETUP_FIGURES) {
      const length = Math.max(...figure.notes.map(([offset, slots]) => offset + slots))
      const earliest = Math.max(stretchStart + fillSlots, previousEnd + GAP + fillSlots)
      for (let slot = earliest; slot < stretchEnd; slot += 1) {
        if (slot % 2 !== figure.parity || slot + length > total) continue
        // Pushes (the & of 4, tied into the next bar) and downbeats are what
        // charts set up most, so they come up more often.
        const inBar = slot % SLOTS_PER_BAR
        const weight = figure.weight * (inBar === 7 || inBar === 0 ? 2 : 1)
        options.push({ figure, slot, weight })
      }
    }
    if (options.length === 0) return null

    const { figure, slot } = pickWeighted(options, (option) => option.weight)
    const notes = figure.notes.map(([offset, slots, articulation]) => ({ slot: slot + offset, slots, articulation, role: 'setup' }))
    setUps.push({ fill: { start: slot - fillSlots, end: slot }, notes })
    previousEnd = figureEnd(notes)
  }
  return setUps
}

// Rhythm cues in bars that hold no fill or set-up figure, kept clear of the
// fills and figures either side. Bar 1 stays plain time.
function placeCues(bars, setUps) {
  const busy = []
  setUps.forEach(({ fill, notes }) => busy.push([fill.start, figureEnd(notes)]))
  const cues = []

  for (let bar = 1; bar < bars; bar += 1) {
    const start = bar * SLOTS_PER_BAR
    const end = start + SLOTS_PER_BAR
    if (busy.some(([from, to]) => from < end + GAP && to + GAP > start)) continue
    if (Math.random() >= CUE_CHANCE) continue
    const notes = pick(CUE_FIGURES).map(([offset, slots, articulation]) => ({ slot: start + offset, slots, articulation, role: 'cue' }))
    cues.push(...notes)
    busy.push([start, figureEnd(notes)])
  }
  return cues
}

/**
 * A random phrase.
 * @param {{ bars: 8 | 16, fillBeats: number | null, feel: 'swing' | 'straight', cues: boolean }} options
 */
export function generateSetUpPhrase({ bars, fillBeats, feel, cues }) {
  let setUps = null
  while (!setUps) setUps = placeSetUps(bars, fillBeats)
  const cueNotes = cues ? placeCues(bars, setUps) : []
  const notes = [...setUps.flatMap((setUp) => setUp.notes), ...cueNotes].sort((a, b) => a.slot - b.slot)

  return {
    key: [
      feel,
      bars,
      setUps.map((setUp) => `${(setUp.fill.end - setUp.fill.start) / 2}@${encodeNotes(setUp.notes)}`).join(';'),
      encodeNotes(cueNotes),
    ].join('|'),
    feel,
    bars,
    notes,
    fills: setUps.map((setUp) => setUp.fill),
    descriptions: setUps.map(setUpDescription),
  }
}
