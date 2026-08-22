// Music theory helpers for the progression ear trainer: key spelling, chord
// voicings with voice leading, and a forgiving parser for typed answers.

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

// Keys are limited to the ones players actually read, each with the accidental
// preference that makes its borrowed chords spell sensibly.
export const KEYS = [
  { name: 'C', pc: 0, accidental: 'flat' },
  { name: 'D♭', pc: 1, accidental: 'flat' },
  { name: 'D', pc: 2, accidental: 'sharp' },
  { name: 'E♭', pc: 3, accidental: 'flat' },
  { name: 'E', pc: 4, accidental: 'sharp' },
  { name: 'F', pc: 5, accidental: 'flat' },
  { name: 'G♭', pc: 6, accidental: 'flat' },
  { name: 'G', pc: 7, accidental: 'sharp' },
  { name: 'A♭', pc: 8, accidental: 'flat' },
  { name: 'A', pc: 9, accidental: 'sharp' },
  { name: 'B♭', pc: 10, accidental: 'flat' },
  { name: 'B', pc: 11, accidental: 'sharp' },
]

export const CHORD_INTERVALS = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  maj13: [0, 4, 7, 11, 14, 21],
  'maj7#11': [0, 4, 11, 14, 18],
  6: [0, 4, 7, 9],
  69: [0, 4, 7, 9, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  m6: [0, 3, 7, 9, 14],
  mMaj7: [0, 3, 7, 11, 14],
  7: [0, 4, 7, 10],
  9: [0, 4, 7, 10, 14],
  13: [0, 4, 7, 10, 14, 21],
  '7b9': [0, 4, 7, 10, 13],
  '7b13': [0, 4, 7, 10, 14, 20],
  '7alt': [0, 4, 8, 10, 13],
  '7sus4': [0, 5, 7, 10, 14],
  '13sus4': [0, 5, 7, 10, 14, 21],
  'ø7': [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
}

// Suffix printed after a roman numeral, where lowercase already implies minor.
const ROMAN_SUFFIX = {
  maj7: 'maj7',
  maj9: 'maj9',
  maj13: 'maj13',
  'maj7#11': 'maj7♯11',
  6: '6',
  69: '6/9',
  m7: '7',
  m9: '9',
  m11: '11',
  m6: '6',
  mMaj7: '(maj7)',
  7: '7',
  9: '9',
  13: '13',
  '7b9': '7♭9',
  '7b13': '7♭13',
  '7alt': '7alt',
  '7sus4': '7sus4',
  '13sus4': '13sus',
  'ø7': 'ø7',
  dim7: '°7',
}

// Suffix printed after a letter name, where minor has to be spelled out.
const SYMBOL_SUFFIX = {
  ...ROMAN_SUFFIX,
  m7: 'm7',
  m9: 'm9',
  m11: 'm11',
  m6: 'm6',
  mMaj7: 'm(maj7)',
}

const QUALITY_FAMILY = {
  maj7: 'major',
  maj9: 'major',
  maj13: 'major',
  'maj7#11': 'major',
  6: 'major',
  69: 'major',
  m7: 'minor',
  m9: 'minor',
  m11: 'minor',
  m6: 'minor',
  mMaj7: 'minMaj',
  7: 'dominant',
  9: 'dominant',
  13: 'dominant',
  '7b9': 'dominant',
  '7b13': 'dominant',
  '7alt': 'dominant',
  '7sus4': 'sus',
  '13sus4': 'sus',
  'ø7': 'halfDim',
  dim7: 'dim',
}

export const FAMILY_LABELS = {
  major: 'major 7th',
  minor: 'minor 7th',
  minMaj: 'minor-major 7th',
  dominant: 'dominant',
  sus: 'suspended dominant',
  halfDim: 'half-diminished',
  dim: 'diminished',
}

const ROMAN_DEGREES = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 }
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

export function noteName(pc, accidental) {
  const names = accidental === 'sharp' ? SHARP_NAMES : FLAT_NAMES
  return names[((pc % 12) + 12) % 12]
}

// Minor keys are not spelled like their major namesakes: F♯ minor, C♯ minor and
// G♯ minor are what players read, never G♭, D♭ or A♭ minor.
const MINOR_SHARP_KEYS = new Set([1, 6, 8])

export function keyForMode(key, tonic) {
  if (tonic !== 'minor') {
    return { ...key, label: `${key.name} major` }
  }
  const accidental = MINOR_SHARP_KEYS.has(key.pc) ? 'sharp' : key.accidental
  const name = noteName(key.pc, accidental)
  return { ...key, accidental, name, label: `${name} minor` }
}

export function romanLabel(chord) {
  return `${chord.numeral}${ROMAN_SUFFIX[chord.quality] ?? ''}`
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_PITCHES = [0, 2, 4, 5, 7, 9, 11]
// Theoretically correct but unread in a chord chart: nobody writes F♭maj7.
const AWKWARD_SPELLINGS = new Set(['F♭', 'C♭', 'E♯', 'B♯'])

// The roman numeral, not the key signature, decides the letter: ♭II in A major
// is B♭, never A♯, and ♯i°7 in C is C♯°7, never D♭°7.
function rootName(chord, key) {
  const pc = (key.pc + chord.root) % 12
  const degree = ROMAN_DEGREES[chord.numeral.replace(/[^IViv]/g, '').toLowerCase()]
  if (degree === undefined) return noteName(pc, key.accidental)

  const letterIndex = (LETTERS.indexOf(key.name[0]) + degree) % 7
  const natural = LETTER_PITCHES[letterIndex]
  const offset = (((pc - natural + 18) % 12)) - 6
  if (Math.abs(offset) > 1) return noteName(pc, key.accidental)

  const spelled = `${LETTERS[letterIndex]}${offset === 1 ? '♯' : offset === -1 ? '♭' : ''}`
  return AWKWARD_SPELLINGS.has(spelled) ? noteName(pc, key.accidental) : spelled
}

export function chordSymbol(chord, key) {
  return `${rootName(chord, key)}${SYMBOL_SUFFIX[chord.quality] ?? ''}`
}

export function familyOf(quality) {
  return QUALITY_FAMILY[quality] ?? 'major'
}

// ---------------------------------------------------------------- shades ---

// Chords that stand in for one another without changing what the chord does.
// The weights keep the everyday voicings common and the colours occasional.
const SHADE_POOLS = {
  major: [['maj9', 4], ['maj7', 4], ['maj13', 2], ['69', 1], ['6', 1]],
  minor: [['m9', 4], ['m7', 3], ['m11', 2]],
  dominant: [['13', 3], ['9', 3], ['7', 2]],
  darkDominant: [['7b9', 4], ['7b13', 3], ['7', 2], ['7alt', 1]],
}

// Only the workaday qualities get shaded. Anything not listed here — a 6/9
// ending, a lydian ♯11, a suspended V, a minor-major line cliché — is on the
// chart for its own particular sound and is left exactly as written.
const SHADE_POOL_FOR = {
  maj7: 'major',
  maj9: 'major',
  maj13: 'major',
  m7: 'minor',
  m9: 'minor',
  m11: 'minor',
  7: 'dominant',
  9: 'dominant',
  13: 'dominant',
  '7b9': 'darkDominant',
  '7b13': 'darkDominant',
  '7alt': 'darkDominant',
}

const MINOR_TARGETS = new Set(['minor', 'minMaj', 'halfDim'])

// A dominant falling a fifth into a minor chord — V/vi, V/ii, the V of a minor
// key — wants a dark ninth or thirteenth. Its natural 13 is the major third of
// the chord it is resolving to, which is the one note that chord has just left
// behind. A IV13 sitting next to a minor tonic is a different animal: that is
// modal, not a resolution, so only the fifth counts here.
function resolvesToMinor(chords, index) {
  const next = chords[(index + 1) % chords.length]
  const step = ((((next.root - chords[index].root) % 12) + 12) % 12)
  return step === 5 && MINOR_TARGETS.has(familyOf(next.quality))
}

function pickWeighted(options) {
  let roll = Math.random() * options.reduce((sum, [, weight]) => sum + weight, 0)
  for (const [value, weight] of options) {
    roll -= weight
    if (roll < 0) return value
  }
  return options[options.length - 1][0]
}

// Re-colour a progression's extensions for a single hearing, so the same
// changes arrive as Imaj7 one time and Imaj9 the next. The ear is meant to
// learn the function, not one memorised voicing, and grading only ever asks
// for the family — so every shade here is still a correct answer. Progressions
// marked `fixed` name their qualities in the title and keep them.
export function shadeProgression(progression) {
  if (progression.fixed) return progression.chords
  return progression.chords.map((chord, index) => {
    const pool = SHADE_POOL_FOR[chord.quality]
    if (!pool) return chord
    const resolved =
      pool === 'dominant' && resolvesToMinor(progression.chords, index) ? 'darkDominant' : pool
    return { ...chord, quality: pickWeighted(SHADE_POOLS[resolved]) }
  })
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// --------------------------------------------------------------- voicing ---

// Keep four voices at most, dropping the fifth first — the note that carries
// the least information in a jazz voicing.
function upperStructure(intervals) {
  const upper = intervals.slice(1)
  while (upper.length > 4) {
    const fifth = upper.findIndex((interval) => interval % 12 === 7)
    if (fifth === -1) break
    upper.splice(fifth, 1)
  }
  return upper.slice(0, 4)
}

function stackFrom(pitchClasses, lowest) {
  const notes = []
  let previous = lowest - 1
  pitchClasses.forEach((pc) => {
    let note = lowest + (((pc - lowest) % 12) + 12) % 12
    while (note <= previous) note += 12
    notes.push(note)
    previous = note
  })
  return notes
}

function voiceLeadingCost(previous, candidate) {
  if (!previous || previous.length === 0) return 0
  let cost = 0
  candidate.forEach((note) => {
    cost += Math.min(...previous.map((old) => Math.abs(old - note)))
  })
  previous.forEach((old) => {
    cost += Math.min(...candidate.map((note) => Math.abs(old - note)))
  })
  return cost / (candidate.length + previous.length)
}

// Try every inversion at every sensible starting octave and keep whichever
// voicing moves least from the previous chord while staying in a warm register.
export function voiceChord(rootPc, quality, previous) {
  const intervals = CHORD_INTERVALS[quality] ?? CHORD_INTERVALS.maj7
  const pitchClasses = [...new Set(upperStructure(intervals).map((i) => (rootPc + i) % 12))]
  const center = 65
  let best = null
  let bestCost = Infinity

  for (let rotation = 0; rotation < pitchClasses.length; rotation += 1) {
    const rotated = [...pitchClasses.slice(rotation), ...pitchClasses.slice(0, rotation)]
    for (let lowest = 52; lowest <= 68; lowest += 1) {
      const candidate = stackFrom(rotated, lowest)
      if (candidate[candidate.length - 1] > 84) continue
      const mean = candidate.reduce((sum, note) => sum + note, 0) / candidate.length
      const cost = voiceLeadingCost(previous, candidate) + Math.abs(mean - center) * 0.35
      if (cost < bestCost) {
        bestCost = cost
        best = candidate
      }
    }
  }

  return best ?? stackFrom(pitchClasses, 60)
}

export function bassNote(rootPc, low = 36) {
  return low + ((((rootPc - low) % 12) + 12) % 12)
}

// ---------------------------------------------------------- answer input ---

const ROMAN_PATTERN = /^([b♭#♯]*)([IViv]+)(.*)$/
const ARABIC_PATTERN = /^([b♭#♯]*)([1-7])(.*)$/
const SYMBOL_PATTERN = /^([A-Ga-g])([b♭#♯]*)(.*)$/
const LETTER_PITCH = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

function accidentalShift(text) {
  let shift = 0
  for (const character of text) {
    if (character === 'b' || character === '♭') shift -= 1
    if (character === '#' || character === '♯') shift += 1
  }
  return shift
}

function normalizeSuffix(raw) {
  return raw
    .replace(/[△Δ∆^]/g, 'maj')
    .replace(/[øØ]/g, 'm7b5')
    .replace(/[°º]/g, 'dim')
    .replace(/maj/gi, 'maj')
    .replace(/min/gi, 'min')
    .replace(/M(?=\d)/g, 'maj')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/[()\s.,/]/g, '')
    .toLowerCase()
}

function familyFromSuffix(raw, numeralIsLower) {
  const normalized = normalizeSuffix(raw)
  // "ma7" and "ma9" are the everyday chart spelling of a major 7th, so the m
  // that means minor is the one followed by neither "aj" nor a degree.
  const explicitMinor = /^(min|m(?!aj|a\d)|-)/.test(normalized)
  const hasMajor = /maj|ma7|ma9/.test(normalized)

  if (/m7b5|min7b5|-7b5|halfdim|halfdiminished/.test(normalized)) return 'halfDim'
  if (/dim|o7/.test(normalized)) return 'dim'
  if (/sus/.test(normalized)) return 'sus'
  if (hasMajor) return explicitMinor || numeralIsLower ? 'minMaj' : 'major'
  if (explicitMinor) return 'minor'
  // A lowercase roman numeral already says "minor", so "ii7" is a minor 7th
  // while "V7" is a dominant. Bare uppercase numerals stay unspecified because
  // "V" could reasonably mean either a triad or a dominant 7th.
  if (numeralIsLower) return 'minor'
  if (/^(add|6|69)/.test(normalized)) return 'major'
  if (normalized === '') return null
  if (/alt|dom|\d/.test(normalized)) return 'dominant'
  return null
}

// Spellings that name an exact extension. The function is what the answer is
// graded on, so this only ever has to recognise a spelling that was typed —
// never guess at one that wasn't.
const QUALITY_SPELLINGS = {
  maj7: ['maj7', 'maj', 'ma7', 'major7', 'major'],
  maj9: ['maj9', 'ma9', 'major9'],
  maj13: ['maj13', 'ma13', 'major13'],
  'maj7#11': ['maj7#11', 'maj9#11', 'maj#11'],
  6: ['6'],
  69: ['69', '6add9'],
  m7: ['m7'],
  m9: ['m9'],
  m11: ['m11'],
  m6: ['m6'],
  mMaj7: ['mmaj7', 'mmaj9', 'mmaj'],
  7: ['7', 'dom7', 'dom'],
  9: ['9'],
  13: ['13'],
  '7b9': ['7b9', 'b9'],
  '7b13': ['7b13', 'b13', '7#5'],
  '7alt': ['7alt', 'alt', '7#9', '7b9#9'],
  '7sus4': ['7sus4', '7sus', 'sus4', 'sus'],
  '13sus4': ['13sus4', '13sus', 'sus13'],
  'ø7': ['m7b5', 'halfdim', 'halfdiminished'],
  dim7: ['dim7', 'dim', 'o7'],
}

const QUALITY_BY_SPELLING = new Map(
  Object.entries(QUALITY_SPELLINGS).flatMap(([quality, spellings]) =>
    spellings.map((spelling) => [spelling, quality])),
)

// A lowercase roman numeral carries the minor on its own, so "ii9" has to be
// read as m9 before it is read as a bare 9.
function qualityFromSuffix(raw, numeralIsLower) {
  const normalized = normalizeSuffix(raw)
    .replace(/^minor/, 'm')
    .replace(/^min/, 'm')
    .replace(/^-/, 'm')
    // "ø7" expands to "m7b5" and leaves its own 7 hanging off the end.
    .replace(/^m7b57$/, 'm7b5')
  if (normalized === '') return null
  const minorFirst = numeralIsLower ? QUALITY_BY_SPELLING.get(`m${normalized}`) : null
  return minorFirst ?? QUALITY_BY_SPELLING.get(normalized) ?? null
}

// The right-hand side of a slash: a roman numeral or a named chord makes this a
// secondary dominant, while a bare letter is just a bass note under a slash
// chord and leaves the chord itself to be graded.
function parseSecondaryTarget(text, tonicPc) {
  const roman = text.match(ROMAN_PATTERN)
  if (roman) {
    const degree = ROMAN_DEGREES[roman[2].toLowerCase()]
    if (degree !== undefined) {
      return (((MAJOR_SCALE[degree] + accidentalShift(roman[1])) % 12) + 12) % 12
    }
  }

  const arabic = text.match(ARABIC_PATTERN)
  if (arabic) {
    return (((MAJOR_SCALE[Number(arabic[2]) - 1] + accidentalShift(arabic[1])) % 12) + 12) % 12
  }

  const symbol = text.match(SYMBOL_PATTERN)
  if (symbol && symbol[3] !== '') {
    const pc = LETTER_PITCH[symbol[1].toLowerCase()] + accidentalShift(symbol[2])
    return ((((pc - tonicPc) % 12) + 12) % 12)
  }

  return null
}

function parseToken(token, tonicPc) {
  // "6/9" is one chord name, not a chord over a bass note, so it has to be
  // spelled out before the slash means what it usually means.
  const text = token.replace(/6\s*\/\s*9/g, '69')
  const slash = text.match(/^([^/]+)\/(.+)$/)
  if (slash) {
    const target = parseSecondaryTarget(slash[2], tonicPc)
    const chord = parseToken(slash[1], tonicPc)
    if (target === null || chord.root === null) {
      return { ...chord, token }
    }
    return {
      token,
      root: (chord.root + target) % 12,
      // "V/ii" names a dominant even without the 7 written in.
      family: chord.family ?? 'dominant',
      quality: chord.quality,
    }
  }

  const roman = text.match(ROMAN_PATTERN)
  if (roman) {
    const degree = ROMAN_DEGREES[roman[2].toLowerCase()]
    if (degree !== undefined) {
      const root = (((MAJOR_SCALE[degree] + accidentalShift(roman[1])) % 12) + 12) % 12
      const lower = roman[2] === roman[2].toLowerCase()
      return {
        token,
        root,
        family: familyFromSuffix(roman[3], lower),
        quality: qualityFromSuffix(roman[3], lower),
      }
    }
  }

  const arabic = text.match(ARABIC_PATTERN)
  if (arabic) {
    const root = (((MAJOR_SCALE[Number(arabic[2]) - 1] + accidentalShift(arabic[1])) % 12) + 12) % 12
    return { token, root, family: familyFromSuffix(arabic[3]), quality: qualityFromSuffix(arabic[3]) }
  }

  const symbol = text.match(SYMBOL_PATTERN)
  if (symbol) {
    const pc = LETTER_PITCH[symbol[1].toLowerCase()] + accidentalShift(symbol[2])
    const root = ((((pc - tonicPc) % 12) + 12) % 12)
    return { token, root, family: familyFromSuffix(symbol[3]), quality: qualityFromSuffix(symbol[3]) }
  }

  return { token, root: null, family: null, quality: null }
}

export function parseAnswer(text, tonicPc, single = false) {
  const separated = text
    // "V7 of ii" is the spoken form of "V7/ii", and has to be read before any
    // spaces are taken away from it.
    .replace(/\s*\bof\b\s*/gi, '/')
    .replace(/[|→>–—]+/g, ' ')
  // A question asks for one chord at a time, so a space left in that answer is
  // someone typing "E maj7" rather than naming a second chord.
  return (single ? separated.replace(/\s+/g, '') : separated)
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseToken(part, tonicPc))
}

// Grading is root-first: getting the movement right is most of the work, and a
// missing or vague quality shouldn't wipe out the whole chord. Function and
// extension are graded apart, because they are different things to hear — any
// major tonic answers a major tonic, whether it sounded as maj7, maj9, maj13 or
// 6/9, so naming the family scores the chord outright and naming the exact
// extension on top of it earns a bonus.
export function gradeAnswer(text, chords, key) {
  const tokens = parseAnswer(text, key.pc, chords.length === 1)
  const results = chords.map((chord, index) => {
    const token = tokens[index]
    const expected = {
      roman: romanLabel(chord),
      symbol: chordSymbol(chord, key),
      family: familyOf(chord.quality),
      quality: chord.quality,
      exact: false,
    }

    if (!token || token.root === null) {
      return { ...expected, typed: token ? token.token : null, status: 'missing', points: 0 }
    }
    if (token.root !== chord.root) {
      return { ...expected, typed: token.token, status: 'wrong', points: 0 }
    }
    if (token.family === null) {
      return { ...expected, typed: token.token, status: 'rootOnly', points: 0.75 }
    }
    if (token.family !== expected.family) {
      return { ...expected, typed: token.token, status: 'quality', points: 0.5 }
    }
    return {
      ...expected,
      typed: token.token,
      status: 'correct',
      points: 1,
      exact: token.quality === chord.quality,
    }
  })

  const earned = results.reduce((sum, result) => sum + result.points, 0)
  return {
    results,
    extraChords: Math.max(0, tokens.length - chords.length),
    bonus: results.filter((result) => result.exact).length,
    score: Math.round((earned / chords.length) * 100),
    perfect: results.every((result) => result.status === 'correct') && tokens.length === chords.length,
  }
}
