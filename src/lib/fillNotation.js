// Draws a sticking-generator fill as drum notation with VexFlow: one 4/4 bar
// with the fill at its end (rests before it), a barline, and the landing note
// on the next downbeat. Hands sit in the C space (snare), kicks in the F space
// (bass drum). The sticking and the counts are drawn under each note, so they
// scale with the staff.
//
// VexFlow and its music font are sizeable, so they are only loaded when a page
// asks for them.

let vexflowPromise = null

export function loadVexFlow() {
  vexflowPromise ??= import('vexflow/bravura').then(async (module) => {
    await module.VexFlow.loadFonts('Bravura', 'Academico')
    return module
  })
  return vexflowPromise
}

const KEY_FOR_STROKE = { K: 'f/4', R: 'c/5', L: 'c/5' }
const STAVE_TOP = 10
const STICKING_Y = 132
const COUNT_Y = 154
const HEIGHT = 168

/**
 * @param {HTMLElement} host   emptied and filled with the SVG
 * @param {object} VF          the loaded VexFlow module
 * @param {object} options
 *   steps: [{ stroke, count, isScrambling }]
 *   notesPerBeat: 4 (16ths) or 3 (8th-note triplets)
 *   beats: how many beats the fill lasts; it ends the bar
 *   landing: { stroke, label }
 *   colors: { ink, muted, hand, kick }
 *   font: the family to draw the sticking in
 */
export function renderFillNotation(host, VF, { steps, notesPerBeat, beats, landing, colors, font }) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Tuplet, BarlineType } = VF
  const isTriplet = notesPerBeat === 3
  const restBeats = 4 - beats
  const noteSpacing = isTriplet ? 40 : 32
  const barWidth = 96 + restBeats * 44 + steps.length * noteSpacing
  const landingWidth = 86
  const width = 10 + barWidth + landingWidth + 10

  host.innerHTML = ''
  const renderer = new Renderer(host, Renderer.Backends.SVG)
  renderer.resize(width, HEIGHT)
  const ctx = renderer.getContext()
  const ink = { fillStyle: colors.ink, strokeStyle: colors.ink }
  const faint = { fillStyle: colors.muted, strokeStyle: colors.muted }
  ctx.setFillStyle(colors.ink)
  ctx.setStrokeStyle(colors.ink)

  const stave = new Stave(10, STAVE_TOP, barWidth).addClef('percussion').addTimeSignature('4/4')
  stave.setStyle(ink)
  stave.setContext(ctx).draw()

  const rests = Array.from({ length: restBeats }, () => new StaveNote({ keys: ['b/4'], duration: 'qr' }).setStyle(ink))
  const fillNotes = steps.map((step) => new StaveNote({
    keys: [KEY_FOR_STROKE[step.stroke]],
    duration: isTriplet ? '8' : '16',
    stemDirection: 1,
  }).setStyle(step.isScrambling ? faint : ink))

  const beams = []
  const tuplets = []
  for (let index = 0; index < fillNotes.length; index += notesPerBeat) {
    const group = fillNotes.slice(index, index + notesPerBeat)
    beams.push(new Beam(group).setStyle(ink))
    if (isTriplet) tuplets.push(new Tuplet(group, { numNotes: 3, notesOccupied: 2, bracketed: false }))
  }

  const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([...rests, ...fillNotes])
  new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 12)
  voice.draw(ctx, stave)
  beams.forEach((beam) => beam.setContext(ctx).draw())
  tuplets.forEach((tuplet) => tuplet.setContext(ctx).draw())

  // The landing bar is left open: it's only there to show where the fill goes.
  const landingStave = new Stave(10 + barWidth, STAVE_TOP, landingWidth)
  landingStave.setBegBarType(BarlineType.NONE).setEndBarType(BarlineType.NONE)
  landingStave.setStyle(ink)
  landingStave.setContext(ctx).draw()
  const landingNote = new StaveNote({ keys: [KEY_FOR_STROKE[landing.stroke]], duration: 'q', stemDirection: 1 }).setStyle(ink)
  const landingVoice = new Voice({ numBeats: 1, beatValue: 4 }).addTickables([landingNote])
  new Formatter().joinVoices([landingVoice]).format([landingVoice], landingWidth - 30)
  landingVoice.draw(ctx, landingStave)

  const centreOf = (note) => (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2
  function label(text, x, y, size, weight, color) {
    ctx.setFont(font, size, weight)
    ctx.setFillStyle(color)
    const measured = ctx.measureText(text).width
    ctx.fillText(text, x - measured / 2, y)
  }

  steps.forEach((step, index) => {
    const x = centreOf(fillNotes[index])
    const strokeColor = step.isScrambling ? colors.muted : step.stroke === 'K' ? colors.kick : colors.hand
    label(step.stroke, x, STICKING_Y, 17, 'bold', strokeColor)
    label(step.count, x, COUNT_Y, 11, 'bold', colors.muted)
  })

  const landingX = centreOf(landingNote)
  label(landing.stroke, landingX, STICKING_Y, 17, 'bold', landing.stroke === 'K' ? colors.kick : colors.hand)
  label(landing.label.toUpperCase(), landingX, COUNT_Y, 10, 'bold', colors.muted)

  // Scale to the container rather than rendering at a fixed pixel size.
  const svg = host.querySelector('svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.maxWidth = `${Math.round(width * 1.35)}px`
  // Past this it's too small to read; the container scrolls instead.
  svg.style.minWidth = `${Math.round(width * 0.62)}px`
  svg.style.height = 'auto'
}
