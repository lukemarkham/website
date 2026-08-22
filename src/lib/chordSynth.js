// A small Web Audio instrument rack for the progression trainer. Everything is
// synthesised at runtime — no samples to ship — but each patch is built from
// the parts that make the real thing recognisable: FM bell attacks for the
// electric pianos, a plucked string model for the guitar, and a generated
// convolution reverb so the chords sit in a room instead of in a browser.

import { bassNote, midiToFreq, voiceChord } from './harmony'

function impulseResponse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      const fade = Math.pow(1 - i / length, decay)
      // A short build-up at the front reads as early reflections.
      const onset = Math.min(1, i / (ctx.sampleRate * 0.012))
      data[i] = (Math.random() * 2 - 1) * fade * onset
    }
  }
  return buffer
}

export function createEngine() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioContextClass()

  const output = ctx.createDynamicsCompressor()
  output.threshold.value = -14
  output.ratio.value = 3
  output.attack.value = 0.008
  output.release.value = 0.22
  output.connect(ctx.destination)

  const master = ctx.createGain()
  master.gain.value = 0.85
  master.connect(output)

  const reverb = ctx.createConvolver()
  reverb.buffer = impulseResponse(ctx, 2.6, 2.4)
  const reverbTone = ctx.createBiquadFilter()
  reverbTone.type = 'highpass'
  reverbTone.frequency.value = 220
  reverb.connect(reverbTone)
  reverbTone.connect(master)

  const cleanups = []
  const activeBuses = []

  return {
    ctx,
    async ensure() {
      if (ctx.state === 'suspended') await ctx.resume()
      return ctx
    },
    // Each voice gets a bus with its own dry/wet balance, torn down once the
    // phrase has rung out.
    createBus(reverbAmount, level = 1) {
      const input = ctx.createGain()
      input.gain.value = level
      const dry = ctx.createGain()
      dry.gain.value = 1 - reverbAmount * 0.45
      const wet = ctx.createGain()
      wet.gain.value = reverbAmount
      input.connect(dry)
      dry.connect(master)
      input.connect(wet)
      wet.connect(reverb)
      activeBuses.push(input)
      return input
    },
    scheduleCleanup(node, when) {
      const timer = window.setTimeout(() => {
        try {
          node.disconnect()
        } catch {
          // Already torn down.
        }
      }, Math.max(0, when) * 1000)
      cleanups.push(timer)
    },
    // Voices are scheduled ahead of time and cannot be unscheduled, so cutting
    // a phrase short means muting and dropping the bus they all play into.
    stopAll() {
      cleanups.forEach((timer) => window.clearTimeout(timer))
      cleanups.length = 0
      const now = ctx.currentTime
      activeBuses.forEach((bus) => {
        bus.gain.cancelScheduledValues(now)
        bus.gain.setValueAtTime(bus.gain.value, now)
        bus.gain.linearRampToValueAtTime(0.0001, now + 0.08)
        window.setTimeout(() => {
          try {
            bus.disconnect()
          } catch {
            // Already torn down.
          }
        }, 200)
      })
      activeBuses.length = 0
    },
    close() {
      cleanups.forEach((timer) => window.clearTimeout(timer))
      cleanups.length = 0
      if (ctx.state !== 'closed') ctx.close()
    },
  }
}

function applyEnvelope(param, time, peak, config, duration) {
  const attackEnd = time + config.attack
  const decayEnd = attackEnd + config.decay
  const end = time + duration + config.release
  param.setValueAtTime(0.0001, time)
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), attackEnd)
  if (decayEnd < end - 0.02) {
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak * config.sustain), decayEnd)
  }
  param.exponentialRampToValueAtTime(0.0001, end)
  return end
}

function fmVoice(ctx, out, note, config) {
  const freq = midiToFreq(note.midi)
  const carrier = ctx.createOscillator()
  carrier.type = config.carrierType ?? 'sine'
  carrier.frequency.setValueAtTime(freq, note.time)

  const modulator = ctx.createOscillator()
  modulator.type = config.modulatorType ?? 'sine'
  modulator.frequency.setValueAtTime(freq * config.ratio, note.time)

  // The modulation index falling away fast is what gives an electric piano its
  // bell-like attack and mellow tail.
  const depth = ctx.createGain()
  const peakDepth = freq * config.index * (0.45 + note.velocity * 0.8)
  depth.gain.setValueAtTime(peakDepth, note.time)
  depth.gain.exponentialRampToValueAtTime(
    Math.max(1, freq * config.indexEnd),
    note.time + config.indexDecay,
  )
  modulator.connect(depth)
  depth.connect(carrier.frequency)

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = config.cutoff
  tone.Q.value = 0.4

  const amp = ctx.createGain()
  const end = applyEnvelope(amp.gain, note.time, note.velocity * config.level, config, note.duration)

  carrier.connect(tone)
  tone.connect(amp)

  if (config.tremoloRate) {
    const tremolo = ctx.createGain()
    tremolo.gain.value = 1
    const lfo = ctx.createOscillator()
    lfo.frequency.value = config.tremoloRate
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = config.tremoloDepth
    lfo.connect(lfoDepth)
    lfoDepth.connect(tremolo.gain)
    lfo.start(note.time)
    lfo.stop(end + 0.05)
    amp.connect(tremolo)
    tremolo.connect(out)
  } else {
    amp.connect(out)
  }

  carrier.start(note.time)
  modulator.start(note.time)
  carrier.stop(end + 0.05)
  modulator.stop(end + 0.05)
}

function padVoice(ctx, out, note) {
  const freq = midiToFreq(note.midi)
  const amp = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 1.1
  filter.frequency.setValueAtTime(420, note.time)
  filter.frequency.exponentialRampToValueAtTime(1500 + note.velocity * 900, note.time + 0.5)
  filter.frequency.exponentialRampToValueAtTime(700, note.time + note.duration + 0.6)

  const end = applyEnvelope(amp.gain, note.time, note.velocity * 0.12, {
    attack: 0.32,
    decay: 0.4,
    sustain: 0.85,
    release: 0.9,
  }, note.duration)

  ;[-9, 0, 8].forEach((detune) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, note.time)
    osc.detune.setValueAtTime(detune, note.time)
    osc.connect(filter)
    osc.start(note.time)
    osc.stop(end + 0.05)
  })

  filter.connect(amp)
  amp.connect(out)
}

// Karplus-Strong rendered straight into a buffer rather than run through a
// feedback delay line: a DelayNode inside a loop cannot hold a delay shorter
// than one render quantum, which would put every note above F4 out of tune.
const pluckCaches = new WeakMap()

function pluckBuffer(ctx, midi, config) {
  let cache = pluckCaches.get(ctx)
  if (!cache) {
    cache = new Map()
    pluckCaches.set(ctx, cache)
  }
  const cacheKey = `${config.id}:${midi}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  // The two-tap damping average delays the loop by half a sample, so the delay
  // line is tuned with a fractional read — rounding to whole samples would run
  // the top voices tens of cents sharp.
  const delay = Math.max(2, ctx.sampleRate / midiToFreq(midi) - 0.5)
  const seed = Math.ceil(delay) + 2
  const length = Math.ceil(ctx.sampleRate * config.seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  // A filtered noise burst is the pick attack; the string is what happens next.
  let smoothed = 0
  for (let i = 0; i < seed; i += 1) {
    smoothed = smoothed * config.pickTone + (Math.random() * 2 - 1) * (1 - config.pickTone)
    data[i] = smoothed
  }

  const read = (index, distance) => {
    const whole = Math.floor(distance)
    const fraction = distance - whole
    return data[index - whole] * (1 - fraction) + data[index - whole - 1] * fraction
  }

  for (let i = seed; i < length; i += 1) {
    data[i] = config.decay * (read(i, delay) * (1 - config.damping) + read(i, delay + 1) * config.damping)
  }

  // Fade the tail so looping the buffer out never clicks.
  const fade = Math.floor(ctx.sampleRate * 0.05)
  for (let i = 0; i < fade; i += 1) {
    data[length - fade + i] *= 1 - i / fade
  }

  if (cache.size > 64) cache.clear()
  cache.set(cacheKey, buffer)
  return buffer
}

function pluckVoice(ctx, out, note, config) {
  const source = ctx.createBufferSource()
  source.buffer = pluckBuffer(ctx, note.midi, config)

  const body = ctx.createBiquadFilter()
  body.type = 'bandpass'
  body.frequency.value = config.body
  body.Q.value = 0.5

  const amp = ctx.createGain()
  amp.gain.setValueAtTime(note.velocity * config.level, note.time)
  // Damp the string when the chord is short, let it ring when it is not.
  const ring = Math.min(note.duration + 0.5, config.seconds)
  amp.gain.setTargetAtTime(0.0001, note.time + ring, 0.12)

  source.connect(body)
  body.connect(amp)
  amp.connect(out)
  source.start(note.time)
  source.stop(note.time + config.seconds)
}

function clavVoice(ctx, out, note) {
  const freq = midiToFreq(note.midi)
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(freq, note.time)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1900, note.time)
  filter.frequency.exponentialRampToValueAtTime(900, note.time + 0.3)
  filter.Q.value = 3.2
  const amp = ctx.createGain()
  const end = applyEnvelope(amp.gain, note.time, note.velocity * 0.2, {
    attack: 0.004,
    decay: 0.16,
    sustain: 0.18,
    release: 0.2,
  }, Math.min(note.duration, 1.1))
  osc.connect(filter)
  filter.connect(amp)
  amp.connect(out)
  osc.start(note.time)
  osc.stop(end + 0.05)
}

export const CHORD_INSTRUMENTS = [
  {
    id: 'rhodes',
    name: 'Rhodes',
    reverb: 0.3,
    bass: 'electric',
    play: (ctx, out, note) => fmVoice(ctx, out, note, {
      ratio: 1,
      index: 2.6,
      indexEnd: 0.14,
      indexDecay: 0.5,
      cutoff: 3800,
      level: 0.2,
      attack: 0.006,
      decay: 0.9,
      sustain: 0.4,
      release: 0.5,
      tremoloRate: 4.6,
      tremoloDepth: 0.09,
    }),
  },
  {
    id: 'wurlitzer',
    name: 'Wurlitzer',
    reverb: 0.26,
    bass: 'electric',
    play: (ctx, out, note) => fmVoice(ctx, out, note, {
      ratio: 2,
      modulatorType: 'triangle',
      index: 3.4,
      indexEnd: 0.3,
      indexDecay: 0.35,
      cutoff: 2900,
      level: 0.19,
      attack: 0.005,
      decay: 0.7,
      sustain: 0.32,
      release: 0.4,
      tremoloRate: 6.2,
      tremoloDepth: 0.14,
    }),
  },
  {
    id: 'vibraphone',
    name: 'Vibraphone',
    reverb: 0.42,
    bass: 'upright',
    play: (ctx, out, note) => fmVoice(ctx, out, note, {
      ratio: 4,
      index: 2.2,
      indexEnd: 0.05,
      indexDecay: 0.14,
      cutoff: 5200,
      level: 0.16,
      attack: 0.004,
      decay: 1.6,
      sustain: 0.25,
      release: 1.1,
      tremoloRate: 5.4,
      tremoloDepth: 0.3,
    }),
  },
  {
    id: 'pad',
    name: 'Warm pad',
    reverb: 0.46,
    bass: 'sub',
    play: (ctx, out, note) => padVoice(ctx, out, note),
  },
  {
    id: 'nylon',
    name: 'Nylon guitar',
    reverb: 0.3,
    bass: 'upright',
    play: (ctx, out, note) => pluckVoice(ctx, out, note, {
      id: 'nylon',
      seconds: 2.4,
      decay: 0.9958,
      damping: 0.5,
      pickTone: 0.55,
      body: 900,
      level: 0.55,
    }),
  },
  {
    id: 'harp',
    name: 'Bell harp',
    reverb: 0.5,
    bass: 'sub',
    play: (ctx, out, note) => pluckVoice(ctx, out, note, {
      id: 'harp',
      seconds: 3.2,
      decay: 0.9988,
      damping: 0.32,
      pickTone: 0.25,
      body: 1700,
      level: 0.3,
    }),
  },
  {
    id: 'clav',
    name: 'Clav',
    reverb: 0.22,
    bass: 'electric',
    play: (ctx, out, note) => clavVoice(ctx, out, note),
  },
]

export const BASS_INSTRUMENTS = {
  upright: {
    name: 'Upright bass',
    reverb: 0.16,
    play: (ctx, out, note) => {
      const freq = midiToFreq(note.midi)
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      // A touch of pitch drop at the front reads as a plucked acoustic string.
      osc.frequency.setValueAtTime(freq * 1.03, note.time)
      osc.frequency.exponentialRampToValueAtTime(freq, note.time + 0.07)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(900, note.time)
      filter.frequency.exponentialRampToValueAtTime(260, note.time + 0.5)
      const amp = ctx.createGain()
      const end = applyEnvelope(amp.gain, note.time, note.velocity * 0.4, {
        attack: 0.008,
        decay: 0.5,
        sustain: 0.3,
        release: 0.3,
      }, Math.min(note.duration, 1.4))
      osc.connect(filter)
      filter.connect(amp)
      amp.connect(out)
      osc.start(note.time)
      osc.stop(end + 0.05)
    },
  },
  electric: {
    name: 'Electric bass',
    reverb: 0.12,
    play: (ctx, out, note) => {
      const freq = midiToFreq(note.midi)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1200, note.time)
      filter.frequency.exponentialRampToValueAtTime(320, note.time + 0.4)
      filter.Q.value = 2
      const amp = ctx.createGain()
      const end = applyEnvelope(amp.gain, note.time, note.velocity * 0.34, {
        attack: 0.01,
        decay: 0.6,
        sustain: 0.42,
        release: 0.28,
      }, Math.min(note.duration, 1.6))
      ;[['sine', 0, freq], ['sawtooth', 0, freq], ['sine', 0, freq * 2]].forEach(([type, detune, frequency], index) => {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.setValueAtTime(frequency, note.time)
        osc.detune.setValueAtTime(detune, note.time)
        const mix = ctx.createGain()
        mix.gain.value = index === 0 ? 1 : index === 1 ? 0.35 : 0.12
        osc.connect(mix)
        mix.connect(filter)
        osc.start(note.time)
        osc.stop(end + 0.05)
      })
      filter.connect(amp)
      amp.connect(out)
    },
  },
  sub: {
    name: 'Sub bass',
    reverb: 0.1,
    play: (ctx, out, note) => {
      const freq = midiToFreq(note.midi)
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, note.time)
      const amp = ctx.createGain()
      const end = applyEnvelope(amp.gain, note.time, note.velocity * 0.42, {
        attack: 0.05,
        decay: 0.5,
        sustain: 0.7,
        release: 0.5,
      }, note.duration)
      osc.connect(amp)
      amp.connect(out)
      osc.start(note.time)
      osc.stop(end + 0.05)
    },
  },
}

// ------------------------------------------------------------------ drums ---

// One buffer of white noise per context, shared by the snare and the hats:
// filtering it differently is most of what separates the two.
const noiseCaches = new WeakMap()

function noiseBuffer(ctx) {
  const cached = noiseCaches.get(ctx)
  if (cached) return cached
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  noiseCaches.set(ctx, buffer)
  return buffer
}

function noiseVoice(ctx, out, note, { type, frequency, Q, peak, decay }) {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = Q
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(Math.max(0.0002, note.velocity * peak), note.time)
  amp.gain.exponentialRampToValueAtTime(0.0001, note.time + decay)
  source.connect(filter)
  filter.connect(amp)
  amp.connect(out)
  source.start(note.time)
  source.stop(note.time + decay + 0.02)
}

// The pitch falling away under the click is the whole trick to a synthesised
// kick: start it up near the beater and let it drop into the floor.
function kickVoice(ctx, out, note) {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(128, note.time)
  osc.frequency.exponentialRampToValueAtTime(44, note.time + 0.09)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(Math.max(0.0002, note.velocity * 0.9), note.time)
  amp.gain.exponentialRampToValueAtTime(0.0001, note.time + 0.34)
  osc.connect(amp)
  amp.connect(out)
  osc.start(note.time)
  osc.stop(note.time + 0.38)
  noiseVoice(ctx, out, note, { type: 'lowpass', frequency: 2600, Q: 0.7, peak: 0.12, decay: 0.02 })
}

// A snare is a tuned shell plus a lot of wires rattling: the triangle gives it
// a pitch, the noise gives it the snares.
function snareVoice(ctx, out, note) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(188, note.time)
  osc.frequency.exponentialRampToValueAtTime(140, note.time + 0.1)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(Math.max(0.0002, note.velocity * 0.22), note.time)
  amp.gain.exponentialRampToValueAtTime(0.0001, note.time + 0.13)
  osc.connect(amp)
  amp.connect(out)
  osc.start(note.time)
  osc.stop(note.time + 0.16)
  noiseVoice(ctx, out, note, {
    type: 'bandpass',
    frequency: 1750,
    Q: 0.6,
    peak: 0.5,
    decay: note.velocity < 0.3 ? 0.06 : 0.17,
  })
}

function hatVoice(ctx, out, note) {
  noiseVoice(ctx, out, note, {
    type: 'highpass',
    frequency: 8200,
    Q: 0.9,
    peak: 0.32,
    decay: note.open ? 0.24 : 0.045,
  })
}

export const DRUM_KIT = {
  reverb: 0.12,
  level: 0.5,
  play: (ctx, out, note) => {
    if (note.voice === 'kick') return kickVoice(ctx, out, note)
    if (note.voice === 'snare') return snareVoice(ctx, out, note)
    return hatVoice(ctx, out, note)
  },
}

// Kick on one and the and-of-three, backbeat on two and four, eighths on the
// hats: enough of a groove to hold the time without competing with the chords
// for attention. The variations are rolled once per arrangement, so a loop
// repeats exactly rather than wandering while the ear is trying to work.
function buildGroove(startBeat, totalBeats, beat) {
  const events = []
  // Offbeats sit a little late — straight eighths under this harmony sound
  // like a drum machine, and a full triplet swing fights the comping.
  const swing = beat * 0.05
  const hit = (position, voice, velocity, open) => {
    if (position >= totalBeats) return
    events.push({
      kind: 'drum',
      voice,
      open,
      // Clamped, so the jitter on the first hit can never push the groove in
      // front of the bar it is meant to be counting.
      time: Math.max(
        startBeat * beat,
        (startBeat + position) * beat + (position % 1 === 0 ? 0 : swing) + humanize(0.008),
      ),
      velocity: Math.max(0.1, velocity + humanize(0.07)),
    })
  }

  for (let bar = 0; bar * 4 < totalBeats; bar += 1) {
    const base = bar * 4
    const last = (bar + 1) * 4 >= totalBeats

    hit(base, 'kick', 0.95)
    hit(base + 2.5, 'kick', 0.82)
    if (Math.random() < 0.4) hit(base + 3.5, 'kick', 0.6)
    if (bar > 0 && Math.random() < 0.25) hit(base + 1.75, 'kick', 0.55)

    hit(base + 1, 'snare', 0.85)
    hit(base + 3, 'snare', 0.88)
    if (Math.random() < 0.5) hit(base + 2.75, 'snare', 0.22)
    if (Math.random() < 0.35) hit(base + 0.75, 'snare', 0.2)

    for (let eighth = 0; eighth < 8; eighth += 1) {
      const position = base + eighth * 0.5
      // Leave the hats open on the way back round, which is what tells the ear
      // the loop has come full circle.
      const open = last && eighth === 7
      hit(position, 'hat', eighth % 2 === 0 ? 0.42 : 0.28, open)
    }
  }

  return events
}

export const PATTERNS = [
  { id: 'block', name: 'Block chords' },
  { id: 'comp', name: 'Comping' },
  { id: 'arpeggio', name: 'Arpeggiated' },
  { id: 'roll', name: 'Ballad roll' },
]

function humanize(amount) {
  return (Math.random() - 0.5) * amount
}

// Turns a progression into a flat list of timed notes: chord voices with voice
// leading, plus a bass part that walks when the pattern calls for it.
export function buildArrangement({
  chords, key, tonic, tempo, beatsPerChord, pattern, playReference, drums,
}) {
  const beat = 60 / tempo
  const chordSeconds = beat * beatsPerChord
  const events = []
  // Which chord is sounding when, so the chart can follow the playback.
  const timeline = []
  let reference = null
  let cursor = 0
  let previousVoicing = null

  const rootPitches = chords.map((chord) => (key.pc + chord.root) % 12)
  const bassPitches = rootPitches.map((pc) => bassNote(pc))

  if (playReference) {
    // A quick tonic chord so the ear has a key centre before the question.
    reference = tonic === 'minor'
      ? { numeral: 'i', root: 0, quality: 'm9' }
      : { numeral: 'I', root: 0, quality: 'maj9' }
    const referenceSlot = chordSeconds
    const voicing = voiceChord(key.pc, reference.quality, null)
    voicing.forEach((midi, index) => {
      events.push({ kind: 'chord', midi, time: cursor + index * 0.02, duration: referenceSlot * 0.8, velocity: 0.62 })
    })
    events.push({ kind: 'bass', midi: bassNote(key.pc), time: cursor, duration: referenceSlot * 0.8, velocity: 0.6 })
    // Voice the first chord away from the reference rather than from nothing.
    previousVoicing = voicing
    timeline.push({ index: -1, start: cursor, end: cursor + referenceSlot })
    cursor += referenceSlot
  }

  // The groove comes in with the changes, not under the tonic reference: that
  // chord is there to be listened to, and it is also where the count would be.
  const grooveStart = cursor
  if (drums) {
    events.push(...buildGroove(grooveStart / beat, chords.length * beatsPerChord, beat))
  }

  chords.forEach((chord, chordIndex) => {
    const voicing = voiceChord(rootPitches[chordIndex], chord.quality, previousVoicing)
    previousVoicing = voicing
    const start = cursor
    timeline.push({ index: chordIndex, start, end: start + chordSeconds })
    const bassMidi = bassPitches[chordIndex]

    const pushChord = (time, duration, velocity, spread) => {
      voicing.forEach((midi, voice) => {
        events.push({
          kind: 'chord',
          midi,
          time: time + voice * spread + humanize(0.012),
          duration,
          velocity: Math.min(1, velocity + voice * 0.02 + humanize(0.06)),
        })
      })
    }

    if (pattern === 'block') {
      pushChord(start, chordSeconds * 0.92, 0.8, 0.014)
      events.push({ kind: 'bass', midi: bassMidi, time: start, duration: chordSeconds * 0.6, velocity: 0.85 })
      if (beatsPerChord >= 4) {
        events.push({
          kind: 'bass',
          midi: bassMidi,
          time: start + beat * 2,
          duration: chordSeconds * 0.4,
          velocity: 0.62,
        })
      }
    } else if (pattern === 'comp') {
      const hits = beatsPerChord >= 4 ? [0, 1.5, 3] : [0, 1.5]
      hits.forEach((offset, index) => {
        pushChord(start + offset * beat, beat * 1.3, index === 0 ? 0.82 : 0.66, 0.01)
      })
      for (let step = 0; step < beatsPerChord; step += 1) {
        events.push({
          kind: 'bass',
          midi: bassMidi,
          time: start + step * beat + humanize(0.014),
          duration: beat * 0.92,
          velocity: step === 0 ? 0.9 : 0.72,
        })
      }
    } else if (pattern === 'arpeggio') {
      const step = beat * 0.5
      const steps = Math.round(chordSeconds / step)
      for (let index = 0; index < steps; index += 1) {
        const midi = voicing[index % voicing.length] + (index >= voicing.length ? 12 : 0)
        events.push({
          kind: 'chord',
          midi: midi > 88 ? midi - 12 : midi,
          time: start + index * step + humanize(0.014),
          duration: chordSeconds - index * step + beat * 0.5,
          velocity: index === 0 ? 0.78 : 0.62 + humanize(0.08),
        })
      }
      events.push({ kind: 'bass', midi: bassMidi, time: start, duration: chordSeconds * 0.9, velocity: 0.86 })
      if (beatsPerChord >= 4) {
        events.push({
          kind: 'bass',
          midi: bassMidi,
          time: start + beat * 2,
          duration: beat * 0.9,
          velocity: 0.6,
        })
      }
    } else {
      pushChord(start, chordSeconds * 0.95, 0.76, 0.055)
      if (beatsPerChord >= 4) {
        pushChord(start + beat * 2, chordSeconds * 0.45, 0.58, 0.045)
      }
      events.push({ kind: 'bass', midi: bassMidi, time: start, duration: chordSeconds * 0.8, velocity: 0.82 })
    }

    cursor += chordSeconds
  })

  return { events, timeline, reference, loopLength: cursor, duration: cursor + 1.6 }
}

// `at` pins the phrase to an exact point on the audio clock, which is how a
// repeat lands in time instead of drifting by however long the timer took.
export function playArrangement(engine, arrangement, chordInstrument, bassInstrument, at) {
  const { ctx } = engine
  const startTime = Math.max(at ?? ctx.currentTime + 0.12, ctx.currentTime + 0.02)
  const chordBus = engine.createBus(chordInstrument.reverb)
  const bassBus = engine.createBus(bassInstrument.reverb)
  // Made on demand, so a question played without drums never builds the bus.
  let drumBus = null

  arrangement.events.forEach((event) => {
    const note = {
      midi: event.midi,
      time: startTime + Math.max(0, event.time),
      duration: event.duration,
      velocity: Math.max(0.15, Math.min(1, event.velocity)),
    }
    if (event.kind === 'drum') {
      if (!drumBus) drumBus = engine.createBus(DRUM_KIT.reverb, DRUM_KIT.level)
      DRUM_KIT.play(ctx, drumBus, { ...note, voice: event.voice, open: event.open })
    } else if (event.kind === 'bass') {
      bassInstrument.play(ctx, bassBus, note, engine)
    } else {
      chordInstrument.play(ctx, chordBus, note, engine)
    }
  })

  const tail = startTime - ctx.currentTime + arrangement.duration + 2
  engine.scheduleCleanup(chordBus, tail)
  engine.scheduleCleanup(bassBus, tail)
  if (drumBus) engine.scheduleCleanup(drumBus, tail)
  return { startTime, duration: arrangement.duration }
}
