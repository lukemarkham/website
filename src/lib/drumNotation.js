// Draws drum-set grooves with VexFlow from a rhythmic grid: the Sticking
// Generator's hand patterns and the Independence exercises. (Fills have their
// own layout, with the landing note, in fillNotation.js.)
//
// Everything is placed on slots: slotsPerBeat 2 is 8ths, 3 is 8th-note
// triplets and 4 is 16ths, counted from the start of the first bar. Hands go
// in a stems-up voice, feet in a stems-down one, the standard drum-set layout.
// Drums don't sustain, so each note simply lasts until the next hit or the
// end of its beat; nothing is tied over a beat.

// Staff positions in the usual drum key. Cymbals and the hi-hat foot take an
// x notehead.
export const DRUM_KEYS = {
  ride: 'f/5/x',
  hihat: 'g/5/x',
  tom1: 'e/5',
  tom2: 'd/5',
  snare: 'c/5',
  floor: 'a/4',
  bass: 'f/4',
  hihatFoot: 'd/4/x',
}

// Note values for a run of n slots inside one beat.
const DURATIONS = {
  2: { 1: '8', 2: 'q' },
  3: { 1: '8', 2: 'q', 3: 'q' },
  4: { 1: '16', 2: '8', 3: '8d', 4: 'q' },
}

const REST_KEY = { 1: 'e/5', [-1]: 'd/4' }
const SLOT_WIDTH = { 2: 40, 3: 34, 4: 28 }
const LINE_TOP_PADDING = 22
// Labels sit under the feet's stems, or tucked up under the staff when there
// are no feet.
const LABEL_ROW_Y = { withFeet: [146, 164], handsOnly: [112, 130] }

/**
 * @param {HTMLElement} host   emptied and filled with the SVG
 * @param {object} VF          the loaded VexFlow module
 * @param {object} options
 *   slotsPerBeat: 2, 3 or 4
 *   bars: how many 4/4 bars to draw
 *   voices: [{ stem: 1 | -1, hits: { [slot]: { keys: string[], accent?: boolean } } }]
 *   labels: [{ slot, row: 0 | 1, text, color? }] drawn under the note at that slot
 *   feel: text over the first bar ('Swing', 'Straight'), or null
 *   repeat: draw repeat barlines around the whole thing
 *   barsPerLine: how many bars before wrapping to a new line
 *   colors: { ink, muted, faint }
 *   font: the family for labels and the feel marking
 */
export function renderDrumNotation(host, VF, options) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Tuplet, Dot, Articulation, Modifier, Fraction, BarlineType } = VF
  const { slotsPerBeat: spb, bars, voices, labels = [], feel, repeat = false, colors, font } = options
  const barsPerLine = Math.max(1, Math.min(options.barsPerLine ?? bars, bars))
  const lineCount = Math.ceil(bars / barsPerLine)
  const hasLabels = labels.length > 0
  const hasFeet = voices.some((voice) => voice.stem === -1 && Object.keys(voice.hits).length > 0)
  const labelRows = hasFeet ? LABEL_ROW_Y.withFeet : LABEL_ROW_Y.handsOnly
  const lineHeight = (hasLabels ? labelRows[1] + 20 : 150)
  const noteWidth = 4 * spb * SLOT_WIDTH[spb] + 24
  const clefWidth = 44
  const timeSigWidth = 26
  const width = 10 + clefWidth + timeSigWidth + barsPerLine * noteWidth + 10
  const height = lineCount * lineHeight + 8
  const ink = { fillStyle: colors.ink, strokeStyle: colors.ink }
  const slotsPerBar = spb * 4

  host.innerHTML = ''
  const renderer = new Renderer(host, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()
  ctx.setFillStyle(colors.ink)
  ctx.setStrokeStyle(colors.ink)

  // Every note that starts a slot, so labels can find where to sit.
  const noteAtSlot = new Map()

  function beatTickables(voice, firstSlot) {
    const offsets = []
    for (let offset = 0; offset < spb; offset += 1) {
      if (voice.hits[firstSlot + offset]) offsets.push(offset)
    }
    const restKeys = [REST_KEY[voice.stem]]
    if (offsets.length === 0) return { tickables: [new StaveNote({ keys: restKeys, duration: 'qr' }).setStyle(ink)], tuplet: false }

    const tickables = []
    const make = (keys, length, isRest) => {
      const duration = DURATIONS[spb][length]
      const note = new StaveNote({
        keys,
        duration: isRest ? `${duration}r` : duration,
        stemDirection: voice.stem,
      }).setStyle(ink)
      if (duration.endsWith('d')) Dot.buildAndAttach([note], { all: true })
      return note
    }

    if (offsets[0] > 0) tickables.push(make(restKeys, offsets[0], true))
    offsets.forEach((offset, index) => {
      const length = (offsets[index + 1] ?? spb) - offset
      const hit = voice.hits[firstSlot + offset]
      const note = make(hit.keys, length, false)
      if (hit.accent) note.addModifier(new Articulation('a>').setPosition(Modifier.Position.ABOVE), 0)
      tickables.push(note)
      if (!noteAtSlot.has(firstSlot + offset)) noteAtSlot.set(firstSlot + offset, note)
    })

    // A whole-beat note in a triplet bar is an ordinary quarter.
    const tuplet = spb === 3 && !(offsets.length === 1 && offsets[0] === 0)
    return { tickables, tuplet }
  }

  const drawLater = []

  for (let bar = 0; bar < bars; bar += 1) {
    const line = Math.floor(bar / barsPerLine)
    const column = bar % barsPerLine
    const isLineStart = column === 0
    const x = 10 + (isLineStart ? 0 : clefWidth + timeSigWidth + column * noteWidth)
    // Every line's first bar keeps room for the time signature, even where
    // only the clef is drawn, so the bars line up down the page.
    const staveWidth = noteWidth + (isLineStart ? clefWidth + timeSigWidth : 0)
    const y = LINE_TOP_PADDING + line * lineHeight

    const stave = new Stave(x, y, staveWidth)
    if (isLineStart) stave.addClef('percussion')
    if (bar === 0) stave.addTimeSignature('4/4')
    if (repeat && bar === 0) stave.setBegBarType(BarlineType.REPEAT_BEGIN)
    if (repeat && bar === bars - 1) stave.setEndBarType(BarlineType.REPEAT_END)
    stave.setStyle(ink)
    stave.setContext(ctx).draw()

    const staveVoices = voices.map((voice) => {
      const tickables = []
      const beams = []
      const tuplets = []
      for (let beat = 0; beat < 4; beat += 1) {
        const built = beatTickables(voice, bar * slotsPerBar + beat * spb)
        if (built.tuplet) tuplets.push(new Tuplet(built.tickables, { numNotes: 3, notesOccupied: 2, bracketed: false, location: voice.stem }))
        tickables.push(...built.tickables)
        if (built.tickables.length > 1) {
          beams.push(...Beam.generateBeams(built.tickables, {
            groups: [new Fraction(1, 4)],
            stemDirection: voice.stem,
            beamRests: true,
            beamMiddleOnly: true,
          }))
        }
      }
      const staveVoice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(tickables)
      return { staveVoice, beams, tuplets }
    })

    const vfVoices = staveVoices.map((item) => item.staveVoice)
    new Formatter().joinVoices(vfVoices).format(vfVoices, stave.getNoteEndX() - stave.getNoteStartX() - 14)
    staveVoices.forEach(({ staveVoice, beams, tuplets }) => {
      staveVoice.draw(ctx, stave)
      drawLater.push(...beams, ...tuplets)
    })

    if (bar === 0 && feel) {
      ctx.setFont(font, 13, 'bold')
      ctx.setFillStyle(colors.ink)
      ctx.fillText(feel, x + 2, y + 6)
    }
  }

  drawLater.forEach((item) => item.setContext(ctx).draw())

  const centreOf = (note) => (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2
  labels.forEach(({ slot, row, text, color, size }) => {
    const note = noteAtSlot.get(slot)
    if (!note) return
    const line = Math.floor(Math.floor(slot / slotsPerBar) / barsPerLine)
    ctx.setFont(font, size ?? (row === 0 ? 16 : 11), 'bold')
    ctx.setFillStyle(color ?? (row === 0 ? colors.ink : colors.muted))
    const measured = ctx.measureText(text).width
    ctx.fillText(text, centreOf(note) - measured / 2, LINE_TOP_PADDING + line * lineHeight + labelRows[row])
  })

  // Scale to the container rather than rendering at a fixed pixel size.
  const svg = host.querySelector('svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.maxWidth = `${Math.round(width * 1.35)}px`
  svg.style.minWidth = `${Math.round(width * 0.62)}px`
  svg.style.height = 'auto'
}
