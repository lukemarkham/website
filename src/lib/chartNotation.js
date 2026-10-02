// Draws a drum chart the way big band parts are written: time as stemless
// slashes on the middle line, ensemble figures cued in rhythm above the staff,
// and a "Fill" bracket over the stretch to fill. Set Ups draws four-bar
// phrases with it; it is meant to grow into whole charts.
//
// Bars are 4/4 and figures sit on an 8th-note grid: slot 0 is beat 1 of the
// first bar, slot 1 its &, 8 slots to a bar. A figure must stay inside its
// bar (no ties over the barline yet).

const SLOTS_PER_BAR = 8
const SLASH_KEY = 'b/4'
const CUE_KEY = 'g/5'
// Rests are placed by their own key; this lifts them clear of the slashes,
// level with the cued notes.
const CUE_REST_KEY = 'e/6'
const CLEF_WIDTH = 36
const TIME_SIG_WIDTH = 26
const LINE_TOP_PADDING = 70
const LINE_HEIGHT = 140
const ARTICULATION = { short: 'a^', long: 'a>' }

// One cued note split at beat boundaries into tied pieces, each a plain
// note value: an off-beat start takes an 8th to reach the beat, then halves
// on beats 1 and 3, dotted quarters and quarters, and an 8th to finish.
function pieces(start, length) {
  const result = []
  let position = start
  let left = length
  while (left > 0) {
    let size
    if (position % 2 === 1 || left === 1) size = 1
    else if (left >= 4 && position % 4 === 0) size = 4
    else if (left === 3) size = 3
    else size = 2
    result.push({ position, size })
    position += size
    left -= size
  }
  return result
}

const NOTE_VALUE = { 1: '8', 2: 'q', 3: 'qd', 4: 'h' }

/**
 * @param {HTMLElement} host   emptied and filled with the SVG
 * @param {object} VF          the loaded VexFlow module
 * @param {object} options
 *   bars: how many 4/4 bars
 *   figures: [{ slot, slots, length: 'short' | 'long' }] cued above the staff
 *   fill: { start, end } in slots, or null
 *   feel: text over the first bar ('Swing'), or null
 *   barsPerLine
 *   barWidth: room for each bar's notes (narrower bars draw larger on phones)
 *   colors: { ink, muted, accent }
 *   font: the family for the text
 */
export function renderChartNotation(host, VF, options) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot, Articulation, Modifier, Fraction, StaveTie } = VF
  const { bars, figures = [], fill = null, feel = null, colors, font } = options
  const barsPerLine = Math.max(1, Math.min(options.barsPerLine ?? bars, bars))
  const noteWidth = options.barWidth ?? 230
  const lineCount = Math.ceil(bars / barsPerLine)
  const width = 10 + CLEF_WIDTH + TIME_SIG_WIDTH + barsPerLine * noteWidth + 10
  const height = LINE_TOP_PADDING + (lineCount - 1) * LINE_HEIGHT + 70
  const ink = { fillStyle: colors.ink, strokeStyle: colors.ink }

  host.innerHTML = ''
  const renderer = new Renderer(host, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()
  ctx.setFillStyle(colors.ink)
  ctx.setStrokeStyle(colors.ink)

  const slashAt = new Map()
  const cueAt = new Map()
  const staves = []
  const drawLater = []

  function cueTickables(bar) {
    const first = bar * SLOTS_PER_BAR
    const inBar = figures.filter((figure) => figure.slot >= first && figure.slot < first + SLOTS_PER_BAR)
    if (inBar.length === 0) return null

    const tickables = []
    const ties = []
    let position = 0
    const sorted = [...inBar].sort((a, b) => a.slot - b.slot)
    for (const figure of [...sorted, null]) {
      const start = figure ? figure.slot - first : SLOTS_PER_BAR
      // Rests up to the figure: an 8th to reach the beat, then quarters.
      while (position < start) {
        const size = position % 2 === 1 || start - position === 1 ? 1 : 2
        tickables.push(new StaveNote({ keys: [CUE_REST_KEY], duration: `${NOTE_VALUE[size]}r` }).setStyle(ink))
        position += size
      }
      if (!figure) break

      const notes = pieces(start, figure.slots).map(({ size }) => {
        const note = new StaveNote({ keys: [CUE_KEY], duration: NOTE_VALUE[size], stemDirection: 1 }).setStyle(ink)
        if (size === 3) Dot.buildAndAttach([note], { all: true })
        return note
      })
      notes[0].addModifier(new Articulation(ARTICULATION[figure.length]).setPosition(Modifier.Position.ABOVE), 0)
      for (let index = 1; index < notes.length; index += 1) {
        ties.push(new StaveTie({ firstNote: notes[index - 1], lastNote: notes[index], firstIndexes: [0], lastIndexes: [0] }))
      }
      cueAt.set(figure.slot, notes[0])
      tickables.push(...notes)
      position = start + figure.slots
    }

    const beams = Beam.generateBeams(tickables, { groups: [new Fraction(1, 4)], stemDirection: 1, beamRests: false })
    return { tickables, beams, ties }
  }

  for (let bar = 0; bar < bars; bar += 1) {
    const line = Math.floor(bar / barsPerLine)
    const column = bar % barsPerLine
    const isLineStart = column === 0
    const x = 10 + (isLineStart ? 0 : CLEF_WIDTH + TIME_SIG_WIDTH + column * noteWidth)
    const staveWidth = noteWidth + (isLineStart ? CLEF_WIDTH + TIME_SIG_WIDTH : 0)
    const y = LINE_TOP_PADDING + line * LINE_HEIGHT

    const stave = new Stave(x, y, staveWidth)
    if (isLineStart) stave.addClef('percussion')
    if (bar === 0) stave.addTimeSignature('4/4')
    if (bar === bars - 1) stave.setEndBarType(VF.BarlineType.END)
    stave.setStyle(ink)
    stave.setContext(ctx).draw()
    staves.push(stave)

    // Stemless slashes: the stem is drawn, but in no colour at all.
    const slashes = [0, 1, 2, 3].map((beat) => {
      const note = new StaveNote({ keys: [SLASH_KEY], duration: 'q', type: 's', stemDirection: 1 }).setStyle(ink)
      note.setStemStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' })
      slashAt.set(bar * SLOTS_PER_BAR + beat * 2, note)
      return note
    })
    const voices = [new Voice({ numBeats: 4, beatValue: 4 }).addTickables(slashes)]
    const cue = cueTickables(bar)
    if (cue) {
      voices.push(new Voice({ numBeats: 4, beatValue: 4 }).addTickables(cue.tickables))
      drawLater.push(...cue.beams, ...cue.ties)
    }

    new Formatter().joinVoices(voices).format(voices, stave.getNoteEndX() - stave.getNoteStartX() - 14)
    voices.forEach((voice) => voice.draw(ctx, stave))

    if (bar === 0 && feel) {
      ctx.setFont(font, 15, 'bold')
      ctx.setFillStyle(colors.ink)
      ctx.fillText(feel, x + 4, y - 44)
    }
  }

  drawLater.forEach((item) => item.setContext(ctx).draw())

  // Where a slot sits across the page: at its note if it has one, otherwise
  // between the slashes either side of it. Slot `bars * 8` is the final
  // barline.
  function slotX(slot) {
    if (cueAt.has(slot)) return cueAt.get(slot).getNoteHeadBeginX()
    if (slashAt.has(slot)) return slashAt.get(slot).getNoteHeadBeginX()
    const before = slashAt.get(slot - 1)
    const bar = Math.floor(slot / SLOTS_PER_BAR)
    const after = slashAt.get(slot + 1)
    const end = after && Math.floor((slot + 1) / SLOTS_PER_BAR) === bar ? after.getNoteHeadBeginX() : staves[bar].getNoteEndX()
    return (before.getNoteHeadBeginX() + end) / 2
  }

  // The fill bracket, as on a printed part: "(FILL - - - - |", broken at
  // the end of a line if it runs onto the next.
  if (fill) {
    const startBar = Math.floor(fill.start / SLOTS_PER_BAR)
    const endBar = Math.floor((fill.end - 1) / SLOTS_PER_BAR)
    let segmentStart = fill.start
    for (let line = Math.floor(startBar / barsPerLine); line <= Math.floor(endBar / barsPerLine); line += 1) {
      const lastBarOfLine = Math.min(bars - 1, (line + 1) * barsPerLine - 1)
      const endsHere = endBar <= lastBarOfLine
      const x1 = slotX(segmentStart) - 2
      // A hit on the first beat of the next line closes the bracket at this
      // line's final barline.
      const lineEndX = staves[lastBarOfLine].getX() + staves[lastBarOfLine].getWidth()
      const hitOnThisLine = Math.floor(fill.end / SLOTS_PER_BAR) <= lastBarOfLine
      const x2 = endsHere && hitOnThisLine ? slotX(fill.end) + 2 : lineEndX
      const y = LINE_TOP_PADDING + line * LINE_HEIGHT - 30
      const isFirst = segmentStart === fill.start

      ctx.setStrokeStyle(colors.accent)
      ctx.setFillStyle(colors.accent)
      ctx.setLineWidth(1.4)
      let textEnd = x1
      if (isFirst) {
        ctx.beginPath()
        ctx.moveTo(x1 + 5, y - 9)
        ctx.quadraticCurveTo(x1, y - 4, x1, y + 2)
        ctx.quadraticCurveTo(x1, y + 7, x1 + 5, y + 10)
        ctx.stroke()
        ctx.setFont(font, 13, 'bold')
        ctx.fillText('FILL', x1 + 7, y + 5)
        textEnd = x1 + 9 + ctx.measureText('FILL').width
      }
      for (let dash = textEnd + 4; dash < x2 - 3; dash += 9) {
        ctx.beginPath()
        ctx.moveTo(dash, y)
        ctx.lineTo(Math.min(dash + 5, x2 - 3), y)
        ctx.stroke()
      }
      if (endsHere) {
        ctx.beginPath()
        ctx.moveTo(x2, y - 6)
        ctx.lineTo(x2, y + 6)
        ctx.stroke()
      }
      segmentStart = (lastBarOfLine + 1) * SLOTS_PER_BAR
    }
  }

  const svg = host.querySelector('svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.maxWidth = `${Math.round(width * 1.3)}px`
  svg.style.height = 'auto'
}
