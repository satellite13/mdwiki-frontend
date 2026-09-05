export type DiffRow = {
  kind: 'context' | 'add' | 'remove'
  before: string | null
  after: string | null
}

export function diffRows(before: string, after: string): { rows: DiffRow[]; truncated: boolean } {
  const left = before.split('\n')
  const right = after.split('\n')
  if (left.length * right.length > 4_000_000) {
    const prefix = left.findIndex((line, index) => line !== right[index])
    const same = prefix < 0 ? Math.min(left.length, right.length) : prefix
    return {
      truncated: true,
      rows: [
        ...left.slice(0, same).map(line => ({ kind: 'context' as const, before: line, after: line })),
        ...left.slice(same, same + 2000).map(line => ({ kind: 'remove' as const, before: line, after: null })),
        ...right.slice(same, same + 2000).map(line => ({ kind: 'add' as const, before: null, after: line })),
      ],
    }
  }
  const lengths = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1))
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lengths[i]![j] = left[i] === right[j]
        ? lengths[i + 1]![j + 1]! + 1
        : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
    }
  }
  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      rows.push({ kind: 'context', before: left[i]!, after: right[j]! }); i++; j++
    } else if (i < left.length && j < right.length && lengths[i + 1]![j] === lengths[i]![j + 1]) {
      rows.push({ kind: 'remove', before: left[i++]!, after: null })
      rows.push({ kind: 'add', before: null, after: right[j++]! })
    } else if (j < right.length && (i === left.length || lengths[i]![j + 1]! >= lengths[i + 1]![j]!)) {
      rows.push({ kind: 'add', before: null, after: right[j++]! })
    } else {
      rows.push({ kind: 'remove', before: left[i++]!, after: null })
    }
  }
  return { rows, truncated: false }
}
