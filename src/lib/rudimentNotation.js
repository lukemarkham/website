// Draws one PAS rudiment the way the PAS sheet does: rhythm alone with no staff
// or time signature, every figure beamed as written, and the sticking under
// the notes. Grace notes go in small letters before the stroke's own.

const SWAP = { R: 'L', L: 'R', r: 'l', l: 'r' }
const mirror = (text) => text.replace(/[RLrl]/g, (hand) => SWAP[hand])

const NOTE_WIDTH = 46
const GRACE_WIDTH = 16
const NOTE_KEY = 'c/5'
const HEIGHT = 190
const STICKING_Y = [150, 174]

function noteRoom(note) {
  return NOTE_WIDTH + note.grace.length * GRACE_WIDTH + (note.hand.length > 2 ? note.hand.length * 12 : 0)
}

export function renderRudiment(host, VF, { groups, bothLeads, parse, colors, font }) {
  const { Renderer, Stave, StaveNote, GraceNote, GraceNoteGroup, Voice, Formatter, Beam, Tuplet, Dot, Articulation, Annotation, Tremolo, StaveTie, Modifier } = VF
  const parsed = groups.map(parse)
  const allNotes = parsed.flatMap((group) => group.notes)
  const width = Math.max(240, allNotes.reduce((total, note) => total + noteRoom(note), 0) + parsed.length * 20 + 40)

  host.innerHTML = ''
  const renderer = new Renderer(host, Renderer.Backends.SVG)
  renderer.resize(width, HEIGHT)
  const ctx = renderer.getContext()
  ctx.setFillStyle(colors.ink)
  ctx.setStrokeStyle(colors.ink)

  const stave = new Stave(0, 34, width)
  const ink = { fillStyle: colors.ink, strokeStyle: colors.ink }

  const built = []
  const beams = []
  const tuplets = []

  parsed.forEach((group) => {
    const groupNotes = group.notes.map((note) => {
      const staveNote = new StaveNote({
        keys: [note.rest ? 'b/4' : NOTE_KEY],
        duration: `${note.duration}${note.dotted ? 'd' : ''}${note.rest ? 'r' : ''}`,
        stemDirection: 1,
        autoStem: false,
      }).setStyle(ink)
      if (note.dotted) Dot.buildAndAttach([staveNote], { all: true })
      if (note.accent) staveNote.addModifier(new Articulation('a>').setPosition(Modifier.Position.ABOVE), 0)
      if (typeof note.slashes === 'number' && note.slashes > 0) staveNote.addModifier(new Tremolo(note.slashes), 0)
      if (note.slashes === 'z') {
        staveNote.addModifier(new Annotation('z').setFont({ family: font, size: 20, style: 'italic' }).setVerticalJustification(Annotation.VerticalJustify.CENTER), 0)
      }
      if (note.strokes) {
        staveNote.addModifier(new Annotation(String(note.strokes)).setFont({ family: 'Academico', size: 16, style: 'italic' }).setVerticalJustification(Annotation.VerticalJustify.TOP), 0)
      }
      if (note.grace) {
        const graces = Array.from(note.grace, () =>
          new GraceNote({ keys: [NOTE_KEY], duration: note.grace.length === 1 ? '8' : '16', slash: note.grace.length === 1, stemDirection: 1 }).setStyle(ink))
        const graceGroup = new GraceNoteGroup(graces, true)
        if (note.grace.length > 1) graceGroup.beamNotes()
        staveNote.addModifier(graceGroup, 0)
      }
      built.push({ note, staveNote })
      return staveNote
    })

    // Runs of beamable notes; a quarter or a rest ends one.
    let run = []
    const flush = () => {
      if (run.length > 1) {
        const beam = new Beam(run)
        if (group.breaks.length > 0) beam.breakSecondaryAt(group.breaks.map((index) => index - 1))
        beams.push(beam)
      }
      run = []
    }
    group.notes.forEach((note, index) => {
      if (note.rest || note.duration === 'q' || note.duration === 'h') flush()
      else run.push(groupNotes[index])
    })
    flush()

    group.tuplets.forEach(({ first, count, value }) => {
      tuplets.push(new Tuplet(groupNotes.slice(first, first + count), {
        numNotes: value,
        notesOccupied: value === 6 ? 4 : 2,
        bracketed: false,
        ratioed: false,
      }))
    })
  })

  const tickables = built.map((item) => item.staveNote)
  const voice = new Voice().setMode(Voice.Mode.SOFT).addTickables(tickables)
  voice.setStave(stave)
  new Formatter().joinVoices([voice]).format([voice], width - 40)
  voice.draw(ctx, stave)
  beams.forEach((beam) => beam.setContext(ctx).draw())
  tuplets.forEach((tuplet) => tuplet.setContext(ctx).draw())

  built.forEach(({ note, staveNote }, index) => {
    if (!note.tied) return
    const next = built[index + 1]
    if (next) {
      new StaveTie({ firstNote: staveNote, lastNote: next.staveNote, firstIndexes: [0], lastIndexes: [0] })
        .setContext(ctx)
        .draw()
    }
  })

  function drawHand(text, x, y, size, weight, anchor = 'middle') {
    const svgText = ctx.svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'text')
    svgText.setAttribute('x', x)
    svgText.setAttribute('y', y)
    svgText.setAttribute('text-anchor', anchor)
    svgText.setAttribute('fill', colors.ink)
    svgText.setAttribute('stroke', 'none')
    svgText.setAttribute('font-family', font)
    svgText.setAttribute('font-size', size)
    svgText.setAttribute('font-weight', weight)
    svgText.textContent = text
    ctx.svg.appendChild(svgText)
  }

  const rows = bothLeads ? [(text) => text, mirror] : [(text) => text]
  rows.forEach((row, rowIndex) => {
    built.forEach(({ note, staveNote }) => {
      if (!note.hand) return
      const x = staveNote.getAbsoluteX() + 7
      const y = STICKING_Y[rowIndex]
      // A roll written as one note spells its strokes out from the note.
      const spelled = note.hand.length > 2
      drawHand(row(note.hand.split('').join(' ')), x, y, 16, 800, spelled ? 'start' : 'middle')
      Array.from(note.grace).forEach((letter, index) => {
        drawHand(row(letter).toUpperCase(), x - 16 - (note.grace.length - 1 - index) * 12, y, 12, 600)
      })
    })
  })

  const svg = host.querySelector('svg')
  if (svg) {
    // The notes rarely fill the stave's width: crop to them so they centre.
    const left = Math.min(...Array.from(svg.querySelectorAll('text, path, rect'), (el) => el.getBBox().x).filter(Number.isFinite))
    const right = Math.max(...Array.from(svg.querySelectorAll('.vf-stavenote, text'), (el) => {
      const box = el.getBBox()
      return box.x + box.width
    }))
    const x = Math.max(0, left - 8)
    const cropped = right + 8 - x
    svg.setAttribute('viewBox', `${x} 0 ${cropped} ${HEIGHT}`)
    svg.setAttribute('width', cropped)
    svg.style.width = `${cropped}px`
    svg.style.maxWidth = '100%'
    svg.style.height = 'auto'
  }
}
