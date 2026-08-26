// A small Web Audio instrument rack for the progression trainer. Everything is
// synthesised at runtime — no samples to ship — but each patch is built from
// the parts that make the real thing recognisable: FM bell attacks for the
// electric pianos, a plucked string model for the guitars, additive drawbars
// and a Leslie for the organ, fixed formants for the choir, and a generated
// convolution reverb so the chords sit in a room instead of in a browser.
//
// Five engines carry the whole rack, and most of the character is in their
// arguments rather than in the code: fmVoice for anything struck or bell-like,
// analogVoice for anything with a filter and a bank of detuned oscillators,
// pluckVoice for strings, organVoice and formantVoice for the two sounds that
// are built from fixed partials rather than from a filter sweep.

import { bassNote, midiToFreq, triadVoicing, voiceProgression } from './harmony'

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

// A mallet, a pick or a hammer makes a noise before the note does, and it is
// most of what tells one struck thing from another. A short filtered burst in
// front of the tone buys more character than any amount of tuning the tone.
function strike(ctx, out, note, { frequency, Q = 1.2, level, decay = 0.045 }) {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = frequency
  band.Q.value = Q
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(Math.max(0.0002, note.velocity * level), note.time)
  amp.gain.exponentialRampToValueAtTime(0.0001, note.time + decay)
  source.connect(band)
  band.connect(amp)
  amp.connect(out)
  source.start(note.time)
  source.stop(note.time + decay + 0.02)
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

  if (config.strike) strike(ctx, out, note, config.strike)
}

// Subtractive: a few detuned oscillators through one filter. What separates a
// pad from a brass stab from an accordion is how fast the envelope gets going
// and where the filter goes while it does, so those are arguments rather than
// built in. The defaults are the warm pad, which is what this started as.
const ANALOG_DEFAULTS = {
  type: 'sawtooth',
  detunes: [-9, 0, 8],
  level: 0.12,
  filterStart: 420,
  filterPeak: 1500,
  filterPeakAt: 0.5,
  filterEnd: 700,
  filterQ: 1.1,
  velocityToFilter: 900,
  attack: 0.32,
  decay: 0.4,
  sustain: 0.85,
  release: 0.9,
  vibratoRate: 5,
  vibratoDepth: 0,
}

function analogVoice(ctx, out, note, config) {
  const settings = { ...ANALOG_DEFAULTS, ...config }
  const freq = midiToFreq(note.midi)
  const amp = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = settings.filterQ
  filter.frequency.setValueAtTime(settings.filterStart, note.time)
  const peakAt = note.time + settings.filterPeakAt
  filter.frequency.exponentialRampToValueAtTime(
    settings.filterPeak + note.velocity * settings.velocityToFilter,
    peakAt,
  )
  // A short chord can be over before the filter has finished opening, and a
  // ramp that ends before the one in front of it started runs backwards.
  filter.frequency.exponentialRampToValueAtTime(
    settings.filterEnd,
    Math.max(peakAt + 0.05, note.time + note.duration + 0.6),
  )

  const end = applyEnvelope(
    amp.gain, note.time, note.velocity * settings.level, settings, note.duration,
  )

  // One vibrato shared by every oscillator, so the voice moves as a whole
  // rather than each detuned copy wandering off on its own.
  let vibrato = null
  if (settings.vibratoDepth > 0) {
    vibrato = ctx.createGain()
    vibrato.gain.value = settings.vibratoDepth
    const lfo = ctx.createOscillator()
    lfo.frequency.value = settings.vibratoRate
    lfo.connect(vibrato)
    lfo.start(note.time)
    lfo.stop(end + 0.05)
  }

  settings.detunes.forEach((detune) => {
    const osc = ctx.createOscillator()
    osc.type = settings.type
    osc.frequency.setValueAtTime(freq, note.time)
    osc.detune.setValueAtTime(detune, note.time)
    if (vibrato) vibrato.connect(osc.detune)
    osc.connect(filter)
    osc.start(note.time)
    osc.stop(end + 0.05)
  })

  filter.connect(amp)
  amp.connect(out)
}

// Nine drawbars is the real thing and six is enough to be recognisable. Each is
// a sine at a fixed multiple of the note, which is the whole of how a tonewheel
// organ makes its sound: no filter, no envelope beyond on and off.
const DRAWBARS = [
  { ratio: 0.5, gain: 0.34 },
  { ratio: 1, gain: 1 },
  { ratio: 2, gain: 0.62 },
  { ratio: 3, gain: 0.3 },
  { ratio: 4, gain: 0.32 },
  { ratio: 8, gain: 0.14 },
]

function organVoice(ctx, out, note, config) {
  const freq = midiToFreq(note.midi)
  const amp = ctx.createGain()
  // An organ key is a switch: the sound is at full the moment the contact
  // closes and gone the moment it opens.
  const end = applyEnvelope(amp.gain, note.time, note.velocity * config.level, {
    attack: 0.008,
    decay: 0.05,
    sustain: 0.95,
    release: 0.07,
  }, note.duration)

  // The Leslie. The horn swinging towards you and away again is a small rise
  // and fall in level and in pitch, the two moving together off one LFO.
  const leslie = ctx.createGain()
  leslie.gain.value = 1
  const lfo = ctx.createOscillator()
  lfo.frequency.value = config.leslieRate
  const levelDepth = ctx.createGain()
  levelDepth.gain.value = 0.13
  lfo.connect(levelDepth)
  levelDepth.connect(leslie.gain)
  const pitchDepth = ctx.createGain()
  pitchDepth.gain.value = 6
  lfo.connect(pitchDepth)
  lfo.start(note.time)
  lfo.stop(end + 0.05)

  DRAWBARS.forEach((bar) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * bar.ratio, note.time)
    pitchDepth.connect(osc.detune)
    const mix = ctx.createGain()
    mix.gain.value = bar.gain
    osc.connect(mix)
    mix.connect(amp)
    osc.start(note.time)
    osc.stop(end + 0.05)
  })

  // Percussion: one high partial that dies away over the first beat. It is
  // what makes a drawbar organ speak rather than simply appear.
  const perc = ctx.createOscillator()
  perc.type = 'sine'
  perc.frequency.setValueAtTime(freq * 4, note.time)
  const percAmp = ctx.createGain()
  percAmp.gain.setValueAtTime(Math.max(0.0002, note.velocity * config.level * 0.7), note.time)
  percAmp.gain.exponentialRampToValueAtTime(0.0001, note.time + 0.22)
  perc.connect(percAmp)
  percAmp.connect(amp)
  perc.start(note.time)
  perc.stop(note.time + 0.25)

  amp.connect(leslie)
  leslie.connect(out)
}

// A vowel is two or three resonances sitting in a fixed place, which is why a
// choir is a bright source through bandpass filters rather than a filter
// sweep: the peaks stay put while the pitch moves about underneath them.
const FORMANTS = {
  ah: [[800, 1], [1150, 0.5], [2800, 0.28]],
  oo: [[320, 1], [800, 0.35], [2500, 0.12]],
}

function formantVoice(ctx, out, note, config) {
  const freq = midiToFreq(note.midi)
  const amp = ctx.createGain()
  const end = applyEnvelope(
    amp.gain, note.time, note.velocity * config.level, config, note.duration,
  )

  const vibrato = ctx.createGain()
  vibrato.gain.value = config.vibratoDepth
  const lfo = ctx.createOscillator()
  lfo.frequency.value = config.vibratoRate
  lfo.connect(vibrato)
  lfo.start(note.time)
  lfo.stop(end + 0.05)

  // Two voices a few cents apart, because nobody sings a unison in tune.
  const source = ctx.createGain()
  ;[-7, 5].forEach((detune) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, note.time)
    osc.detune.setValueAtTime(detune, note.time)
    vibrato.connect(osc.detune)
    osc.connect(source)
    osc.start(note.time)
    osc.stop(end + 0.05)
  })

  // Breath through the same formants. Without it this is a filtered sawtooth
  // and sounds like one.
  const breath = ctx.createBufferSource()
  breath.buffer = noiseBuffer(ctx)
  breath.loop = true
  const breathLevel = ctx.createGain()
  breathLevel.gain.value = 0.05
  breath.connect(breathLevel)
  breathLevel.connect(source)
  breath.start(note.time)
  breath.stop(end + 0.05)

  FORMANTS[config.vowel].forEach(([frequency, gain]) => {
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = frequency
    band.Q.value = 6.5
    const mix = ctx.createGain()
    mix.gain.value = gain
    source.connect(band)
    band.connect(mix)
    mix.connect(amp)
  })

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

  // The two-tap damping average is itself a delay of `damping` samples, so the
  // string is that much shorter than it looks and the delay line has to be
  // tuned with a fractional read. Rounding to whole samples, or assuming the
  // half-sample a symmetric average would give, runs the top of a heavily
  // damped patch several cents sharp.
  const delay = Math.max(2, ctx.sampleRate / midiToFreq(midi) - config.damping)
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

// tanh, normalised so the loudest input still comes out at one. An amplifier
// working hard rounds the peaks off rather than clipping them square, and it
// is the rounding that reads as a guitar amp rather than as a fault.
const driveCurves = new Map()

function driveCurve(amount) {
  const cached = driveCurves.get(amount)
  if (cached) return cached
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i * 2) / (curve.length - 1) - 1
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount)
  }
  driveCurves.set(amount, curve)
  return curve
}

function pluckVoice(ctx, out, note, config) {
  const body = ctx.createBiquadFilter()
  body.type = 'bandpass'
  body.frequency.value = config.body
  body.Q.value = 0.5

  const amp = ctx.createGain()
  amp.gain.setValueAtTime(note.velocity * config.level, note.time)
  // Damp the string when the chord is short, let it ring when it is not.
  const ring = Math.min(note.duration + 0.5, config.seconds)
  amp.gain.setTargetAtTime(0.0001, note.time + ring, 0.12)

  // A twelve-string is two courses a hair apart on every note, and the beating
  // between them is the whole sound. One string is the ordinary case.
  const strings = config.strings ?? 1
  for (let index = 0; index < strings; index += 1) {
    const source = ctx.createBufferSource()
    source.buffer = pluckBuffer(ctx, note.midi, config)
    // Detuning the playback rate detunes the string, which is exactly what a
    // course slightly out with itself is.
    if (index > 0) source.detune.value = config.spread ?? 7
    source.connect(body)
    // The pick crosses the courses one after the other, not all at once.
    const offset = index * 0.007
    source.start(note.time + offset)
    source.stop(note.time + offset + config.seconds)
  }

  if (config.drive) {
    const shaper = ctx.createWaveShaper()
    shaper.curve = driveCurve(config.drive)
    shaper.oversample = '2x'
    body.connect(shaper)
    shaper.connect(amp)
  } else {
    body.connect(amp)
  }
  amp.connect(out)

  if (config.strike) strike(ctx, out, note, config.strike)
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
    gm: 4,
    name: 'Rhodes',
    reverb: 0.3,
    bass: ['electric', 'picked'],
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
    gm: 5,
    name: 'Wurlitzer',
    reverb: 0.26,
    bass: ['electric', 'picked'],
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
    gm: 11,
    name: 'Vibraphone',
    reverb: 0.42,
    bass: ['upright', 'fretless'],
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
    gm: 89,
    name: 'Warm pad',
    reverb: 0.46,
    bass: ['sub', 'fretless'],
    play: (ctx, out, note) => analogVoice(ctx, out, note, {}),
  },
  {
    id: 'strings',
    gm: 48,
    name: 'Bowed strings',
    reverb: 0.5,
    bass: ['upright', 'sub'],
    play: (ctx, out, note) => analogVoice(ctx, out, note, {
      detunes: [-11, -4, 3, 10],
      level: 0.075,
      filterStart: 500,
      filterPeak: 2300,
      filterPeakAt: 0.35,
      filterEnd: 900,
      filterQ: 0.8,
      velocityToFilter: 1100,
      attack: 0.16,
      decay: 0.45,
      sustain: 0.88,
      release: 0.55,
      vibratoRate: 5.6,
      vibratoDepth: 7,
    }),
  },
  {
    id: 'brass',
    gm: 62,
    name: 'Synth brass',
    reverb: 0.24,
    bass: ['sub', 'picked'],
    play: (ctx, out, note) => analogVoice(ctx, out, note, {
      detunes: [-6, 0, 7],
      level: 0.1,
      // Brass is the filter opening fast and then backing straight off again:
      // the bite is at the front and the note settles behind it.
      filterStart: 600,
      filterPeak: 2600,
      filterPeakAt: 0.07,
      filterEnd: 1000,
      filterQ: 3.4,
      velocityToFilter: 1600,
      attack: 0.035,
      decay: 0.28,
      sustain: 0.6,
      release: 0.22,
    }),
  },
  {
    id: 'accordion',
    gm: 21,
    name: 'Accordion',
    reverb: 0.2,
    bass: ['upright', 'sub'],
    // Two reed banks a little out with each other, no filter movement at all:
    // the bellows hold a steady pressure and the reeds do the rest.
    play: (ctx, out, note) => analogVoice(ctx, out, note, {
      type: 'square',
      detunes: [-13, 0, 12],
      level: 0.07,
      filterStart: 1400,
      filterPeak: 1800,
      filterPeakAt: 0.05,
      filterEnd: 1500,
      filterQ: 0.7,
      velocityToFilter: 500,
      attack: 0.055,
      decay: 0.2,
      sustain: 0.92,
      release: 0.14,
      vibratoRate: 6.4,
      vibratoDepth: 4,
    }),
  },
  {
    id: 'organ',
    gm: 16,
    name: 'Drawbar organ',
    reverb: 0.22,
    bass: ['sub', 'electric'],
    play: (ctx, out, note) => organVoice(ctx, out, note, { level: 0.12, leslieRate: 5.9 }),
  },
  {
    id: 'choir',
    gm: 52,
    name: 'Choir',
    reverb: 0.54,
    bass: ['upright', 'sub'],
    play: (ctx, out, note) => formantVoice(ctx, out, note, {
      vowel: 'ah',
      level: 0.5,
      attack: 0.2,
      decay: 0.4,
      sustain: 0.82,
      release: 0.7,
      vibratoRate: 5.2,
      vibratoDepth: 9,
    }),
  },
  {
    id: 'marimba',
    gm: 12,
    name: 'Marimba',
    reverb: 0.3,
    bass: ['upright', 'picked'],
    play: (ctx, out, note) => fmVoice(ctx, out, note, {
      // A wooden bar's overtone is a fourth above two octaves, which is what
      // the ratio of three is doing here — bright, but not a bell.
      ratio: 3,
      index: 1.6,
      indexEnd: 0.04,
      indexDecay: 0.1,
      cutoff: 4200,
      level: 0.2,
      attack: 0.003,
      decay: 0.5,
      sustain: 0.06,
      release: 0.3,
      strike: { frequency: 2400, Q: 0.8, level: 0.1, decay: 0.03 },
    }),
  },
  {
    id: 'musicbox',
    gm: 10,
    name: 'Music box',
    reverb: 0.46,
    bass: ['sub', 'fretless'],
    play: (ctx, out, note) => fmVoice(ctx, out, note, {
      // An inharmonic ratio is what makes a struck metal tine ring rather than
      // sing: the partials do not line up with anything.
      ratio: 3.51,
      index: 1.9,
      indexEnd: 0.03,
      indexDecay: 0.09,
      cutoff: 6200,
      level: 0.14,
      attack: 0.002,
      decay: 1.1,
      sustain: 0.1,
      release: 0.9,
      strike: { frequency: 5200, Q: 1.6, level: 0.06, decay: 0.02 },
    }),
  },
  {
    id: 'nylon',
    gm: 24,
    name: 'Nylon guitar',
    reverb: 0.3,
    bass: ['upright', 'fretless'],
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
    id: 'twelve',
    gm: 25,
    name: '12-string',
    reverb: 0.36,
    bass: ['picked', 'electric'],
    play: (ctx, out, note) => pluckVoice(ctx, out, note, {
      // The buffer is cached per id and pitch, so the two courses share one
      // string and are pulled apart by playback rate rather than by rendering
      // the whole model twice.
      id: 'twelve',
      seconds: 2.6,
      decay: 0.9968,
      damping: 0.36,
      pickTone: 0.72,
      body: 1300,
      level: 0.3,
      strings: 2,
      spread: 9,
      strike: { frequency: 3200, Q: 0.9, level: 0.05, decay: 0.02 },
    }),
  },
  {
    id: 'muted',
    gm: 28,
    name: 'Muted electric',
    reverb: 0.16,
    bass: ['electric', 'picked'],
    play: (ctx, out, note) => pluckVoice(ctx, out, note, {
      // Heavy damping is the palm on the strings; the drive after it is the
      // amp, which is the other half of why a muted guitar sounds close.
      id: 'muted',
      seconds: 0.9,
      decay: 0.988,
      damping: 0.82,
      pickTone: 0.8,
      body: 1100,
      level: 0.5,
      drive: 2.6,
    }),
  },
  {
    id: 'harp',
    gm: 46,
    name: 'Bell harp',
    reverb: 0.5,
    bass: ['sub', 'fretless'],
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
    gm: 7,
    name: 'Clav',
    reverb: 0.22,
    bass: ['electric', 'picked'],
    play: (ctx, out, note) => clavVoice(ctx, out, note),
  },
]

// The key centre is not one of the voices on offer: it is always the same stock
// piano, so the sound of the reference never matches the sound of the chords
// and gives away a chord that happens to be the tonic.
export const REFERENCE_INSTRUMENT = {
  id: 'piano',
  gm: 0,
  name: 'Piano',
  reverb: 0.2,
  play: (ctx, out, note) => fmVoice(ctx, out, note, {
    ratio: 1,
    index: 3.2,
    indexEnd: 0.08,
    indexDecay: 0.16,
    cutoff: 4200,
    level: 0.22,
    attack: 0.003,
    decay: 1.6,
    sustain: 0.12,
    release: 0.7,
  }),
}

export const BASS_INSTRUMENTS = {
  upright: {
    gm: 32,
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
    gm: 33,
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
  picked: {
    gm: 34,
    name: 'Picked bass',
    reverb: 0.1,
    play: (ctx, out, note) => {
      const freq = midiToFreq(note.midi)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      // Brighter and shorter than the fingered electric: a pick leaves the
      // top of the note in and the string does not get long to settle.
      filter.frequency.setValueAtTime(2600, note.time)
      filter.frequency.exponentialRampToValueAtTime(520, note.time + 0.3)
      filter.Q.value = 3.4
      const amp = ctx.createGain()
      const end = applyEnvelope(amp.gain, note.time, note.velocity * 0.3, {
        attack: 0.004,
        decay: 0.35,
        sustain: 0.3,
        release: 0.2,
      }, Math.min(note.duration, 1.2))
      ;[['sawtooth', 1], ['square', 0.3]].forEach(([type, gain]) => {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.setValueAtTime(freq, note.time)
        const mix = ctx.createGain()
        mix.gain.value = gain
        osc.connect(mix)
        mix.connect(filter)
        osc.start(note.time)
        osc.stop(end + 0.05)
      })
      filter.connect(amp)
      amp.connect(out)
      // The pick itself, which is the half of the sound that is not the string.
      strike(ctx, out, note, { frequency: 2200, Q: 1.1, level: 0.05, decay: 0.02 })
    },
  },
  fretless: {
    gm: 35,
    name: 'Fretless bass',
    reverb: 0.2,
    play: (ctx, out, note) => {
      const freq = midiToFreq(note.midi)
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      // No fret to stop the string, so the finger arrives at the pitch rather
      // than landing on it. A small scoop is all it takes to hear that.
      osc.frequency.setValueAtTime(freq * 0.975, note.time)
      osc.frequency.exponentialRampToValueAtTime(freq, note.time + 0.11)
      const growl = ctx.createOscillator()
      growl.type = 'sawtooth'
      growl.frequency.setValueAtTime(freq, note.time)
      const growlMix = ctx.createGain()
      growlMix.gain.value = 0.22
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1400, note.time)
      filter.frequency.exponentialRampToValueAtTime(420, note.time + 0.7)
      filter.Q.value = 1.6
      const amp = ctx.createGain()
      const end = applyEnvelope(amp.gain, note.time, note.velocity * 0.36, {
        attack: 0.02,
        decay: 0.7,
        sustain: 0.5,
        release: 0.4,
      }, Math.min(note.duration, 1.8))
      osc.connect(filter)
      growl.connect(growlMix)
      growlMix.connect(filter)
      filter.connect(amp)
      amp.connect(out)
      osc.start(note.time)
      growl.start(note.time)
      osc.stop(end + 0.05)
      growl.stop(end + 0.05)
    },
  },
  sub: {
    gm: 38,
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

  const rootPitches = chords.map((chord) => (key.pc + chord.root) % 12)
  const bassPitches = rootPitches.map((pc) => bassNote(pc))
  // Settled as a cycle, so the last chord leads back into the first.
  const voicings = voiceProgression(rootPitches, chords)

  if (playReference) {
    // A plain triad on the tonic so the ear has a key centre before the
    // question. It carries no extension and no shade: an extended tonic in the
    // instrument the chords are played on hands over the answer whenever the
    // missing chord is the one the reference just sounded.
    reference = tonic === 'minor'
      ? { numeral: 'i', root: 0, quality: 'min' }
      : { numeral: 'I', root: 0, quality: 'maj' }
    const referenceSlot = chordSeconds
    triadVoicing(key.pc, tonic).forEach((midi, index) => {
      events.push({
        kind: 'chord',
        instrument: 'reference',
        midi,
        time: cursor + index * 0.02,
        duration: referenceSlot * 0.8,
        velocity: 0.62,
      })
    })
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
    const voicing = voicings[chordIndex]
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
  // Likewise the key centre, which only the first pass of a question has.
  let referenceBus = null

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
    } else if (event.instrument === 'reference') {
      if (!referenceBus) referenceBus = engine.createBus(REFERENCE_INSTRUMENT.reverb)
      REFERENCE_INSTRUMENT.play(ctx, referenceBus, note, engine)
    } else {
      chordInstrument.play(ctx, chordBus, note, engine)
    }
  })

  const tail = startTime - ctx.currentTime + arrangement.duration + 2
  engine.scheduleCleanup(chordBus, tail)
  engine.scheduleCleanup(bassBus, tail)
  if (drumBus) engine.scheduleCleanup(drumBus, tail)
  if (referenceBus) engine.scheduleCleanup(referenceBus, tail)
  return { startTime, duration: arrangement.duration }
}
