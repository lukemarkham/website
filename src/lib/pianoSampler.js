// An acoustic piano for what's played on a MIDI keyboard: the Salamander
// Grand Piano (Alexander Holm, CC BY 3.0), sampled every minor third from C2
// to C7 in public/audio/piano. Notes between samples are the nearest one
// pitch-shifted, which is at most a semitone and a half and inaudible as such.

const SAMPLE_LETTERS = [['C', 0], ['Ds', 3], ['Fs', 6], ['A', 9]]
const SAMPLES = [
  ...[2, 3, 4, 5, 6].flatMap((octave) => SAMPLE_LETTERS.map(([letter, offset]) => ({
    file: `${letter}${octave}`,
    midi: (octave + 1) * 12 + offset,
  }))),
  { file: 'C7', midi: 96 },
]
const RELEASE_SECONDS = 0.35

// Samples decode against an audio context, so loading waits for one.
export function createPianoSampler(ctx, destination = ctx.destination) {
  const buffers = new Map()
  let loading = null

  function load() {
    loading ??= Promise.all(SAMPLES.map(async (sample) => {
      const response = await fetch(`/audio/piano/${sample.file}.mp3`)
      if (!response.ok) throw new Error(`${sample.file}: ${response.status}`)
      buffers.set(sample.midi, await ctx.decodeAudioData(await response.arrayBuffer()))
    })).then(() => true, () => false)
    return loading
  }

  function nearest(midi) {
    return SAMPLES.reduce((best, sample) => (Math.abs(sample.midi - midi) < Math.abs(best.midi - midi) ? sample : best))
  }

  return {
    load,
    get isReady() {
      return buffers.size === SAMPLES.length
    },

    // Returns a voice with release(), or null while the samples aren't in.
    play(midi, velocity) {
      const sample = nearest(midi)
      const buffer = buffers.get(sample.midi)
      if (!buffer) return null

      const time = ctx.currentTime
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = 2 ** ((midi - sample.midi) / 12)
      const amp = ctx.createGain()
      // Soft playing is quieter and a little darker on a real piano; the
      // level alone gets most of the way there.
      amp.gain.value = 0.12 + velocity ** 1.6 * 0.75
      source.connect(amp)
      amp.connect(destination)
      source.start(time)

      let released = false
      return {
        release() {
          if (released) return
          released = true
          const now = ctx.currentTime
          amp.gain.cancelScheduledValues(now)
          amp.gain.setValueAtTime(amp.gain.value, now)
          amp.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE_SECONDS)
          source.stop(now + RELEASE_SECONDS + 0.05)
        },
      }
    },
  }
}
