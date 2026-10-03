// Set Ups: a piece of time (8, 16 or 32 bars) with ensemble figures to set
// up, each led into by a fill. Bars without a set-up can carry shorter rhythm
// cues, to comp along with on the snare or just to keep reading.
//
// Everything sits on an 8th-note grid across the piece: slot 0 is beat 1 of
// bar 1, slot 1 its &, and so on, 8 slots to a bar. A note is
// { slot, slots, articulation, role, staff }:
// - articulation is 'marcato' (^, short), 'accent' (>, held for its
//   length), 'tenuto' (-, a full quarter) or 'staccato' (.)
// - role is 'setup', 'fillHit' (a band hit inside a fill) or 'cue'
// - staff is true when the note is written in the staff as rhythmic slashes
//   rather than cued above it. That's every hit inside a fill, every set-up
//   figure in a bar that has fill in it (the fill line takes no rhythmic
//   space, so the bar's rhythm is written out), and the final figure.
// Notes may be tied over a barline.
//
// Fills start and end on a downbeat. A fill into a figure on an & ends at
// that beat; the drummer fills on until the figure, which the rhythmic
// slashes show with an 8th rest.
//
// The piece always ends on a set-up in its last bar, the last thing written:
// rests follow it, not slashes.

export const SLOTS_PER_BAR = 8

export const SET_UP_LENGTHS = [8, 16, 32]

// Rehearsal letters at each eight-bar section, as on a chart.
export function sectionsFor(bars) {
  return Array.from({ length: bars / 8 }, (_, index) => ({ bar: index * 8, label: 'ABCD'[index] }))
}

export const SET_UP_FILL_LENGTHS = [
  { beats: null, label: 'Mix' },
  { beats: 1, label: '1 beat' },
  { beats: 2, label: '2 beats' },
  { beats: 4, label: '1 bar' },
]

// Weights for Mix: two-beat fills are the everyday set-up.
const MIXED_FILL_BEATS = [1, 2, 2, 2, 4]

// `weight` is how often each feel comes up when the player picks All.
export const SET_UP_FEELS = [
  { id: 'swing', label: 'Swing', tempoRange: [100, 200], weight: 3 },
  { id: 'straight', label: 'Straight 8ths', tempoRange: [90, 140], weight: 2 },
  { id: 'bossa', label: 'Bossa Nova', tempoRange: [110, 150], weight: 1 },
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

// The chance a fill of 2 beats or a bar has the band hitting inside it.
const FILL_HIT_CHANCE = { 2: 0.3, 4: 0.5 }

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

const barOf = (slot) => Math.floor(slot / SLOTS_PER_BAR)

function setUpDescription(setUp) {
  const { fill, notes, fillHits } = setUp
  const beats = (fill.end - fill.start) / 2
  const length = beats === 4 ? 'a bar' : `${beats} ${beats === 1 ? 'beat' : 'beats'}`
  const first = notes[0]
  const crosses = barOf(first.slot) !== barOf(first.slot + first.slots - 1)
  const single = { accent: 'a held hit on', tenuto: 'a held quarter on' }[first.articulation] ?? 'a short hit on'
  const what = notes.length > 1 ? `a ${notes.length}-note figure starting on` : single
  const catching = fillHits.length
    ? `, catching the band on ${fillHits.map((hit) => describeSlot(hit.slot)).join(' and ')},`
    : ''
  return `Fill for ${length}${catching} into ${what} ${describeSlot(first.slot)}${crosses ? ', tied over the barline' : ''}.`
}

const ARTICULATION_CODES = { marcato: 'm', accent: 'a', staccato: 's', tenuto: 't' }

function encodeNotes(notes) {
  return notes.map((note) => `${note.slot}-${note.slots}${ARTICULATION_CODES[note.articulation]}`).join(',')
}

// Short band hits inside a fill: none in its first 8th, ending at least an
// 8th before it does, one to a beat at most, a marcato quarter on a beat or
// 8th on an &.
function placeFillHits(fill) {
  const beats = (fill.end - fill.start) / 2
  if (!(Math.random() < (FILL_HIT_CHANCE[beats] ?? 0))) return []
  const wanted = beats === 4 && Math.random() < 0.4 ? 2 : 1
  const hits = []
  for (let attempt = 0; attempt < 20 && hits.length < wanted; attempt += 1) {
    const slot = fill.start + 1 + Math.floor(Math.random() * (fill.end - fill.start - 2))
    const slots = slot % 2 === 0 ? 2 : 1
    if (slot + slots > fill.end - 1) continue
    if (hits.some((hit) => Math.floor(hit.slot / 2) === Math.floor(slot / 2) || Math.abs(hit.slot - slot) < 2)) continue
    hits.push({ slot, slots, articulation: 'marcato', role: 'fillHit', staff: true })
  }
  return hits.sort((a, b) => a.slot - b.slot)
}

// How many set-ups a piece of this length gets.
function setUpCount(bars) {
  if (bars === 8) return 2
  if (bars === 16) return pick([3, 4])
  return pick([6, 7])
}

// Draws set-ups one per stretch of the piece, left to right. Each fill
// starts in bar 2 at the earliest and clear of the figure before it, and the
// last figure is in the last bar (or pushed into it from the & of 4).
function placeSetUps(bars, fillBeats) {
  const total = bars * SLOTS_PER_BAR
  const count = setUpCount(bars)
  const setUps = []
  let previousEnd = SLOTS_PER_BAR - GAP

  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1
    const stretchStart = Math.round((index * bars) / count) * SLOTS_PER_BAR
    const stretchEnd = isLast ? total : Math.round(((index + 1) * bars) / count) * SLOTS_PER_BAR
    const beats = fillBeats ?? pick(MIXED_FILL_BEATS)

    const options = []
    for (const figure of SETUP_FIGURES) {
      const length = Math.max(...figure.notes.map(([offset, slots]) => offset + slots))
      for (let slot = stretchStart; slot < stretchEnd; slot += 1) {
        if (slot % 2 !== figure.parity || slot + length > total) continue
        // The fill ends on the beat the figure falls in.
        const fillStart = Math.floor(slot / 2) * 2 - beats * 2
        if (fillStart < SLOTS_PER_BAR || fillStart < previousEnd + GAP) continue
        // The final figure sounds in the last bar: a push from the & of 4
        // only if it's tied over.
        if (isLast && (slot < total - SLOTS_PER_BAR - 1 || slot + length <= total - SLOTS_PER_BAR)) continue
        // Pushes (the & of 4, tied into the next bar) and downbeats are what
        // charts set up most, so they come up more often.
        const inBar = slot % SLOTS_PER_BAR
        const weight = figure.weight * (inBar === 7 || inBar === 0 ? 2 : 1)
        options.push({ figure, slot, fillStart, weight })
      }
    }
    if (options.length === 0) return null

    const { figure, slot, fillStart } = pickWeighted(options, (option) => option.weight)
    const fill = { start: fillStart, end: Math.floor(slot / 2) * 2 }
    const notes = figure.notes.map(([offset, slots, articulation]) => ({ slot: slot + offset, slots, articulation, role: 'setup' }))
    // Written in the staff when it shares a bar with fill, or ends the piece.
    const fillBars = new Set()
    for (let at = fill.start; at < fill.end; at += 1) fillBars.add(barOf(at))
    const staff = isLast || notes.some((note) => fillBars.has(barOf(note.slot)) || fillBars.has(barOf(note.slot + note.slots - 1)))
    notes.forEach((note) => {
      note.staff = staff
    })
    setUps.push({ fill, notes, fillHits: placeFillHits(fill) })
    previousEnd = figureEnd(notes)
  }
  return setUps
}

// Rhythm cues in bars that hold no fill or set-up figure, kept clear of the
// fills and figures either side. Bar 1 stays plain time, and nothing comes
// after the final set-up's fill.
function placeCues(bars, setUps) {
  const busy = []
  setUps.forEach(({ fill, notes }) => busy.push([fill.start, figureEnd(notes)]))
  busy.push([setUps[setUps.length - 1].fill.start, bars * SLOTS_PER_BAR])
  const cues = []

  for (let bar = 1; bar < bars; bar += 1) {
    const start = bar * SLOTS_PER_BAR
    const end = start + SLOTS_PER_BAR
    if (busy.some(([from, to]) => from < end + GAP && to + GAP > start)) continue
    if (Math.random() >= CUE_CHANCE) continue
    const notes = pick(CUE_FIGURES).map(([offset, slots, articulation]) => ({ slot: start + offset, slots, articulation, role: 'cue', staff: false }))
    cues.push(...notes)
    busy.push([start, figureEnd(notes)])
  }
  return cues
}

/**
 * A random piece.
 * @param {{ bars: 8 | 16 | 32, fillBeats: number | null, feel: 'swing' | 'straight' | 'bossa', cues: boolean }} options
 */
export function generateSetUpPhrase({ bars, fillBeats, feel, cues }) {
  let setUps = null
  while (!setUps) setUps = placeSetUps(bars, fillBeats)
  const cueNotes = cues ? placeCues(bars, setUps) : []
  // A figure that shares a bar with any fill, not just its own, is written
  // in the staff too: the fill line never sits over a cue line's rests.
  const fillBars = new Set(setUps.flatMap(({ fill }) => {
    const covered = []
    for (let at = fill.start; at < fill.end; at += 1) covered.push(barOf(at))
    return covered
  }))
  setUps.forEach((setUp) => {
    if (setUp.notes.some((note) => fillBars.has(barOf(note.slot)) || fillBars.has(barOf(note.slot + note.slots - 1)))) {
      setUp.notes.forEach((note) => {
        note.staff = true
      })
    }
  })
  const notes = [...setUps.flatMap((setUp) => [...setUp.fillHits, ...setUp.notes]), ...cueNotes].sort((a, b) => a.slot - b.slot)

  return {
    key: [
      feel,
      bars,
      setUps.map((setUp) => `${(setUp.fill.end - setUp.fill.start) / 2}@${encodeNotes(setUp.notes)}${setUp.fillHits.length ? `+${encodeNotes(setUp.fillHits)}` : ''}`).join(';'),
      encodeNotes(cueNotes),
    ].join('|'),
    feel,
    bars,
    notes,
    fills: setUps.map((setUp) => setUp.fill),
    // Where the piece ends: nothing is written after the final figure.
    end: figureEnd(setUps[setUps.length - 1].notes),
    sections: sectionsFor(bars),
    descriptions: setUps.map(setUpDescription),
  }
}
