// Four-limb independence exercises for drum set.
//
// Every exercise sets some limbs a fixed ostinato and gives the others
// something that moves against it. The families run from the basics
// (comping under a ride pattern, a moving bass drum under a groove) to ideas
// drawn from Ari Hoenig: a hand phrase over a foot ostinato, groupings that
// cycle against the bar, and metric modulation, where some limbs play time in
// a new tempo while the others keep the old one.
//
// Hits sit on a grid of `slotsPerBeat` slots per beat (2 = 8ths, 3 = 8th-note
// triplets, 4 = 16ths), counted from the start of the first bar. An exercise
// spans as many bars as it takes to come back around to where it started.

const LIMB_NAMES = { RH: 'Right hand', LH: 'Left hand', RF: 'Right foot', LF: 'Left foot' }
export const LIMB_ORDER = ['RH', 'LH', 'RF', 'LF']
const HANDS = ['RH', 'LH']

// Short codes keep the feedback key compact.
export const INSTRUMENTS = {
  r: { id: 'ride', name: 'Ride' },
  h: { id: 'hihat', name: 'Hi-hat' },
  t: { id: 'tom1', name: 'High tom' },
  m: { id: 'tom2', name: 'Mid tom' },
  s: { id: 'snare', name: 'Snare' },
  f: { id: 'floor', name: 'Floor tom' },
  b: { id: 'bass', name: 'Bass drum' },
  p: { id: 'hihatFoot', name: 'Hi-hat (foot)' },
}

export const COUNT_SYLLABLES = { 2: ['', '&'], 3: ['', '&', 'a'], 4: ['', 'e', '&', 'a'] }

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b)
}

// Bars until a figure `period` slots long starts on a downbeat again.
function barsToRealign(period, slotsPerBar) {
  return (period * slotsPerBar) / gcd(period, slotsPerBar) / slotsPerBar
}

// A one-bar (or one-period) figure repeated to fill the exercise.
function repeatEvery(slots, period, total, inst, extra = {}) {
  const hits = []
  for (let start = 0; start < total; start += period) {
    slots.forEach((slot) => {
      if (start + slot < total) hits.push({ slot: start + slot, inst, ...extra })
    })
  }
  return hits
}

// Picks `count` distinct slots from a bar, weighted by where they fall in
// the beat. `required` slots are always in.
function randomRhythm(spb, bars, count, weights, required = []) {
  const slotsPerBar = spb * 4
  const hits = []
  for (let bar = 0; bar < bars; bar += 1) {
    const chosen = new Set(required.map((slot) => slot + bar * slotsPerBar))
    const pool = Array.from({ length: slotsPerBar }, (_, slot) => slot)
    while (chosen.size < Math.min(count, slotsPerBar)) {
      const candidates = pool.filter((slot) => !chosen.has(slot + bar * slotsPerBar))
      const total = candidates.reduce((sum, slot) => sum + weights[slot % spb], 0)
      let roll = Math.random() * total
      for (const slot of candidates) {
        roll -= weights[slot % spb]
        if (roll < 0) {
          chosen.add(slot + bar * slotsPerBar)
          break
        }
      }
    }
    hits.push(...[...chosen].sort((a, b) => a - b))
  }
  return hits
}

function part(limb, inst, text, hits, instrument = INSTRUMENTS[inst].name) {
  return { limb, text, instrument, hits: hits.map((hit) => (typeof hit === 'number' ? { slot: hit, inst } : hit)) }
}

// --- Basics -----------------------------------------------------------------

const SWING_RIDE = [0, 2, 3, 4, 6, 7]
const SWING_HAT = [2, 6]

function comping() {
  const spb = 2
  const bars = pick([1, 2])
  const total = spb * 4 * bars
  const mover = pick(['snare', 'bass', 'split'])
  // Comping leans on the upbeats.
  const rhythm = randomRhythm(spb, bars, randomInt(2, 4), [1, 2])
  const parts = [
    part('RH', 'r', 'Swing ride pattern', repeatEvery(SWING_RIDE, 8, total, 'r')),
    part('LF', 'p', 'Beats 2 and 4', repeatEvery(SWING_HAT, 8, total, 'p')),
  ]

  if (mover === 'snare') {
    parts.push(part('LH', 's', 'Comps the rhythm', rhythm))
    parts.push(part('RF', 'b', 'Feathered quarter notes', repeatEvery([0, 2, 4, 6], 8, total, 'b')))
  } else if (mover === 'bass') {
    parts.push(part('RF', 'b', 'Comps the rhythm', rhythm))
  } else {
    // Split between snare and bass drum, with both getting a say.
    const insts = rhythm.map(() => pick(['s', 'b']))
    if (!insts.includes('s')) insts[0] = 's'
    if (!insts.includes('b')) insts[insts.length - 1] = 'b'
    parts.push(part('LH', 's', 'Comps the rhythm with the bass drum', rhythm.filter((_, index) => insts[index] === 's')))
    parts.push(part('RF', 'b', 'Comps the rhythm with the snare', rhythm.filter((_, index) => insts[index] === 'b')))
  }

  const moverName = { snare: 'the snare', bass: 'the bass drum', split: 'snare and bass drum between them' }[mover]
  return {
    family: 'comping',
    variant: mover,
    title: 'Comping under the ride',
    idea: `Keep the ride and hi-hat steady while ${moverName} ${mover === 'split' ? 'comp' : 'comps'} the written rhythm. Loop it until the comping stops pulling the ride off course.`,
    feel: 'swing',
    slotsPerBeat: spb,
    bars,
    parts,
  }
}

const GHOST_WEIGHTS = [1, 2, 2, 2]

function straightGroove() {
  const spb = 4
  const bars = 1
  const total = 16
  const eighths = repeatEvery([0, 2, 4, 6, 8, 10, 12, 14], 16, total, 'r')

  if (Math.random() < 0.5) {
    return {
      family: 'groove',
      variant: 'bass',
      title: 'Moving bass drum under a groove',
      idea: 'The ride, snare and hi-hat stay put while the bass drum plays a new 16th-note rhythm. Keep the backbeat even however busy the foot gets.',
      feel: 'straight',
      slotsPerBeat: spb,
      bars,
      parts: [
        part('RH', 'r', 'Eighth notes', eighths),
        part('LH', 's', 'Backbeat on 2 and 4', [4, 12]),
        part('RF', 'b', 'The moving part', randomRhythm(spb, bars, randomInt(4, 6), [3, 1, 2, 2], [0])),
        part('LF', 'p', 'Quarter notes', [0, 4, 8, 12]),
      ],
    }
  }

  // Ghost notes around accented backbeats, the Chaffee and Garibaldi idea.
  const snare = randomRhythm(spb, bars, randomInt(5, 7), GHOST_WEIGHTS, [4, 12])
    .map((slot) => ({ slot, inst: 's', accent: slot % 16 === 4 || slot % 16 === 12 }))
  return {
    family: 'groove',
    variant: 'ghosts',
    title: 'Ghost notes around the backbeat',
    idea: 'Accents on 2 and 4, everything else on the snare as quiet ghost notes, while the ride, bass drum and hi-hat hold the groove.',
    feel: 'straight',
    slotsPerBeat: spb,
    bars,
    parts: [
      part('RH', 'r', 'Eighth notes', eighths),
      part('LH', 's', 'Accented backbeats, ghost notes between', snare),
      part('RF', 'b', 'Fixed bass drum pattern', pick([[0, 8], [0, 6, 8], [0, 10], [0, 7, 8], [0, 8, 11]])),
      part('LF', 'p', 'The &s', [2, 6, 10, 14]),
    ],
  }
}

// --- Ideas from Ari Hoenig ------------------------------------------------------

const FOOT_OSTINATOS = [
  { spb: 2, feel: 'swing', name: 'Feathered quarters, hi-hat on 2 and 4', bass: [0, 2, 4, 6], hat: [2, 6] },
  { spb: 2, feel: 'swing', name: 'Charleston on the bass drum, hi-hat on 2 and 4', bass: [0, 3], hat: [2, 6] },
  { spb: 4, feel: 'straight', name: 'Son clave (3-2) on the bass drum, hi-hat on the quarters', bass: [0, 3, 6, 10, 12], hat: [0, 4, 8, 12] },
  { spb: 4, feel: 'straight', name: 'Bossa nova bass drum, hi-hat on 2 and 4', bass: [0, 3, 4, 7, 8, 11, 12, 15], hat: [4, 12] },
  { spb: 4, feel: 'straight', name: 'Samba feet: bossa bass drum, hi-hat on the &s', bass: [0, 3, 4, 7, 8, 11, 12, 15], hat: [2, 6, 10, 14] },
  { spb: 4, feel: 'straight', name: 'Four on the floor, hi-hat on the &s', bass: [0, 4, 8, 12], hat: [2, 6, 10, 14] },
  { spb: 4, feel: 'straight', name: 'Tumbao bass drum (the & of 2, and 4), hi-hat on the quarters', bass: [6, 12], hat: [0, 4, 8, 12] },
]

const HAND_DRUMS = ['t', 's', 'm', 'f']

function handPhrase(feel) {
  const ostinato = pick(FOOT_OSTINATOS.filter((item) => !feel || item.feel === feel))
  const spb = ostinato.spb
  const bars = pick([1, 2])
  const total = spb * 4 * bars
  const perBar = spb === 4 ? randomInt(5, 8) : randomInt(4, 6)
  const slots = randomRhythm(spb, bars, perBar, spb === 4 ? [3, 1, 2, 2] : [2, 2])

  // Hand to hand: the right hand takes the even slots (the beats and &s in
  // 16ths, the beats in swung 8ths), the left the rest, so the sticking
  // follows the grid. The phrase wanders around the
  // kit a step at a time.
  let drum = 1
  const hits = slots.map((slot) => {
    drum = Math.max(0, Math.min(HAND_DRUMS.length - 1, drum + pick([-1, 0, 0, 1])))
    return { slot, inst: HAND_DRUMS[drum], sticking: slot % 2 === 0 ? 'R' : 'L' }
  })

  return {
    family: 'phrase',
    variant: FOOT_OSTINATOS.indexOf(ostinato),
    title: 'Hand phrase over a foot ostinato',
    idea: 'Get the feet going on their own first, then play the phrase on top with the written sticking. Ari Hoenig works this way with a tune\'s melody over the ostinato; once the phrase sits, try singing it or swapping in a melody you know.',
    feel: ostinato.feel,
    slotsPerBeat: spb,
    bars,
    parts: [
      part('RH', 's', 'The phrase, right-hand notes', hits.filter((hit) => hit.sticking === 'R'), 'Snare and toms'),
      part('LH', 's', 'The phrase, left-hand notes', hits.filter((hit) => hit.sticking === 'L'), 'Snare and toms'),
      part('RF', 'b', ostinato.name, repeatEvery(ostinato.bass, spb * 4, total, 'b')),
      part('LF', 'p', ostinato.name, repeatEvery(ostinato.hat, spb * 4, total, 'p')),
    ],
    sticking: true,
  }
}

// A figure a few slots long, repeated until it comes back to beat one.
const GROUPINGS = [
  { spb: 2, feel: 'swing', period: 3, unit: '8th', motifs: [[0], [0, 2], [0, 1]] },
  { spb: 4, feel: 'straight', period: 3, unit: '16th', motifs: [[0], [0, 2], [0, 1]] },
  { spb: 4, feel: 'straight', period: 6, unit: '16th', motifs: [[0], [0, 3], [0, 4]] },
  { spb: 3, feel: 'straight', period: 2, unit: 'triplet', motifs: [[0]] },
  { spb: 3, feel: 'straight', period: 4, unit: 'triplet', motifs: [[0], [0, 3], [0, 2]] },
]

function grouping(feel) {
  const group = pick(GROUPINGS.filter((item) => !feel || item.feel === feel))
  const { spb, period } = group
  const bars = barsToRealign(period, spb * 4)
  const total = spb * 4 * bars
  const motif = pick(group.motifs)
  const mover = pick(['RF', 'LH'])
  const inst = mover === 'RF' ? 'b' : 's'
  const parts = []

  if (spb === 2) {
    parts.push(part('RH', 'r', 'Swing ride pattern', repeatEvery(SWING_RIDE, 8, total, 'r')))
    parts.push(part('LF', 'p', 'Beats 2 and 4', repeatEvery(SWING_HAT, 8, total, 'p')))
  } else if (spb === 4) {
    parts.push(part('RH', 'r', 'Eighth notes', repeatEvery([0, 2, 4, 6, 8, 10, 12, 14], 16, total, 'r')))
    parts.push(part('LF', 'p', 'Beats 2 and 4', repeatEvery([4, 12], 16, total, 'p')))
  } else {
    parts.push(part('RH', 'r', 'Quarter notes', repeatEvery([0, 3, 6, 9], 12, total, 'r')))
    parts.push(part('LF', 'p', 'Beats 2 and 4', repeatEvery([3, 9], 12, total, 'p')))
  }

  const groupingName = period === 2 && spb === 3 ? 'quarter-note triplets' : `groups of ${period} ${group.unit}s`
  parts.push(part(mover, inst, `Repeats a figure in ${groupingName}`, repeatEvery(motif, period, total, inst)))
  if (mover === 'LH' && spb !== 2) {
    parts.push(part('RF', 'b', 'Beats 1 and 3', repeatEvery([0, spb * 2], spb * 4, total, 'b')))
  }

  const limbName = mover === 'RF' ? 'bass drum' : 'left hand'
  return {
    family: 'grouping',
    variant: `${spb}-${period}-${motif.join('.')}-${mover}`,
    title: period === 2 && spb === 3 ? 'Quarter-note triplets against time' : `Groups of ${period} against 4/4`,
    idea: bars > 1
      ? `The ${limbName} repeats a figure in ${groupingName}, so it only lands back on beat one after ${bars} bars. Count the time out loud, not the grouping.`
      : `The ${limbName} plays ${groupingName} across the time. Keep counting the quarter notes out loud so the grouping doesn't take over.`,
    feel: group.feel,
    slotsPerBeat: spb,
    bars,
    parts,
  }
}

// The new tempo's quarter note, in slots of the old one, and the ride pattern
// in the new time: swung where the new beat splits into thirds, straight
// where it splits in two.
const MODULATIONS = [
  { spb: 4, beat: 3, ratio: [4, 3], name: 'a dotted 8th', skip: 2 },
  { spb: 3, beat: 2, ratio: [3, 2], name: 'a quarter-note triplet', skip: 1 },
  { spb: 4, beat: 6, ratio: [2, 3], name: 'a dotted quarter', skip: 4 },
  { spb: 3, beat: 4, ratio: [3, 4], name: 'four triplet 8ths', skip: 2 },
]

function modulation() {
  const modulationIndex = randomInt(0, MODULATIONS.length - 1)
  const { spb, beat, ratio, name, skip } = MODULATIONS[modulationIndex]
  const newBar = beat * 4
  const bars = barsToRealign(newBar, spb * 4)
  const total = spb * 4 * bars
  const newRide = [0, beat, beat + skip, beat * 2, beat * 3, beat * 3 + skip]
  const newHat = [beat, beat * 3]
  const arrangement = pick(['hands', 'feet'])
  const parts = []

  if (arrangement === 'hands') {
    parts.push(part('RH', 'r', 'Ride pattern in the new tempo', repeatEvery(newRide, newBar, total, 'r')))
    parts.push(part('LF', 'p', '2 and 4 of the new tempo', repeatEvery(newHat, newBar, total, 'p')))
    parts.push(part('RF', 'b', 'Quarter notes in the original tempo', repeatEvery([0, spb, spb * 2, spb * 3], spb * 4, total, 'b')))
    if (Math.random() < 0.5) {
      parts.push(part('LH', 's', '2 and 4 of the original tempo', repeatEvery([spb, spb * 3], spb * 4, total, 's')))
    }
  } else {
    const oldRide = spb === 4 ? [0, 4, 6, 8, 12, 14] : [0, 3, 5, 6, 9, 11]
    parts.push(part('RH', 'r', 'Ride pattern in the original tempo', repeatEvery(oldRide, spb * 4, total, 'r')))
    parts.push(part('RF', 'b', 'Quarter notes in the new tempo', repeatEvery([0, beat, beat * 2, beat * 3], newBar, total, 'b')))
    parts.push(part('LF', 'p', '2 and 4 of the new tempo', repeatEvery(newHat, newBar, total, 'p')))
  }

  return {
    family: 'modulation',
    variant: `${modulationIndex}-${arrangement}`,
    title: `Metric modulation: ${name} becomes the beat`,
    idea: arrangement === 'hands'
      ? `The ride and hi-hat play time in a new tempo, where ${name} is the quarter note, while the bass drum keeps the original pulse. Ari Hoenig moves between tempos like this; get the new tempo solid on its own first.`
      : `The hands keep the original time while the feet play quarter notes and 2 and 4 in a new tempo, where ${name} is the quarter note. Get the feet solid on their own before adding the ride.`,
    feel: 'straight',
    slotsPerBeat: spb,
    bars,
    parts,
    newTempoRatio: ratio,
  }
}

const FAMILIES = [
  { make: comping, weight: 2, feels: ['swing'] },
  { make: straightGroove, weight: 2, feels: ['straight'] },
  { make: handPhrase, weight: 2, feels: ['swing', 'straight'] },
  { make: grouping, weight: 2, feels: ['swing', 'straight'] },
  { make: modulation, weight: 2, feels: ['straight'] },
]

// feel: 'swing', 'straight', or null for either.
export function generateIndependenceExercise(feel = null) {
  const families = FAMILIES.filter((family) => !feel || family.feels.includes(feel))
  const total = families.reduce((sum, family) => sum + family.weight, 0)
  let roll = Math.random() * total
  const family = families.find((item) => (roll -= item.weight) < 0) ?? families[0]
  const exercise = family.make(feel)
  exercise.parts = exercise.parts.filter((item) => item.hits.length > 0)
  exercise.parts.sort((a, b) => LIMB_ORDER.indexOf(a.limb) - LIMB_ORDER.indexOf(b.limb))
  return { ...exercise, key: exerciseKey(exercise) }
}

// Spells out the whole exercise, so a vote on it can be rebuilt later:
// family.variant|slotsPerBeat|bars|limb:hits;... with each hit as its slot,
// instrument code, then an optional sticking (R/L) and accent (A).
export function exerciseKey(exercise) {
  const parts = exercise.parts.map((item) => `${item.limb}:${item.hits.map((hit) => `${hit.slot}${hit.inst}${hit.sticking ?? ''}${hit.accent ? 'A' : ''}`).join(',')}`)
  return [`${exercise.family}.${exercise.variant}`, exercise.slotsPerBeat, exercise.bars, ...parts].join('|')
}

export function limbName(limb) {
  return LIMB_NAMES[limb]
}

export function isHand(limb) {
  return HANDS.includes(limb)
}
