// Standard MIDI File export, so a progression worth keeping can be dragged
// into a DAW. The notes come from the arrangement that was actually played —
// the same voicings, the same voice leading, the same timing and velocities —
// rather than being re-derived from the chart, so the file is what the ear
// heard rather than a tidied-up version of it.

const PPQ = 480
// General MIDI drum notes, which live on channel 10 by convention.
const DRUM_NOTES = { kick: 36, snare: 38, hat: 42, openHat: 46 }
const DRUM_CHANNEL = 9

// Meta text is read as bytes, and a chord chart is full of characters that a
// DAW's track list will not thank us for.
function asciiBytes(text) {
  return [...text
    .replace(/[♭]/g, 'b')
    .replace(/[♯]/g, '#')
    .replace(/[–—]/g, '-')
    .replace(/[ø]/g, 'o')
    .replace(/[°]/g, 'dim')
  ].map((character) => character.charCodeAt(0) & 0x7f)
}

// Delta times are stored seven bits at a time, high bit set on every byte but
// the last.
function variableLength(value) {
  const bytes = [value & 0x7f]
  let rest = Math.floor(value / 128)
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80)
    rest = Math.floor(rest / 128)
  }
  return bytes
}

function uint32(value) {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function chunk(id, body) {
  return [...asciiBytes(id), ...uint32(body.length), ...body]
}

// `order` breaks ties on the tick: a note off has to come before a note on at
// the same moment, or a repeated note is cut the instant it starts.
function serialise(events) {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order)
  const body = []
  let previous = 0
  sorted.forEach((event) => {
    body.push(...variableLength(Math.max(0, event.tick - previous)), ...event.bytes)
    previous = event.tick
  })
  body.push(...variableLength(0), 0xff, 0x2f, 0x00)
  return chunk('MTrk', body)
}

function noteTrack(name, channel, program, notes) {
  const events = [{ tick: 0, order: 0, bytes: [0xff, 0x03, ...variableLength(asciiBytes(name).length), ...asciiBytes(name)] }]
  if (program !== null) {
    events.push({ tick: 0, order: 1, bytes: [0xc0 | channel, program & 0x7f] })
  }
  notes.forEach((note) => {
    const velocity = Math.max(1, Math.min(127, Math.round(note.velocity * 127)))
    events.push({ tick: note.tick, order: 2, bytes: [0x90 | channel, note.midi, velocity] })
    events.push({ tick: note.tick + Math.max(1, note.length), order: -1, bytes: [0x80 | channel, note.midi, 0] })
  })
  return serialise(events)
}

function drumNote(event) {
  if (event.voice === 'hat') return event.open ? DRUM_NOTES.openHat : DRUM_NOTES.hat
  return DRUM_NOTES[event.voice] ?? DRUM_NOTES.hat
}

// One pass of the progression — pass the loop arrangement rather than the one
// with the tonic reference on the front, which is a teaching aid rather than
// part of the music.
export function arrangementToMidi({ arrangement, tempo, name, chordProgram, bassProgram }) {
  const secondsPerBeat = 60 / tempo
  const toTicks = (seconds) => Math.max(0, Math.round((seconds / secondsPerBeat) * PPQ))
  const collect = (kind) => arrangement.events
    .filter((event) => event.kind === kind)
    .map((event) => ({
      midi: kind === 'drum' ? drumNote(event) : event.midi,
      tick: toTicks(event.time),
      // A drum hit has no length of its own, so it gets a sixteenth to sit in.
      length: kind === 'drum' ? PPQ / 4 : toTicks(event.duration),
      velocity: event.velocity,
    }))

  const tempoTrack = serialise([
    { tick: 0, order: 0, bytes: [0xff, 0x03, ...variableLength(asciiBytes(name).length), ...asciiBytes(name)] },
    { tick: 0, order: 1, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] },
    { tick: 0, order: 2, bytes: [0xff, 0x51, 0x03, ...uint32(Math.round(60000000 / tempo)).slice(1)] },
  ])

  const tracks = [tempoTrack, noteTrack('Chords', 0, chordProgram, collect('chord'))]
  const bass = collect('bass')
  if (bass.length > 0) tracks.push(noteTrack('Bass', 1, bassProgram, bass))
  const drums = collect('drum')
  if (drums.length > 0) tracks.push(noteTrack('Drums', DRUM_CHANNEL, null, drums))

  // Format 1: one tempo map, then a track per part.
  const header = chunk('MThd', [
    0x00, 0x01,
    ...uint32(tracks.length).slice(2),
    ...uint32(PPQ).slice(2),
  ])

  return new Uint8Array([...header, ...tracks.flat()])
}

export function midiFilename(progressionName, keyLabel) {
  const clean = asciiBytes(`${progressionName} in ${keyLabel}`)
    .map((code) => String.fromCharCode(code))
    .join('')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return `${clean || 'progression'}.mid`
}
