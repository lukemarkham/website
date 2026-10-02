// The band behind a Set Ups phrase: changes in the style of a jazz standard,
// a walking bass, piano comping and horns on the figures, all reacting to
// what's written.
//
// - The horns play every figure: set-ups and hits inside fills at full level,
//   rhythm cues quieter. They voice the chord sounding at that moment; a
//   figure on an & belongs to the chord of the beat it anticipates.
// - The bass walks in quarters and catches the set-ups and fill hits with the
//   horns (a root, short or held as written), then picks the walk back up.
// - The piano comps in bars with nothing written, plays every figure with the
//   horns, and lays out under fills so the drums are exposed.
// - After the final set-up the walking and comping stop: the phrase ends on
//   the band's hit.
//
// Events are on the same 8th-note grid as the phrase, { slot, slots,
// instrument: 'bass' | 'piano' | 'horns', midi: number[], short, level }, so
// the page can swing the &s.

import { CHORD_INTERVALS, voiceChord } from './harmony'

const SLOTS_PER_BAR = 8

// Big band keys.
const KEY_PCS = [5, 10, 3, 0, 7, 8]

// Eight-bar progressions in the style of standards, each ending on the
// tonic so the final hit lands home. A bar is one chord, or two splitting it
// in half; a chord is [semitones above the tonic, quality].
const PROGRESSIONS = [
  // Rhythm changes, A section.
  [[[0, '6'], [9, '7b9']], [[2, 'm7'], [7, '9']], [[0, '6'], [9, '7b9']], [[2, 'm7'], [7, '9']], [[7, 'm7'], [0, '9']], [[5, '6'], [6, 'dim7']], [[2, 'm7'], [7, '13']], [[0, '6']]],
  // I–VI–ii–V round the cycle.
  [[[0, 'maj7']], [[9, '7b9']], [[2, 'm9']], [[7, '13']], [[4, 'm7']], [[9, '7b9']], [[2, 'm7'], [7, '13']], [[0, '69']]],
  // A Train-style II7.
  [[[0, '6']], [[0, '6']], [[2, '9']], [[2, '9']], [[2, 'm9']], [[7, '13']], [[2, 'm7'], [7, '7b9']], [[0, '6']]],
  // Down the cycle from ii, Autumn Leaves-style.
  [[[2, 'm9']], [[7, '13']], [[0, 'maj7']], [[5, 'maj7']], [[11, 'ø7']], [[4, '7b9']], [[2, 'm7'], [7, '13']], [[0, '69']]],
  // Bird-style ii–Vs falling into the IV.
  [[[0, 'maj7']], [[11, 'ø7'], [4, '7b9']], [[9, 'm7'], [2, '9']], [[7, 'm7'], [0, '9']], [[5, 'maj7']], [[5, 'm7'], [10, '9']], [[2, 'm7'], [7, '13']], [[0, '6']]],
]

// Comping rhythms for a bar, as 8th-note slots. Many favour the & of 2 and
// the & of 4, the way a big band pianist stays out of the way.
const COMP_PATTERNS = [[3], [0, 3], [2, 6], [3, 7], [5], [1, 4], [3, 6], [0, 5]]

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function nearestInRange(pc, previous, low, high) {
  let best = null
  for (let midi = low; midi <= high; midi += 1) {
    if (((midi % 12) + 12) % 12 !== pc) continue
    if (best === null || Math.abs(midi - previous) < Math.abs(best - previous)) best = midi
  }
  return best
}

/**
 * @param {{ bars: number, notes: object[], fills: object[] }} phrase
 */
export function arrangeBand(phrase) {
  const { bars, notes, fills } = phrase
  const total = bars * SLOTS_PER_BAR
  const keyPc = pick(KEY_PCS)
  const progression = Array.from({ length: bars / 8 }, () => pick(PROGRESSIONS)).flat()

  // Each chord with the slots it covers.
  const chordAtSlot = []
  progression.forEach((bar, index) => {
    bar.forEach(([degree, quality], half) => {
      const chord = { rootPc: (keyPc + degree) % 12, quality }
      const from = index * SLOTS_PER_BAR + (bar.length === 2 ? half * 4 : 0)
      const to = bar.length === 2 && half === 0 ? from + 4 : (index + 1) * SLOTS_PER_BAR
      for (let slot = from; slot < to; slot += 1) chordAtSlot[slot] = chord
    })
  })
  const chordAt = (slot) => chordAtSlot[Math.min(total - 1, Math.max(0, slot))]
  // A figure on an & anticipates the next beat, chord and all.
  const chordFor = (slot) => chordAt(slot % 2 === 1 ? slot + 1 : slot)

  const events = []
  const lastSetUp = Math.max(...notes.filter((note) => note.role === 'setup').map((note) => note.slot))
  const full = notes.filter((note) => note.role !== 'cue')
  const inFill = (slot) => fills.some((fill) => slot >= fill.start && slot < fill.end)

  // ---- Horns and piano on every figure (voiced below, in time order).
  notes.forEach((note) => {
    const chord = chordFor(note.slot)
    const short = note.articulation === 'marcato' || note.articulation === 'staccato'
    const level = note.role === 'cue' ? 0.55 : 1
    events.push({ slot: note.slot, slots: note.slots, instrument: 'horns', chord, short, level })
    events.push({ slot: note.slot, slots: note.slots, instrument: 'piano', chord, short, level: level * 0.9 })
  })

  // ---- Walking bass.
  // A beat is the band's when a full-band figure starts on it or is held
  // through it; the walk steps aside and the bass plays the figure.
  const bandOwnsBeat = (beat) => full.some((note) => {
    const downbeat = beat * 2
    return note.slot === downbeat || (note.slot < downbeat && note.slot + note.slots > downbeat)
  })
  const figureOnAnd = (beat) => full.find((note) => note.slot === beat * 2 + 1)

  let previousBass = nearestInRange(chordAt(0).rootPc, 40, 28, 50)
  for (let beat = 0; beat * 2 < total; beat += 1) {
    const slot = beat * 2
    if (slot >= lastSetUp) break
    if (bandOwnsBeat(beat)) continue

    const chord = chordAt(slot)
    const intervals = CHORD_INTERVALS[chord.quality]
    const isChordStart = slot === 0 || chordAt(slot - 2) !== chord
    const next = chordAt(slot + 2)
    let pc
    if (isChordStart) pc = chord.rootPc
    else if (next !== chord) pc = (next.rootPc + pick([1, -1, 7])) % 12
    else pc = (chord.rootPc + pick([intervals[1], intervals[2], intervals[3] ?? intervals[2], 2])) % 12
    const midi = nearestInRange((pc + 12) % 12, previousBass, 28, 50)
    previousBass = midi
    // A figure on this beat's & cuts the walking note short.
    events.push({ slot, slots: figureOnAnd(beat) ? 1 : 2, instrument: 'bass', midi: [midi], short: false, level: 1 })
  }
  full.forEach((note) => {
    const chord = chordFor(note.slot)
    const midi = nearestInRange(chord.rootPc, previousBass, 28, 45)
    const short = note.articulation === 'marcato' || note.articulation === 'staccato'
    events.push({ slot: note.slot, slots: note.slots, instrument: 'bass', midi: [midi], short, level: 1 })
  })

  // ---- Piano comping, in bars with nothing written and no fill.
  for (let bar = 0; bar < bars; bar += 1) {
    const start = bar * SLOTS_PER_BAR
    if (start >= lastSetUp) break
    const busy = notes.some((note) => note.slot < start + SLOTS_PER_BAR && note.slot + note.slots > start)
    let filled = false
    for (let slot = start; slot < start + SLOTS_PER_BAR; slot += 1) filled ||= inFill(slot)
    if (busy || filled) continue
    pick(COMP_PATTERNS).forEach((offset) => {
      const slot = start + offset
      events.push({ slot, slots: 1, instrument: 'piano', chord: chordFor(slot), short: true, level: 0.6 })
    })
  }

  // Voicings move as little as they can from one chord to the next, in the
  // order they sound. The horns take the piano's voicing with the trumpets an
  // octave over its top note and the trombones' root underneath.
  events.sort((a, b) => a.slot - b.slot)
  let previousVoicing = null
  let previousChord = null
  events.forEach((event) => {
    if (!event.chord) return
    if (event.chord !== previousChord) {
      previousVoicing = voiceChord(event.chord.rootPc, event.chord.quality, previousVoicing)
      previousChord = event.chord
    }
    event.midi = event.instrument === 'horns'
      ? [nearestInRange(event.chord.rootPc, 48, 43, 54), ...previousVoicing, previousVoicing[previousVoicing.length - 1] + 12]
      : previousVoicing
    delete event.chord
  })

  return { keyPc, events }
}
