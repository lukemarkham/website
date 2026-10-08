// Sight Reading: a drum chart (8, 16 or 32 written bars) to read the way a
// working drummer does. Its sections ('tune') are time with ensemble figures
// to set up, each led into by a fill; bars without a set-up can carry
// shorter rhythm cues, to comp along with on the snare or just to keep
// reading. Every piece has a drum solo: trading 4s or 8s with the band
// (swing), or soloing around band figures (any feel). One section may be
// repeated, twice or marked 3x or 4x, and directions such as "2 feel" or
// "To ride" are printed over the staff (`marks`).
//
// Everything sits on an 8th-note grid across the piece: slot 0 is beat 1 of
// bar 1, slot 1 its &, and so on, 8 slots to a bar. A note is
// { slot, slots, articulation, role, staff }:
// - articulation is 'marcato' (^, short), 'accent' (>, held for its
//   length), 'tenuto' (-, a full quarter) or 'staccato' (.)
// - role is 'setup', 'fillHit' (a band hit inside a fill), 'solo' (a band
//   figure in a drum solo) or 'cue'
// - staff is true when the note is written in the staff as rhythmic slashes
//   rather than cued above it. That's every hit inside a fill, every set-up
//   figure in a bar that has fill in it (the fill line takes no rhythmic
//   space, so the bar's rhythm is written out), every figure in a solo, and
//   the final figure.
// Notes may be tied over a barline, but never over a repeat sign.
//
// Fills start and end on a downbeat. A fill into a figure on an & ends at
// that beat; the drummer fills on until the figure, which the rhythmic
// slashes show with an 8th rest.
//
// The piece always ends on a band figure in its last bar, the last thing
// written: rests follow it, not slashes.
//
// Positions are in written bars. `performance` lists the bars in the order
// they're played, repeats and all, and performPhrase unrolls the piece into
// played slots for the band and the clock.

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
  { id: 'swing', label: 'Swing', tempoRange: [100, 200], weight: 6 },
  { id: 'straight', label: 'Straight 8ths', tempoRange: [90, 140], weight: 4 },
  { id: 'latin', label: 'Latin', tempoRange: [150, 210], weight: 3 },
  { id: 'bossa', label: 'Bossa Nova', tempoRange: [110, 150], weight: 2 },
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
// The chance each bar of a solo around figures has a band figure in it, and
// the room after one before the next, so there's space to play.
const SOLO_FIGURE_CHANCE = 0.6
const SOLO_GAP = 3
// The chance a piece has a repeated section, when repeats are on.
const REPEAT_CHANCE = 0.8

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

const figureLength = (figure) => Math.max(...figure.notes.map(([offset, slots]) => offset + slots))

// ---- The form

const tune = (bar, bars) => ({ type: 'tune', bar, bars })
// Trading: turns of `turn` bars, the band's first, then the drums'.
const trade = (bar, bars, turn) => ({ type: 'trade', bar, bars, turn })
// A drum solo around band figures.
const solo = (bar, bars) => ({ type: 'solo', bar, bars })

// Where the tune sections and the drum solo go. Swing trades 4s or 8s or
// solos around figures; the straight-8th feels solo around figures. Pieces
// of 8 and 16 bars end on their solo, its last band hit ending the piece;
// 32 bars (AABA) solo in the middle and come back for a last A, or solo
// over it.
function pickForm(bars, feel) {
  if (bars === 8) return [tune(0, 4), solo(4, 4)]
  if (bars === 16) return [tune(0, 8), solo(8, 8)]
  const forms = feel === 'swing'
    ? [
        { weight: 3, segments: [tune(0, 8), tune(8, 8), trade(16, 8, 4), tune(24, 8)] },
        { weight: 2, segments: [tune(0, 8), trade(8, 16, 8), tune(24, 8)] },
        { weight: 1, segments: [tune(0, 8), trade(8, 16, 4), tune(24, 8)] },
        { weight: 2, segments: [tune(0, 8), tune(8, 8), solo(16, 8), tune(24, 8)] },
        { weight: 1, segments: [tune(0, 8), tune(8, 8), tune(16, 8), solo(24, 8)] },
      ]
    : [
        { weight: 3, segments: [tune(0, 8), tune(8, 8), solo(16, 8), tune(24, 8)] },
        { weight: 1, segments: [tune(0, 8), solo(8, 8), tune(16, 8), tune(24, 8)] },
        { weight: 2, segments: [tune(0, 8), tune(8, 8), tune(16, 8), solo(24, 8)] },
      ]
  return pickWeighted(forms, (form) => form.weight).segments
}

// One section to repeat: a whole eight-bar section (twice), or four bars of
// a tune section, two, three or four times. A solo or a trade repeats whole
// or not at all, and the last bar, with the final hit, never repeats.
function pickRepeat(segments, bars) {
  const options = []
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1
    if (segment.bars === 8 && !isLast) options.push({ bar: segment.bar, bars: 8, times: 2, weight: 3 })
    if (segment.type !== 'tune') return
    for (let bar = segment.bar; bar < segment.bar + segment.bars; bar += 4) {
      if (bar + 4 === bars) continue
      options.push({ bar, bars: 4, times: 2, weight: 2 }, { bar, bars: 4, times: 3, weight: 1 }, { bar, bars: 4, times: 4, weight: 1 })
    }
  })
  if (options.length === 0) return null
  const { bar, bars: length, times } = pickWeighted(options, (option) => option.weight)
  return { bar, bars: length, times }
}

/**
 * The bars in the order they're played, repeats and all.
 * @returns {{ bar: number, pass: number, passes: number }[]} `bar` is the
 *   written bar; `pass` counts from 0 through a repeated section's `passes`
 */
export function performanceOf(bars, repeat) {
  const order = []
  for (let bar = 0; bar < bars; bar += 1) {
    if (repeat && bar === repeat.bar) {
      for (let pass = 0; pass < repeat.times; pass += 1) {
        for (let inner = 0; inner < repeat.bars; inner += 1) order.push({ bar: bar + inner, pass, passes: repeat.times })
      }
      bar += repeat.bars - 1
    } else {
      order.push({ bar, pass: 0, passes: 1 })
    }
  }
  return order
}

// ---- Directions over the staff

// The words a chart uses. `bass` is what a swing bass does from there: walk
// ('four'), play in 2 ('two'), or in 2 the first time through a repeat and
// walk the second ('twoThenFour'). `clave` is the side a bossa starts on,
// which the band's comping follows.
const CHART_MARKS = {
  two: { text: '2 feel', bass: 'two' },
  twowalk: { text: '2 feel, walk 2nd x', bass: 'twoThenFour' },
  walk: { text: 'Walk', bass: 'four' },
  in4: { text: 'In 4', bass: 'four' },
  time: { text: 'Time', bass: 'four' },
  hats: { text: 'Hi-hats' },
  ride: { text: 'To ride' },
  tohats: { text: 'To hi-hats' },
  cascara: { text: 'Cáscara' },
  bell: { text: 'To bell' },
  xstick: { text: 'Cross stick' },
  bossa23: { text: '2-3 bossa', clave: '2-3' },
  bossa32: { text: '3-2 bossa', clave: '3-2' },
  trade4: { text: 'Trade 4s', bass: 'four' },
  trade8: { text: 'Trade 8s', bass: 'four' },
  solo: { text: 'Solo around figures' },
}

// Each straight feel's opening sound and what a later section changes to.
const GROOVE_MARKS = {
  straight: { open: ['hats'], next: { hats: 'ride', ride: 'tohats', tohats: 'ride' } },
  latin: { open: ['hats', 'cascara'], next: { hats: 'ride', cascara: 'bell', ride: 'tohats', bell: 'cascara', tohats: 'ride' } },
  // Cross stick is implied by "bossa", so the opening names the clave.
  bossa: { open: ['bossa23', 'bossa32'], next: { bossa23: 'ride', bossa32: 'ride', xstick: 'ride', ride: 'xstick' } },
}

// Where the directions go: the opening sound or feel at bar 1, a change at
// the next tune section (or halfway through a lone one), "Time" when the
// band comes back after a solo, and the solo's own heading. Swing often
// starts in 2 and goes to 4 for the next section.
function planMarks(segments, feel, repeat) {
  const marks = []
  const add = (bar, id) => marks.push({ bar, id })
  let inTwo = false
  let groove = null

  function change(bar) {
    if (feel === 'swing') {
      if (!inTwo) return
      add(bar, pick(['walk', 'in4']))
      inTwo = false
    } else {
      groove = GROOVE_MARKS[feel].next[groove]
      add(bar, groove)
    }
  }

  function visit(segment, index) {
    const previous = segments[index - 1]
    if (segment.type === 'trade') return add(segment.bar, segment.turn === 4 ? 'trade4' : 'trade8')
    if (segment.type === 'solo') return add(segment.bar, 'solo')
    if (previous && previous.type !== 'tune') return add(segment.bar, 'time')
    if (index > 0) return change(segment.bar)
    if (feel !== 'swing') {
      groove = pick(GROOVE_MARKS[feel].open)
      return add(0, groove)
    }
    if (Math.random() >= 0.65) return undefined
    // In 2 the first time, walking the second: only over a repeat from bar 1.
    if (repeat?.bar === 0 && repeat.times === 2 && Math.random() < 0.5) return add(0, 'twowalk')
    inTwo = true
    return add(0, 'two')
  }
  visit(segments[0], 0)
  // A piece with one eight-bar tune section may change halfway through it,
  // before any later section changes again.
  if (segments[0].bars === 8 && segments[1]?.type !== 'tune' && Math.random() < 0.5) change(4)
  segments.slice(1).forEach((segment, index) => visit(segment, index + 1))
  return marks.sort((a, b) => a.bar - b.bar)
}

// ---- Figures

// Band figures for the drummer to solo around, in about three bars in five
// and never more than two bars apart, with room to play between them. A
// final solo saves its last bar for the final hit, which ends the piece.
function placeSoloFigures(start, end, isFinal, earliest) {
  const notes = []
  const lastBar = end - SLOTS_PER_BAR
  let from = earliest
  let emptyBars = 0
  for (let bar = start; bar < end; bar += SLOTS_PER_BAR) {
    const isFinalBar = isFinal && bar === lastBar
    emptyBars += 1
    if (!isFinalBar && emptyBars < 3 && Math.random() >= SOLO_FIGURE_CHANCE) continue
    const room = isFinal && !isFinalBar ? lastBar - SOLO_GAP : end
    const options = []
    for (const figure of SETUP_FIGURES) {
      for (let slot = Math.max(bar, from); slot < bar + SLOTS_PER_BAR; slot += 1) {
        if (slot % 2 !== figure.parity || slot + figureLength(figure) > room) continue
        options.push({ figure, slot })
      }
    }
    if (options.length === 0) {
      if (isFinalBar) return null
      continue
    }
    const { figure, slot } = pickWeighted(options, (option) => option.figure.weight)
    const placed = figure.notes.map(([offset, slots, articulation]) => ({ slot: slot + offset, slots, articulation, role: 'solo', staff: true }))
    notes.push(...placed)
    from = figureEnd(placed) + SOLO_GAP
    emptyBars = 0
  }
  return notes
}

// Set-ups through the tune sections and figures through the solos, left to
// right. Each tune section gets one set-up per four bars, each in its own
// stretch. A fill starts in the section's second bar at the earliest and
// clear of the figure before it; a figure stays in its section unless more
// tune follows; neither runs over a repeat sign. The piece's last figure is
// in the last bar (or pushed into it from the & of 4).
function placeFigures(segments, bars, fillBeats, edges) {
  const total = bars * SLOTS_PER_BAR
  const crossesEdge = (from, to) => edges.some((edge) => from < edge && edge < to)
  const setUps = []
  const soloNotes = []
  let previousEnd = -GAP

  for (const [index, segment] of segments.entries()) {
    const start = segment.bar * SLOTS_PER_BAR
    const end = start + segment.bars * SLOTS_PER_BAR
    const isFinal = index === segments.length - 1
    if (segment.type === 'trade') {
      previousEnd = end
      continue
    }
    if (segment.type === 'solo') {
      const notes = placeSoloFigures(start, end, isFinal, Math.max(start, previousEnd + GAP))
      if (!notes) return null
      soloNotes.push(...notes)
      previousEnd = notes.length ? figureEnd(notes) : end
      continue
    }

    const limit = segments[index + 1]?.type === 'tune' ? total : end
    const count = segment.bars / 4
    for (let n = 0; n < count; n += 1) {
      const isLast = isFinal && n === count - 1
      const stretchStart = start + Math.round((n * segment.bars) / count) * SLOTS_PER_BAR
      const stretchEnd = isLast ? total : start + Math.round(((n + 1) * segment.bars) / count) * SLOTS_PER_BAR
      const beats = fillBeats ?? pick(MIXED_FILL_BEATS)

      const options = []
      for (const figure of SETUP_FIGURES) {
        const length = figureLength(figure)
        for (let slot = stretchStart; slot < stretchEnd; slot += 1) {
          if (slot % 2 !== figure.parity || slot + length > limit) continue
          // The fill ends on the beat the figure falls in.
          const fillStart = Math.floor(slot / 2) * 2 - beats * 2
          if (fillStart < start + SLOTS_PER_BAR || fillStart < previousEnd + GAP) continue
          if (crossesEdge(fillStart, slot + length)) continue
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
      const notes = figure.notes.map(([offset, slots, articulation]) => ({ slot: slot + offset, slots, articulation, role: 'setup', staff: isLast }))
      setUps.push({ fill, notes, fillHits: placeFillHits(fill) })
      previousEnd = figureEnd(notes)
    }
  }
  return { setUps, soloNotes }
}

// Rhythm cues in tune bars that hold no fill or set-up figure, kept clear of
// the fills and figures either side. The first bar of each section stays
// plain time, and nothing comes after the final set-up's fill.
function placeCues(segments, bars, setUps) {
  const busy = []
  setUps.forEach(({ fill, notes }) => busy.push([fill.start, figureEnd(notes)]))
  if (segments[segments.length - 1].type === 'tune') busy.push([setUps[setUps.length - 1].fill.start, bars * SLOTS_PER_BAR])
  const cues = []

  for (let bar = 1; bar < bars; bar += 1) {
    const start = bar * SLOTS_PER_BAR
    const end = start + SLOTS_PER_BAR
    const segment = segments.find((item) => bar >= item.bar && bar < item.bar + item.bars)
    if (segment.type !== 'tune' || segment.bar === bar) continue
    if (busy.some(([from, to]) => from < end + GAP && to + GAP > start)) continue
    if (Math.random() >= CUE_CHANCE) continue
    const notes = pick(CUE_FIGURES).map(([offset, slots, articulation]) => ({ slot: start + offset, slots, articulation, role: 'cue', staff: false }))
    cues.push(...notes)
    busy.push([start, figureEnd(notes)])
  }
  return cues
}

const barRange = (from, count) => (count === 1 ? `Bar ${from + 1}` : `Bars ${from + 1}–${from + count}`)

function segmentDescription(segment, isFinal) {
  const where = barRange(segment.bar, segment.bars)
  if (segment.type === 'trade') {
    const again = segment.bars > segment.turn * 2 ? ', and round again' : ''
    return `${where}: trade ${segment.turn}s. The band plays ${segment.turn} bars of time, then you solo for ${segment.turn} with the band laid out${again}.`
  }
  return `${where}: solo around the band's figures. The band plays only the hits: set each one up and keep soloing between them${isFinal ? '. The last hit ends the piece' : ''}.`
}

function repeatDescription({ bar, bars, times }) {
  const count = times === 2 ? 'twice' : `${times} times (the ${times}x over the end repeat)`
  return `${barRange(bar, bars)} are played ${count}: at the end repeat, go back to the start repeat${times > 2 ? ' each time' : ''}.`
}

// The form part of the key: sections, the repeat and the directions, split
// by '/'. A tune section is t<bar>-<bars>, a trade x<turn>@<bar>-<bars>, a
// solo s<bar>-<bars>@<figures>; the repeat r<bar>-<bars>x<times>; a
// direction m<bar>:<id>.
function encodeForm(segments, soloNotes, repeat, marks) {
  const parts = segments.map((segment) => {
    const at = `${segment.bar}-${segment.bars}`
    if (segment.type === 'trade') return `x${segment.turn}@${at}`
    if (segment.type === 'tune') return `t${at}`
    const end = (segment.bar + segment.bars) * SLOTS_PER_BAR
    return `s${at}@${encodeNotes(soloNotes.filter((note) => note.slot >= segment.bar * SLOTS_PER_BAR && note.slot < end))}`
  })
  if (repeat) parts.push(`r${repeat.bar}-${repeat.bars}x${repeat.times}`)
  marks.forEach((mark) => parts.push(`m${mark.bar}:${mark.id}`))
  return parts.join('/')
}

/**
 * A random piece.
 * @param {{ bars: 8 | 16 | 32, fillBeats: number | null, feel: 'swing' | 'straight' | 'latin' | 'bossa', cues: boolean, repeats: boolean }} options
 */
export function generateSetUpPhrase({ bars, fillBeats, feel, cues, repeats = true }) {
  const segments = pickForm(bars, feel)
  const repeat = repeats && Math.random() < REPEAT_CHANCE ? pickRepeat(segments, bars) : null
  const edges = repeat ? [repeat.bar * SLOTS_PER_BAR, (repeat.bar + repeat.bars) * SLOTS_PER_BAR] : []
  let placed = null
  while (!placed) placed = placeFigures(segments, bars, fillBeats, edges)
  const { setUps, soloNotes } = placed
  const marks = planMarks(segments, feel, repeat)
  const cueNotes = cues ? placeCues(segments, bars, setUps) : []
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
  const notes = [...setUps.flatMap((setUp) => [...setUp.fillHits, ...setUp.notes]), ...soloNotes, ...cueNotes].sort((a, b) => a.slot - b.slot)

  // The drummer's solo turns: a whole solo, or every other turn of a trade.
  // The band's turns of a trade go to a horn soloist.
  const solos = []
  const trades = []
  segments.forEach((segment) => {
    const start = segment.bar * SLOTS_PER_BAR
    if (segment.type === 'solo') solos.push({ start, end: start + segment.bars * SLOTS_PER_BAR })
    if (segment.type !== 'trade') return
    for (let turn = 0; turn < segment.bars; turn += segment.turn) {
      const range = { start: start + turn * SLOTS_PER_BAR, end: start + (turn + segment.turn) * SLOTS_PER_BAR }
      if ((turn / segment.turn) % 2 === 1) solos.push(range)
      else trades.push(range)
    }
  })

  const last = segments[segments.length - 1]
  const descriptions = [
    ...setUps.map((setUp) => ({ at: setUp.fill.start, text: setUpDescription(setUp) })),
    ...segments
      .filter((segment) => segment.type !== 'tune')
      .map((segment) => ({ at: segment.bar * SLOTS_PER_BAR, text: segmentDescription(segment, segment === last) })),
    ...(repeat ? [{ at: repeat.bar * SLOTS_PER_BAR - 0.5, text: repeatDescription(repeat) }] : []),
  ].sort((a, b) => a.at - b.at)

  return {
    key: [
      feel,
      bars,
      setUps.map((setUp) => `${(setUp.fill.end - setUp.fill.start) / 2}@${encodeNotes(setUp.notes)}${setUp.fillHits.length ? `+${encodeNotes(setUp.fillHits)}` : ''}`).join(';'),
      encodeNotes(cueNotes),
      encodeForm(segments, soloNotes, repeat, marks),
    ].join('|'),
    feel,
    bars,
    notes,
    fills: setUps.map((setUp) => setUp.fill),
    solos,
    trades,
    repeat,
    performance: performanceOf(bars, repeat),
    marks: marks.map((mark) => ({ bar: mark.bar, id: mark.id, text: CHART_MARKS[mark.id].text })),
    // Where the piece ends: nothing is written after the final figure.
    end: figureEnd(last.type === 'solo' ? soloNotes : setUps[setUps.length - 1].notes),
    // Where the band's time stops for good: the end of the final fill, or
    // the start of a final solo.
    timeStop: last.type === 'solo' ? last.bar * SLOTS_PER_BAR : setUps[setUps.length - 1].fill.end,
    sections: sectionsFor(bars),
    descriptions: descriptions.map((item) => item.text),
  }
}

/**
 * The piece as it's played, repeats unrolled: its notes, fills and solos at
 * played slots, and for each played bar the written bar (for the changes)
 * and whether a swing bass is in 2 there. Nothing written runs over a repeat
 * sign, so each item moves with the bar it starts in.
 */
export function performPhrase(phrase) {
  const { performance } = phrase
  const playedBars = new Map()
  performance.forEach((entry, played) => {
    if (!playedBars.has(entry.bar)) playedBars.set(entry.bar, [])
    playedBars.get(entry.bar).push(played)
  })
  const shift = (bar) => playedBars.get(bar).map((played) => (played - bar) * SLOTS_PER_BAR)
  const notes = phrase.notes.flatMap((note) => shift(barOf(note.slot)).map((offset) => ({ ...note, slot: note.slot + offset })))
  const ranges = (items) => items.flatMap((item) => shift(barOf(item.start)).map((offset) => ({ start: item.start + offset, end: item.end + offset })))
  const lastOffset = (slot) => shift(barOf(slot)).at(-1)

  let bass = 'four'
  const marksAt = new Map(phrase.marks.map((mark) => [mark.bar, CHART_MARKS[mark.id]]))
  const inTwo = performance.map((entry) => {
    const effect = marksAt.get(entry.bar)?.bass
    if (effect === 'twoThenFour') bass = entry.pass === 0 ? 'two' : 'four'
    else if (effect) bass = effect
    return bass === 'two'
  })

  return {
    feel: phrase.feel,
    bars: performance.length,
    notes: notes.sort((a, b) => a.slot - b.slot),
    fills: ranges(phrase.fills).sort((a, b) => a.start - b.start),
    solos: ranges(phrase.solos).sort((a, b) => a.start - b.start),
    trades: ranges(phrase.trades ?? []).sort((a, b) => a.start - b.start),
    timeStop: phrase.timeStop + lastOffset(Math.min(phrase.timeStop, phrase.bars * SLOTS_PER_BAR - 1)),
    writtenBars: performance.map((entry) => entry.bar),
    inTwo,
    clave: phrase.marks.map((mark) => CHART_MARKS[mark.id].clave).find(Boolean) ?? '3-2',
  }
}
