// ii-V drills: a key comes up, and the answer is its ii-V-I played on a MIDI
// keyboard, the ii, then the V, then the resolution.
//
// A chord counts when its third and seventh are both there, which is what
// makes it that chord. The tonic can take a sixth in place of the seventh
// (C6, Cm6), and in minor any of the sixth, flat seventh or major seventh.
// The root and fifth can be left out, as they are in rootless voicings. Any other note must be a tension the chord takes, so a
// wrong note fails it. For now the V takes every usual dominant tension,
// natural or altered; it is where the extensions will get specific later.

import { KEYS, chordSymbolFor, keyForMode } from './harmony.js'

// Semitones above the root.
const II_MAJOR = { quality: 'm7', guideTones: [3, 10], allowed: [0, 3, 7, 10, 2, 5, 9] }
const II_MINOR = { quality: 'ø7', guideTones: [3, 10], allowed: [0, 3, 6, 10, 2, 5, 8] }
const V_DOMINANT = { quality: '7', guideTones: [4, 10], allowed: [0, 4, 7, 10, 1, 2, 3, 6, 8, 9] }
// `oneOf` is the seventh-or-sixth: at least one of them has to be there.
const I_MAJOR = { quality: 'maj7', guideTones: [4], oneOf: [11, 9], allowed: [0, 4, 7, 11, 9, 2, 6] }
const I_MINOR = { quality: 'm6', guideTones: [3], oneOf: [9, 10, 11], allowed: [0, 3, 7, 9, 10, 11, 2, 5] }

// Fewer notes than this is a shell, not a voicing, and would let two stray
// keys count as an answer.
export const MIN_NOTES = 3

export const MODES = ['major', 'minor']

export function twoFiveFor(keyPc, mode) {
  const key = keyForMode(KEYS.find((item) => item.pc === keyPc), mode)
  const chords = [
    { role: 'ii', rootPc: (keyPc + 2) % 12, ...(mode === 'major' ? II_MAJOR : II_MINOR) },
    { role: 'V', rootPc: (keyPc + 7) % 12, ...V_DOMINANT },
    { role: mode === 'major' ? 'I' : 'i', rootPc: keyPc, ...(mode === 'major' ? I_MAJOR : I_MINOR) },
  ].map((chord) => ({ ...chord, symbol: chordSymbolFor(chord.rootPc, chord.quality, key) }))
  return { key, mode, chords }
}

// A new key, never the one just asked. modes: which of major and minor may
// come up.
export function randomTwoFive(modes, previous) {
  for (;;) {
    const keyPc = Math.floor(Math.random() * 12)
    const mode = modes[Math.floor(Math.random() * modes.length)]
    if (previous && previous.key.pc === keyPc && previous.mode === mode) continue
    return twoFiveFor(keyPc, mode)
  }
}

export function matchesChord(midiNotes, chord) {
  const intervals = new Set(midiNotes.map((note) => (((note - chord.rootPc) % 12) + 12) % 12))
  if (intervals.size < MIN_NOTES) return false
  if (!chord.guideTones.every((interval) => intervals.has(interval))) return false
  if (chord.oneOf && !chord.oneOf.some((interval) => intervals.has(interval))) return false
  return [...intervals].every((interval) => chord.allowed.includes(interval))
}
