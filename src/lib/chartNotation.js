// Draws a drum chart the way big band parts are written: time as stemless
// slashes on the middle line, ensemble figures cued in rhythm above the
// staff, and a "FILL" bracket over the slashes to fill. Set Ups draws its
// phrases with it; it is meant to grow into whole charts.
//
// Bars are 4/4 and figures sit on an 8th-note grid: slot 0 is beat 1 of the
// first bar, slot 1 its &, 8 slots to a bar. A note can run over a barline;
// it is drawn tied.
//
// Engraving follows the usual rules for 4/4: rests and notes show where the
// beat falls. An off-beat start takes an 8th to reach the beat. Rests then
// combine: a whole rest for an empty bar, a dotted half for three beats from
// beat 1 or 2, a half from beat 1 or 3 (never across the middle of the bar,
// so beats 2 and 3 stay two quarters), otherwise quarters.

const SLOTS_PER_BAR = 8
const SLASH_KEY = 'b/4'
const CUE_KEY = 'g/5'
// Rests are placed by their own key; this lifts them clear of the slashes,
// level with the cued notes.
const CUE_REST_KEY = 'e/6'
const CLEF_WIDTH = 36
const TIME_SIG_WIDTH = 26
const FIRST_LINE_TOP = 92
const LINE_HEIGHT = 136
const ARTICULATIONS = { marcato: 'a^', accent: 'a>', staccato: 'a.' }
// SMuFL's metronome-mark quarter note (metNoteQuarterUp), in Bravura.
const QUARTER_NOTE_GLYPH = '\uECA5'
const VALUE = { 1: '8', 2: 'q', 3: 'qd', 4: 'h', 6: 'hd', 8: 'w' }

// A note's run inside one bar, split into plain values that show the beat.
function notePieces(position, length) {
  const result = []
  while (length > 0) {
    let size
    if (position % 2 === 1 || length === 1) size = 1
    else if (length >= 4 && position % 4 === 0) size = 4
    else if (length === 3) size = 3
    else size = 2
    result.push({ position, size })
    position += size
    length -= size
  }
  return result
}

function restPieces(position, length) {
  const result = []
  while (length > 0) {
    let size
    if (position % 2 === 1 || length === 1) size = 1
    else if (position === 0 && length >= 8) size = 8
    else if ((position === 0 || position === 2) && length >= 6) size = 6
    else if ((position === 0 || position === 4) && length >= 4) size = 4
    else size = 2
    result.push({ position, size })
    position += size
    length -= size
  }
  return result
}

// Invisible spacers under a fill: the band rests, but the bracket says what
// to do, so no rests are printed there.
function spacerPieces(position, length) {
  const result = []
  while (length > 0) {
    const size = position % 2 === 1 || length === 1 ? 1 : 2
    result.push({ position, size })
    position += size
    length -= size
  }
  return result
}

/**
 * @param {HTMLElement} host   emptied and filled with the SVG
 * @param {object} VF          the loaded VexFlow module
 * @param {object} options
 *   bars: how many 4/4 bars
 *   notes: [{ slot, slots, articulation: 'marcato' | 'accent' | 'staccato' }]
 *   fills: [{ start, end }] in slots; each ends where its figure starts
 *   feel: the style marking over bar 1 ('Swing'), or null
 *   tempo: quarter-note BPM for the tempo marking, or null
 *   barsPerLine
 *   barWidth: room for each bar's notes (narrower bars draw larger on phones)
 *   colors: { ink, muted, accent }
 *   font: the family for the text
 */
export function renderChartNotation(host, VF, options) {
  const { Renderer, Stave, StaveNote, GhostNote, Voice, Formatter, Beam, Dot, Articulation, Modifier, StaveTie } = VF
  const { bars, notes = [], fills = [], feel = null, tempo = null, colors, font } = options
  const barsPerLine = Math.max(1, Math.min(options.barsPerLine ?? bars, bars))
  const noteWidth = options.barWidth ?? 230
  const lineCount = Math.ceil(bars / barsPerLine)
  const width = 10 + CLEF_WIDTH + TIME_SIG_WIDTH + barsPerLine * noteWidth + 10
  const height = FIRST_LINE_TOP + (lineCount - 1) * LINE_HEIGHT + 64
  const ink = { fillStyle: colors.ink, strokeStyle: colors.ink }
  const fillInk = { fillStyle: colors.accent, strokeStyle: colors.accent }
  const inFill = (slot) => fills.some((fill) => slot >= fill.start && slot < fill.end)
  const lineOf = (bar) => Math.floor(bar / barsPerLine)
  const lineTop = (line) => FIRST_LINE_TOP + line * LINE_HEIGHT

  host.innerHTML = ''
  const renderer = new Renderer(host, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()
  ctx.setFillStyle(colors.ink)
  ctx.setStrokeStyle(colors.ink)

  // Each note cut at the barlines: { bar, position, length, note, isFirst }.
  const runs = []
  notes.forEach((note) => {
    let slot = note.slot
    const end = note.slot + note.slots
    while (slot < end) {
      const bar = Math.floor(slot / SLOTS_PER_BAR)
      const barEnd = (bar + 1) * SLOTS_PER_BAR
      runs.push({ bar, position: slot - bar * SLOTS_PER_BAR, length: Math.min(end, barEnd) - slot, note, isFirst: slot === note.slot })
      slot = Math.min(end, barEnd)
    }
  })

  const slashAt = new Map()
  const noteAt = new Map()
  const piecesOf = new Map()
  const staves = []
  const drawLater = []

  function cueVoice(bar) {
    const barRuns = runs.filter((run) => run.bar === bar).sort((a, b) => a.position - b.position)
    if (barRuns.length === 0) return null

    const tickables = []
    const beats = new Map()
    const add = (tickable, position, isNote) => {
      tickables.push(tickable)
      const beat = Math.floor(position / 2)
      if (!beats.has(beat)) beats.set(beat, [])
      beats.get(beat).push({ tickable, isNote, size: tickable.getDuration() === '8' ? 1 : 0 })
    }

    // The gap before a run: spacers under a fill, rests elsewhere.
    function fillGap(from, to) {
      let position = from
      while (position < to) {
        const spacer = inFill(bar * SLOTS_PER_BAR + position)
        let end = position
        while (end < to && inFill(bar * SLOTS_PER_BAR + end) === spacer) end += 1
        const pieces = spacer ? spacerPieces(position, end - position) : restPieces(position, end - position)
        pieces.forEach(({ position: at, size }) => {
          const tickable = spacer
            ? new GhostNote({ duration: VALUE[size] })
            : new StaveNote({ keys: [CUE_REST_KEY], duration: `${VALUE[size]}r` }).setStyle(ink)
          if (!spacer && size === 6) Dot.buildAndAttach([tickable], { all: true })
          add(tickable, at, false)
        })
        position = end
      }
    }

    let position = 0
    barRuns.forEach((run) => {
      fillGap(position, run.position)
      const pieces = notePieces(run.position, run.length).map(({ position: at, size }) => {
        const tickable = new StaveNote({ keys: [CUE_KEY], duration: VALUE[size], stemDirection: 1 }).setStyle(ink)
        if (size === 3) Dot.buildAndAttach([tickable], { all: true })
        add(tickable, at, true)
        return tickable
      })
      if (run.isFirst) {
        pieces[0].addModifier(new Articulation(ARTICULATIONS[run.note.articulation]).setPosition(Modifier.Position.ABOVE), 0)
        noteAt.set(run.note.slot, pieces[0])
      }
      piecesOf.set(run, pieces)
      position = run.position + run.length
    })
    fillGap(position, SLOTS_PER_BAR)

    // Two 8th notes in one beat share a beam; an 8th beside a rest keeps
    // its flag.
    const beams = []
    beats.forEach((items) => {
      if (items.length === 2 && items.every((item) => item.isNote && item.size === 1)) {
        beams.push(new Beam(items.map((item) => item.tickable)))
      }
    })
    return { tickables, beams }
  }

  for (let bar = 0; bar < bars; bar += 1) {
    const line = lineOf(bar)
    const column = bar % barsPerLine
    const isLineStart = column === 0
    const x = 10 + (isLineStart ? 0 : CLEF_WIDTH + TIME_SIG_WIDTH + column * noteWidth)
    const staveWidth = noteWidth + (isLineStart ? CLEF_WIDTH + TIME_SIG_WIDTH : 0)
    const y = lineTop(line)

    const stave = new Stave(x, y, staveWidth)
    if (isLineStart) stave.addClef('percussion')
    if (bar === 0) stave.addTimeSignature('4/4')
    if (bar === bars - 1) stave.setEndBarType(VF.BarlineType.END)
    stave.setStyle(ink)
    stave.setContext(ctx).draw()
    staves.push(stave)

    // Stemless slashes: the stem is drawn, but in no colour at all. The ones
    // under a fill bracket take its colour.
    const slashes = [0, 1, 2, 3].map((beat) => {
      const slot = bar * SLOTS_PER_BAR + beat * 2
      const note = new StaveNote({ keys: [SLASH_KEY], duration: 'q', type: 's', stemDirection: 1 }).setStyle(inFill(slot) ? fillInk : ink)
      note.setStemStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' })
      slashAt.set(slot, note)
      return note
    })
    const voices = [new Voice({ numBeats: 4, beatValue: 4 }).addTickables(slashes)]
    const cue = cueVoice(bar)
    if (cue) {
      voices.push(new Voice({ numBeats: 4, beatValue: 4 }).addTickables(cue.tickables))
      drawLater.push(...cue.beams)
    }

    new Formatter().joinVoices(voices).format(voices, stave.getNoteEndX() - stave.getNoteStartX() - 14)
    voices.forEach((voice) => voice.draw(ctx, stave))

    // Bar numbers at the start of each line after the first, as on a part.
    if (isLineStart && bar > 0) {
      ctx.setFont(font, 11, 'normal')
      ctx.setFillStyle(colors.muted)
      ctx.fillText(String(bar + 1), x, y + 8)
    }
  }

  drawLater.forEach((item) => item.setContext(ctx).draw())

  // Ties, within a note and across barlines. One that crosses a line break
  // is drawn as two halves, off the end of one line and into the next.
  const tied = []
  notes.forEach((note) => {
    const pieces = runs.filter((run) => run.note === note).flatMap((run) => piecesOf.get(run).map((piece) => ({ piece, bar: run.bar })))
    for (let index = 1; index < pieces.length; index += 1) tied.push([pieces[index - 1], pieces[index]])
  })
  // Ties curve over the cued notes, as on a part, clear of the staff.
  const drawTie = (firstNote, lastNote) => {
    new StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] }).setDirection(-1).setStyle(ink).setContext(ctx).draw()
  }
  tied.forEach(([from, to]) => {
    if (lineOf(from.bar) === lineOf(to.bar)) {
      drawTie(from.piece, to.piece)
    } else {
      drawTie(from.piece, null)
      drawTie(null, to.piece)
    }
  })

  // The style and tempo over bar 1, as a chart prints them: "Swing ♩ = 160".
  if (feel || tempo) {
    const y = lineTop(0) - 46
    let x = 14
    if (feel) {
      ctx.setFont(font, 17, 'bold')
      ctx.setFillStyle(colors.ink)
      ctx.fillText(feel, x, y)
      x += ctx.measureText(feel).width + 10
    }
    if (tempo) {
      ctx.setFont('Bravura', 22, 'normal')
      ctx.fillText(QUARTER_NOTE_GLYPH, x, y)
      x += ctx.measureText(QUARTER_NOTE_GLYPH).width + 5
      ctx.setFont(font, 17, 'bold')
      ctx.fillText(`= ${tempo}`, x, y)
    }
  }

  // Where a slot sits across the page: at its note if it has one, otherwise
  // its slash, or halfway between slashes for an &.
  function slotX(slot) {
    if (noteAt.has(slot)) return noteAt.get(slot).getNoteHeadBeginX()
    if (slashAt.has(slot)) return slashAt.get(slot).getNoteHeadBeginX()
    const bar = Math.floor(slot / SLOTS_PER_BAR)
    const after = slashAt.get(slot + 1)
    const end = after && Math.floor((slot + 1) / SLOTS_PER_BAR) === bar ? after.getNoteHeadBeginX() : staves[bar].getNoteEndX()
    return (slashAt.get(slot - 1).getNoteHeadBeginX() + end) / 2
  }

  // Each fill bracket sits just over the staff, from its first slash to the
  // figure it sets up, with "FILL" at its start. One that runs past the end
  // of a line carries on over the next.
  ctx.setStrokeStyle(colors.accent)
  ctx.setFillStyle(colors.accent)
  ctx.setLineWidth(1.5)
  fills.forEach((fill) => {
    const lastBar = Math.floor((fill.end - 1) / SLOTS_PER_BAR)
    let from = fill.start
    while (from < fill.end) {
      const line = lineOf(Math.floor(from / SLOTS_PER_BAR))
      const lastBarOfLine = Math.min(bars - 1, (line + 1) * barsPerLine - 1)
      const lineEnd = staves[lastBarOfLine].getX() + staves[lastBarOfLine].getWidth()
      const closesHere = lastBar <= lastBarOfLine
      const hitOnThisLine = lineOf(Math.floor(fill.end / SLOTS_PER_BAR)) === line && fill.end < bars * SLOTS_PER_BAR
      const x1 = from === fill.start ? slotX(from) - 3 : staves[Math.floor(from / SLOTS_PER_BAR)].getNoteStartX() - 6
      const x2 = closesHere && hitOnThisLine ? slotX(fill.end) - 4 : lineEnd - 2
      const y = staves[Math.floor(from / SLOTS_PER_BAR)].getYForLine(0) - 11

      ctx.beginPath()
      if (from === fill.start) {
        ctx.moveTo(x1, y + 8)
        ctx.lineTo(x1, y)
      } else {
        ctx.moveTo(x1, y)
      }
      ctx.lineTo(x2, y)
      if (closesHere) ctx.lineTo(x2, y + 8)
      ctx.stroke()

      if (from === fill.start) {
        ctx.setFont(font, 11, 'bold')
        ctx.fillText('FILL', x1, y - 5)
      }
      from = (lastBarOfLine + 1) * SLOTS_PER_BAR
    }
  })

  const svg = host.querySelector('svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.maxWidth = `${Math.round(width * 1.3)}px`
  svg.style.height = 'auto'
}
