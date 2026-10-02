// Set Ups: a four-bar phrase of time with one ensemble hit, and a fill that
// sets it up. The fill always runs straight into the hit, so the drummer
// practises reading the figure and leading the band into it.
//
// Everything sits on an 8th-note grid across the phrase: slot 0 is beat 1 of
// bar 1, slot 1 its &, and so on, 8 slots to a bar.

export const SET_UP_BARS = 4
const SLOTS_PER_BAR = 8
const PHRASE_SLOTS = SET_UP_BARS * SLOTS_PER_BAR

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

// How long each hit is written, in slots. A short hit is a marcato quarter
// on the beat or a marcato 8th off it. A long one is accented and held: a
// half note on the beat, or an 8th tied into the next beat off it. Long hits
// stay inside their bar.
function writtenLength(slot, length) {
  const offBeat = slot % 2 === 1
  if (length === 'short') return offBeat ? 1 : 2
  return offBeat ? 3 : 4
}

function fitsInBar(slot, slots) {
  return (slot % SLOTS_PER_BAR) + slots <= SLOTS_PER_BAR
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

const BEAT_NAMES = ['1', '2', '3', '4']

export function describeSlot(slot) {
  const inBar = slot % SLOTS_PER_BAR
  const beat = BEAT_NAMES[Math.floor(inBar / 2)]
  return `${inBar % 2 ? `the & of ${beat}` : `beat ${beat}`} of bar ${Math.floor(slot / SLOTS_PER_BAR) + 1}`
}

/**
 * A random set-up. The fill starts in bar 2 at the earliest, so there is
 * always a bar of time first.
 * @param {{ fillBeats: number | null, feel: 'swing' | 'straight' }} options
 */
export function generateSetUp({ fillBeats, feel }) {
  const beats = fillBeats ?? pick(MIXED_FILL_BEATS)
  const length = Math.random() < 0.5 ? 'short' : 'long'
  const fillSlots = beats * 2
  const slots = []
  for (let slot = SLOTS_PER_BAR + fillSlots; slot < PHRASE_SLOTS; slot += 1) {
    if (fitsInBar(slot, writtenLength(slot, length))) slots.push(slot)
  }
  const slot = pick(slots)

  return {
    key: `${feel}:${slot}:${length}:${beats}`,
    feel,
    fillBeats: beats,
    hit: { slot, length, slots: writtenLength(slot, length) },
    fill: { start: slot - fillSlots, end: slot },
    description: `Fill for ${beats === 4 ? 'a bar' : `${beats} ${beats === 1 ? 'beat' : 'beats'}`} into a ${length} hit on ${describeSlot(slot)}.`,
  }
}
