// Hands-only stickings for the Sticking Generator: a cycle of one, two or
// four beats, chained from rudiment cells and repeated to fill a 4/4 bar.
// Each cell is written right-hand lead; the left-lead mirror is added
// automatically. Some of the time the whole cycle is one of the Percussive
// Arts Society's International Drum Rudiments instead, played as written.
//
// Strokes are written the way PAS writes sticking: R or L for the stroke,
// with the grace notes in front in lower case, so lR is a right-hand flam
// and llR a right-hand drag. A > after a stroke accents it, and - is a rest
// (only the true rudiments have rests).

function parseStroke(token) {
  const match = /^([lr]{0,2})([RL])(>?)$/.exec(token)
  if (!match) return null
  return { grace: match[1], hand: match[2], accent: match[3] === '>' }
}

// The stroke as shown and stored: grace notes and hand, no accent.
export function strokeName(token) {
  return token.replace('>', '')
}

export function strokeHand(token) {
  return parseStroke(token)?.hand ?? null
}

export function strokeGrace(token) {
  return parseStroke(token)?.grace ?? ''
}

function mirrorTokens(tokens) {
  const swap = { R: 'L', L: 'R', r: 'l', l: 'r' }
  return tokens.map((token) => token.replace(/[RLrl]/g, (hand) => swap[hand]))
}

// A cell's accents are marked with >. A chained cell with none marked accents
// its first stroke; a true rudiment has only the accents PAS marks (none on
// the rolls, the Flam or the Drag).
function makeCell(cell, tokens, accentFirst) {
  const marked = tokens.flatMap((token, index) => (token.endsWith('>') ? [index] : []))
  const strokes = tokens.map(strokeName)
  return {
    ...cell,
    pattern: strokes.join(''),
    display: strokes.join(' '),
    strokes,
    accents: marked.length > 0 || !accentFirst ? marked : [0],
  }
}

function withMirror(cell, accentFirst = true) {
  const tokens = cell.sticking.split(' ')
  const mirror = mirrorTokens(tokens)
  const cells = [makeCell(cell, tokens, accentFirst)]
  if (mirror.join(' ') !== cell.sticking) cells.push(makeCell(cell, mirror, accentFirst))
  return cells
}

const CELLS = [
  { sticking: 'R', name: 'Single stroke', weight: 1 },
  { sticking: 'R L', name: 'Single strokes', weight: 3 },
  { sticking: 'R R L L', name: 'Double strokes', weight: 2 },
  { sticking: 'R L R R', name: 'Paradiddle', weight: 3 },
  { sticking: 'R L L R', name: 'Inverted paradiddle', weight: 1 },
  { sticking: 'R R L R', name: 'Reverse paradiddle', weight: 1 },
  { sticking: 'R L R L R R', name: 'Double paradiddle', weight: 2 },
  { sticking: 'R L R L R L R R', name: 'Triple paradiddle', weight: 1 },
  { sticking: 'R L R R L L', name: 'Paradiddle-diddle', weight: 2 },
  { sticking: 'R L L R R L', name: 'Six-stroke roll', weight: 1 },
  { sticking: 'R R L L R', name: 'Five-stroke roll', weight: 1 },
  { sticking: 'R L L', name: 'Single and a double', weight: 2 },
  { sticking: 'R R L', name: 'Double and a single', weight: 1 },
  { sticking: 'R L R L L', name: 'Singles into a double', weight: 1 },
  // Flam and drag cells, taken from the PAS rudiments they come from.
  { sticking: 'lR', name: 'Flam', weight: 0.5 },
  { sticking: 'lR> R', name: 'Flam tap', weight: 0.5 },
  { sticking: 'lR> L R', name: 'Flam accent', weight: 0.5 },
  { sticking: 'lR> L R R', name: 'Flam paradiddle', weight: 0.5 },
  { sticking: 'lR> R L R', name: 'Flammed mill', weight: 0.25 },
  { sticking: 'lR> L rL> R', name: 'Inverted flam tap', weight: 0.25 },
  { sticking: 'lR> L R rL>', name: 'Pataflafla', weight: 0.25 },
  { sticking: 'llR', name: 'Drag', weight: 0.5 },
  { sticking: 'llR L>', name: 'Drag tap', weight: 0.5 },
  { sticking: 'llR L R>', name: 'Lesson 25', weight: 0.25 },
  { sticking: 'llR L R L>', name: 'Ratamacue', weight: 0.25 },
].flatMap((cell) => withMirror(cell))

export const HAND_RATES = [
  { id: 'sixteenth', label: '16ths', notesPerBeat: 4 },
  { id: 'triplet', label: 'Triplets', notesPerBeat: 3 },
]

// Only lengths that divide the bar, so the cycle repeats cleanly inside it.
export const HAND_CYCLE_BEATS = [1, 2, 4]

// How often a sticking is a true PAS rudiment rather than one chained from
// cells.
export const RUDIMENT_CHANCE = 0.15

// The PAS International Drum Rudiments that sit on the generator's grid, as
// written on the PAS rudiment sheet: one slot per 16th, or per 8th-note
// triplet at the triplet rate (where PAS writes sextuplets or 6/8). Rudiments
// with buzz or measured-roll strokes, or rhythms the grid can't hold, are
// left out. Quarter- and 8th-note rudiments rest out the rest of the beat.
const RUDIMENTS = [
  { number: 1, name: 'Single Stroke Roll', rate: 'sixteenth', sticking: 'R L' },
  { number: 1, name: 'Single Stroke Roll', rate: 'triplet', sticking: 'R L R L R L' },
  { number: 5, name: 'Triple Stroke Roll', rate: 'triplet', sticking: 'R R R L L L' },
  { number: 6, name: 'Double Stroke Open Roll', rate: 'sixteenth', sticking: 'R R L L' },
  { number: 16, name: 'Single Paradiddle', rate: 'sixteenth', sticking: 'R> L R R L> R L L' },
  { number: 17, name: 'Double Paradiddle', rate: 'triplet', sticking: 'R> L R L R R L> R L R L L' },
  { number: 18, name: 'Triple Paradiddle', rate: 'sixteenth', sticking: 'R> L R L R L R R L> R L R L R L L' },
  { number: 19, name: 'Single Paradiddle-diddle', rate: 'triplet', sticking: 'R> L R R L L' },
  { number: 20, name: 'Flam', rate: 'sixteenth', sticking: 'lR - - - rL - - -' },
  { number: 20, name: 'Flam', rate: 'triplet', sticking: 'lR - - rL - -' },
  { number: 21, name: 'Flam Accent', rate: 'triplet', sticking: 'lR> L R rL> R L' },
  { number: 22, name: 'Flam Tap', rate: 'sixteenth', sticking: 'lR> R rL> L' },
  { number: 23, name: 'Flamacue', rate: 'sixteenth', sticking: 'lR L> R L lR - - -' },
  { number: 24, name: 'Flam Paradiddle', rate: 'sixteenth', sticking: 'lR> L R R rL> R L L' },
  { number: 25, name: 'Single Flammed Mill', rate: 'sixteenth', sticking: 'lR> R L R rL> L R L' },
  { number: 26, name: 'Flam Paradiddle-diddle', rate: 'triplet', sticking: 'lR> L R R L L rL> R L L R R' },
  { number: 27, name: 'Pataflafla', rate: 'sixteenth', sticking: 'lR> L R rL>' },
  { number: 28, name: 'Swiss Army Triplet', rate: 'triplet', sticking: 'lR> R L' },
  { number: 29, name: 'Inverted Flam Tap', rate: 'sixteenth', sticking: 'lR> L rL> R' },
  { number: 31, name: 'Drag', rate: 'sixteenth', sticking: 'llR - - - rrL - - -' },
  { number: 31, name: 'Drag', rate: 'triplet', sticking: 'llR - - rrL - -' },
  { number: 32, name: 'Single Drag Tap', rate: 'sixteenth', sticking: 'llR - L> - rrL - R> -' },
  { number: 33, name: 'Double Drag Tap', rate: 'triplet', sticking: 'llR llR L> rrL rrL R>' },
  { number: 34, name: 'Lesson 25', rate: 'sixteenth', sticking: 'llR L R> -' },
].flatMap((rudiment) => withMirror(rudiment, false))

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= item.weight
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

// The cycle repeats, so no hand plays three in a row either inside it or
// across the join back to its start. Grace notes are quiet taps and don't
// count. A drag can't follow a stroke by the hand that plays its grace notes
// (L llR is three lefts in a row), no more than two flams or drags sit side by
// side, and at most half the strokes carry one.
export function isPlayableHandSticking(strokes) {
  const hands = strokes.map(strokeHand)
  const graces = strokes.map(strokeGrace)
  const at = (list, index) => list[index % list.length]
  let ornaments = 0
  for (let index = 0; index < strokes.length; index += 1) {
    const hand = hands[index]
    if (hand === at(hands, index + 1) && hand === at(hands, index + 2)) return false
    const grace = graces[index]
    if (!grace) continue
    ornaments += 1
    const previous = hands[(index - 1 + strokes.length) % strokes.length]
    if (grace.length === 2 && previous === grace[0].toUpperCase()) return false
    if (at(graces, index + 1) && at(graces, index + 2)) return false
  }
  return ornaments * 2 <= strokes.length
}

// One candidate cycle, or null if the draw broke the rules. Nothing but single
// strokes is too plain to be worth generating, unless the cycle is too short
// to hold anything else.
export function drawHandSticking(length) {
  const cells = []
  let remaining = length
  while (remaining > 0) {
    const cell = pickWeighted(CELLS.filter((item) => item.strokes.length <= remaining))
    cells.push(cell)
    remaining -= cell.strokes.length
  }

  const strokes = cells.flatMap((cell) => cell.strokes)
  if (!isPlayableHandSticking(strokes)) return null
  if (length > 3 && cells.every((cell) => cell.name.startsWith('Single stroke'))) return null
  return cells
}

// The true rudiments that fit a cycle at this rate: ones whose length divides
// it, so the cycle is the rudiment played through whole.
export function rudimentsFor(rateId, length) {
  return RUDIMENTS.filter((cell) => cell.rate === rateId && length % cell.strokes.length === 0)
}

// A true rudiment, repeated to fill the cycle, as a single cell.
export function drawRudiment(rateId, length) {
  const options = rudimentsFor(rateId, length)
  if (options.length === 0) return null
  const rudiment = options[Math.floor(Math.random() * options.length)]
  const times = length / rudiment.strokes.length
  if (times === 1) return [rudiment]
  const strokes = Array.from({ length: times }, () => rudiment.strokes).flat()
  return [{
    ...rudiment,
    strokes,
    pattern: strokes.join(''),
    accents: Array.from({ length: times }, (_, round) => rudiment.accents.map((index) => index + round * rudiment.strokes.length)).flat(),
  }]
}
