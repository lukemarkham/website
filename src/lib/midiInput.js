// Web MIDI in, so a chord can be answered by playing it rather than spelling
// it. No dependencies and no build step: the browser either has the API or it
// does not, and everything here degrades to nothing when it does not.
//
// Access is per-origin and permanent once granted, but asking for it has to
// come from something the user did, so the call is behind a button rather than
// fired on mount.

const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const CONTROL_CHANGE = 0xb0
const SUSTAIN = 64
// A chord is rolled, not struck: notes arriving inside this window belong to
// the same gesture, and it is only silence longer than this that starts a new
// one. Long enough for a spread left hand, short enough that two deliberate
// chords never run together.
const GESTURE_GAP_MS = 140

export function isMidiSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

function describe(access) {
  return [...access.inputs.values()].map((input) => input.name).filter(Boolean)
}

// `onNote` is every key going down and coming up, on its own and as soon as it
// happens, because it is what sounds the note and latency is the whole game
// there. `onChord` is the reading of it: every note in the gesture so far — a
// rolled chord builds up rather than being read as four one-note chords —
// alongside what is still under the fingers.
export async function connectMidi({ onNote, onChord, onSustain, onDevices, onError }) {
  if (!isMidiSupported()) throw new Error('unsupported')

  const access = await navigator.requestMIDIAccess({ sysex: false })

  // Held is what is down now; gesture is everything played since the last
  // silence. Releasing a note leaves it in the gesture, so letting go of a
  // chord does not erase the answer it just put in the box.
  const held = new Set()
  let gesture = []
  let lastReleasedAt = 0
  let closed = false

  const handle = (event) => {
    const [status, data1, data2] = event.data
    const command = status & 0xf0

    if (command === CONTROL_CHANGE && data1 === SUSTAIN) {
      onSustain?.(data2 >= 64)
      return
    }

    const isNoteOn = command === NOTE_ON && data2 > 0
    const isNoteOff = command === NOTE_OFF || (command === NOTE_ON && data2 === 0)
    if (!isNoteOn && !isNoteOff) return

    // Sounded before anything is worked out about it: the note under the
    // finger should not wait on the name of the chord it is part of.
    onNote?.({ note: data1, on: isNoteOn, velocity: isNoteOn ? data2 / 127 : 0 })

    if (isNoteOn) {
      if (held.size === 0 && event.timeStamp - lastReleasedAt > GESTURE_GAP_MS) {
        gesture = []
      }
      held.add(data1)
      if (!gesture.includes(data1)) gesture.push(data1)
    } else {
      held.delete(data1)
      if (held.size === 0) lastReleasedAt = event.timeStamp
    }

    onChord?.({ chord: [...gesture], held: [...held].sort((a, b) => a - b) })
  }

  const listen = () => {
    access.inputs.forEach((input) => {
      input.onmidimessage = handle
    })
    onDevices?.(describe(access))
  }

  listen()
  // A keyboard switched on after the page loaded, or unplugged and plugged
  // back in, arrives this way rather than through the original enumeration.
  access.onstatechange = () => {
    if (closed) return
    try {
      listen()
    } catch (error) {
      onError?.(error)
    }
  }

  return {
    devices: describe(access),
    close() {
      closed = true
      access.onstatechange = null
      access.inputs.forEach((input) => {
        input.onmidimessage = null
      })
    },
  }
}
