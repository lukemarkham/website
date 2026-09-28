// Hands-only stickings for the Sticking Generator: a cycle of one, two or
// four beats, chained from rudiment cells and repeated to fill a 4/4 bar.
// Each cell is written right-hand lead; the left-lead mirror is added
// automatically.

const CELLS = [
  { pattern: 'R', name: 'Single stroke', weight: 1 },
  { pattern: 'RL', name: 'Single strokes', weight: 3 },
  { pattern: 'RRLL', name: 'Double strokes', weight: 2 },
  { pattern: 'RLRR', name: 'Paradiddle', weight: 3 },
  { pattern: 'RLLR', name: 'Inverted paradiddle', weight: 1 },
  { pattern: 'RRLR', name: 'Reverse paradiddle', weight: 1 },
  { pattern: 'RLRLRR', name: 'Double paradiddle', weight: 2 },
  { pattern: 'RLRLRLRR', name: 'Triple paradiddle', weight: 1 },
  { pattern: 'RLRRLL', name: 'Paradiddle-diddle', weight: 2 },
  { pattern: 'RLLRRL', name: 'Six-stroke roll', weight: 1 },
  { pattern: 'RRLLR', name: 'Five-stroke roll', weight: 1 },
  { pattern: 'RLL', name: 'Single and a double', weight: 2 },
  { pattern: 'RRL', name: 'Double and a single', weight: 1 },
  { pattern: 'RLRLL', name: 'Singles into a double', weight: 1 },
].flatMap((cell) => {
  const mirror = cell.pattern.replace(/[RL]/g, (hand) => (hand === 'R' ? 'L' : 'R'))
  const cells = [{ ...cell, strokes: cell.pattern.split('') }]
  if (mirror !== cell.pattern) cells.push({ ...cell, pattern: mirror, strokes: mirror.split('') })
  return cells
})

export const HAND_RATES = [
  { id: 'sixteenth', label: '16ths', notesPerBeat: 4 },
  { id: 'triplet', label: 'Triplets', notesPerBeat: 3 },
]

// Only lengths that divide the bar, so the cycle repeats cleanly inside it.
export const HAND_CYCLE_BEATS = [1, 2, 4]

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= item.weight
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

// The cycle repeats, so no hand plays three in a row either inside it or
// across the join back to its start.
export function isPlayableHandSticking(strokes) {
  for (let index = 0; index < strokes.length; index += 1) {
    const stroke = strokes[index]
    if (stroke === strokes[(index + 1) % strokes.length] && stroke === strokes[(index + 2) % strokes.length]) return false
  }
  return true
}

// One candidate cycle, or null if the draw broke the rules. Nothing but single
// strokes is too plain to be worth generating, unless the cycle is too short
// to hold anything else.
export function drawHandSticking(length) {
  const cells = []
  let remaining = length
  while (remaining > 0) {
    const cell = pickWeighted(CELLS.filter((item) => item.strokes.length <= remaining))
    cells.push(cell)
    remaining -= cell.strokes.length
  }

  const strokes = cells.flatMap((cell) => cell.strokes)
  if (!isPlayableHandSticking(strokes)) return null
  if (length > 3 && cells.every((cell) => cell.name.startsWith('Single stroke'))) return null
  return cells
}
