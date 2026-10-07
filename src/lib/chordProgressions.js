// Chord progression drills: a key and a progression come up, and the answer is
// each chord of it played in turn on a MIDI keyboard.
//
// A chord counts when its guide tones are there, which is what makes it that
// chord: the third and seventh, or the fourth and seventh of a sus chord. A
// tonic can take a sixth in place of the seventh (C6, Cm6), and a minor tonic
// any of the sixth, flat seventh or major seventh. The root and fifth can be
// left out, as they are in rootless voicings. Any other note must be a tension
// the chord takes, so a wrong note fails it. Dominants take every usual
// tension, natural or altered.

import { KEYS, chordSymbol, keyForMode } from './harmony.js'

// Semitones above the root. `oneOf` is the seventh-or-sixth: at least one of
// them has to be there. `quality` is what the answer shows once played.
const KINDS = {
  m7: { quality: 'm7', guideTones: [3, 10], allowed: [0, 3, 7, 10, 2, 5, 9] },
  ø7: { quality: 'ø7', guideTones: [3, 10], allowed: [0, 3, 6, 10, 2, 5, 8] },
  7: { quality: '7', guideTones: [4, 10], allowed: [0, 4, 7, 10, 1, 2, 3, 6, 8, 9] },
  sus: { quality: '7sus4', guideTones: [5, 10], allowed: [0, 5, 7, 10, 1, 2, 9] },
  maj7: { quality: 'maj7', guideTones: [4, 11], allowed: [0, 4, 7, 11, 2, 6, 9] },
  dim7: { quality: 'dim7', guideTones: [3, 9], allowed: [0, 3, 6, 9, 2, 5, 8, 11] },
  // The minor-plagal iv: m6 as often as m7.
  m6or7: { quality: 'm6', guideTones: [3], oneOf: [9, 10], allowed: [0, 3, 7, 9, 10, 2, 5] },
  I: { quality: 'maj7', guideTones: [4], oneOf: [11, 9], allowed: [0, 4, 7, 11, 9, 2, 6] },
  i: { quality: 'm6', guideTones: [3], oneOf: [9, 10, 11], allowed: [0, 3, 7, 9, 10, 11, 2, 5] },
}

// Fewer notes than this is a shell, not a voicing, and would let two stray
// keys count as an answer.
export const MIN_NOTES = 3

export const MODES = ['major', 'minor']

export const PROGRESSION_TYPES = [
  { id: 'ii-v', label: 'ii–Vs' },
  { id: 'backdoor', label: 'Backdoor' },
  { id: 'tritone', label: 'Tritone subs' },
  { id: 'turnaround', label: 'Turnarounds' },
  { id: 'secondary', label: 'Secondary ii–Vs' },
  { id: 'neo-soul', label: 'Neo soul' },
  { id: 'diminished', label: 'Passing diminished' },
]

// `label` is what the player reads, in chart parlance (V/ii, not VI7).
// `numeral` is the root's own degree, which spells it: ♭II in A is B♭, and
// the ii/IV in C is G, the v.
function c(label, numeral, root, kind) {
  return { label, numeral, root, kind }
}

export const PROGRESSIONS = [
  // ii–Vs
  { id: 'ii-v-i', type: 'ii-v', mode: 'major', name: 'ii–V–I',
    chords: [c('ii7', 'ii', 2, 'm7'), c('V7', 'V', 7, '7'), c('I', 'I', 0, 'I')] },
  { id: 'minor-ii-v-i', type: 'ii-v', mode: 'minor', name: 'Minor ii–V–i',
    chords: [c('iiø7', 'ii', 2, 'ø7'), c('V7', 'V', 7, '7'), c('i', 'i', 0, 'i')] },

  // Backdoor
  { id: 'backdoor', type: 'backdoor', mode: 'major', name: 'Backdoor ii–V',
    chords: [c('iv7', 'iv', 5, 'm7'), c('♭VII7', '♭VII', 10, '7'), c('I', 'I', 0, 'I')] },
  { id: 'backdoor-from-ii', type: 'backdoor', mode: 'major', name: 'ii–V into the backdoor',
    chords: [c('ii7', 'ii', 2, 'm7'), c('V7', 'V', 7, '7'), c('iv7', 'iv', 5, 'm7'), c('♭VII7', '♭VII', 10, '7'), c('I', 'I', 0, 'I')] },

  // Tritone subs
  { id: 'tritone-sub', type: 'tritone', mode: 'major', name: 'Tritone sub',
    chords: [c('ii7', 'ii', 2, 'm7'), c('♭II7', '♭II', 1, '7'), c('I', 'I', 0, 'I')] },
  { id: 'minor-tritone-sub', type: 'tritone', mode: 'minor', name: 'Minor tritone sub',
    chords: [c('iiø7', 'ii', 2, 'ø7'), c('♭II7', '♭II', 1, '7'), c('i', 'i', 0, 'i')] },
  { id: 'tritone-sub-related-ii', type: 'tritone', mode: 'major', name: 'Tritone sub with its own ii',
    chords: [c('♭vi7', '♭vi', 8, 'm7'), c('♭II7', '♭II', 1, '7'), c('I', 'I', 0, 'I')] },
  { id: 'tritone-turnaround', type: 'tritone', mode: 'major', name: 'Tritone-sub turnaround',
    chords: [c('I', 'I', 0, 'I'), c('♭III7', '♭III', 3, '7'), c('ii7', 'ii', 2, 'm7'), c('♭II7', '♭II', 1, '7')] },

  // Turnarounds
  { id: 'i-vi-ii-v', type: 'turnaround', mode: 'major', name: 'I–vi–ii–V',
    chords: [c('I', 'I', 0, 'I'), c('vi7', 'vi', 9, 'm7'), c('ii7', 'ii', 2, 'm7'), c('V7', 'V', 7, '7')] },
  { id: 'i-vi7-ii-v', type: 'turnaround', mode: 'major', name: 'I–V/ii–ii–V',
    chords: [c('I', 'I', 0, 'I'), c('V/ii', 'VI', 9, '7'), c('ii7', 'ii', 2, 'm7'), c('V7', 'V', 7, '7')] },
  { id: 'iii-vi-ii-v', type: 'turnaround', mode: 'major', name: 'iii–V/ii–ii–V',
    chords: [c('iii7', 'iii', 4, 'm7'), c('V/ii', 'VI', 9, '7'), c('ii7', 'ii', 2, 'm7'), c('V7', 'V', 7, '7')] },
  { id: 'minor-turnaround', type: 'turnaround', mode: 'minor', name: 'Minor turnaround',
    chords: [c('i', 'i', 0, 'i'), c('♭VImaj7', '♭VI', 8, 'maj7'), c('iiø7', 'ii', 2, 'ø7'), c('V7', 'V', 7, '7')] },

  // Secondary ii–Vs
  { id: 'ii-v-of-iv', type: 'secondary', mode: 'major', name: 'ii–V to IV',
    chords: [c('ii/IV', 'v', 7, 'm7'), c('V/IV', 'I', 0, '7'), c('IVmaj7', 'IV', 5, 'maj7')] },
  { id: 'ii-v-of-ii', type: 'secondary', mode: 'major', name: 'ii–V to ii',
    chords: [c('iiø/ii', 'iii', 4, 'ø7'), c('V/ii', 'VI', 9, '7'), c('ii7', 'ii', 2, 'm7')] },
  { id: 'ii-v-of-vi', type: 'secondary', mode: 'major', name: 'ii–V to vi',
    chords: [c('iiø/vi', 'vii', 11, 'ø7'), c('V/vi', 'III', 4, '7'), c('vi7', 'vi', 9, 'm7')] },
  { id: 'ii-v-of-v', type: 'secondary', mode: 'major', name: 'ii–V to V',
    chords: [c('ii/V', 'vi', 9, 'm7'), c('V/V', 'II', 2, '7'), c('V7', 'V', 7, '7'), c('I', 'I', 0, 'I')] },

  // Neo soul
  { id: 'just-the-two', type: 'neo-soul', mode: 'major', name: 'IV–V/vi–vi',
    chords: [c('IVmaj7', 'IV', 5, 'maj7'), c('V/vi', 'III', 4, '7'), c('vi7', 'vi', 9, 'm7')] },
  { id: 'minor-plagal', type: 'neo-soul', mode: 'major', name: 'Minor plagal',
    chords: [c('IVmaj7', 'IV', 5, 'maj7'), c('iv', 'iv', 5, 'm6or7'), c('I', 'I', 0, 'I')] },
  { id: 'sus-ii-v', type: 'neo-soul', mode: 'major', name: 'ii–V7sus–I',
    chords: [c('ii7', 'ii', 2, 'm7'), c('V7sus', 'V', 7, 'sus'), c('I', 'I', 0, 'I')] },
  { id: 'minor-sus', type: 'neo-soul', mode: 'minor', name: 'iv–V7sus–i',
    chords: [c('iv7', 'iv', 5, 'm7'), c('V7sus', 'V', 7, 'sus'), c('i', 'i', 0, 'i')] },
  { id: 'borrowed-flat-six-seven', type: 'neo-soul', mode: 'major', name: '♭VI–♭VII–I',
    chords: [c('♭VImaj7', '♭VI', 8, 'maj7'), c('♭VII7', '♭VII', 10, '7'), c('I', 'I', 0, 'I')] },

  // Passing diminished
  { id: 'rising-dim', type: 'diminished', mode: 'major', name: 'Rising diminished',
    chords: [c('I', 'I', 0, 'I'), c('♯i°7', '♯i', 1, 'dim7'), c('ii7', 'ii', 2, 'm7'), c('V7', 'V', 7, '7')] },
  { id: 'falling-dim', type: 'diminished', mode: 'major', name: 'Falling diminished',
    chords: [c('iii7', 'iii', 4, 'm7'), c('♭iii°7', '♭iii', 3, 'dim7'), c('ii7', 'ii', 2, 'm7'), c('V7', 'V', 7, '7')] },
]

export function progressionsFor(types, modes) {
  return PROGRESSIONS.filter((item) => types.includes(item.type) && modes.includes(item.mode))
}

export function questionFor(progression, keyPc) {
  const key = keyForMode(KEYS.find((item) => item.pc === keyPc), progression.mode)
  const chords = progression.chords.map((chord) => {
    const kind = KINDS[chord.kind]
    return {
      ...kind,
      role: chord.label,
      rootPc: (keyPc + chord.root) % 12,
      symbol: chordSymbol({ numeral: chord.numeral, root: chord.root, quality: kind.quality }, key),
    }
  })
  return { key, mode: progression.mode, progression, chords }
}

// A new key and progression, never the pair just asked. Each type in play is
// as likely as the next, however many progressions it holds. Null when the
// filters leave nothing to ask.
export function randomQuestion(types, modes, previous) {
  const pool = progressionsFor(types, modes)
  if (pool.length === 0) return null
  const inPlay = [...new Set(pool.map((item) => item.type))]
  for (;;) {
    const type = inPlay[Math.floor(Math.random() * inPlay.length)]
    const ofType = pool.filter((item) => item.type === type)
    const progression = ofType[Math.floor(Math.random() * ofType.length)]
    const keyPc = Math.floor(Math.random() * 12)
    if (previous && previous.key.pc === keyPc && previous.progression.id === progression.id) continue
    return questionFor(progression, keyPc)
  }
}

export function matchesChord(midiNotes, chord) {
  const intervals = new Set(midiNotes.map((note) => (((note - chord.rootPc) % 12) + 12) % 12))
  if (intervals.size < MIN_NOTES) return false
  if (!chord.guideTones.every((interval) => intervals.has(interval))) return false
  if (chord.oneOf && !chord.oneOf.some((interval) => intervals.has(interval))) return false
  return [...intervals].every((interval) => chord.allowed.includes(interval))
}
