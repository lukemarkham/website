// The 40 PAS International Drum Rudiments for the Rudiments tool, written out
// note for note from the PAS sheet (pas.org/rudiments), which has no time
// signature, so neither do they. Stickings take the Sticking Generator's form:
// lR a flam, llR a drag, > an accent.
//
// Each group is one beamed figure, as a string of notes. A note is
// `duration:sticking`, and a bare sticking takes the duration before it:
//   duration  32, 16, 8, q or h; a dot after it dots the note
//   /2        slashes through the stem (/z a buzz)
//   ~         tied to the next note
//   #5        the roll's stroke count over the note
//   _         no sticking under the note
//   8r        a rest
//   [3 ...]   a tuplet, [3 ...] over two or [6 ...] over four
//   |         a break in the second beam
// `bothLeads` is the sheet's second row of sticking, the same again from the
// other hand.

export const RUDIMENT_FAMILIES = ['Rolls', 'Diddles', 'Flams', 'Drags']

export const RUDIMENTS = [
  { number: 1, name: 'Single Stroke Roll', family: 'Rolls', groups: ['32:R L R L', '32:R L R L'] },
  { number: 2, name: 'Single Stroke Four', family: 'Rolls', groups: ['[3 16:R L R] 8:L', '[3 16:R L R] 8:L'], bothLeads: true },
  { number: 3, name: 'Single Stroke Seven', family: 'Rolls', groups: ['[6 16:R L R L R L] q:R'], bothLeads: true },
  { number: 4, name: 'Multiple Bounce Roll', family: 'Rolls', groups: ['h/z:_'] },
  { number: 5, name: 'Triple Stroke Roll', family: 'Rolls', groups: ['[3 16:R R R] [3 16:L L L]', '[3 16:R R R] [3 16:L L L]'] },
  { number: 6, name: 'Double Stroke Open Roll', family: 'Rolls', groups: ['h/3:RRLLRRLL'] },
  { number: 7, name: 'Five Stroke Roll', family: 'Rolls', groups: ['8/2~#5:R 8:R>', '8/2~#5:L 8:L>'] },
  { number: 8, name: 'Six Stroke Roll', family: 'Rolls', groups: ['16:R> 8/2~#6:_ 16:L>', '16:R> 8/2~#6:_ 16:L>'], bothLeads: true },
  { number: 9, name: 'Seven Stroke Roll', family: 'Rolls', groups: ['8./2~#7:R 16:L>', '8./2~#7:R 16:L>'], bothLeads: true },
  { number: 10, name: 'Nine Stroke Roll', family: 'Rolls', groups: ['q/3~#9:R', 'q:R>', 'q/3~#9:L', 'q:L>'] },
  { number: 11, name: 'Ten Stroke Roll', family: 'Rolls', groups: ['q/3~#10:R', '16:R> L> 8r', 'q/3~#10:R', '16:R> L> 8r'], bothLeads: true },
  { number: 12, name: 'Eleven Stroke Roll', family: 'Rolls', groups: ['q/3~#11:R', '16/1:R 16:L> 8r', 'q/3~#11:R', '16/1:R 16:L> 8r'], bothLeads: true },
  { number: 13, name: 'Thirteen Stroke Roll', family: 'Rolls', groups: ['q/3~#13:R', '8/2~:_ 8:R>', 'q/3~#13:L', '8/2~:_ 8:L>'] },
  { number: 14, name: 'Fifteen Stroke Roll', family: 'Rolls', groups: ['q/3~#15:R', '8./2~:_ 16:L>', 'q/3~#15:R', '8./2~:_ 16:L>'], bothLeads: true },
  { number: 15, name: 'Seventeen Stroke Roll', family: 'Rolls', groups: ['h/3~#17:R', 'q:R>', 'h/3~#17:L', 'q:L>'] },

  { number: 16, name: 'Single Paradiddle', family: 'Diddles', groups: ['16:R> L R R', '16:L> R L L'] },
  { number: 17, name: 'Double Paradiddle', family: 'Diddles', groups: ['16:R> L R L R R', '16:L> R L R L L'] },
  { number: 18, name: 'Triple Paradiddle', family: 'Diddles', groups: ['16:R> L R L | R L R R', '16:L> R L R | L R L L'] },
  { number: 19, name: 'Single Paradiddle-Diddle', family: 'Diddles', groups: ['16:R> L R R L L', '16:R> L R R L L'], bothLeads: true },

  { number: 20, name: 'Flam', family: 'Flams', groups: ['q:lR', 'q:rL'] },
  { number: 21, name: 'Flam Accent', family: 'Flams', groups: ['8:lR> L R', '8:rL> R L'] },
  { number: 22, name: 'Flam Tap', family: 'Flams', groups: ['16:lR> R rL> L', '16:lR> R rL> L'] },
  { number: 23, name: 'Flamacue', family: 'Flams', groups: ['16:lR L> R L', 'q:lR'], bothLeads: true },
  { number: 24, name: 'Flam Paradiddle', family: 'Flams', groups: ['16:lR> L R R', '16:rL> R L L'] },
  { number: 25, name: 'Single Flammed Mill', family: 'Flams', groups: ['16:lR> R L R', '16:rL> L R L'] },
  { number: 26, name: 'Flam Paradiddle-Diddle', family: 'Flams', groups: ['16:lR> L R R L L', '16:rL> R L L R R'] },
  { number: 27, name: 'Pataflafla', family: 'Flams', groups: ['16:lR> L R rL>', '16:lR> L R rL>'] },
  { number: 28, name: 'Swiss Army Triplet', family: 'Flams', groups: ['[3 16:lR> R L]', '[3 16:lR> R L]'], bothLeads: true },
  { number: 29, name: 'Inverted Flam Tap', family: 'Flams', groups: ['16:lR> L rL> R', '16:lR> L rL> R'] },
  { number: 30, name: 'Flam Drag', family: 'Flams', groups: ['8:lR> 16:L L 8:R', '8:rL> 16:R R 8:L'] },

  { number: 31, name: 'Drag', family: 'Drags', groups: ['q:llR', 'q:rrL'] },
  { number: 32, name: 'Single Drag Tap', family: 'Drags', groups: ['8:llR L>', '8:rrL R>'] },
  { number: 33, name: 'Double Drag Tap', family: 'Drags', groups: ['8:llR llR L>', '8:rrL rrL R>'] },
  { number: 34, name: 'Lesson 25', family: 'Drags', groups: ['16:llR L 8:R>', '16:llR L 8:R>'], bothLeads: true },
  { number: 35, name: 'Single Dragadiddle', family: 'Drags', groups: ['16/1:RR> 16:L R R', '16/1:LL> 16:R L L'] },
  { number: 36, name: 'Drag Paradiddle #1', family: 'Drags', groups: ['8:R> 16:llR L R R', '8:L> 16:rrL R L L'] },
  { number: 37, name: 'Drag Paradiddle #2', family: 'Drags', groups: ['8:R> llR', '16:llR L R R', '8:L> rrL', '16:rrL R L L'] },
  { number: 38, name: 'Single Ratamacue', family: 'Drags', groups: ['[3 16:llR L R] 8:L>', '[3 16:rrL R L] 8:R>'] },
  { number: 39, name: 'Double Ratamacue', family: 'Drags', groups: ['8:llR [3 16:llR L R] 8:L>', '8:rrL [3 16:rrL R L] 8:R>'] },
  { number: 40, name: 'Triple Ratamacue', family: 'Drags', groups: ['8:llR llR', '[3 16:llR L R] 8:L>', '8:rrL rrL', '[3 16:rrL R L] 8:R>'] },
]

export const RUDIMENT_NUMBERS = RUDIMENTS.map((rudiment) => rudiment.number)

const NOTE = /^(32|16|8|q|h)?(\.)?(r)?(?:\/([z\d]))?(~)?(?:#(\d+))?$/

// A group's string as notes and its marks: { notes, tuplets: [{ first, count,
// value }], breaks: [index] }, with `first` and `breaks` counting from the
// group's first note.
export function parseGroup(group) {
  const notes = []
  const tuplets = []
  const breaks = []
  let duration = null
  let tuplet = null

  group.split(' ').forEach((raw) => {
    let token = raw
    if (token === '|') {
      breaks.push(notes.length)
      return
    }
    if (token.startsWith('[')) {
      tuplet = { first: notes.length, count: 0, value: Number(token.slice(1)) }
      return
    }
    const closes = token.endsWith(']')
    if (closes) token = token.slice(0, -1)

    const [head, stroke] = token.includes(':') ? token.split(':') : [null, token]
    const isRest = /^(32|16|8|q|h)r$/.test(stroke ?? '')
    const match = NOTE.exec(isRest ? stroke : head ?? '')
    duration = match[1] ?? duration
    const accent = !isRest && stroke.endsWith('>')
    const name = isRest || stroke === '_' ? '' : stroke.replace('>', '')
    notes.push({
      duration,
      dotted: Boolean(match[2]),
      rest: isRest,
      slashes: match[4] === 'z' ? 'z' : Number(match[4] ?? 0),
      tied: Boolean(match[5]),
      strokes: match[6] ? Number(match[6]) : null,
      accent,
      grace: /^[lr]{1,2}[RL]$/.test(name) ? name.slice(0, -1) : '',
      hand: /^[lr]{1,2}[RL]$/.test(name) ? name.slice(-1) : name,
    })

    if (tuplet) tuplet.count += 1
    if (closes) {
      tuplets.push(tuplet)
      tuplet = null
    }
  })

  return { notes, tuplets, breaks }
}

export function pickRudiment(pool, current) {
  const others = pool.filter((number) => number !== current)
  const choices = others.length > 0 ? others : pool
  const number = choices[Math.floor(Math.random() * choices.length)]
  return RUDIMENTS.find((rudiment) => rudiment.number === number)
}
