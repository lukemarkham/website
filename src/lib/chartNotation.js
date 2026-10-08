// Draws a drum chart the way big band parts are written: time as stemless
// slashes on the middle line, ensemble figures either cued in rhythm above
// the staff or written in it as rhythmic slashes, and a "FILL" bracket over
// the beats to fill. Set Ups draws its pieces with it; it is meant to grow
// into whole charts.
//
// Bars are 4/4 and figures sit on an 8th-note grid: slot 0 is beat 1 of the
// first bar, slot 1 its &, 8 slots to a bar. A note can run over a barline;
// it is drawn tied.
//
// Engraving follows the usual rules for 4/4, plus Luke's for drum parts:
// - Rests and notes show where the beat falls. An off-beat start takes an
//   8th to reach the beat, except that a note on the & of 1 or the & of 3
//   lasting to the middle or end of the bar is a dotted quarter.
// - Nothing hides beat 3, the middle of the bar: a note from beat 2 that
//   runs past it is a quarter tied to whatever is left.
// - Rests combine: a whole rest for an empty bar, a dotted half for three
//   beats from beat 1 or 2, a half from beat 1 or 3 (never across the middle
//   of the bar, so beats 2 and 3 stay two quarters), otherwise quarters.
// - The fill line takes no rhythmic space. It is only a marker over the
//   bar's real rhythm, and it starts and ends on a downbeat: a full-bar fill
//   runs barline to barline. An & is shown in the rhythm, not the bracket.
// - Figures in a bar with fill, and band hits inside a fill, are written in
//   the staff as rhythmic slashes (slash noteheads, stems down, an 8th rest
//   before an &). Beats with nothing written stay plain slashes.
// - Ties are drawn heavier and more arched than VexFlow's default, so one
//   over a barline doesn't blend into the barline or the staff lines.
// - Cued figures sit exactly over the slashes they line up with.
// - The piece ends on its final figure: rests follow it, not slashes.
// - Rehearsal letters mark each eight-bar section.
// - Rehearsal letters are boxed, over the barline that starts the section.
// - Directions ("2 feel", "To ride") sit close over the bar they start in,
//   level with the rehearsal letter and just after it, rising only as far as
//   it takes to clear a cued figure or fill bracket under the words.
// - Repeats use winged repeat signs, with "3x" or "4x" over the end repeat
//   when the section plays more than twice.
// - A "SOLO" bracket marks the drummer's solo, drawn like a fill's; figures
//   in it are written in the staff.

const SLOTS_PER_BAR = 8
const SLASH_KEY = 'b/4'
const CUE_KEY = 'g/5'
// Rests are placed by their own key; this lifts them clear of the slashes,
// level with the cued notes.
const CUE_REST_KEY = 'e/6'
const CLEF_WIDTH = 36
const TIME_SIG_WIDTH = 26
const FIRST_LINE_TOP = 96
const LINE_HEIGHT = 136
// Rehearsal letters, directions and repeat counts share a baseline this far
// above the top line, or a bar number's height higher at the start of a line.
const MARK_RISE = 12
const BAR_NUMBER_RISE = 14
const ARTICULATIONS = { marcato: 'a^', accent: 'a>', staccato: 'a.', tenuto: 'a-' }
// SMuFL's metronome-mark quarter note (metNoteQuarterUp), in Bravura.
const QUARTER_NOTE_GLYPH = ''
const VALUE = { 1: '8', 2: 'q', 3: 'qd', 4: 'h', 6: 'hd', 8: 'w' }

// A note's run inside one bar, split into plain values that show the beat.
function notePieces(position, length) {
  const result = []
  while (length > 0) {
    let size
    if ((position === 1 || position === 5) && length >= 3) size = 3
    else if (position % 2 === 1 || length === 1) size = 1
    else if (length >= 4 && position % 4 === 0) size = 4
    // A dotted quarter from beat 2 would hide beat 3: quarter tied to an 8th.
    else if (length === 3 && position !== 2) size = 3
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

/**
 * @param {HTMLElement} host   emptied and filled with the SVG
 * @param {object} VF          the loaded VexFlow module
 * @param {object} options
 *   bars: how many 4/4 bars
 *   notes: [{ slot, slots, articulation, role, staff }]; `staff` notes are
 *     written in the staff as rhythmic slashes, the rest cued above
 *   fills: [{ start, end }] in slots, each on a downbeat
 *   solos: [{ start, end }] in slots, the drummer's solos
 *   marks: [{ bar, text }] directions over the staff
 *   repeat: { bar, bars, times } a repeated section, or null
 *   end: the slot the music stops at; rests follow, not slashes
 *   sections: [{ bar, label }] rehearsal letters
 *   feel: the style marking over bar 1 ('Swing'), or null
 *   tempo: quarter-note BPM for the tempo marking, or null
 *   barsPerLine
 *   barWidth: room for each bar's notes (narrower bars draw larger on phones)
 *   colors: { ink, muted, accent }
 *   font: the family for the text
 * @returns the layout, for following along: { width, height, firstLineTop,
 *   lineHeight, barsPerLine }, in SVG units
 */
export function renderChartNotation(host, VF, options) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot, Articulation, Modifier, StaveTie } = VF
  const { bars, notes = [], fills = [], solos = [], marks = [], repeat = null, sections = [], feel = null, tempo = null, colors, font } = options
  const end = options.end ?? bars * SLOTS_PER_BAR
  const barsPerLine = Math.max(1, Math.min(options.barsPerLine ?? bars, bars))
  const noteWidth = options.barWidth ?? 230
  const lineCount = Math.ceil(bars / barsPerLine)
  const width = 10 + CLEF_WIDTH + TIME_SIG_WIDTH + barsPerLine * noteWidth + 10
  // A stave's bottom line sits 80 below its top, and ties under the last
  // line need a little more.
  const height = FIRST_LINE_TOP + (lineCount - 1) * LINE_HEIGHT + 104
  const ink = { fillStyle: colors.ink, strokeStyle: colors.ink }
  const fillInk = { fillStyle: colors.accent, strokeStyle: colors.accent }
  const inFill = (slot) => [...fills, ...solos].some((fill) => slot >= fill.start && slot < fill.end)
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
    const noteEnd = note.slot + note.slots
    while (slot < noteEnd) {
      const bar = Math.floor(slot / SLOTS_PER_BAR)
      const barEnd = (bar + 1) * SLOTS_PER_BAR
      runs.push({ bar, position: slot - bar * SLOTS_PER_BAR, length: Math.min(noteEnd, barEnd) - slot, note, isFirst: slot === note.slot })
      slot = Math.min(noteEnd, barEnd)
    }
  })

  const slashAt = new Map()
  const noteAt = new Map()
  const piecesOf = new Map()
  const staves = []
  const drawLater = []
  const laterMarks = []
  // What's drawn over the staff, as { x, y, width, height }, for the
  // directions to clear.
  const obstacles = []
  const stemmedSlots = new Set()

  // Two 8th notes in one beat share a beam; an 8th beside a rest keeps its
  // flag.
  function beamPairs(byBeat) {
    const beams = []
    byBeat.forEach((items) => {
      if (items.length === 2 && items.every((item) => item.isNote && item.tickable.getDuration() === '8')) {
        beams.push(new Beam(items.map((item) => item.tickable)))
      }
    })
    return beams
  }

  function addTo(list, byBeat, tickable, position, isNote) {
    list.push(tickable)
    const beat = Math.floor(position / 2)
    if (!byBeat.has(beat)) byBeat.set(beat, [])
    byBeat.get(beat).push({ tickable, isNote })
  }

  // A run's pieces, tied together, with the articulation on the first.
  function runPieces(run, makeNote) {
    const pieces = notePieces(run.position, run.length).map(({ position, size }) => {
      const tickable = makeNote(VALUE[size])
      if (size === 3) Dot.buildAndAttach([tickable], { all: true })
      return { tickable, position }
    })
    if (run.isFirst) {
      pieces[0].tickable.addModifier(new Articulation(ARTICULATIONS[run.note.articulation]).setPosition(Modifier.Position.ABOVE), 0)
      noteAt.set(run.note.slot, pieces[0].tickable)
    }
    piecesOf.set(run, pieces.map((piece) => piece.tickable))
    return pieces
  }

  // The staff: plain slashes for beats with nothing written, rhythmic
  // slashes and 8th rests for the written figures, rests after the end.
  function staffVoice(bar) {
    const first = bar * SLOTS_PER_BAR
    const barRuns = runs.filter((run) => run.bar === bar && run.note.staff).sort((a, b) => a.position - b.position)
    const tickables = []
    const byBeat = new Map()
    const add = (tickable, position, isNote) => {
      addTo(tickables, byBeat, tickable, position, isNote)
      if (position % 2 === 0) slashAt.set(first + position, tickable)
    }

    function gap(from, to) {
      let position = from
      while (position < to) {
        const slot = first + position
        if (slot >= end) {
          restPieces(position, to - position).forEach(({ position: at, size }) => {
            const rest = new StaveNote({ keys: [SLASH_KEY], duration: `${VALUE[size]}r` }).setStyle(ink)
            if (size === 6) Dot.buildAndAttach([rest], { all: true })
            add(rest, at, false)
          })
          return
        }
        if (position % 2 === 0 && to - position >= 2) {
          const slash = new StaveNote({ keys: [SLASH_KEY], duration: 'q', type: 's', stemDirection: -1 }).setStyle(inFill(slot) ? fillInk : ink)
          slash.setStemStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' })
          add(slash, position, false)
          position += 2
        } else {
          add(new StaveNote({ keys: [SLASH_KEY], duration: '8r' }).setStyle(ink), position, false)
          position += 1
        }
      }
    }

    let position = 0
    barRuns.forEach((run) => {
      gap(position, run.position)
      runPieces(run, (duration) => new StaveNote({ keys: [SLASH_KEY], duration, type: 's', stemDirection: -1 }).setStyle(ink))
        .forEach(({ tickable, position: at }) => add(tickable, at, true))
      for (let slot = first + run.position; slot < first + run.position + run.length; slot += 1) stemmedSlots.add(slot)
      position = run.position + run.length
    })
    gap(position, SLOTS_PER_BAR)
    return { tickables, beams: beamPairs(byBeat) }
  }

  // The cue line above: the bar's cued figures with rests around them.
  function cueVoice(bar) {
    const barRuns = runs.filter((run) => run.bar === bar && !run.note.staff).sort((a, b) => a.position - b.position)
    if (barRuns.length === 0) return null
    const tickables = []
    const byBeat = new Map()
    const rests = (from, to) => restPieces(from, to - from).forEach(({ position, size }) => {
      const rest = new StaveNote({ keys: [CUE_REST_KEY], duration: `${VALUE[size]}r` }).setStyle(ink)
      if (size === 6) Dot.buildAndAttach([rest], { all: true })
      addTo(tickables, byBeat, rest, position, false)
    })

    let position = 0
    barRuns.forEach((run) => {
      rests(position, run.position)
      runPieces(run, (duration) => new StaveNote({ keys: [CUE_KEY], duration, stemDirection: 1 }).setStyle(ink))
        .forEach(({ tickable, position: at }) => addTo(tickables, byBeat, tickable, at, true))
      position = run.position + run.length
    })
    rests(position, SLOTS_PER_BAR)
    return { tickables, beams: beamPairs(byBeat) }
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
    const repeatEnd = repeat && bar === repeat.bar + repeat.bars - 1
    if (repeat && bar === repeat.bar) stave.setBegBarType(VF.BarlineType.REPEAT_BEGIN)
    if (bar === bars - 1) stave.setEndBarType(VF.BarlineType.END)
    else if (repeatEnd) stave.setEndBarType(VF.BarlineType.REPEAT_END)
    // A double bar closes each section before the next letter.
    else if (sections.some((section) => section.bar === bar + 1)) stave.setEndBarType(VF.BarlineType.DOUBLE)
    stave.setStyle(ink)
    stave.setContext(ctx).draw()
    staves.push(stave)

    const staff = staffVoice(bar)
    const voices = [new Voice({ numBeats: 4, beatValue: 4 }).addTickables(staff.tickables)]
    drawLater.push(...staff.beams)
    const cue = cueVoice(bar)
    if (cue) {
      voices.push(new Voice({ numBeats: 4, beatValue: 4 }).addTickables(cue.tickables))
      drawLater.push(...cue.beams)
    }

    new Formatter().joinVoices(voices).format(voices, stave.getNoteEndX() - stave.getNoteStartX() - 14)
    voices.forEach((voice) => voice.draw(ctx, stave))
    voices.forEach((voice) => voice.getTickables().forEach((note) => {
      const box = note.getBoundingBox()
      if (box) obstacles.push({ x: box.getX(), y: box.getY(), width: box.getW(), height: box.getH() })
    }))

    // Everything drawn by hand over the bar sets its own line width, colour
    // and font; saved and restored so none of it leaks into the next bar's
    // staff, which would otherwise draw heavier than bar 1's.
    ctx.save()

    // Rehearsal letters in a box, and bar numbers at the start of each line
    // after the first, both over the clef where no figure can be.
    const topLine = stave.getYForLine(0)
    const section = sections.find((item) => item.bar === bar)
    const markY = topLine - MARK_RISE - (isLineStart && bar > 0 ? BAR_NUMBER_RISE : 0)
    let markX = x + 4
    if (section) {
      ctx.setFont(font, 17, 'bold')
      ctx.setFillStyle(colors.ink)
      ctx.setStrokeStyle(colors.ink)
      ctx.setLineWidth(1.5)
      const letterWidth = ctx.measureText(section.label).width
      const boxWidth = Math.max(24, letterWidth + 12)
      // A stroked path, not rect(): VexFlow fills its rects.
      ctx.beginPath()
      ctx.moveTo(x, markY + 7)
      ctx.lineTo(x + boxWidth, markY + 7)
      ctx.lineTo(x + boxWidth, markY - 18)
      ctx.lineTo(x, markY - 18)
      ctx.closePath()
      ctx.stroke()
      ctx.fillText(section.label, x + (boxWidth - letterWidth) / 2, markY)
      markX = x + boxWidth + 8
    }
    if (isLineStart && bar > 0) {
      ctx.setFont(font, 11, 'normal')
      ctx.setFillStyle(colors.muted)
      ctx.fillText(String(bar + 1), x, topLine - 7)
    }

    // Wings on the repeat signs: the thick line curls out over the staff
    // toward the repeated music, top and bottom.
    stave.getModifiers().forEach((modifier) => {
      if (!(modifier instanceof VF.Barline)) return
      const type = modifier.getType()
      if (type !== VF.BarlineType.REPEAT_BEGIN && type !== VF.BarlineType.REPEAT_END) return
      const direction = type === VF.BarlineType.REPEAT_BEGIN ? 1 : -1
      const lineX = modifier.getX() - 0.5
      const bottomLine = stave.getYForLine(4)
      ctx.setStrokeStyle(colors.ink)
      ctx.setLineWidth(2.2)
      ;[[topLine, -1], [bottomLine, 1]].forEach(([y, away]) => {
        ctx.beginPath()
        ctx.moveTo(lineX, y)
        ctx.quadraticCurveTo(lineX, y + away * 7, lineX + direction * 11, y + away * 9)
        ctx.stroke()
      })
    })
    if (repeatEnd && repeat.times > 2) {
      const text = `${repeat.times}x`
      ctx.setFont(font, 14, 'bold')
      laterMarks.push({ text, x: x + staveWidth - ctx.measureText(text).width - 2, y: markY, size: 14 })
    }

    const mark = marks.find((item) => item.bar === bar)
    if (mark) laterMarks.push({ text: mark.text, x: markX, y: markY, size: 15 })
    ctx.restore()
  }

  drawLater.forEach((item) => item.setContext(ctx).draw())

  // Ties, within a note and across barlines, curving over the notes (the
  // stems point down in the staff and up in the cue line, so over is away
  // from the stems in the staff). One that crosses a line break is drawn as
  // two halves, off the end of one line and into the next.
  notes.forEach((note) => {
    const pieces = runs.filter((run) => run.note === note).flatMap((run) => piecesOf.get(run).map((piece) => ({ piece, bar: run.bar })))
    const drawTie = (firstNote, lastNote) => {
      const tie = new StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] }).setDirection(-1).setStyle(ink)
      Object.assign(tie.renderOptions, { cp1: 12, cp2: 19, cp1Short: 6, cp2Short: 11, yShift: 8 })
      tie.setContext(ctx).draw()
    }
    for (let index = 1; index < pieces.length; index += 1) {
      const from = pieces[index - 1]
      const to = pieces[index]
      if (lineOf(from.bar) === lineOf(to.bar)) {
        drawTie(from.piece, to.piece)
      } else {
        drawTie(from.piece, null)
        drawTie(null, to.piece)
      }
    }
  })

  // The style and tempo over bar 1, as a chart prints them: "Swing ♩ = 160".
  if (feel || tempo) {
    const y = lineTop(0) - 46
    let x = sections.some((section) => section.bar === 0) ? 44 : 14
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

  // Where a downbeat sits across the page: at a barline when it starts a
  // bar (or ends the last one), otherwise at the left of what's on the beat.
  const barlineX = (bar) => (bar % barsPerLine === 0 ? staves[bar].getNoteStartX() - 4 : staves[bar].getX())
  function beatX(slot, isEnd) {
    const bar = Math.floor(slot / SLOTS_PER_BAR)
    if (slot % SLOTS_PER_BAR === 0) {
      if (isEnd) return staves[bar - 1].getX() + staves[bar - 1].getWidth()
      return barlineX(bar)
    }
    const at = noteAt.get(slot) ?? slashAt.get(slot)
    return at.getAbsoluteX() - 4
  }

  // Each fill or solo bracket, just over the staff with "FILL" or "SOLO" at
  // its start; over rhythm inside it, it rises clear of the accents and ties.
  // One that runs past the end of a line carries on over the next.
  ctx.setStrokeStyle(colors.accent)
  ctx.setFillStyle(colors.accent)
  ctx.setLineWidth(1.5)
  const brackets = [...fills.map((fill) => ({ ...fill, label: 'FILL' })), ...solos.map((range) => ({ ...range, label: 'SOLO' }))]
  brackets.forEach((fill) => {
    let hasStems = false
    for (let slot = fill.start; slot < fill.end; slot += 1) hasStems ||= stemmedSlots.has(slot)
    let from = fill.start
    while (from < fill.end) {
      const bar = Math.floor(from / SLOTS_PER_BAR)
      const line = lineOf(bar)
      const lastBarOfLine = Math.min(bars - 1, (line + 1) * barsPerLine - 1)
      const lineEndSlot = (lastBarOfLine + 1) * SLOTS_PER_BAR
      const closesHere = fill.end <= lineEndSlot
      let x1 = from === fill.start ? beatX(from, false) : staves[bar].getNoteStartX() - 6
      // Clear of a rehearsal letter over the same barline.
      if (from === fill.start && from % SLOTS_PER_BAR === 0 && sections.some((section) => section.bar === bar)) {
        x1 = Math.max(x1, staves[bar].getX() + 28)
      }
      const x2 = closesHere ? beatX(fill.end, true) : staves[lastBarOfLine].getX() + staves[lastBarOfLine].getWidth()
      const y = staves[bar].getYForLine(0) - (hasStems ? 30 : 11)

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
        ctx.fillText(fill.label, x1 + 3, y - 5)
      }
      obstacles.push({ x: x1, y: y - 15, width: x2 - x1, height: 23 })
      from = lineEndSlot
    }
  })

  // Directions and repeat counts go on last, each lifted over whatever is
  // already drawn under its words: a cued figure, a fill bracket.
  ctx.save()
  ctx.setFillStyle(colors.ink)
  laterMarks.forEach(({ text, x, y, size }) => {
    ctx.setFont(font, size, 'bold')
    const right = x + ctx.measureText(text).width
    let baseline = y
    let clashes = true
    while (clashes) {
      const top = baseline - size * 0.8
      const clash = obstacles.find((box) => box.x < right + 3 && box.x + box.width > x - 3 && box.y < baseline + 4 && box.y + box.height > top - 3)
      clashes = Boolean(clash)
      if (clash) baseline = clash.y - 6
    }
    ctx.fillText(text, x, baseline)
  })
  ctx.restore()

  const svg = host.querySelector('svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.maxWidth = `${Math.round(width * 1.3)}px`
  svg.style.height = 'auto'
  svg.style.display = 'block'
  return { width, height, firstLineTop: FIRST_LINE_TOP, lineHeight: LINE_HEIGHT, barsPerLine }
}
